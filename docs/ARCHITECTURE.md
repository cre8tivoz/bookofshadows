# Architecture

## Frontend Source Layout

Phase 1 introduces a source tree under `static/src/` and bundles it back to `static/app.js` so the Python server and HTML shell keep serving the same asset path.

```text
static/src/
  app.js
  app-main.js
  api/
    client.js
  features/
    graph.js
    memories.js
    review.js
  state/
    routing.js
  ui/
    dom.js
    render.js
  utils/
    escape.js
    format.js
    a11y.js
    motion.js
```

`static/app.js` is generated. Edit `static/src/app.js` and modules under `static/src/`, then run:

```bash
npm run build:frontend
```

## Current Extraction Boundaries

- `app.js`: tiny guarded entrypoint. CI fails if this grows past the Phase 1 line-count gate.
- `app-main.js`: transitional dashboard orchestrator. This is intentionally not a feature module; it holds remaining cross-feature wiring while later phases continue extracting controllers.
- `api/client.js`: fetch wrapper, JSON POST helper, and unauthorized callback seam.
- `api/endpoints.js`: endpoint builders and short TTL policy for low-volatility GETs.
- `ui/dom.js`: selector helpers, select rendering, section panel switching, mobile menu helpers.
- `ui/feedback.js`: toast HTML, pending-button state, skeleton loading cards, keyboard shortcut mapping, and bulk-action summaries.
- `ui/render.js`: shared state-card, breakdown, select-option, and count-label rendering helpers.
- `utils/escape.js`: HTML escaping, ID shortening, chat-role prefix helpers.
- `utils/format.js`: time and byte formatting.
- `utils/a11y.js`: focus-trap utility (`trapFocus()`/`focusableElements()`) used by the drawer, action modal, and login overlay.
- `utils/motion.js`: `prefersReducedMotion()`, shared by the canvas constellation, 3D visualiser, and Memory Palace render loops.
- `state/routing.js`: pure route parse/serialize helpers and legacy tab aliases.
- `features/memories.js`: pure memory card/meta rendering, mutability helper, paginated query params (`memoryFilterParams` with limit/offset), page merge/dedup (`mergeMemoryPage`), and saved filter presets (`MEMORY_FILTER_PRESETS`, `memoryPresetByKey`, `sortByExpiringSoon`).
- `features/review.js`: review queue rendering, lifecycle queue wrapper, review query params, and selected-action helpers.
- `features/graph.js`: graph layout, graph inspector HTML, SVG graph controller state, pan/zoom binding, and graph API query path.

Large controller functions such as `switchTab()`, `applyRoute()`, feature loaders, drawer actions, and visualiser lifecycle remain in `static/src/app-main.js` for now. They should move only after dependencies are explicit and covered by tests. The visualiser code is the main remaining extraction target because it combines canvas, Three.js, and memory-palace state.

## Test Strategy

Frontend unit tests live in `tests/frontend/` and run with Vitest + happy-dom:

```bash
npm run test:frontend
```

The browser smoke test still exercises the generated `static/app.js` through the Python server:

```bash
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/frontend_smoke.py
```

## API Reliability

Phase 2 keeps the existing `api(path)` and `postJson(path, body)` calling style, but the client now owns request reliability:

- identical in-flight GETs are deduplicated;
- low-volatility GETs use short URL-driven TTL caching;
- keyed query requests can abort older stale requests;
- failures are normalised as `ApiError` with `status`, `path`, `payload`, and `retryable`;
- successful JSON mutations clear cached GETs;
- development timing logs can be enabled with `localStorage.mnemosyne-debug-api = "1"`.

## Routing

Phase 3 uses hash routes so the dashboard can be served by the existing Python static server without backend route rewrites.

- Major tabs use `#/overview`, `#/today`, `#/memories`, `#/graph`, and `#/settings`.
- Memory browser filters round-trip through `#/memories?q=...&status=...&source=...&scope=...`.
- Detail drawers use stable deep links: `#/memory/<id>` for memories and `#/session/<id>` for timeline sessions.
- `popstate` and `hashchange` both re-apply route state, so browser back/forward and pasted hash links restore the correct tab, filters, and drawer.
- Legacy query-string links such as `?tab=memories&memory=<id>` are still parsed, but new navigation serialises to hash routes.

## Product UX Feedback

Phase 4 keeps feedback primitives framework-free:

- `showToast()` renders a transient `#toastHost` message for saves, auth changes, backups, mutation success, and errors.
- `runButtonAction()` wraps async button actions with `disabled`, `aria-busy`, and a pending label.
- Bulk memory and review mutations report action summaries and keep failed selections available for retry.
- Skeleton cards are used while core list/search panels load.
- Global shortcuts are mapped through `keyboardActionForEvent()`: `/` focuses search, `?` opens shortcut help, `Esc` closes overlays, `g o/m/r/k` navigates, and `Cmd/Ctrl+K` opens command search.

## Accessibility and Interface Quality

Phase 5 raises interactive elements and overlays to a consistent baseline:

- `ui/dom.js` exports `bindActivatable(el, handler)`, which makes a non-native clickable row (memory cards, breakdown filter rows, profile items, triple rows, session events, consolidation cards) keyboard-operable: it adds `tabindex="0"`/`role="button"` when not already present and wires Enter/Space alongside the existing click handler, without intercepting keys meant for nested real buttons/inputs.
- `utils/a11y.js` exports `trapFocus(container)`, used by `#detail` (the drawer), `#actionModal`, and the login overlay. It traps Tab/Shift+Tab inside the open surface and restores focus to whatever triggered it once released.
- `#detail` and `#actionModal` are `role="dialog" aria-modal="true"` with `aria-labelledby`/`aria-describedby`; the login overlay is a `role="dialog"` too. `<nav>` and every `.section-tabs` group are `role="tablist"`/`role="tab"` with `aria-selected` kept in sync in `switchTab()`/`showPanel()`/the visualiser mode switchers. `#graphSvg` carries a descriptive `aria-label` and points to the Facts table as a keyboard-accessible alternative to the graph canvas.
- `static/style.css` adds a global `:focus-visible` ring (mouse-driven `:focus` stays ring-free), a `prefers-reduced-motion` block that collapses transition/animation durations and disables hover transforms, and `font-variant-numeric: tabular-nums` on counters, tables, and diagnostics.
- `--text-subtle` (both themes) and light-mode `--text-muted` were adjusted after a contrast audit found them below WCAG AA (~2.7-3.1:1) against the surfaces they render on; they now land at ~4.0-4.5:1. `--text-subtle` is still not guaranteed to clear 4.5:1 on every surface — treat it as decorative/redundant-label text only, not the sole carrier of information.
- The 3D/canvas visualisers remain mouse-driven; keyboard equivalents are out of scope for this phase (see `docs/PHASE_0_BASELINE.md`/Phase 8 notes on visualiser work).

## Memory Browser Scalability

Phase 6 paginates the memory browser instead of fetching everything in one shot:

- `loadMemories()` fetches page one (`memoryFilterParams(filters, MEMORY_PAGE_SIZE, 0)`) and replaces `#memoryList`; `loadMoreMemories()` fetches the next offset and appends only the newly-returned cards via `insertAdjacentHTML('beforeend', ...)`, leaving previously-rendered DOM nodes untouched. `mergeMemoryPage()` (replace vs. append+dedup-by-id) tracks the accumulated `latestMemoryItems` array either way.
- `#memoryListCount` shows a "N loaded" indicator; the `#memoryLoadBar` (`Load 150 more`) hides once a page returns fewer than `MEMORY_PAGE_SIZE` items. There is no exact filtered "N total" — see the Phase 6 status update in `TRANSFORMATION_PLAN.md` for why that was deliberately left out of this frontend-scoped phase.
- `#memoryPresetBar` offers six saved filter views (`MEMORY_FILTER_PRESETS` in `features/memories.js`). `applyMemoryPreset()` always calls `resetMemoryFilterControls()` before applying a preset's filters, so an earlier preset's leftover filter value (e.g. `veracity`) can't silently suppress a later preset's results. "Expiring soon" is the one preset that can't be expressed as existing filter/sort controls — it fetches a bounded active batch and sorts client-side by `valid_until` (`sortByExpiringSoon()`), and disables further pagination for that view.
- Bulk selection (`bulkSelection`, a `Set` of ids) is untouched by pagination appends, so selections persist across "Load more" without any special-cased logic.

## Backend Interface Cleanup

Phase 7 introduces a value object for memory queries and centralises mutation bookkeeping in `dashboard_core.py`, plus CSRF/rate-limiting in `server.py`:

- `MemoryQuery` (frozen dataclass) + `MemoryQuery.from_raw(...)` hold all filter normalisation (limit/offset clamping, status/veracity/degradation-tier validation, truthy-string coercion, min-importance parsing). `DashboardStore.query_memories(query)` takes only a `MemoryQuery` and does pure SQL construction/execution — no normalisation logic lives there anymore.
- `list_memories(**wide parameter list)` is unchanged as a public signature and is now a two-line wrapper: build a `MemoryQuery`, delegate to `query_memories()`. Every existing internal caller (`stats()`, `review_queues()`, `lifecycle_dashboard()`, `inferred_profile()`, `pattern_insights()`, `constellation()`, `global_search()`, `recall_debug()`, `timeline()`, `session_detail()`, and the `/api/memories` HTTP route) still calls `list_memories(...)` unchanged. New callers should prefer building a `MemoryQuery` and calling `query_memories()` directly.
- `DashboardStore._apply_memory_mutation(memory_id, action, backup, mutate, extra)` is the shared backup+audit template: fetch `before`, back up if requested, run `mutate(con)` inside a `connect_rw()` transaction, fetch `after`, write one audit entry, return `{ok, memory_id, backup, item}`. `invalidate_memory`, `set_memory_importance`, `set_memory_veracity`, and `set_memory_expiry` are each just a `mutate(con)` closure plus a small merge of their own extra field on top of that shared shape. `supersede_memory` also calls `_apply_memory_mutation()` for the same backup/audit wrapping, but validates its importance default against the *existing* memory before calling it (deliberately not squeezed into the exact same closure signature — see the Phase 7 status update in `TRANSFORMATION_PLAN.md` for why).
- `config.csrf_token_value(cfg)` derives a per-install CSRF token via HMAC over the same `auth_secret` used for the auth cookie (different HMAC message, independent value). `/api/auth/status` includes `csrf_token` only when the caller is authenticated and `auth_enabled` is true. `server.py`'s `_require_csrf()` requires a matching `X-CSRF-Token` header on every mutating POST except `/api/auth/login`, and is a no-op when auth is disabled. Frontend: `api/client.js`'s `postJson()` attaches the token automatically once `setCsrfToken()` has been called (wired from `refreshAuthState()`).
- Login attempts are rate-limited: a thread-safe in-memory sliding window (5 attempts / 5 minutes per client IP, `server.py`), cleared on success. Simple by design — this is a local/LAN single-user dashboard, not a public service that needs persistent or distributed rate-limit storage.

## Lazy Visualisers and Performance

Phase 8 rounds out the visualiser lifecycle (lazy-load/WebGL-fallback/tab-switch disposal already existed) with loading states, reduced motion, and background-tab pausing, plus a source cleanup:

- `loadThreeVisualiser()`/`loadMemoryPalace()` show a `.three-loading-card` immediately (covering both the API fetch and the `import()` of `static/vendor/three.module.min.js`) and a `.three-fallback-card` error card if either fails, instead of leaving a blank/stale viewport on a silently-rejected promise.
- `utils/motion.js` (`prefersReducedMotion()`) defaults `threeVis.paused`/`memoryPalace.paused` to `true` on scene load, disabling auto-rotation, edge-pulse travel animation, drone bobbing, beacon spin, and relic self-rotation, while leaving the render loop and all drag/WASD/pan/zoom interaction intact. The canvas constellation's own reduced-motion handling (Phase 5) now shares this same helper.
- A `visibilitychange` listener stops the canvas/Three.js/Memory Palace render loops from rescheduling `requestAnimationFrame` while the browser tab is hidden, and resumes them (without disposing the scene) when it becomes visible again — separate from `switchTab()`'s existing full-disposal behaviour when navigating between dashboard tabs.
- `.three-label`/`.three-labels` had no CSS at all before this phase (`position: static`), so the floating node-name overlays on both the 3D Visualiser and Memory Palace rendered as plain stacked text instead of floating over their nodes; fixed with the missing overlay positioning.
- Removed ~368 lines of dead code: `renderMemoryPalaceDungeon`/`animateMemoryPalaceDungeon` and `renderMemoryPalaceIso`/`animateMemoryPalaceIso` (plus helpers used only by them) were earlier Memory Palace prototypes never reachable from the live `loadMemoryPalace()` entry point. esbuild's bundler was already tree-shaking them out of `static/app.js`, so this was a source-readability fix, not a shipped-bundle-size fix.
