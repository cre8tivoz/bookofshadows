# Next Agent Handoff

Paused on 2026-07-01 after Phase 8 was completed.

## Current State

- Phases 0 through 8 are complete and checked off in `TRANSFORMATION_PLAN.md`.
- The active product direction is still the transformation plan; continue with Phase 9 next.
- Work completed so far:
  - Phase 0: baseline docs, screenshots, smoke tooling, payload sizes, and verification commands.
  - Phase 1: frontend source extraction and esbuild/Vitest harness.
  - Phase 2: API client reliability, request dedupe/cache/abort handling, and error states.
  - Phase 3: hash routing, filter params, deep links, and browser back/forward support.
  - Phase 4: toasts, pending buttons, skeleton states, command search, shortcuts, confirmations, and safer bulk action summaries.
  - Phase 5: focus-visible styles, reduced-motion handling, tabular-nums, keyboard-operable clickable rows, modal/drawer focus trapping, ARIA roles, a WCAG contrast audit and fix, and an emoji-as-icon audit.
  - Phase 6: paginated memory browser (load-more appends without re-rendering), a loaded-count indicator, and six saved filter presets.
  - Phase 7: `MemoryQuery` value object + `query_memories()`, centralised mutation backup/audit via `_apply_memory_mutation()`, CSRF token validation, and login rate limiting.
  - Phase 8: visualiser loading/error states, a shared `prefersReducedMotion()` mode for the 3D Visualiser and Memory Palace, `visibilitychange`-based render-loop pausing, a fix for the floating node-label overlay CSS (was completely unstyled), and removal of ~368 lines of dead Memory Palace prototype code. Details in `TRANSFORMATION_PLAN.md`'s Phase 8 status update and `docs/ARCHITECTURE.md`'s "Lazy Visualisers and Performance" section.

## Recommended Next Step

Start Phase 9: Charts and Insights Layer.

Per the plan, this phase is explicitly meant to come *after* architecture can support it — modularisation (Phase 1), API reliability (Phase 2), and now visualiser hygiene (Phase 8) are all in place, so this is a reasonable time to start. The plan's own implementation note: "Use a lightweight charting layer only after modularisation. Avoid dumping a heavy chart library into the current raw frontend." — worth deciding deliberately (a small dependency-free SVG/canvas chart helper vs. a real charting library) before writing chart code, given the project's stated preference for a minimal dependency footprint (stdlib Python backend, zero external JS runtime before this point apart from Three.js).

High-value chart ideas from the plan to prioritize: memory growth over time, working vs. episodic split, trust/veracity mix over time, review backlog burn-down, recall frequency distribution, lifecycle tier transitions (hot → warm → cold), and admin mutation/audit activity. Most of the underlying data already exists via `/api/stats`, `/api/lifecycle`, `/api/review`, and `/api/digest/today` — check whether any new backend endpoints are actually needed or if this is achievable by reshaping/aggregating existing responses on the frontend.

Verify with `npm run build:frontend && npm run check:frontend`, `scripts/frontend_smoke.py`, `pytest`, `ruff`, and `compileall`.

Known deliberately-out-of-scope items, in case they resurface:

- The Review queue's own "Load more" still fully re-renders its accumulated list on every page (the same anti-pattern Phase 6 fixed for the memory browser). A follow-up task for this was spun off in a separate session; check whether it's already been picked up.
- `TRANSFORMATION_PLAN.md` has a full duplicate "Sprint 1"–"Sprint 10" roadmap appended after the real "Phase 0"–"Phase 10" plan — a stale earlier draft, never referenced by any completed phase. A follow-up task to delete it was spun off in a separate session; check whether it's already been picked up before doing it again.
- Phase 7 did not add a true filtered "N total" count for the memory browser (only "N loaded") — deliberately deferred since the only existing precedent for a real total computes it by fetching up to 10,000 rows and counting in Python.
- `supersede_memory()` intentionally does not share the exact same mutation-closure signature as the other four admin mutations (see the Phase 7 status update for why).

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
- If testing config/auth changes locally, set `HERMES_HOME` to a scratch directory first — `config.py` reads/writes `$HERMES_HOME/plugin-data/mnemosyne-dashboard/config.json` by default, which is shared with any real/production dashboard instance on the same machine.
