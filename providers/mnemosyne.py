from __future__ import annotations

from pathlib import Path
from typing import Any

from config import default_db_path
from dashboard_core import DashboardStore

from .base import (
    Edge,
    MemoryProvider,
    ProviderCapabilities,
    ProviderHealth,
    Row,
    TimelineEntry,
)


class MnemosyneProvider(MemoryProvider):
    name: str = "Mnemosyne"
    glyph: str = "🧠"
    color: str = "#7c3aed"  # purple

    def __init__(self, db_path: str | Path | None = None):
        self.db_path = Path(db_path) if db_path else default_db_path()
        self._store = DashboardStore(self.db_path)

    # ── resolver ───────────────────────────────────────────────────────
    @classmethod
    def detect(cls) -> bool:
        """True if a Mnemosyne DB exists at the default path."""
        return default_db_path().exists()

    # ── ABC implementation ────────────────────────────────────────────
    def initialize(self) -> ProviderHealth:
        if not self.db_path.exists():
            return ProviderHealth("error", 0, f"DB not found: {self.db_path}")
        try:
            counts = self.get_counts()
            total = counts.get("total", 0)
            msg = f"{total} memories" if total else "connected, no memories"
            return ProviderHealth("ok", total, msg)
        except Exception as e:
            return ProviderHealth("error", 0, str(e))

    def query(self, search: str, limit: int = 100) -> list[Row]:
        rows = self._store.list_memories(q=search, limit=limit)
        return [self._to_row(r) for r in rows]

    def get_counts(self) -> dict[str, int]:
        stats = self._store.stats()
        counts = stats.get("counts", {})
        return {"total": sum(counts.values()), **counts}

    def get_graph_edges(self, limit: int = 500) -> list[Edge] | None:
        with self._store.connect() as con:
            rows = con.execute(
                "SELECT subject, predicate, object, confidence FROM triples LIMIT ?",
                (limit,),
            ).fetchall()
            return [Edge(r[0], r[1], r[2], r[3] or 1.0) for r in rows]

    def get_timeline(self, limit: int = 200) -> list[TimelineEntry] | None:
        memories = self._store.list_memories(kind="all", sort="recent", limit=limit)
        return [TimelineEntry(
            id=str(m.get("id", "")),
            content=str(m.get("content", "")),
            timestamp=str(m.get("timestamp") or m.get("created_at", "")),
            kind=str(m.get("memory_kind", "working")),
        ) for m in memories]

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(search=True, graph=True, timeline=True, editable=False)

    # ── helpers ───────────────────────────────────────────────────────
    @staticmethod
    def _to_row(d: dict[str, Any]) -> Row:
        meta = {}
        if d.get("metadata_json"):
            import json
            try:
                meta = json.loads(d["metadata_json"])
            except Exception:
                meta = {}
        return Row(
            id=str(d.get("id", "")),
            content=str(d.get("content", "")),
            timestamp=str(d.get("timestamp", "")),
            source=str(d.get("source", "")),
            kind=str(d.get("memory_kind", "working")),
            metadata=meta,
            veracity=str(d.get("veracity", "unknown")),
            importance=float(d.get("importance", 0.5)),
        )


class MnemosyneDashboardStore:
    """Backward-compatible facade so server.py handlers don't need changes."""

    def __init__(self, db_path):
        self._provider = MnemosyneProvider(db_path if db_path != default_db_path() else None)
        self._store = self._provider._store

    def __getattr__(self, name: str) -> Any:
        return getattr(self._store, name)
