# Demo Data and Screenshots

The repo includes fictional mock data helpers for screenshots, smoke tests, and public documentation. They never read the user's real Mnemosyne database.

## Mock Database

`scripts/mock_data.py` creates a temporary SQLite database with:

- working and episodic memories,
- triples,
- consolidation log rows,
- varied sources, sessions, scopes, and recall counts,
- recent-relative timestamps so the Insights tab has visible 7/30/90-day data.

## Mock Audit Log

The screenshot generator also writes a fictional `audit.jsonl` under a temporary `HERMES_HOME`:

```text
/tmp/mnemosyne-dashboard-screenshots/hermes-home/plugin-data/mnemosyne-dashboard/audit.jsonl
```

That gives the Insights tab meaningful admin activity without touching real plugin data.

## Regenerate Gallery

```bash
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/generate_mock_screenshots.py
```

The generator removes obsolete PNGs from `docs/screenshots/` before writing the current gallery, so stale captures do not silently survive a refresh.

Generated files are written to:

```text
docs/screenshots/
```

The gallery manifest is:

```text
docs/screenshots/manifest.json
```

The manifest records the generation timestamp, source script, fictional-data guarantee, and every screenshot's file, theme, tab, and viewport.

## Safety Rules

- Do not point screenshot tooling at a real memory database.
- Do not commit screenshots containing real memory content, real paths, or private names.
- Keep demo timestamps recent-relative so Insights remains useful after the calendar moves on.
