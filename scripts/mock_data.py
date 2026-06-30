#!/usr/bin/env python3

"""Fictional Mnemosyne data used by local baseline tools.

The helpers in this file intentionally create a temporary SQLite database with
mock records. They never read the user's real Mnemosyne database.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path


def make_mock_db(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE working_memory (
            id TEXT PRIMARY KEY, content TEXT NOT NULL, source TEXT, timestamp TEXT,
            session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5,
            metadata_json TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL,
            valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL,
            scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT
        );
        CREATE TABLE episodic_memory (
            rowid INTEGER PRIMARY KEY AUTOINCREMENT,
            id TEXT UNIQUE NOT NULL, content TEXT NOT NULL, source TEXT, timestamp TEXT,
            session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5,
            metadata_json TEXT, summary_of TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL,
            valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL,
            scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT
        );
        CREATE TABLE triples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL, predicate TEXT NOT NULL, object TEXT NOT NULL,
            valid_from TEXT NOT NULL, valid_until TEXT, source TEXT, confidence REAL DEFAULT 1.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE consolidation_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, items_consolidated INTEGER,
            summary_preview TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    working = [
        (
            "wm-001",
            "User prefers local-first memory tools with clear provenance, fast search, and no cloud calls for private chat data.",
            "preference",
            "2026-05-04T08:15:00",
            "product_strategy_20260504",
            0.92,
            "global",
            7,
        ),
        (
            "wm-002",
            "The Mnemosyne dashboard should feel premium on mobile, with compact controls, readable cards, and zero horizontal overflow.",
            "insight",
            "2026-05-04T09:30:00",
            "design_review_20260504",
            0.86,
            "session",
            5,
        ),
        (
            "wm-003",
            "Use token-prefix search: 'Dian' should match Diana but not the middle of Obsidian.",
            "debugging",
            "2026-05-04T10:05:00",
            "search_quality_20260504",
            0.81,
            "global",
            4,
        ),
        (
            "wm-004",
            "Graph view should make relationships explorable without exposing write actions in the browser.",
            "security",
            "2026-05-04T10:45:00",
            "graph_review_20260504",
            0.74,
            "global",
            3,
        ),
        (
            "wm-005",
            "Short phone-landscape screens should keep the compact top bar and avoid desktop sidebar takeover.",
            "ux",
            "2026-05-04T11:20:00",
            "mobile_layout_20260504",
            0.79,
            "session",
            6,
        ),
        (
            "wm-006",
            "Settings should keep authentication optional and transparent: disabled by default, password stored as salt/hash only.",
            "security",
            "2026-05-04T12:00:00",
            "auth_review_20260504",
            0.69,
            "global",
            2,
        ),
    ]
    con.executemany(
        "INSERT INTO working_memory(id,content,source,timestamp,session_id,importance,scope,recall_count) VALUES (?,?,?,?,?,?,?,?)",
        working,
    )
    episodic = [
        (
            "em-001",
            "Published the dashboard as a GitHub-ready Hermes plugin with README, CI, license, security notes, and read-only SQLite access.",
            "task",
            "2026-05-03T17:25:34",
            "release_hardening_20260503",
            0.77,
            "session",
            "wm-001,wm-004",
            3,
        ),
        (
            "em-002",
            "Refined the mobile overview so stat cards, memory pills, and long session identifiers fit within the viewport.",
            "task",
            "2026-05-04T09:45:00",
            "mobile_layout_20260504",
            0.72,
            "session",
            "wm-002,wm-005",
            5,
        ),
        (
            "em-003",
            "Tightened search behavior across Memories, Global Search, Recall Debugger, Timeline, Graph, Triples, and Consolidations.",
            "debugging",
            "2026-05-04T10:50:00",
            "search_quality_20260504",
            0.83,
            "global",
            "wm-003",
            4,
        ),
        (
            "em-004",
            "Added a visible mobile top-bar theme toggle while keeping the desktop sidebar theme switch in sync.",
            "ux",
            "2026-05-04T12:06:00",
            "design_review_20260504",
            0.68,
            "session",
            "wm-002,wm-005",
            2,
        ),
    ]
    con.executemany(
        "INSERT INTO episodic_memory(id,content,source,timestamp,session_id,importance,scope,summary_of,recall_count) VALUES (?,?,?,?,?,?,?,?,?)",
        episodic,
    )
    triples = [
        ("Mnemosyne Dashboard", "reads", "SQLite memory store", "2026-05-03", "architecture", 0.98),
        ("Mnemosyne Dashboard", "serves", "local web UI", "2026-05-03", "architecture", 0.96),
        ("Local web UI", "supports", "dark theme", "2026-05-04", "design", 0.94),
        ("Local web UI", "supports", "light theme", "2026-05-04", "design", 0.94),
        ("Search", "uses", "token-prefix matching", "2026-05-04", "debugging", 0.91),
        ("Graph", "visualizes", "triples", "2026-05-04", "feature", 0.89),
        ("Timeline", "groups by", "session", "2026-05-04", "feature", 0.88),
        ("Settings", "controls", "optional password auth", "2026-05-04", "security", 0.87),
        ("Mobile header", "contains", "theme toggle", "2026-05-04", "ux", 0.85),
        ("Dashboard", "avoids", "external JavaScript dependencies", "2026-05-03", "security", 0.93),
    ]
    con.executemany(
        "INSERT INTO triples(subject,predicate,object,valid_from,source,confidence) VALUES (?,?,?,?,?,?)",
        triples,
    )
    consolidations = [
        ("release_hardening_20260503", 8, "Repository publication checklist: README, CI, security headers, path traversal tests."),
        ("mobile_layout_20260504", 14, "Mobile layout fixes for overview cards, top bar, timeline headers, and landscape mode."),
        ("search_quality_20260504", 6, "Search semantics consolidated around token-prefix behavior and shared backend helpers."),
        ("design_review_20260504", 5, "Theme switch moved into mobile top bar; brand spacing adjusted for script M overhang."),
    ]
    con.executemany(
        "INSERT INTO consolidation_log(session_id,items_consolidated,summary_preview) VALUES (?,?,?)",
        consolidations,
    )
    con.commit()
    con.close()
