# Next Agent Handoff

Paused on 2026-07-01 after Phase 6 was completed.

## Current State

- Phases 0 through 6 are complete and checked off in `TRANSFORMATION_PLAN.md`.
- The active product direction is still the transformation plan; continue with Phase 7 next.
- Work completed so far:
  - Phase 0: baseline docs, screenshots, smoke tooling, payload sizes, and verification commands.
  - Phase 1: frontend source extraction and esbuild/Vitest harness.
  - Phase 2: API client reliability, request dedupe/cache/abort handling, and error states.
  - Phase 3: hash routing, filter params, deep links, and browser back/forward support.
  - Phase 4: toasts, pending buttons, skeleton states, command search, shortcuts, confirmations, and safer bulk action summaries.
  - Phase 5: focus-visible styles, reduced-motion handling, tabular-nums, keyboard-operable clickable rows (`bindActivatable()`), modal/drawer focus trapping (`utils/a11y.js`), ARIA roles for dialogs/tabs/graph, a WCAG contrast audit and fix, and an emoji-as-icon audit.
  - Phase 6: paginated memory browser (`loadMoreMemories()` appends without re-rendering existing cards), a loaded-count indicator, and six saved filter presets (`MEMORY_FILTER_PRESETS`). Details in `TRANSFORMATION_PLAN.md`'s Phase 6 status update and `docs/ARCHITECTURE.md`'s "Memory Browser Scalability" section.

## Recommended Next Step

Start Phase 7: Backend Interface Cleanup.

Suggested first slice:

1. Introduce a `MemoryQuery` dataclass (or equivalent value object) in `dashboard_core.py` and have `list_memories()` accept it instead of its current ~14 loose parameters, keeping the existing parameter list working as a thin compatibility wrapper so `server.py` and every existing caller don't need to change at once.
2. Split query normalisation (trimming, coercion, veracity/degradation validation) from SQL construction — this is also the natural place to add a real `count_memories()` alongside `list_memories()` if you want to give the Memory Browser (Phase 6) an exact filtered total instead of just "N loaded". The only existing precedent, `review_queues()`, computes totals by fetching up to 10,000 rows and counting in Python — worth deciding deliberately whether to keep that pattern or do a real `SELECT COUNT(*)`.
3. Add tests for each query mode (status/veracity/degradation/due-for-degradation/source/scope/session filtering, `q` search, sort modes) against the new query object.
4. Add explicit CSRF token validation for POST endpoints and login rate limiting, per the plan's security-hardening items for this phase.
5. Verify with `npm run build:frontend && npm run check:frontend`, `scripts/frontend_smoke.py`, `pytest`, `ruff`, and `compileall`.

A known, deliberately out-of-scope item from Phase 6: the Review queue's "Load more" (`loadReviewPage()`/`renderSelectedReviewQueue()` in `static/src/app-main.js`) still fully re-renders its accumulated list on every page, the same anti-pattern that was just fixed for the memory browser. A follow-up task for this was already spun off separately from this session; check whether it's been picked up before re-doing it.

## Useful Commands

```bash
npm run build:frontend && npm run check:frontend
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/frontend_smoke.py
/Users/habibi/.local/bin/uv run --with pytest --python /Users/habibi/.local/bin/python3.11 python -m pytest
/Users/habibi/.local/bin/uv run --with ruff --python /Users/habibi/.local/bin/python3.11 python -m ruff check .
/Users/habibi/.local/bin/uv run --python /Users/habibi/.local/bin/python3.11 python -m compileall scripts tests
```

## Notes

- `static/app.js` is generated. Edit `static/src/` and rebuild.
- `uv.lock` may appear after `uv run`; do not include it unless the project intentionally adopts it.
- Keep PRs phase-sized and update `TRANSFORMATION_PLAN.md` as each phase lands.
