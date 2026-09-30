from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path
from unittest.mock import patch

# Ensure the project root is on sys.path so `providers` is importable
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from providers.base import Edge, Row, TimelineEntry
from providers.mnemosyne import MnemosyneDashboardStore, MnemosyneProvider


def make_mnemosyne_db(db_path: Path, populate: bool = True) -> Path:
    """Create a minimal SQLite Mnemosyne DB for testing."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as con:
        con.executescript("""
            CREATE TABLE working_memory (
                id TEXT PRIMARY KEY,
                content TEXT,
                source TEXT,
                timestamp TEXT,
                session_id TEXT,
                importance REAL,
                metadata_json TEXT,
                created_at TEXT,
                recall_count INTEGER,
                last_recalled TEXT,
                valid_until TEXT,
                superseded_by TEXT,
                scope TEXT,
                author_id TEXT,
                author_type TEXT,
                channel_id TEXT,
                veracity TEXT
            );

            CREATE TABLE episodic_memory (
                id TEXT PRIMARY KEY,
                content TEXT,
                source TEXT,
                timestamp TEXT,
                session_id TEXT,
                importance REAL,
                metadata_json TEXT,
                created_at TEXT,
                recall_count INTEGER,
                last_recalled TEXT,
                valid_until TEXT,
                superseded_by TEXT,
                scope TEXT,
                author_id TEXT,
                author_type TEXT,
                channel_id TEXT,
                veracity TEXT,
                tier INTEGER,
                degraded_at TEXT
            );

            CREATE TABLE triples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT NOT NULL,
                predicate TEXT NOT NULL,
                object TEXT NOT NULL,
                confidence REAL,
                valid_from TEXT,
                valid_until TEXT,
                source TEXT,
                created_at TEXT
            );
        """)

        if populate:
            con.execute(
                """
                INSERT INTO working_memory (id, content, source, timestamp, importance, metadata_json, veracity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "wm1",
                    "User prefers Python 3.11",
                    "chat",
                    "2026-01-01T10:00:00",
                    0.9,
                    json.dumps({"category": "preferences"}),
                    "stated",
                ),
            )

            con.execute(
                """
                INSERT INTO episodic_memory (id, content, source, timestamp, importance, veracity, tier)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "em1",
                    "User discussed memory architectures",
                    "chat",
                    "2025-12-01T10:00:00",
                    0.7,
                    "stated",
                    1,
                ),
            )

            con.execute(
                """
                INSERT INTO triples (subject, predicate, object, confidence)
                VALUES (?, ?, ?, ?)
                """,
                ("User", "prefers", "Python 3.11", 0.95),
            )
            con.execute(
                """
                INSERT INTO triples (subject, predicate, object, confidence)
                VALUES (?, ?, ?, ?)
                """,
                ("User", "uses", "Mnemosyne", None),
            )

    return db_path


# ── tests ────────────────────────────────────────────────────────────────


class TestMnemosyneInitAndDetect:
    def test_init_default_db_path(self, monkeypatch, tmp_path):
        expected_default = tmp_path / "default_mnemosyne.db"
        monkeypatch.setattr("providers.mnemosyne.default_db_path", lambda: expected_default)

        provider = MnemosyneProvider()
        assert provider.db_path == expected_default

    def test_init_custom_db_path(self, tmp_path):
        custom_path = tmp_path / "custom.db"
        provider = MnemosyneProvider(db_path=custom_path)
        assert provider.db_path == custom_path
        assert provider.db_path == Path(custom_path)

    def test_detect_true_when_db_exists(self, monkeypatch, tmp_path):
        existing_db = tmp_path / "exists.db"
        existing_db.touch()
        monkeypatch.setattr("providers.mnemosyne.default_db_path", lambda: existing_db)

        assert MnemosyneProvider.detect() is True

    def test_detect_false_when_db_missing(self, monkeypatch, tmp_path):
        missing_db = tmp_path / "missing.db"
        monkeypatch.setattr("providers.mnemosyne.default_db_path", lambda: missing_db)

        assert MnemosyneProvider.detect() is False


class TestMnemosyneInitializeAndCapabilities:
    def test_initialize_error_when_db_not_found(self, tmp_path):
        missing_db = tmp_path / "nonexistent.db"
        provider = MnemosyneProvider(db_path=missing_db)

        health = provider.initialize()
        assert health.status == "error"
        assert health.row_count == 0
        assert f"DB not found: {missing_db}" in health.message

    def test_initialize_ok_with_memories(self, tmp_path):
        db_path = make_mnemosyne_db(tmp_path / "test.db")
        provider = MnemosyneProvider(db_path=db_path)

        health = provider.initialize()
        assert health.status == "ok"
        assert health.row_count == 4
        assert "4 memories" in health.message

    def test_initialize_ok_with_zero_memories(self, tmp_path):
        empty_db = make_mnemosyne_db(tmp_path / "empty.db", populate=False)

        provider = MnemosyneProvider(db_path=empty_db)
        health = provider.initialize()
        assert health.status == "ok"
        assert health.row_count == 0
        assert health.message == "connected, no memories"

    def test_initialize_exception_handling(self, tmp_path):
        db_path = tmp_path / "corrupt.db"
        db_path.touch()
        provider = MnemosyneProvider(db_path=db_path)

        # Patch get_counts on provider to raise an error
        with patch.object(provider, "get_counts", side_effect=Exception("Database error")):
            health = provider.initialize()
            assert health.status == "error"
            assert health.row_count == 0
            assert health.message == "Database error"

    def test_capabilities(self, tmp_path):
        provider = MnemosyneProvider(db_path=tmp_path / "test.db")
        caps = provider.capabilities()

        assert caps.search is True
        assert caps.graph is True
        assert caps.timeline is True
        assert caps.editable is False


class TestMnemosyneQueriesAndHelpers:
    def test_query_returns_rows(self, tmp_path):
        db_path = make_mnemosyne_db(tmp_path / "test.db")
        provider = MnemosyneProvider(db_path=db_path)

        rows = provider.query("Python")
        assert len(rows) == 1
        assert isinstance(rows[0], Row)
        assert rows[0].id == "wm1"
        assert rows[0].content == "User prefers Python 3.11"
        assert rows[0].source == "chat"
        assert rows[0].kind == "working"
        assert rows[0].metadata == {"category": "preferences"}
        assert rows[0].veracity == "stated"
        assert rows[0].importance == 0.9

    def test_get_counts(self, tmp_path):
        db_path = make_mnemosyne_db(tmp_path / "test.db")
        provider = MnemosyneProvider(db_path=db_path)

        counts = provider.get_counts()
        assert "total" in counts
        assert counts["working_memory"] == 1
        assert counts["episodic_memory"] == 1
        assert counts["triples"] == 2
        assert counts["total"] == counts["working_memory"] + counts["episodic_memory"] + counts["triples"]

    def test_get_graph_edges(self, tmp_path):
        db_path = make_mnemosyne_db(tmp_path / "test.db")
        provider = MnemosyneProvider(db_path=db_path)

        edges = provider.get_graph_edges()
        assert edges is not None
        assert len(edges) == 2

        assert isinstance(edges[0], Edge)
        assert edges[0].source == "User"
        assert edges[0].predicate == "prefers"
        assert edges[0].target == "Python 3.11"
        assert edges[0].confidence == 0.95

        # Test default confidence fallback when None in DB
        assert edges[1].source == "User"
        assert edges[1].predicate == "uses"
        assert edges[1].target == "Mnemosyne"
        assert edges[1].confidence == 1.0

    def test_get_timeline(self, tmp_path):
        db_path = make_mnemosyne_db(tmp_path / "test.db")
        provider = MnemosyneProvider(db_path=db_path)

        timeline = provider.get_timeline()
        assert timeline is not None
        assert len(timeline) == 2

        assert isinstance(timeline[0], TimelineEntry)
        contents = [entry.content for entry in timeline]
        assert "User prefers Python 3.11" in contents
        assert "User discussed memory architectures" in contents

    def test_to_row_parsing(self):
        # Test valid JSON metadata
        d_valid = {
            "id": "1",
            "content": "test",
            "timestamp": "2026-01-01",
            "source": "cli",
            "memory_kind": "working",
            "metadata_json": '{"key": "val"}',
            "veracity": "stated",
            "importance": 0.8,
        }
        row1 = MnemosyneProvider._to_row(d_valid)
        assert row1.metadata == {"key": "val"}
        assert row1.importance == 0.8

        # Test invalid JSON metadata fallback
        d_invalid = {
            "id": "2",
            "content": "test2",
            "metadata_json": "invalid-json",
        }
        row2 = MnemosyneProvider._to_row(d_invalid)
        assert row2.metadata == {}
        assert row2.veracity == "unknown"
        assert row2.importance == 0.5
        assert row2.kind == "working"


class TestMnemosyneDashboardStoreFacade:
    def test_facade_delegates_to_store(self, tmp_path):
        db_path = make_mnemosyne_db(tmp_path / "test.db")
        facade = MnemosyneDashboardStore(db_path=db_path)

        assert facade._provider is not None
        assert facade._store is not None
        # test __getattr__ delegation
        stats = facade.stats()
        assert "counts" in stats
