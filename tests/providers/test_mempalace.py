from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from providers.mempalace import MemPalaceProvider


def make_palace(root: Path) -> Path:
    """Create a minimal MemPalace palace structure for testing.

    Returns the palace root directory (parent of config.json).
    """
    palace_root = root / "mempalace"
    palace_root.mkdir(parents=True, exist_ok=True)

    # config.json
    (palace_root / "config.json").write_text(
        json.dumps({"version": "1.0", "name": "test-palace"}),
        encoding="utf-8",
    )

    # wing_config.json
    (palace_root / "wing_config.json").write_text(
        json.dumps({"yc-projects": "palaces/yc-projects"}),
        encoding="utf-8",
    )

    # palaces/yc-projects/
    wing_path = palace_root / "palaces" / "yc-projects"
    wing_path.mkdir(parents=True, exist_ok=True)

    # kg.db with triples table
    kg_db = wing_path / "kg.db"
    with sqlite3.connect(kg_db) as con:
        con.execute("""
            CREATE TABLE triples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT NOT NULL,
                predicate TEXT NOT NULL,
                object TEXT NOT NULL,
                valid_from TEXT NOT NULL,
                valid_until TEXT,
                weight REAL DEFAULT 1.0,
                source TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        con.execute(
            "INSERT INTO triples(subject, predicate, object, valid_from, source, weight) VALUES (?, ?, ?, ?, ?, ?)",
            ("YC", "prefers", "local-only memory", "2026-01-01T00:00:00", "test", 0.95),
        )
        con.commit()

    # rooms.json (empty rooms dict)
    (wing_path / "rooms.json").write_text(
        json.dumps({}),
        encoding="utf-8",
    )

    # rooms/ directory with a room containing drawers.json
    rooms_dir = wing_path / "rooms" / "general"
    rooms_dir.mkdir(parents=True, exist_ok=True)
    (rooms_dir / "drawers.json").write_text(
        json.dumps([
            "YC prefers local-only memory storage",
            "YC uses Obsidian for note-taking",
        ]),
        encoding="utf-8",
    )
    (rooms_dir / "closets.json").write_text(
        json.dumps(["summary of local-only preference"]),
        encoding="utf-8",
    )

    return palace_root


# ── tests ────────────────────────────────────────────────────────────


def test_detect_finds_config(tmp_path, monkeypatch):
    palace_root = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(palace_root))
    assert MemPalaceProvider.detect() is True


def test_detect_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("MEMPALACE_DIR", str(tmp_path / "nonexistent"))
    monkeypatch.delenv("MEMPALACE_CONFIG", raising=False)
    # Override HOME to an empty temp path so ~/.mempalace doesn't exist
    monkeypatch.setenv("HOME", str(tmp_path / "empty_home"))
    assert MemPalaceProvider.detect() is False


def test_initialize_returns_health(tmp_path, monkeypatch):
    palace_root = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(palace_root))
    provider = MemPalaceProvider()
    health = provider.initialize()
    assert health.status == "ok"
    assert health.row_count >= 1


def test_query_returns_rows(tmp_path, monkeypatch):
    palace_root = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(palace_root))
    provider = MemPalaceProvider()
    provider.initialize()
    rows = provider.query("local-only")
    assert len(rows) >= 1
    # At least one row should contain the search term
    assert any("local-only" in r.content for r in rows)


def test_get_counts(tmp_path, monkeypatch):
    palace_root = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(palace_root))
    provider = MemPalaceProvider()
    provider.initialize()
    counts = provider.get_counts()
    assert "total" in counts
    assert counts["wings"] == 1
    assert counts["triples"] == 1
    assert counts["drawers"] == 2
    assert counts["closets"] == 1
    assert counts["total"] >= 4


def test_graph_edges_from_kg(tmp_path, monkeypatch):
    palace_root = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(palace_root))
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
    palace_root = make_palace(tmp_path)
    monkeypatch.setenv("MEMPALACE_DIR", str(palace_root))
    provider = MemPalaceProvider()
    provider.initialize()
    timeline = provider.get_timeline()
    assert timeline is not None
    assert len(timeline) >= 1
    entry = timeline[0]
    assert entry.timestamp == "2026-01-01T00:00:00"
    assert "YC" in entry.content
