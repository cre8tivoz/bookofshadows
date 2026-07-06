from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from providers.mempalace import MemPalaceProvider


def make_palace(root: Path) -> Path:
    """Create a minimal MemPalace v3.x ChromaDB structure for testing.

    Returns the mempalace config dir (parent of config.json).
    """
    mp_dir = root / "mempalace"
    mp_dir.mkdir(parents=True, exist_ok=True)

    palace_dir = mp_dir / "palace"
    palace_dir.mkdir(parents=True, exist_ok=True)

    # config.json with palace_path
    (mp_dir / "config.json").write_text(
        json.dumps({
            "palace_path": str(palace_dir),
            "collection_name": "mempalace_drawers",
        }),
        encoding="utf-8",
    )

    # ChromaDB SQLite with the real schema
    chroma_db = palace_dir / "chroma.sqlite3"
    with sqlite3.connect(chroma_db) as con:
        con.executescript("""
            CREATE TABLE collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                dimension INTEGER,
                database_id TEXT
            );
            CREATE TABLE segments (
                id TEXT PRIMARY KEY,
                collection_id TEXT,
                file_path TEXT
            );
            CREATE TABLE embeddings (
                id INTEGER PRIMARY KEY,
                segment_id TEXT NOT NULL,
                embedding_id TEXT NOT NULL,
                seq_id BLOB NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE embedding_metadata (
                id INTEGER REFERENCES embeddings(id),
                key TEXT NOT NULL,
                string_value TEXT,
                int_value INTEGER,
                float_value REAL,
                bool_value INTEGER,
                PRIMARY KEY (id, key)
            );
        """)

        # Insert a collection (not strictly needed since we filter by
        # embedding_id prefix, but realistic)
        con.execute(
            "INSERT INTO collections(id, name, dimension) VALUES (?, ?, ?)",
            ("c1", "mempalace_drawers", 384),
        )

        # Insert 3 drawers and 1 closet
        for i, (emb_id, wing, room, hall, content) in enumerate([
            (
                "drawer_yc_projects_general_aaa111",
                "yc-projects",
                "general",
                "technical",
                "YC prefers local-only memory storage",
            ),
            (
                "drawer_yc_projects_general_bbb222",
                "yc-projects",
                "general",
                "technical",
                "YC uses Obsidian for note-taking",
            ),
            (
                "drawer_yc_projects_notes_ccc333",
                "yc-projects",
                "notes",
                "creative",
                "MemPalace is a memory palace for AI agents",
            ),
            (
                "closet_yc_projects_summary_ddd444",
                "yc-projects",
                "general",
                "technical",
                "Summary: YC project values local-first memory",
            ),
        ]):
            con.execute(
                "INSERT INTO embeddings(id, segment_id, embedding_id, seq_id) "
                "VALUES (?, ?, ?, ?)",
                (i, "seg1", emb_id, b"\x00"),
            )
            for key, val in [
                ("wing", wing),
                ("room", room),
                ("hall", hall),
                ("chroma:document", content),
                ("filed_at", "2026-01-01T00:00:00"),
                ("source_file", f"/test/{room}.md"),
                ("added_by", "mempalace"),
            ]:
                con.execute(
                    "INSERT INTO embedding_metadata(id, key, string_value) "
                    "VALUES (?, ?, ?)",
                    (i, key, val),
                )

    # Knowledge graph SQLite
    kg_db = mp_dir / "knowledge_graph.sqlite3"
    with sqlite3.connect(kg_db) as con:
        con.executescript("""
            CREATE TABLE entities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'unknown',
                properties TEXT DEFAULT '{}',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE triples (
                id TEXT PRIMARY KEY,
                subject TEXT NOT NULL,
                predicate TEXT NOT NULL,
                object TEXT NOT NULL,
                valid_from TEXT,
                valid_to TEXT,
                confidence REAL DEFAULT 1.0,
                source_closet TEXT,
                source_file TEXT,
                source_drawer_id TEXT,
                adapter_name TEXT,
                extracted_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        """)
        con.execute(
            "INSERT INTO entities(id, name, type) VALUES (?, ?, ?)",
            ("yc", "YC", "concept"),
        )
        con.execute(
            "INSERT INTO entities(id, name, type) VALUES (?, ?, ?)",
            ("local-only memory", "local-only memory", "concept"),
        )
        con.execute(
            "INSERT INTO triples(id, subject, predicate, object, valid_from, confidence) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                "t1",
                "YC",
                "prefers",
                "local-only memory",
                "2026-01-01T00:00:00",
                0.95,
            ),
        )

    return mp_dir


# ── tests ────────────────────────────────────────────────────────────


def test_detect_finds_config(tmp_path, monkeypatch):
    mp_dir = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(mp_dir))
    assert MemPalaceProvider.detect() is True


def test_detect_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("MEMPALACE_DIR", str(tmp_path / "nonexistent"))
    monkeypatch.delenv("MEMPALACE_CONFIG", raising=False)
    monkeypatch.setenv("HOME", str(tmp_path / "empty_home"))
    assert MemPalaceProvider.detect() is False


def test_initialize_returns_health(tmp_path, monkeypatch):
    mp_dir = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(mp_dir))
    provider = MemPalaceProvider()
    health = provider.initialize()
    assert health.status == "ok"
    assert health.row_count >= 1


def test_query_returns_rows(tmp_path, monkeypatch):
    mp_dir = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(mp_dir))
    provider = MemPalaceProvider()
    provider.initialize()
    rows = provider.query("local-only")
    assert len(rows) >= 1
    assert any("local-only" in r.content for r in rows)


def test_get_counts(tmp_path, monkeypatch):
    mp_dir = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(mp_dir))
    provider = MemPalaceProvider()
    provider.initialize()
    counts = provider.get_counts()
    assert "total" in counts
    assert counts["wings"] == 1
    assert counts["triples"] == 1
    assert counts["drawers"] == 3
    assert counts["closets"] == 1
    assert counts["total"] == 5  # 3 drawers + 1 closet + 1 triple


def test_graph_edges_from_kg(tmp_path, monkeypatch):
    mp_dir = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(mp_dir))
    provider = MemPalaceProvider()
    provider.initialize()
    edges = provider.get_graph_edges()
    assert edges is not None
    assert len(edges) >= 1
    edge = edges[0]
    assert edge.source == "YC"
    assert edge.predicate == "prefers"
    assert edge.target == "local-only memory"


def test_timeline_from_valid_from(tmp_path, monkeypatch):
    mp_dir = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(mp_dir))
    provider = MemPalaceProvider()
    provider.initialize()
    timeline = provider.get_timeline()
    assert timeline is not None
    assert len(timeline) >= 1
    entry = timeline[0]
    assert entry.timestamp == "2026-01-01T00:00:00"
    assert "YC" in entry.content
