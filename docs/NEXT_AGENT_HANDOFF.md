# Next Agent Handoff

Paused on 2026-07-01 after Phase 9 was completed.

## Current State

- Phases 0 through 9 are complete and checked off in `TRANSFORMATION_PLAN.md`.
- The active product direction is still the transformation plan; continue with Phase 10 next.
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
  - Phase 9: a new Insights tab with two uPlot line/area charts (memory growth by kind, admin/audit activity by action) plus a recall-frequency distribution, backed by three new `/api/insights/*` read-only endpoints. Chose uPlot over shadcn charts (React/Tailwind/Radix dependency this project doesn't have) after weighing bundle size and dependency footprint with the user. Also added proportional fill bars to the Overview breakdown rows. Details in `TRANSFORMATION_PLAN.md`'s Phase 9 status update and `docs/ARCHITECTURE.md`'s "Charts and Insights Layer" section.

## Recommended Next Step

Start Phase 10: Product Polish and Release Package.

Per the plan: README polish, screenshots/gallery update, setup docs, architecture docs, accessibility notes, a demo fixture DB or sanitized sample mode, and a release checklist. This is largely a documentation/presentation pass rather than new feature work — the underlying product surface (accessibility, scalability, backend cleanup, visualiser performance, charts) is now in reasonably good shape after Phases 5-9.

A few things worth doing early in Phase 10, since they touch several of the checklist items at once:
- The README and screenshots likely still show the dashboard *before* the Insights tab, accessibility fixes, and pagination/preset work — worth a fresh screenshot pass.
- A "demo fixture DB" or sanitized sample mode could reuse/extend `scripts/mock_data.py`'s `make_mock_db()`, but note it currently seeds fixed 2026-05-03/04 dates; for the Insights charts to show meaningful data out of the box, a demo fixture would need recent-relative timestamps (see how Phase 9 verification built one — same technique documented below).
- Phase 9 deliberately left several chart ideas unimplemented (trust/veracity-over-time, source-breakdown-over-time, review burn-down, lifecycle-tier-transitions, entity/domain clusters, session-activity heatmap) and the whole "product-grade insight cards" list from the plan. These are out of scope for Phase 10 (which is polish/release, not new features) but worth flagging if Billy wants a Phase 11.

Verify with `npm run build:frontend && npm run check:frontend`, `scripts/frontend_smoke.py`, `pytest`, `ruff`, and `compileall`.

Known deliberately-out-of-scope items, in case they resurface:

- The Review queue's own "Load more" still fully re-renders its accumulated list on every page (the same anti-pattern Phase 6 fixed for the memory browser). A follow-up task for this was spun off in a separate session; check whether it's already been picked up.
- `TRANSFORMATION_PLAN.md` had a full duplicate "Sprint 1"–"Sprint 10" roadmap appended after the real "Phase 0"–"Phase 10" plan — a stale earlier draft. A follow-up task to delete it was spun off in a separate session; check whether it's already been picked up before doing it again.
- Phase 7 did not add a true filtered "N total" count for the memory browser (only "N loaded") — deliberately deferred since the only existing precedent for a real total computes it by fetching up to 10,000 rows and counting in Python.
- `supersede_memory()` intentionally does not share the exact same mutation-closure signature as the other four admin mutations (see the Phase 7 status update for why).
- Phase 9's charts theme from CSS variables at render time but do not live-update on theme toggle without a tab re-visit (`switchTab()` re-runs `loadInsights()` on every entry, so switching away and back repaints with the new theme's colors) — same precedent as the Three.js/constellation visualisers, which also don't repaint live on theme toggle.

## Useful Commands

```bash
npm run build:frontend && npm run check:frontend
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/frontend_smoke.py
/Users/habibi/.local/bin/uv run --with pytest --python /Users/habibi/.local/bin/python3.11 python -m pytest
/Users/habibi/.local/bin/uv run --with ruff --python /Users/habibi/.local/bin/python3.11 python -m ruff check .
/Users/habibi/.local/bin/uv run --python /Users/habibi/.local/bin/python3.11 python -m compileall scripts tests
```

If `.venv` has nothing installed (observed once this phase — a fresh/reset venv with no pip, pytest, or ruff), either use the `uv run --with X` one-shot form above, or `uv pip install pytest ruff websocket-client` once into `.venv` and use `source .venv/bin/activate` for the rest of the session.

For manually verifying anything in the Insights tab (or any date-sensitive view), the standard `make_mock_db()` fixture uses fixed 2026-05-03/04 dates that won't show meaningful data in a 7/30/90-day window relative to the real system clock. Build a throwaway DB with recent-relative timestamps instead (insert rows with `timestamp = now - timedelta(days=i)` for a spread of days) plus a hand-written `audit.jsonl` under a scratch `$HERMES_HOME/plugin-data/mnemosyne-dashboard/`, and point `MNEMOSYNE_DASHBOARD_DB`/`HERMES_HOME` at them via `.claude/launch.json`'s `runtimeArgs`.

## Notes

- `static/app.js` is generated. Edit `static/src/` and rebuild.
- `uv.lock` may appear after `uv run`; do not include it unless the project intentionally adopts it.
- Keep PRs phase-sized and update `TRANSFORMATION_PLAN.md` as each phase lands.
- If testing config/auth changes locally, set `HERMES_HOME` to a scratch directory first — `config.py` reads/writes `$HERMES_HOME/plugin-data/mnemosyne-dashboard/config.json` by default, which is shared with any real/production dashboard instance on the same machine.
- The vendored `static/vendor/*.min.js` files (Three.js, uPlot) ship without their companion CSS/runtime niceties that the npm package normally bundles — check upstream defaults before assuming a missing visual behavior is a bug in *this* code rather than a missing vendored asset.
