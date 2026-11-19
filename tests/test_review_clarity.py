"""Focused regression tests: review counts and backlog chart must agree."""

import sqlite3
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dashboard_core import DashboardStore  # noqa: E402


def _make_clarity_db(path: Path) -> None:
    """Minimal store with only synthetic rows used by these assertions."""
    con = sqlite3.connect(path)
    con.executescript(
        """
        CREATE TABLE working_memory (
            id TEXT PRIMARY KEY, content TEXT NOT NULL, source TEXT, timestamp TEXT,
            session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5,
            metadata_json TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL,
            valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL,
            scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT,
            veracity TEXT DEFAULT 'unknown'
        );
        CREATE TABLE episodic_memory (
            rowid INTEGER PRIMARY KEY AUTOINCREMENT,
            id TEXT UNIQUE NOT NULL, content TEXT NOT NULL, source TEXT, timestamp TEXT,
            session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5,
            metadata_json TEXT, summary_of TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL,
            valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL,
            scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT,
            veracity TEXT DEFAULT 'unknown', tier INTEGER DEFAULT 1, degraded_at TEXT
        );
        """
    )
    today = datetime.now(UTC).replace(tzinfo=None).date().isoformat() + "T00:00:00"
    rows = [
        # Contaminated active rows straddling the high-importance threshold.
        ("wm_050", "Exactly 0.5", "preference", today, 0.5, "inferred"),
        ("wm_060", "Above 0.5", "preference", today, 0.6, "inferred"),
    ]
    con.executemany(
        "INSERT INTO working_memory(id,content,source,timestamp,importance,veracity) VALUES (?,?,?,?,?,?)",
        rows,
    )
    # Tier-3 episodic row with NO degraded_at: must not be counted as degraded.
    con.execute(
        "INSERT INTO episodic_memory(id,content,source,timestamp,importance,veracity,tier,degraded_at) "
        "VALUES (?,?,?,?,?,?,?,?)",
        ("em_tier3", "Cold but never compressed", "task", today, 0.5, "stated", 3, None),
    )
    con.commit()
    con.close()


def test_importance_threshold_and_degraded_definition_match_series(tmp_path):
    db = tmp_path / "clarity.db"
    _make_clarity_db(db)
    store = DashboardStore(db)

    queues = store.review_queues(queue="high_importance_contaminated", limit=10)
    series = store.review_backlog_series(days=7)

    # Queue: importance exactly 0.5 is excluded, 0.6 is included.
    assert queues["counts"]["high_importance_contaminated"] == 1
    assert [item["id"] for item in queues["queues"]["high_importance_contaminated"]["items"]] == ["wm_060"]

    # Series must use the SAME > 0.5 definition as the queue.
    assert series["by_queue"]["high_value"][-1] == queues["counts"]["high_importance_contaminated"]

    # A tier-3 row with no degraded_at is not degraded in the queue.
    degraded = store.review_queues(queue="degraded", limit=10)
    assert degraded["counts"]["degraded"] == 0

    # ...and the chart must agree with the drill-down (degraded_at != '' only).
    assert series["by_queue"]["degraded"][-1] == degraded["counts"]["degraded"]
