# Next Agent Handoff

Paused on 2026-07-01 after Phase 7 was completed.

## Current State

- Phases 0 through 7 are complete and checked off in `TRANSFORMATION_PLAN.md`.
- The active product direction is still the transformation plan; continue with Phase 8 next.
- Work completed so far:
  - Phase 0: baseline docs, screenshots, smoke tooling, payload sizes, and verification commands.
  - Phase 1: frontend source extraction and esbuild/Vitest harness.
  - Phase 2: API client reliability, request dedupe/cache/abort handling, and error states.
  - Phase 3: hash routing, filter params, deep links, and browser back/forward support.
  - Phase 4: toasts, pending buttons, skeleton states, command search, shortcuts, confirmations, and safer bulk action summaries.
  - Phase 5: focus-visible styles, reduced-motion handling, tabular-nums, keyboard-operable clickable rows, modal/drawer focus trapping, ARIA roles, a WCAG contrast audit and fix, and an emoji-as-icon audit.
  - Phase 6: paginated memory browser (load-more appends without re-rendering), a loaded-count indicator, and six saved filter presets.
  - Phase 7: `MemoryQuery` value object + `query_memories()` (query normalisation split from SQL construction), centralised mutation backup/audit via `_apply_memory_mutation()`, CSRF token validation for mutating POSTs, and login rate limiting. Details in `TRANSFORMATION_PLAN.md`'s Phase 7 status update and `docs/ARCHITECTURE.md`'s "Backend Interface Cleanup" section.

## Recommended Next Step

Start Phase 8: Lazy Visualisers and Performance.

Suggested first slice:

1. Lazy-load Three.js — it's currently loaded upfront (`static/vendor/three.module.min.js`, ~656K per the Phase 0 baseline) even for users who never open the 3D Visualiser tab. Load it dynamically (`import()`) only when that tab is first opened.
2. Add loading/error states for the visualisers while Three.js/canvas assets are being fetched or initialised.
3. Stop render loops (`requestAnimationFrame`) when a visualiser tab is not the active/visible one — `switchTab()` in `static/src/app-main.js` already calls `stopCanvasVisualiserLoop()`/`clearThreeScene()`/`clearPalaceScene()` when leaving a visualiser tab, so check whether that coverage is already sufficient or has gaps (e.g. backgrounded browser tab, not just dashboard tab switch).
4. Add a WebGL fallback (detect `WebGLRenderingContext` support before initialising Three.js; show a clear message instead of a blank/broken viewport).
5. Add a reduced-motion visualiser mode — Phase 5 already gated the canvas constellation's `requestAnimationFrame` loop on `prefers-reduced-motion`; check whether the same needs doing for the Three.js and Memory Palace render loops.
6. Verify with `npm run build:frontend && npm run check:frontend`, `scripts/frontend_smoke.py`, `pytest`, `ruff`, and `compileall`.

Known deliberately-out-of-scope items from recent phases, in case they resurface:

- The Review queue's own "Load more" (`loadReviewPage()`/`renderSelectedReviewQueue()`) still fully re-renders its accumulated list on every page — the same anti-pattern Phase 6 fixed for the memory browser. A follow-up task for this was spun off in a separate session; check whether it's already been picked up before redoing it.
- Phase 7 did not add a true filtered "N total" count for the memory browser (only "N loaded") — the only existing precedent for a real total (`review_queues()`) computes it by fetching up to 10,000 rows and counting in Python, which felt like real backend cost/scope better suited to a dedicated pass rather than something to bolt on quietly.
- `supersede_memory()` intentionally does not share the exact same mutation-closure signature as the other four admin mutations (see the Phase 7 status update for why) — don't "fix" this into uniformity without re-reading that reasoning first.

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
