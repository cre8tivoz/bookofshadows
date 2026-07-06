from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

from .base import (
    Edge,
    MemoryProvider,
    ProviderCapabilities,
    ProviderHealth,
    Row,
    TimelineEntry,
)


def _aaak_decompress(data: str) -> str:
    """Minimal AAAK decompression stub.

    The real MemPalace SDK provides a full decoder; this handles the
    trivial pass-through case used in tests (uncompressed JSON strings).
    """
    if not data:
        return ""
    return data


# ── SQL fragments reused across queries ────────────────────────────────

# The segments table may be empty (ChromaDB version differences), so we
# distinguish drawers from closets by the embedding_id prefix instead of
# joining through segments → collections.

_DRAWER_FILTER = "e.embedding_id LIKE 'drawer_%'"
_CLOSET_FILTER = "e.embedding_id LIKE 'closet_%'"

_WING_COUNT_SQL = f"""
    SELECT em.string_value AS wing, COUNT(*) AS cnt
    FROM embedding_metadata em
    JOIN embeddings e ON em.id = e.id
    WHERE em.key = 'wing' AND {_DRAWER_FILTER}
    GROUP BY em.string_value
    ORDER BY cnt DESC
"""

_SEARCH_DRAWERS_SQL = f"""
    SELECT e.embedding_id,
           em_doc.string_value AS content,
           em_wing.string_value AS wing,
           em_room.string_value AS room,
           em_hall.string_value AS hall,
           em_filed.string_value AS filed_at,
           em_source.string_value AS source_file
    FROM embeddings e
    LEFT JOIN embedding_metadata em_doc
        ON em_doc.id = e.id AND em_doc.key = 'chroma:document'
    LEFT JOIN embedding_metadata em_wing
        ON em_wing.id = e.id AND em_wing.key = 'wing'
    LEFT JOIN embedding_metadata em_room
        ON em_room.id = e.id AND em_room.key = 'room'
    LEFT JOIN embedding_metadata em_hall
        ON em_hall.id = e.id AND em_hall.key = 'hall'
    LEFT JOIN embedding_metadata em_filed
        ON em_filed.id = e.id AND em_filed.key = 'filed_at'
    LEFT JOIN embedding_metadata em_source
        ON em_source.id = e.id AND em_source.key = 'source_file'
    WHERE {_DRAWER_FILTER}
      AND (
          LOWER(em_doc.string_value) LIKE :q
          OR LOWER(em_room.string_value) LIKE :q
          OR LOWER(em_source.string_value) LIKE :q
      )
    LIMIT :limit
"""

_SEARCH_CLOSETS_SQL = f"""
    SELECT e.embedding_id,
           em_doc.string_value AS content,
           em_wing.string_value AS wing,
           em_room.string_value AS room,
           em_filed.string_value AS filed_at
    FROM embeddings e
    LEFT JOIN embedding_metadata em_doc
        ON em_doc.id = e.id AND em_doc.key = 'chroma:document'
    LEFT JOIN embedding_metadata em_wing
        ON em_wing.id = e.id AND em_wing.key = 'wing'
    LEFT JOIN embedding_metadata em_room
        ON em_room.id = e.id AND em_room.key = 'room'
    LEFT JOIN embedding_metadata em_filed
        ON em_filed.id = e.id AND em_filed.key = 'filed_at'
    WHERE {_CLOSET_FILTER}
      AND LOWER(em_doc.string_value) LIKE :q
    LIMIT :limit
"""


class MemPalaceProvider(MemoryProvider):
    """Read adapter for the MemPalace memory store.

    Reads directly from MemPalace v3.x ChromaDB SQLite storage and the
    knowledge graph database.  Wings are metadata fields on ChromaDB
    embeddings, not filesystem directories.
    """

    name: str = "MemPalace"
    glyph: str = "🏰"
    color: str = "#f59e0b"  # amber

    def __init__(self, config_path: str | Path | None = None):
        self._config_path = Path(config_path) if config_path else None
        self._palace_root: Path | None = None  # dir containing chroma.sqlite3
        self._chroma_db: Path | None = None
        self._kg_db: Path | None = None
        self._wings: dict[str, int] = {}  # wing_name -> drawer count
        # Lazy-loaded gate so detect() can short-circuit cleanly.
        self._sdk_available = False
        try:
            import mempalace  # noqa: F401

            self._sdk_available = True
        except ImportError:
            self._sdk_available = False

    # ── config resolution ─────────────────────────────────────────────
    @staticmethod
    def _resolve_config() -> Path | None:
        """Return the resolved config path using the chain:
        1. MEMPALACE_DIR env (look for config.json inside)
        2. MEMPALACE_CONFIG env (direct path to config.json)
        3. ~/.mempalace/config.json
        """
        env_dir = os.environ.get("MEMPALACE_DIR")
        if env_dir:
            p = Path(env_dir) / "config.json"
            if p.exists():
                return p
        env_cfg = os.environ.get("MEMPALACE_CONFIG")
        if env_cfg:
            p = Path(env_cfg)
            if p.exists():
                return p
        default = Path.home() / ".mempalace" / "config.json"
        if default.exists():
            return default
        return None

    # ── detector ──────────────────────────────────────────────────────
    @classmethod
    def detect(cls) -> bool:
        """True if a MemPalace config.json exists at any candidate path."""
        return cls._resolve_config() is not None

    def _ensure_resolved(self) -> None:
        if self._chroma_db is not None:
            return
        if self._config_path:
            cfg = self._config_path
        else:
            cfg = self._resolve_config()
        if cfg is None or not cfg.exists():
            raise FileNotFoundError(
                "MemPalace config not found. Set MEMPALACE_DIR or "
                "MEMPALACE_CONFIG, or create ~/.mempalace/config.json"
            )

        # Read palace_path from config.json
        try:
            config_data = json.loads(cfg.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            raise FileNotFoundError(
                f"MemPalace config.json unreadable: {e}"
            ) from e

        palace_path_str = config_data.get("palace_path")
        if palace_path_str:
            palace_path = Path(palace_path_str)
        else:
            # Fallback: look for chroma.sqlite3 next to config
            palace_path = cfg.parent

        self._palace_root = palace_path
        self._chroma_db = palace_path / "chroma.sqlite3"

        if not self._chroma_db.exists():
            raise FileNotFoundError(
                f"MemPalace ChromaDB not found at {self._chroma_db}. "
                "Set palace_path in config.json or run mempalace init."
            )

        # Knowledge graph — check next to config first, then ~/.mempalace/
        kg_next_to_config = cfg.parent / "knowledge_graph.sqlite3"
        kg_home = Path.home() / ".mempalace" / "knowledge_graph.sqlite3"
        if kg_next_to_config.exists():
            self._kg_db = kg_next_to_config
        elif kg_home.exists():
            self._kg_db = kg_home
        else:
            self._kg_db = kg_next_to_config  # default for future creation

        self._load_wings()

    def _load_wings(self) -> None:
        """Discover wings from ChromaDB metadata (key='wing')."""
        assert self._chroma_db is not None
        try:
            with sqlite3.connect(self._chroma_db) as con:
                rows = con.execute(_WING_COUNT_SQL).fetchall()
                self._wings = {wing: count for wing, count in rows}
        except sqlite3.Error:
            self._wings = {}

    # ── ABC implementation ────────────────────────────────────────────
    def initialize(self) -> ProviderHealth:
        try:
            self._ensure_resolved()
        except FileNotFoundError as e:
            return ProviderHealth("error", 0, str(e))

        try:
            counts = self.get_counts()
            total = counts.get("total", 0)
            wing_count = counts.get("wings", 0)
            msg = f"{total} memories across {wing_count} wings"
            if not self._sdk_available:
                msg += " (SDK not installed; AAAK decompression limited)"
            return ProviderHealth("ok", total, msg)
        except Exception as e:
            return ProviderHealth("error", 0, str(e))

    def query(self, search: str, limit: int = 100) -> list[Row]:
        self._ensure_resolved()
        rows: list[Row] = []
        assert self._chroma_db is not None
        search_lower = search.lower()

        try:
            with sqlite3.connect(self._chroma_db) as con:
                # Search drawer documents
                cur = con.execute(
                    _SEARCH_DRAWERS_SQL,
                    {"q": f"%{search_lower}%", "limit": limit},
                )
                for emb_id, content, wing, room, hall, filed_at, source_file in cur.fetchall():
                    wing = wing or "unknown"
                    room = room or ""
                    source = f"MemPalace:{wing}"
                    if room:
                        source += f"/{room}"
                    rows.append(
                        Row(
                            id=f"drawer:{emb_id}",
                            content=content or "",
                            timestamp=filed_at or "",
                            source=source,
                            kind="verbatim",
                            metadata={
                                "wing": wing,
                                "room": room,
                                "hall": hall or "",
                                "source_file": source_file or "",
                            },
                        )
                    )

                # Also search closet documents (compressed/summarized)
                if len(rows) < limit:
                    remaining = limit - len(rows)
                    cur = con.execute(
                        _SEARCH_CLOSETS_SQL,
                        {"q": f"%{search_lower}%", "limit": remaining},
                    )
                    for emb_id, content, wing, room, filed_at in cur.fetchall():
                        wing = wing or "unknown"
                        room = room or ""
                        source = f"MemPalace:{wing}"
                        if room:
                            source += f"/{room}"
                        rows.append(
                            Row(
                                id=f"closet:{emb_id}",
                                content=content or "",
                                timestamp=filed_at or "",
                                source=source,
                                kind="episodic",
                            )
                        )

        except sqlite3.Error:
            pass

        return rows

    def get_counts(self) -> dict[str, int]:
        self._ensure_resolved()
        assert self._chroma_db is not None

        counts: dict[str, int] = {
            "wings": len(self._wings),
            "drawers": 0,
            "closets": 0,
        }

        try:
            with sqlite3.connect(self._chroma_db) as con:
                row = con.execute(
                    f"SELECT COUNT(*) FROM embeddings e WHERE {_DRAWER_FILTER}"
                ).fetchone()
                counts["drawers"] = row[0] if row else 0

                row = con.execute(
                    f"SELECT COUNT(*) FROM embeddings e WHERE {_CLOSET_FILTER}"
                ).fetchone()
                counts["closets"] = row[0] if row else 0
        except sqlite3.Error:
            pass

        # KG triples count
        if self._kg_db and self._kg_db.exists():
            try:
                with sqlite3.connect(self._kg_db) as con:
                    row = con.execute("SELECT COUNT(*) FROM triples").fetchone()
                    counts["triples"] = row[0] if row else 0
            except sqlite3.Error:
                counts["triples"] = 0
        else:
            counts["triples"] = 0

        counts["rooms"] = 0  # Not applicable in ChromaDB model
        counts["total"] = counts["drawers"] + counts["closets"] + counts["triples"]
        return counts

    def get_graph_edges(self, limit: int = 500) -> list[Edge] | None:
        self._ensure_resolved()
        if not self._kg_db or not self._kg_db.exists():
            return None

        edges: list[Edge] = []
        try:
            with sqlite3.connect(self._kg_db) as con:
                cur = con.execute(
                    """SELECT subject, predicate, object, confidence
                       FROM triples
                       WHERE valid_to IS NULL
                       ORDER BY extracted_at DESC
                       LIMIT ?""",
                    (limit,),
                )
                for s, p, o, conf in cur.fetchall():
                    edges.append(
                        Edge(
                            source=s,
                            predicate=p,
                            target=o,
                            confidence=conf if conf is not None else 1.0,
                        )
                    )
        except sqlite3.Error:
            return None

        return edges if edges else None

    def get_timeline(self, limit: int = 200) -> list[TimelineEntry] | None:
        self._ensure_resolved()
        if not self._kg_db or not self._kg_db.exists():
            return None

        entries: list[TimelineEntry] = []
        try:
            with sqlite3.connect(self._kg_db) as con:
                cur = con.execute(
                    """SELECT id, subject, predicate, object, valid_from
                       FROM triples
                       ORDER BY valid_from DESC
                       LIMIT ?""",
                    (limit,),
                )
                for tid, s, p, o, vf in cur.fetchall():
                    entries.append(
                        TimelineEntry(
                            id=str(tid),
                            content=f"{s} {p} {o}",
                            timestamp=vf or "",
                            kind="semantic",
                        )
                    )
        except sqlite3.Error:
            return None

        return entries if entries else None

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            search=True, graph=True, timeline=True, editable=False
        )
