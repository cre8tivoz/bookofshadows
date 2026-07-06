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


class MemPalaceProvider(MemoryProvider):
    """Read adapter for the MemPalace memory store.

    Supports querying wings, rooms, knowledge graph triples, and drawers
    from a MemPalace palace directory structure.
    """

    name: str = "MemPalace"
    glyph: str = "🏰"
    color: str = "#f59e0b"  # amber

    def __init__(self, config_path: str | Path | None = None):
        self._config_path = Path(config_path) if config_path else None
        self._palace_root: Path | None = None
        self._wings: dict[str, Path] = {}
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
        if self._palace_root is not None:
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
        self._palace_root = cfg.parent
        self._load_wings()

    def _load_wings(self) -> None:
        assert self._palace_root is not None
        wing_cfg = self._palace_root / "wing_config.json"
        if wing_cfg.exists():
            data = json.loads(wing_cfg.read_text(encoding="utf-8"))
            self._wings = {
                name: self._palace_root / path
                for name, path in data.items()
            }
        else:
            # Auto-discover wings inside palaces/ directory.
            palaces_dir = self._palace_root / "palaces"
            if palaces_dir.exists():
                self._wings = {
                    p.name: p for p in palaces_dir.iterdir() if p.is_dir()
                }

    # ── ABC implementation ────────────────────────────────────────────
    def initialize(self) -> ProviderHealth:
        try:
            self._ensure_resolved()
        except FileNotFoundError as e:
            return ProviderHealth("error", 0, str(e))

        try:
            counts = self.get_counts()
            total = counts.get("total", 0)
            msg = f"{total} memories across {counts.get('wings', 0)} wings"
            if not self._sdk_available:
                msg += " (SDK not installed; AAAK decompression limited)"
            return ProviderHealth("ok", total, msg)
        except Exception as e:
            return ProviderHealth("error", 0, str(e))

    def query(self, search: str, limit: int = 100) -> list[Row]:
        self._ensure_resolved()
        rows: list[Row] = []
        search_lower = search.lower()

        for wing_name, wing_path in self._wings.items():
            if len(rows) >= limit:
                break

            # Search rooms.json
            rooms_json = wing_path / "rooms.json"
            if rooms_json.exists():
                try:
                    rooms = json.loads(rooms_json.read_text(encoding="utf-8"))
                    for room_name, room_data in rooms.items():
                        if len(rows) >= limit:
                            break
                        text = json.dumps(room_data).lower()
                        if search_lower in text:
                            rows.append(
                                Row(
                                    id=f"room:{wing_name}/{room_name}",
                                    content=room_data.get("description", room_name),
                                    source=f"MemPalace:{wing_name}",
                                    kind="episodic",
                                )
                            )
                except (json.JSONDecodeError, OSError):
                    continue

            # Search kg.db triples
            kg_db = wing_path / "kg.db"
            if kg_db.exists() and len(rows) < limit:
                try:
                    with sqlite3.connect(kg_db) as con:
                        remaining = limit - len(rows)
                        cur = con.execute(
                            """SELECT subject, predicate, object, valid_from, source
                               FROM triples
                               WHERE subject LIKE ? OR predicate LIKE ? OR object LIKE ?
                               LIMIT ?""",
                            (f"%{search}%", f"%{search}%", f"%{search}%", remaining),
                        )
                        for s, p, o, vf, src in cur.fetchall():
                            rows.append(
                                Row(
                                    id=f"triple:{s}/{p}/{o}",
                                    content=f"{s} {p} {o}",
                                    timestamp=vf or "",
                                    source=src or f"MemPalace:{wing_name}",
                                    kind="semantic",
                                )
                            )
                except sqlite3.Error:
                    continue

            # Search drawers.json files
            rooms_dir = wing_path / "rooms"
            if rooms_dir.exists() and len(rows) < limit:
                for room_dir in rooms_dir.iterdir():
                    if len(rows) >= limit:
                        break
                    drawers_json = room_dir / "drawers.json"
                    if drawers_json.exists():
                        try:
                            drawers = json.loads(
                                drawers_json.read_text(encoding="utf-8")
                            )
                            for idx, entry in enumerate(drawers):
                                if len(rows) >= limit:
                                    break
                                content = entry if isinstance(entry, str) else json.dumps(entry)
                                if search_lower in content.lower():
                                    rows.append(
                                        Row(
                                            id=f"drawer:{wing_name}/{room_dir.name}/{idx}",
                                            content=content,
                                            source=f"MemPalace:{wing_name}/{room_dir.name}",
                                            kind="verbatim",
                                        )
                                    )
                        except (json.JSONDecodeError, OSError):
                            continue

        return rows

    def get_counts(self) -> dict[str, int]:
        self._ensure_resolved()
        counts: dict[str, int] = {
            "wings": len(self._wings),
            "rooms": 0,
            "triples": 0,
            "closets": 0,
            "drawers": 0,
        }

        for wing_path in self._wings.values():
            # rooms.json entries
            rooms_json = wing_path / "rooms.json"
            if rooms_json.exists():
                try:
                    rooms = json.loads(rooms_json.read_text(encoding="utf-8"))
                    counts["rooms"] += len(rooms)
                except (json.JSONDecodeError, OSError):
                    pass

            # Closets count
            rooms_dir = wing_path / "rooms"
            if rooms_dir.exists():
                for room_dir in rooms_dir.iterdir():
                    closets_json = room_dir / "closets.json"
                    if closets_json.exists():
                        try:
                            closets = json.loads(
                                closets_json.read_text(encoding="utf-8")
                            )
                            counts["closets"] += len(closets)
                        except (json.JSONDecodeError, OSError):
                            pass

                    drawers_json = room_dir / "drawers.json"
                    if drawers_json.exists():
                        try:
                            drawers = json.loads(
                                drawers_json.read_text(encoding="utf-8")
                            )
                            counts["drawers"] += len(drawers)
                        except (json.JSONDecodeError, OSError):
                            pass

            # Triples count from kg.db
            kg_db = wing_path / "kg.db"
            if kg_db.exists():
                try:
                    with sqlite3.connect(kg_db) as con:
                        row = con.execute("SELECT COUNT(*) FROM triples").fetchone()
                        if row:
                            counts["triples"] += row[0]
                except sqlite3.Error:
                    pass

        counts["total"] = (
            counts["rooms"] + counts["triples"] + counts["closets"] + counts["drawers"]
        )
        return counts

    def get_graph_edges(self, limit: int = 500) -> list[Edge] | None:
        self._ensure_resolved()
        edges: list[Edge] = []

        for wing_path in self._wings.values():
            if len(edges) >= limit:
                break
            kg_db = wing_path / "kg.db"
            if not kg_db.exists():
                continue
            try:
                with sqlite3.connect(kg_db) as con:
                    remaining = limit - len(edges)
                    cur = con.execute(
                        """SELECT subject, predicate, object, weight
                           FROM triples LIMIT ?""",
                        (remaining,),
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
                continue

        return edges if edges else None

    def get_timeline(self, limit: int = 200) -> list[TimelineEntry] | None:
        self._ensure_resolved()
        entries: list[TimelineEntry] = []

        for wing_path in self._wings.values():
            if len(entries) >= limit:
                break
            kg_db = wing_path / "kg.db"
            if not kg_db.exists():
                continue
            try:
                with sqlite3.connect(kg_db) as con:
                    remaining = limit - len(entries)
                    cur = con.execute(
                        """SELECT id, subject, predicate, object, valid_from
                           FROM triples
                           ORDER BY valid_from DESC LIMIT ?""",
                        (remaining,),
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
                continue

        return entries if entries else None

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            search=True, graph=True, timeline=True, editable=False
        )
