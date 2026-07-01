# Next Agent Handoff

Updated on 2026-07-01 after Release 11A was completed.

## Current State

- Phases 0 through 10 are complete in `TRANSFORMATION_PLAN.md`.
- Phase 9's extra analytics ideas have been moved to the Future Release Backlog instead of remaining as ambiguous unfinished checklist work.
- Phase 10 release package is now present:
  - refreshed README links and screenshot gallery,
  - current-date fictional demo data for screenshots and Insights,
  - setup docs,
  - architecture refresh,
  - accessibility notes,
  - demo-data notes,
  - release checklist.
- Release 11A is complete: the Insights tab now includes trust mix, source mix, review backlog, lifecycle events, entity/domain clusters, session heatmap, and action cards, with matching read-only backend endpoints and tests.

## Useful Commands

```bash
npm run build:frontend && npm run check:frontend
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/frontend_smoke.py
/Users/habibi/.local/bin/uv run --with pytest --python /Users/habibi/.local/bin/python3.11 python -m pytest tests/ -q
/Users/habibi/.local/bin/uv run --with ruff --python /Users/habibi/.local/bin/python3.11 python -m ruff check .
/Users/habibi/.local/bin/python3.11 -m compileall -q .
```

Regenerate public screenshots:

```bash
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/generate_mock_screenshots.py
```

## Future Release Backlog

- Release 11B: Review queue append pagination and exact filtered memory totals.
- Release 11C: Extract visualiser, auth/settings, review, and detail-drawer controllers from `static/src/app-main.js`.
- Release 11D: Add keyboard equivalents and accessible data paths for canvas/WebGL visualisers.

## Notes

- `static/app.js` is generated. Edit `static/src/` and rebuild.
- `uv.lock` may appear after `uv run`; do not include it unless the project intentionally adopts it.
- If testing config/auth changes locally, set `HERMES_HOME` to a scratch directory first. The default config/audit/backup path is `$HERMES_HOME/plugin-data/mnemosyne-dashboard/`.
- Screenshot tooling uses temporary fictional data only. Do not point it at a real memory database.
