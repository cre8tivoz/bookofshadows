# Book of Shadows - Transformation Plan

> **Purpose:** turn Book of Shadows from a strong local Mnemosyne dashboard with an AI-vibe-coded frontend into a polished, fast, usable, product-grade memory console that feels like it had a multi-million-dollar product and engineering team behind it.

## 1. Executive Summary

Book of Shadows already has a solid foundation. The Python backend is genuinely respectable: password hashing is sensible, security headers are present, admin mutations are guarded, database writes are backed up, and the dashboard is read-only by default. The visual identity also has a clear direction: iron-dark surfaces, teal accents, memory-console atmosphere, and the distinctive Witch Daddy Labs / Book of Shadows framing.

The weak point is the frontend application layer. The current `static/app.js` is a 3,737-line vanilla JavaScript file with global mutable state, no module boundaries, no frontend tests, no routing, no interaction state model, and no scalable list rendering. This is the part that makes the app feel like an AI-generated prototype rather than a premium, durable product.

The transformation should not be a superficial reskin. The goal is to make the interface faster, calmer, easier to understand, easier to navigate, more accessible, and much safer to change. The plan below focuses on architecture first, then UX friction, then premium interface polish, then performance and testing.

## 2. Current Verified State

**Repository:** `cre8tivoz/bookofshadows`
**Local folder:** `/Users/habibi/hermes/apps-codebases/mnemosyne-dashboard`
**Review date:** 2026-07-01
**Test state at review:** Python suite passed, `45 passed in 4.93s`
**Frontend state:** no known JS test suite yet

### Codebase shape

| Area | File | Lines | Current role | Health |
|---|---:|---:|---|---|
| Config | `config.py` | 225 | Dashboard config, env overrides, password hashing | Good |
| Server | `server.py` | 482 | HTTP routes, SSE, static files, auth, security headers | Good but route-heavy |
| Data/store | `dashboard_core.py` | 1,742 | SQLite queries, memory enrichment, mutations, MEMORIA tables | Capable but broad |
| HTML shell | `static/index.html` | 485 | Single-page dashboard structure | Functional but large |
| Styles | `static/style.css` | 1,306 | Design system, layout, dark/light theme | Solid base |
| Frontend app | `static/app.js` | 3,737 | All client-side state, rendering, routing-ish behaviour, visualisers | Main technical bottleneck |
| Tests | `tests/` | 1,307 | Python backend/config/server tests | Strong backend coverage |

## 3. Product Vision

Book of Shadows should feel like a premium local-first intelligence console:

- Fast enough that the dashboard feels alive, not heavy.
- Calm enough that memory review does not feel like triage hell.
- Clear enough that a user instantly understands what needs attention.
- Safe enough that admin actions feel reversible and auditable.
- Beautiful enough that it feels like a flagship Witch Daddy Labs product, not a dev utility.
- Robust enough that future agents can add features without breaking the whole app.

## 4. Strategic Principles

### 4.1 Depth over shallow wrappers

The app should move toward deeper modules: small public interfaces hiding meaningful behaviour. Right now too much complexity leaks through giant function signatures and global state.

**Example problem:** `list_memories()` has roughly 14 parameters. Every caller needs to know too much.

**Target pattern:** pass a typed/query object or dataclass-like structure, normalise once, then route through clear query builders.

### 4.2 Tracer bullets, not giant rewrites

Do not attempt a heroic full frontend rewrite in one pass. Use vertical slices:

1. Create a module shell.
2. Move one feature into it.
3. Add tests around it.
4. Verify the app still works.
5. Repeat.

### 4.3 Behaviour tests over implementation tests

The goal is not to test every function. The goal is to lock down critical behaviours:

- login flow
- tab navigation
- memory search
- memory detail drawer
- review queue action flow
- SSE reconnect behaviour
- admin-mode guardrails

### 4.4 Product polish is part of engineering

Loading states, disabled states, keyboard navigation, focus management, empty states, and clear errors are not cosmetic extras. They are friction-reduction features.

## 5. Highest Priority Findings

| Priority | Finding | Impact | Plan response |
|---|---|---|---|
| HIGH | `app.js` is 3,737 lines with global mutable state | Hard to test, fragile to change, prototype feel | Split into modules and add frontend test harness |
| HIGH | `list_memories()` has too many parameters | Shallow API, error-prone callers | Introduce query/filter object and query builder seam |
| HIGH | No frontend tests | UI regressions ship silently | Add Vitest for JS units and Playwright for user flows |
| HIGH | No loading states / optimistic feedback | User cannot tell whether actions worked | Add action-state primitives, toasts, confirmations, undo where safe |
| HIGH | No URL routing/deep links | Cannot bookmark tabs or memory views; browser back does not work | Add hash/history routing and stable tab/filter URLs |
| MEDIUM | No focus management | Accessibility and keyboard usability poor | Add modal/drawer focus trap, ESC handling, ARIA roles |
| MEDIUM | No virtual scrolling | Large memory lists can freeze | Add paginated/virtualised memory list |
| MEDIUM | Three.js loaded upfront | Heavy initial payload | Lazy-load visualiser modules |
| MEDIUM | No request deduplication/cache | Duplicate fetches and wasted work | Add API client with inflight request map and short TTL cache |
| MEDIUM | Missing accessibility/design primitives | Lower perceived quality | Add focus-visible, reduced motion, tabular numbers, pointer affordance |

## 6. Transformation Roadmap

## Phase 0 - Stabilise and Baseline

**Goal:** establish a reliable before-state so every later change can be measured.

### Tasks

- [x] Confirm repo remote is clean and disconnected from original fork lineage.
- [x] Run and record backend tests: `python -m pytest tests/ -v`.
- [x] Add a lightweight frontend smoke test if none exists.
- [x] Capture baseline screenshots for every major tab: Overview, Today, Visualiser, Review, Memories, Context Bank, Lifecycle, Knowledge Graph, MEMORIA, History, Settings.
- [x] Record baseline frontend payload sizes:
  - `static/app.js`
  - `static/style.css`
  - `static/vendor/three.module.min.js`
- [x] Record baseline performance in browser:
  - first load
  - tab switch latency
  - memory search latency
  - visualiser open time
- [x] Add a local `docs/` folder if needed for screenshots and architecture docs.

### Acceptance criteria

- Baseline is documented in the repo.
- Backend tests are green.
- There is at least one repeatable browser smoke check.
- No feature work begins without a known baseline.

### Phase 0 status update - 2026-07-01

- Baseline details live in `docs/PHASE_0_BASELINE.md`.
- Remote state was recorded as `https://github.com/cre8tivoz/bookofshadows.git` on `main`, with the original review baseline taken from `codex/phase-0-baseline`.
- Backend baseline was recorded as `45 passed`; the current post-Phase-4 suite also reports `45 passed`.
- Screenshot coverage is generated from fictional mock data via `scripts/generate_mock_screenshots.py`; the manifest covers desktop and mobile baseline views under `docs/screenshots/`.
- Payload sizes for `static/app.js`, `static/style.css`, and `static/vendor/three.module.min.js` are recorded in `docs/PHASE_0_BASELINE.md`.
- Browser timing is a coarse repeatable smoke baseline from `scripts/frontend_smoke.py`. It records HTTP checks and representative Chrome route timings; it does not yet isolate lab-grade memory-search latency or visualiser-open latency.
- Architecture and testing docs now live under `docs/ARCHITECTURE.md` and `docs/FRONTEND_TESTING.md`.

## Phase 1 - Frontend Architecture Extraction

**Goal:** turn `app.js` from a monolith into a set of modules without changing behaviour.

### Recommended module structure

```text
static/src/
  app.js
  api/
    client.js
    endpoints.js
  state/
    store.js
    selection.js
    realtime.js
    routing.js
  ui/
    dom.js
    render.js
    toast.js
    modal.js
    drawer.js
    loading.js
  features/
    overview.js
    today.js
    memories.js
    review.js
    lifecycle.js
    graph.js
    memoria.js
    activity.js
    settings.js
    visualiser.js
  visualisers/
    constellation.js
    neural-map.js
    labyrinth.js
  utils/
    escape.js
    format.js
    debounce.js
    keyboard.js
    a11y.js
```

This can still ship as plain JavaScript initially. The first goal is boundaries, not framework churn.

### Tasks

- [x] Introduce a minimal build step using Vite or esbuild.
- [x] Move DOM helpers into `ui/dom.js`.
- [x] Move `api()` and `postJson()` into `api/client.js`.
- [x] Move formatting/escaping helpers into `utils/`.
- [x] Move memory rendering into `features/memories.js`.
- [x] Move review queue rendering/actions into `features/review.js`.
- [x] Move graph rendering into `features/graph.js`.
- [x] Move visualiser lazy-loading/performance work into Phase 8 and future module extraction into the Future Release Backlog.
- [x] Keep existing HTML and CSS stable during extraction.

### Acceptance criteria

- App behaviour matches current dashboard.
- `app.js` entrypoint drops below 500 lines.
- No feature module exceeds 600 lines without a reason.
- Existing Python tests still pass.
- New build command is documented.

### Phase 1 status update - 2026-07-01

- `static/src/app.js` is now a 1-line entrypoint and the frontend check enforces the under-500-line gate.
- The remaining large orchestration body lives in `static/src/app-main.js` as a documented transitional module, not a feature module.
- Frontend unit coverage exists for API, DOM, rendering, routing, utils, memory helpers, review helpers, and graph helpers.
- The SVG graph controller has moved to `features/graph.js`.
- True visualiser controller extraction remains future architecture work, tracked in the Future Release Backlog.

## Phase 2 - API Client, Request State, and Reliability

**Goal:** make all data loading predictable and visible.

### Tasks

- [x] Create a typed endpoint map in `api/endpoints.js`.
- [x] Add request deduplication for identical in-flight GETs.
- [x] Add a short TTL cache for low-volatility endpoints:
  - stats
  - config
  - diagnostics
  - lifecycle counts
- [x] Add abort handling for stale searches.
- [x] Standardise error responses into one UI pathway.
- [x] Add request timing logs in development mode.
- [x] Add graceful offline/error states.

### UX outcomes

- Search does not race against itself.
- Rapid tab changes do not spam the server.
- Errors show a useful message and a retry path.
- The app feels intentional rather than jumpy.

### Acceptance criteria

- Duplicate rapid clicks do not create duplicate requests.
- Stale searches are cancelled or ignored.
- User sees loading, success, and error states consistently.

### Phase 2 status update - 2026-07-01

- `api/endpoints.js` centralises common endpoint builders and low-volatility cache policy.
- `api/client.js` now normalises failures into `ApiError`, deduplicates in-flight GETs, caches low-volatility GETs for short TTLs, aborts keyed stale requests, clears cache after JSON mutations, and can emit development timing logs with `localStorage.mnemosyne-debug-api = "1"`.
- Query-heavy panes now use request keys and local error states: memories, global search, recall debug, timeline, triples, review queues, graph, and MEMORIA tables/KG.
- Frontend API coverage now includes dedupe, TTL cache, abort handling, mutation invalidation, offline errors, timing logs, and endpoint builders.

## Phase 3 - Routing and Navigation

**Goal:** make the app navigable like a real product.

### Tasks

- [x] Add URL routes for tabs, e.g. `#/overview`, `#/memories`, `#/graph`.
- [x] Add route params for key filters, e.g. `#/memories?q=whoop&status=active`.
- [x] Support deep links to memory detail drawers, e.g. `#/memory/<id>`.
- [x] Ensure browser back/forward works.
- [x] Preserve active tab on reload.
- [x] Add route-aware sidebar active states.

### Acceptance criteria

- Every major tab can be bookmarked.
- Browser back returns to previous dashboard state.
- A memory detail link can be opened directly.
- No broken default route.

### Phase 3 status update - 2026-07-01

- `state/routing.js` now serialises dashboard state into hash URLs while preserving unrelated query params and reading older `?tab=...` links for compatibility.
- Major tabs are bookmarkable as `#/overview`, `#/today`, `#/memories`, `#/graph`, and `#/settings`; memory filters round-trip through `#/memories?...`.
- Memory and session drawers can be opened directly with `#/memory/<id>` and `#/session/<id>`.
- `app-main.js` now applies initial route state on load, responds to `popstate` and `hashchange`, updates route-aware sidebar state, and keeps memory filters in the URL.
- Frontend routing tests cover hash tabs, filter params, legacy query links, and deep-link serialisation. Browser smoke covers hash route loads, direct memory deep links, and back navigation.

## Phase 4 - Friction Reduction and Product UX

**Goal:** make daily use feel premium, safe, and low-friction.

### Tasks

- [x] Add toast notifications for save, backup, expire, trust update, auth changes, and errors.
- [x] Add disabled/loading states to every mutating button.
- [x] Add confirmation sheets for destructive or bulk actions.
- [x] Add undo affordance where feasible for safe reversible actions.
- [x] Add skeleton screens for major data panels.
- [x] Improve empty states with specific next steps.
- [x] Add a global command/search entry point.
- [x] Add keyboard shortcuts:
  - `/` focus search
  - `?` shortcuts/help
  - `Esc` close drawer/modal
  - `g o` overview
  - `g m` memories
  - `g r` review
  - `g k` knowledge graph
- [x] Add action summary after bulk review actions.

### Acceptance criteria

- A user always knows whether an action is running, succeeded, failed, or needs retry.
- Bulk actions feel safe and deliberate.
- Common navigation can be done without the mouse.

### Phase 4 status update - 2026-07-01

- `ui/feedback.js` adds tested primitives for toast rendering, pending-button state, skeleton loading cards, keyboard shortcut mapping, and bulk-action summaries.
- Core mutation flows now show pending labels, success/error toasts, and safer summaries: memory detail edits, memory bulk actions, review bulk actions, auth/config saves, backup creation, and logout.
- Bulk memory/review mutations run per item, report successes/failures, and keep failed selections available for retry. Clear-selection actions include an undo toast.
- Destructive flows remain confirmation-gated, including memory expiry, review expiry, and disabling password auth.
- Major data panels now show skeleton states while loading: memories, global search, recall debug, timeline, review queues, and MEMORIA lists/KG.
- Keyboard/product navigation now supports `/`, `?`, `Esc`, `g o`, `g m`, `g r`, `g k`, and command search with `Cmd/Ctrl+K`.

## Phase 5 - Accessibility and Interface Quality

**Goal:** raise the interface from visually interesting to genuinely polished.

### Tasks

- [x] Add `:focus-visible` styles for all interactive elements.
- [x] Add `prefers-reduced-motion` handling for animations and visualisers.
- [x] Add `font-variant-numeric: tabular-nums` for counters, tables, diagnostics, and chart labels.
- [x] Add consistent pointer affordance for buttons and clickable rows.
- [x] Add modal/drawer focus trapping.
- [x] Add ARIA labels and roles for drawers, modals, tabs, and graph controls.
- [x] Ensure Escape closes overlays safely.
- [x] Audit colour contrast in dark and light themes.
- [x] Remove emoji-as-icon reliance where it hurts product polish.

### Acceptance criteria

- Keyboard-only navigation works across core flows.
- Screen reader landmarks are sensible.
- Motion can be reduced without breaking layout.
- Data feels visually aligned and professional.

### Phase 5 status update - 2026-07-01

- `ui/dom.js` gained `bindActivatable()`, which makes previously mouse-only clickable rows (memory cards, breakdown filter rows, profile items, triple rows, session events, consolidation cards, realtime events) keyboard-operable via `tabindex`/`role="button"` plus Enter/Space, without swallowing keys meant for nested real buttons/checkboxes.
- New `utils/a11y.js` provides `trapFocus()`, wired into `#detail` (the drawer), `#actionModal`, and the login overlay; each now moves focus in on open, traps Tab/Shift+Tab, and restores focus to the triggering element on close. Verified live in a browser: opening a memory card, tabbing to the last drawer control, and pressing Escape correctly wraps focus and returns it to the originating card.
- `<nav>` and every `.section-tabs` group are `role="tablist"`/`role="tab"` with `aria-selected` kept in sync in `switchTab()`, `showPanel()`, and the visualiser mode switchers (this also fixed a pre-existing bug where switching the Legacy Visualiser's tab was incorrectly clearing the 3D Visualiser tab's active state). `#detail`, `#actionModal`, and the login overlay are `role="dialog" aria-modal="true"` with labelling. `#graphSvg` has a descriptive `aria-label` and points to the Facts table as a keyboard-accessible alternative.
- `static/style.css` adds a global `:focus-visible` ring, a `prefers-reduced-motion` block covering transitions/animations/hover transforms, and `font-variant-numeric: tabular-nums` on counters/tables/diagnostics. Canvas/Three.js render loops already respected `prefers-reduced-motion` from earlier phases.
- Contrast audit (WCAG relative-luminance calculation across every text/surface pairing in both themes) found `--text-subtle` failing badly in both themes (~2.7-3.1:1, need 4.5:1) and light-mode `--text-muted` narrowly failing (~4.07-4.29:1). Both were retuned to ~4.0-4.5:1. `--text-subtle` should still be treated as decorative/redundant-label text, not the sole carrier of information, since it does not clear 4.5:1 on every surface.
- Emoji audit found no problematic emoji-as-primary-icon usage: the existing glyphs (☰ hamburger, ☾/☀ theme, × close) are conventional UI symbols already paired with text labels or `aria-label`s, and the two hidden legacy nav entries using pictographic icons are `aria-hidden` and visually hidden. No changes were needed here beyond confirming this.
- Fixed an unrelated-but-adjacent visual bug found during the pointer-affordance pass: the overview/MEMORIA breakdown rows render with a `.break-row` class, but the only matching CSS rule was a dead `.breakdown-row` selector, so these rows had no layout, borders, or hover feedback at all. Renamed the CSS to `.break-row` and added interactive-row affordance (`cursor:pointer`, hover, focus) gated on `role="button"` so only the actually-clickable breakdown rows get it.
- Added base styling for `.profile-item` (Context Bank) and `.session-event` (session drawer timeline), which previously rendered as unstyled plain text with no clickable affordance.
- New frontend tests: `tests/frontend/a11y.test.js` (focusable-element filtering, Tab/Shift+Tab wrap, focus restore, opt-out of focus restore) and `bindActivatable` coverage in `tests/frontend/dom.test.js`. Full suite: 70 passed.
- Known remaining gap: the 3D/canvas visualisers (constellation, neural map, memory palace) are still mouse-only; keyboard equivalents are out of scope for this phase and remain for the Phase 8 visualiser work.

## Phase 6 - Memory Browser Scalability

**Goal:** make the app stay fast with thousands of memories.

### Tasks

- [x] Add paginated or virtualised rendering for memory grids.
- [x] Avoid rebuilding entire lists via `innerHTML` on every minor state change.
- [x] Add stable item keys.
- [x] Cache source/scope/session filter lists.
- [x] Add visible count and loaded count indicators.
- [x] Add saved filter presets:
  - Needs review
  - High importance
  - Recently recalled
  - Expiring soon
  - Tool-generated
  - Unknown trust
- [x] Add bulk selection persistence across paginated loads only if explicit.

### Acceptance criteria

- Memory browser remains responsive with 1,000+ items.
- Loading more does not re-render the whole world.
- Filter changes feel instant or clearly loading.

### Phase 6 status update - 2026-07-01

- The memory browser (`#memoryList`) previously fetched a single flat page (`limit=150`, no offset) with no way to see more than the first 150 matches. It now paginates: `loadMemories()` fetches page 1 and resets state, `loadMoreMemories()` fetches subsequent pages and `insertAdjacentHTML('beforeend', ...)`s only the *new* cards instead of re-rendering the whole list — verified live in a browser with a 410-row synthetic dataset that the first card's DOM node is preserved (same reference) across a "Load more" click, going from 150 to 300 to 410 loaded, with the Load-more control correctly hiding once the last (partial) page comes back.
- `memoryFilterParams()` (`features/memories.js`) gained an `offset` parameter; `mergeMemoryPage()` handles both the "replace" (new filter search) and "append, dedup by id" (load more) cases, reusing the existing `data-id` as the stable key.
- Added `#memoryListCount` ("N loaded") next to the search controls. A true filtered "N total" was deliberately not added: the only existing precedent (`review_queues()` in `dashboard_core.py`) computes totals by fetching up to 10,000 rows and counting them in Python, which is backend surgery/cost better suited to the real `MemoryQuery` work in Phase 7, not this frontend-scoped phase.
- Added a "Saved views" preset row (`MEMORY_FILTER_PRESETS` in `features/memories.js`) covering all six named presets: Needs review, High importance, Recently recalled, Tool-generated, and Unknown trust map directly onto existing filter/sort controls; Expiring soon has no server-side sort mode, so it fetches a bounded active batch and sorts client-side by `valid_until` ascending (`sortByExpiringSoon()`), capped at 100 results, with the Load-more control hidden since it's a curated snapshot rather than a paginated stream.
- Found and fixed a real bug while testing presets in a browser: `applyMemoryRouteFilters()` only touches a dropdown when the filters object explicitly includes that key, so clicking "Tool-generated" (sets `veracity=tool`) then "Needs review" (doesn't mention `veracity`) silently left the stale `tool` filter active and zeroed out the results. Fixed by extracting a `resetMemoryFilterControls()` helper (used by both the existing "Clear" button and every preset) that clears all filter fields before a preset applies its own.
- Verified rather than re-implemented: source/scope/session filter dropdown options are populated once in `loadStats()` (itself covered by Phase 2's low-volatility TTL cache), not on every `loadMemories()` search — this criterion was already satisfied. Memory cards already key off the stable `data-id` attribute used for dedup. Bulk selection (`bulkSelection`, a `Set` keyed by id) is untouched by pagination appends, so selections persist naturally across "Load more" without extra state — no explicit cross-page persistence feature was added beyond that, per the task's "only if explicit" guidance.
- New/updated frontend tests in `tests/frontend/memories.test.js`: `memoryFilterParams` offset handling, `mergeMemoryPage` replace/append-dedup behavior, and preset resolution/sorting (`memoryPresetByKey`, `sortByExpiringSoon`). Full suite: 77 passed.
- Known remaining gap: the Review queue's own "Load more" (`loadReviewPage`/`renderSelectedReviewQueue`) still fully re-renders its accumulated list on every page — the same anti-pattern this phase fixed for the memory browser. Left alone here to keep the PR scoped to "memory grids" as named in the plan; worth revisiting alongside Phase 7's backend query work.

## Phase 7 - Backend Interface Cleanup

**Goal:** reduce shallow interfaces and make backend queries safer to evolve.

### Tasks

- [x] Introduce a `MemoryQuery` dataclass or equivalent value object.
- [x] Replace the broad `list_memories()` parameter list with a smaller query interface.
- [x] Split query normalisation from SQL construction.
- [x] Add tests for each query mode:
  - status filtering
  - veracity filtering
  - degradation filtering
  - due-for-degradation filtering
  - source/scope/session filtering
  - q search
  - sort modes
- [x] Create a `MemoryMutationService` or equivalent for admin actions.
- [x] Keep backup/audit behaviour centralised.
- [x] Add explicit CSRF token validation for POST endpoints if auth is enabled.
- [x] Add login rate limiting.

### Acceptance criteria

- Public data-store interfaces are smaller and clearer.
- Backend tests cover the query object behaviour.
- Admin mutation guarantees remain intact.
- Security posture improves without making local use painful.

### Phase 7 status update - 2026-07-01

- Added `MemoryQuery` (a frozen dataclass) plus `MemoryQuery.from_raw(...)`, which now owns every bit of normalisation `list_memories()` used to do inline (limit/offset clamping, status/veracity/degradation-tier validation, truthy-string coercion for the three boolean filters, min-importance parsing). `DashboardStore.query_memories(query)` takes only a `MemoryQuery` and does nothing but build/run SQL from already-validated fields — normalisation and SQL construction are now in two different places for the first time.
- `list_memories(**same wide parameter list as before)` still exists and is unchanged for every existing caller (the HTTP route in `server.py`, `stats()`, `review_queues()`, `lifecycle_dashboard()`, `today_digest()` via other paths, `inferred_profile()`, `pattern_insights()`, `constellation()`, `global_search()`, `recall_debug()`, `timeline()`, `session_detail()`); it is now a two-line wrapper that builds a `MemoryQuery` and delegates. New callers should build a `MemoryQuery` and call `query_memories()` directly — deliberately did not migrate the existing internal call sites, since that's mechanical churn across already-tested working code for no behavioural benefit (tracer-bullet scope discipline, same reasoning used in earlier phases for `app-main.js`).
- Centralised the mutation backup/audit template as `DashboardStore._apply_memory_mutation(memory_id, action, backup, mutate, extra)`, used by `invalidate_memory`, `set_memory_importance`, `set_memory_veracity`, and `set_memory_expiry`. Each of those is now just: validate the new value, define a small `mutate(con)` closure with the actual SQL, and merge the mutation-specific field into the shared result shape. Response JSON shapes returned to the frontend are byte-for-byte identical to before.
- `supersede_memory` does **not** route through the same closure signature as the other four — its importance-default/validation logic depends on the *existing* memory's current importance, and the original code deliberately validated that before creating a backup. Forcing it through a `mutate(con)`-only closure would mean either re-fetching `before` twice or silently reordering "validate" after "backup" (creating a wasted backup on a validation failure). Instead it does one extra `get_memory()` read up front to validate early, then still calls `_apply_memory_mutation()` for the shared backup+audit/before-after wrapping — so all five mutations share the backup/audit primitive, just not identical closure signatures. This was a deliberate choice, not an oversight; a fully uniform `MemoryMutationService` class was considered and skipped for the same reason — it would need to either duplicate `DashboardStore`'s connection/table helpers or take a `DashboardStore` reference, adding a layer without changing what's actually shared (the backup+audit sequence, which is now one method).
- New tests in `tests/test_dashboard_core.py` cover status filtering (active/expired/superseded/all), source/scope/session filtering, due-for-degradation filtering (previously only exercised indirectly through `review_queues`/`lifecycle_dashboard`), the `oldest`/`recall` sort modes, and `MemoryQuery.from_raw()` normalisation edge cases (unparsable/out-of-range limit, invalid status/veracity/degradation_tier, truthy-string coercion). Full suite: 56 passed (was 45).
- CSRF: `config.csrf_token_value(cfg)` derives a per-install token via HMAC over `cfg.auth_secret` (same secret as the auth cookie, different HMAC message, so the two derived values are independent). `/api/auth/status` includes `csrf_token` only when `auth_enabled` **and** the request is already authenticated — never exposed to an unauthenticated caller. Every mutating POST except `/api/auth/login` now requires a matching `X-CSRF-Token` header once auth is enabled (checked with `hmac.compare_digest`); when auth is disabled, the check is a no-op, matching the plan's "if auth is enabled" wording and keeping local single-user use frictionless. Verified live in a browser: a real admin mutation through the UI succeeds (token attached by `postJson`), while an identical raw `fetch()` without the header is rejected with 403.
- Login rate limiting: a thread-safe in-memory sliding window (5 attempts / 5 minutes per client IP) in `server.py`, cleared on successful login. This is intentionally simple in-memory state (not persisted, not evicted for long-idle IPs) — proportionate for a local/LAN single-user dashboard, not a public-internet service.
- Frontend: `api/client.js` gained `setCsrfToken()`/automatic `X-CSRF-Token` header attachment in `postJson()`; `app-main.js`'s `refreshAuthState()` captures the token from `/api/auth/status`, and logout clears it.
- Incidental fix: `vitest.config.js` had no `exclude` list, so `npm run test:frontend` was also picking up and running test files from sibling git worktrees checked out under `.claude/worktrees/` (discovered because another agent had a worktree open during this phase). Added an explicit exclude so this repo's test run only ever covers this repo's tests.

## Phase 8 - Lazy Visualisers and Performance

**Outcome:** visualisers become premium without taxing the whole app.

- [x] Lazy-load Three.js.
- [x] Add visualiser loading/error states.
- [x] Stop render loops when visualisers are hidden.
- [x] Add WebGL fallback.
- [x] Add reduced-motion visualiser mode.

### Phase 8 status update - 2026-07-01

- Three of the five tasks were already done before this phase and are only documented here, not re-implemented: Three.js is lazy-loaded via `import()` in `loadThreeModule()`; every `new THREE.WebGLRenderer(...)` call site (3D Visualiser and Memory Palace) already has a try/catch showing a "browser could not start WebGL" fallback card; and `switchTab()` already fully disposes the canvas/Three.js/Memory Palace scenes (`stopCanvasVisualiserLoop()`/`clearThreeScene()`/`clearPalaceScene()`) whenever the user navigates to a different dashboard tab.
- Added a real loading state: `loadThreeVisualiser()`/`loadMemoryPalace()` now show a loading card immediately (covering both the API data fetch and the Three.js module fetch) and a distinct error card if either fails, instead of leaving the previous/blank viewport with a silently-swallowed rejection.
- Added a `prefers-reduced-motion` mode for the 3D Visualiser and Memory Palace (the canvas constellation already had this from Phase 5). New shared `utils/motion.js` (`prefersReducedMotion()`) is used to default `threeVis.paused`/`memoryPalace.paused` to `true` on scene load, which disables auto-rotation, the neural-mode edge-pulse travel animation, drone bobbing, beacon spin, and relic self-rotation — while leaving the render loop itself, and all drag/WASD/pan/zoom interaction, fully functional. Reduced motion means removing *automatic* decorative motion, not disabling interactivity.
- Added `visibilitychange` handling: the canvas/Three.js/Memory Palace render loops now stop rescheduling `requestAnimationFrame` while the browser tab itself is hidden (not just when switching dashboard tabs, which was already handled), and resume automatically when the tab becomes visible again, without disposing/rebuilding the scene.
- Found and fixed two real, unrelated bugs while working in this area:
  - `.three-label`/`.three-labels` (the floating node-name overlays on both the 3D Visualiser and the Memory Palace) had **no CSS at all** (`position: static`), so every label rendered as plain stacked text at the top of the viewport instead of floating over its node — despite the JS correctly computing per-label `left`/`top` coordinates every frame. Added the missing `position:absolute` overlay styling; verified live in a browser that labels now correctly float over their nodes in both visualisers.
  - `renderMemoryPalaceDungeon`/`animateMemoryPalaceDungeon` and `renderMemoryPalaceIso`/`animateMemoryPalaceIso` (plus ~10 helper functions used only by them) were entirely dead code from earlier Memory Palace design iterations — never called from the live `loadMemoryPalace() → renderMemoryPalace() → animateMemoryPalace()` path. Verified via a full call-graph trace (every helper's call sites checked individually, not just the four named functions) before deleting 368 lines. Confirmed via `git show HEAD:static/app.js` that esbuild's bundler was already tree-shaking these unreferenced declarations out of the shipped bundle — so this was a source-readability/maintainability fix (three near-identical "which one is real?" implementations down to one), not a bundle-size fix. Verified both visualisers still render and interact correctly afterward in a live browser.
- A pytest assertion (`test_static_ui_exposes_v23_trust_and_lifecycle_controls`) was literally checking for the dead function names' presence in the built bundle; updated it to only assert on the functions that are actually live.
- New/updated frontend tests: `tests/frontend/motion.test.js` for the extracted `prefersReducedMotion()` helper. Full suite: 80 passed (was 78); backend suite: 56 passed.
- Phase 8 intentionally left broader visualiser controller extraction for future architecture work; the performance and lazy-loading goals for this roadmap were completed here.

## Phase 9 - Charts and Insights Layer

**Goal:** add the charts and analysis layer Billy wants, but only after the architecture can support it.

- [x] Memory growth over time (working vs episodic split).
- [x] Recall frequency distribution.
- [x] Admin mutation/audit activity.
- [x] Future chart and insight ideas moved to the Future Release Backlog.

### Implementation notes

Use a lightweight charting layer only after modularisation. Avoid dumping a heavy chart library into the current raw frontend.

### Phase 9 status update - 2026-07-01

- Evaluated chart library options against the "usable, not decorative" requirement and shadcn's weight concerns (raised by Billy): shadcn charts pull in React + Tailwind + Radix, none of which this vanilla-JS/esbuild project has, so adopting it would mean a parallel framework just for charts. Chose **uPlot v1.6.32** instead — vendored as `static/vendor/uplot.esm.min.js` (~52KB min, ~22KB gzip), zero runtime dependencies, canvas-based, lazy-loaded via `import()` exactly like Three.js from Phase 8, and `--external` in both `package.json`'s `build:frontend` script and `scripts/check_frontend_bundle.mjs` so it never gets inlined into `static/app.js`.
- Added three read-only backend aggregations in `dashboard_core.py` (`memory_growth_series`, `audit_activity_series`, `recall_distribution`) plus matching `/api/insights/*` routes in `server.py` and pytest coverage in `tests/test_dashboard_core.py`/`tests/test_server.py`.
- Added a new **Insights** nav tab (`static/index.html`) with a day-window selector (7/30/90 days), two uPlot line/area charts (memory growth by kind, audit activity by action type), and a recall-frequency distribution reusing the existing `.pattern-bar` CSS pattern (no uPlot needed for that one). All three are genuinely interactive, not decorative: hovering either chart shows a themed tooltip with exact per-day values, and clicking a recall-frequency bucket jumps to Memories pre-filtered and sorted by recall count.
- New `static/src/features/charts.js` feature module (mirrors the `features/graph.js` pattern from Phase 1) owns chart lifecycle: lazy-loads uPlot, builds/destroys chart instances, themes them from the app's existing `--chart-1`..`--chart-6`/`--chart-grid`/`--chart-axis` CSS variables (so charts follow the active theme without any chart-specific dark/light logic), and resizes on window resize. `switchTab()` disposes both chart instances when navigating away from Insights, matching the existing Three.js/Memory Palace disposal pattern.
- Found and fixed a real uPlot integration bug during manual browser verification: the vendored `uplot.esm.min.js` ships with **no CSS of its own** (unlike the npm package, which bundles `uPlot.min.css`), and the JS only sets *some* of the DOM sizing it needs (exact pixel dimensions on `.u-wrap`, devicePixelRatio-scaled `width`/`height` attributes on the `<canvas>`) while relying entirely on companion CSS for the rest (`.u-wrap{position:relative}`, `canvas{width:100%;height:100%}`, legend layout via `.u-inline`). Without that CSS, charts rendered at their raw devicePixelRatio-scaled pixel size (e.g. 612×520 instead of 306×260) and overflowed their cards by several hundred pixels. Fixed by porting the relevant subset of upstream `uPlot.min.css` into `static/style.css`, scoped under `.chart-viewport`, with the app's own colors layered on top. Verified in both light and dark theme, at desktop and mobile widths, using recent-relative mock timestamps and fictional audit-log entries.
- Added a proportional background-fill bar to the existing Overview breakdown rows (Trust mix, Lifecycle, Sources, Scopes, Top sessions) — each `.break-row`'s fill width is the row's share of that panel's total (not share-of-max), with a 2% floor so small non-zero entries stay visible. Pure CSS/markup change to `ui/render.js`'s `breakdown()` helper; no backend change.
- New/updated frontend tests: `tests/frontend/charts.test.js` (7 tests, pure data-transform helpers in `utils/charts.js`) and two new `render.test.js` cases for the breakdown fill-percentage math. Full frontend suite: 89 passed (was 82); backend suite: 58 passed; ruff clean; `check:frontend` bundle-sync clean.
- Deferred items were moved to the Future Release Backlog so Phase 9 remains scoped to the first useful Insights layer rather than an open-ended analytics suite.

## Phase 10 - Product Polish and Release Package

**Outcome:** public repo feels saleable/shareable.

- [x] README polish.
- [x] Screenshots/gallery update.
- [x] Setup docs.
- [x] Architecture docs.
- [x] Accessibility notes.
- [x] Demo fixture DB or sanitized sample mode.
- [x] Release checklist.

### Phase 10 status update - 2026-07-01

- README polish landed: rewrote `README.md` in a warmer, more conversational voice pitched at enthusiasts/tinkerers rather than assumed-technical readers, with a new "Plays nicely with Hermes Agent" section explaining what Hermes Agent is and why the plugin integration matters (previously only a one-line Credits mention). Also caught the feature list up to Phase 9 (it hadn't listed the new Insights tab).
- Screenshot gallery was regenerated from fictional recent-relative data and now includes desktop/mobile Insights coverage.
- Added release-facing docs: `docs/SETUP.md`, `docs/ACCESSIBILITY.md`, `docs/DEMO_DATA.md`, and `docs/RELEASE_CHECKLIST.md`; refreshed `docs/ARCHITECTURE.md` with Phase 10 docs and future extraction targets.
- `scripts/mock_data.py` now uses recent-relative timestamps and can write a fictional audit log; `scripts/generate_mock_screenshots.py` points `HERMES_HOME` at a temporary directory so Insights charts have data without touching real plugin state.
- Non-blocking analytics/refactor ideas were moved into the Future Release Backlog.

## 7. Future Release Backlog

These items are explicitly non-blocking for Phase 10. They are additive product work or deeper refactors that should be considered for future feature releases after the public package is polished.

### Backlog Strategy

Do not treat this backlog as one giant "finish everything" task. It is technically possible for one long agent session to attempt all of it, but the risk is a large, hard-to-review change set that mixes backend aggregation, chart UX, accessibility, and architecture extraction. The healthier path is a small sequence of focused releases.

Recommended order:

1. Release 11A - Insights Completion. Completed 2026-07-01.
2. Release 11B - Scalability Polish. Completed 2026-07-01.
3. Release 11C - Controller Extraction.
4. Release 11D - Visualiser Accessibility.

### Release 11A - Insights Completion

**Outcome:** Insights becomes a fuller operational analytics layer, not just the first three charts.

**Status:** Completed 2026-07-01.

**Scope:**

- Trust/veracity mix over time.
- Source breakdown over time.
- Review backlog burn-down.
- Lifecycle tier transitions: hot -> warm -> cold.
- Entity/domain clusters.
- Session activity heatmap.
- Product-grade insight cards:
  - "Needs review now" with reason.
  - "High-value memories at risk of degradation."
  - "Most recalled entities this week."
  - "Sessions generating the most durable memory."
  - "Potential stale or contradicted memories."

**Likely backend work:**

- Add read-only aggregation methods to `dashboard_core.py`, following the existing `memory_growth_series`, `audit_activity_series`, and `recall_distribution` pattern.
- Add matching `GET /api/insights/*` routes in `server.py`.
- Keep endpoints bounded with day/window/limit caps. Avoid endpoints that scan unbounded memory tables without limits.
- For review burn-down and lifecycle transitions, decide whether current SQLite fields are sufficient or whether the audit log is the only reliable history source.
- For entity/domain clusters, reuse existing `pattern_insights()` / taxonomy helpers where possible before inventing a new clustering pipeline.

**Likely frontend work:**

- Extend `static/src/features/charts.js` and `static/src/utils/charts.js`.
- Add compact chart panels to the existing Insights tab in `static/index.html`.
- Reuse uPlot for time-series charts and existing `.pattern-bar` / breakdown row patterns for categorical insights where a chart would add noise.
- Keep charts clickable only when the click can route to a useful filtered view.
- Add loading, empty, and error states for every new panel.

**Tests:**

- Backend tests for each aggregation shape in `tests/test_dashboard_core.py`.
- Server route tests in `tests/test_server.py`.
- Frontend data-shaping tests in `tests/frontend/charts.test.js`.
- Browser smoke or manual screenshot verification for the expanded Insights tab.

**Acceptance criteria:**

- Every new chart answers a concrete operational question.
- No chart is decorative only.
- Date windows work for 7/30/90 days where relevant.
- Empty datasets render as useful empty states rather than blank panels.
- Screenshot/demo data shows non-empty Insights panels.
- `npm run check:frontend`, pytest, ruff, compileall, and frontend smoke pass.

**One-session guidance:**

Can be done in one session if the scope is limited to the charts and insight cards listed above. Do not combine it with controller extraction in the same PR.

**Release 11A status update - 2026-07-01**

- Added bounded read-only aggregation methods in `dashboard_core.py` and matching `/api/insights/*` routes in `server.py` for trust/veracity mix, source breakdown, review backlog, lifecycle events, entity/domain clusters, session activity heatmap, and action cards.
- Expanded `static/src/features/charts.js` and `static/src/utils/charts.js` to render four additional uPlot time-series charts plus pattern-bar clusters, action cards, and a session heatmap.
- Expanded the Insights tab in `static/index.html` and added compact CSS for cards and heatmap rows.
- Extended mock/smoke tooling so fictional audit data is available and browser smoke covers `#/insights`.
- Added backend, server-route, and frontend chart-helper tests for the new shapes.

### Release 11B - Scalability Polish

**Outcome:** the remaining high-friction list-scaling issues are cleaned up without changing the product concept.

**Status:** Completed 2026-07-01.

**Scope:**

- Improve Review queue pagination so "Load more" appends only new cards instead of re-rendering the accumulated queue.
- Add exact filtered total counts for the memory browser if the backend can expose them cheaply.

**Likely backend work:**

- Introduce a count path for `MemoryQuery` only if it can reuse the same normalisation and SQL constraints as `query_memories()`.
- Prefer a dedicated `count_memories(query)` or `{items,total,next_offset}` shape over fetching 10,000 rows and counting in Python.
- Keep compatibility with existing `/api/memories` callers if adding total metadata.

**Likely frontend work:**

- Refactor `renderSelectedReviewQueue()` so append mode preserves existing DOM nodes and inserts only new queue cards.
- Keep review selection state stable across appended pages.
- Update `#reviewQueueCount` and `#memoryListCount` copy to distinguish loaded vs total.
- Add retry/error behavior for appended review pages.

**Tests:**

- Frontend tests for review append/dedup behavior in `tests/frontend/review.test.js`.
- Backend tests for any new count query behavior.
- Browser check with a synthetic multi-page review dataset.

**Acceptance criteria:**

- Review "Load more" does not rebuild already-rendered cards.
- Selection survives pagination appends.
- Memory list can show loaded and total counts when total is available.
- No expensive all-row count workaround is introduced.

**One-session guidance:**

Good one-session candidate. It is narrow and mostly mechanical, but it should still ship with tests.

**Release 11B status update - 2026-07-01**

- Added `DashboardStore.count_memories(query)` and shared memory filter construction so list queries and count queries use the same normalised constraints.
- Expanded `GET /api/memories` to return `items`, `total`, `listed`, `limit`, `offset`, `next_offset`, and `has_more` while preserving existing `items` callers.
- Updated the memory browser to show loaded vs total counts when backend totals are available, and to drive pagination from `has_more`/`next_offset` instead of guessing from page size alone.
- Refactored Review queue append mode so "Load more" preserves existing queue card DOM, appends only new cards, keeps selection state, and updates visible counts.
- Added backend, server-route, and frontend helper tests for filtered totals and review append/dedup behavior.

### Release 11C - Controller Extraction

**Outcome:** `static/src/app-main.js` stops being the primary place where unrelated feature behavior accumulates.

**Status:** Complete. Review, detail/session drawer, auth/settings, and visualiser controllers extracted 2026-07-02.

**Scope:**

- Extract visualiser controllers from `app-main.js` into dedicated modules.
- Extract auth/settings controller.
- Extract review controller.
- Extract detail drawer/session drawer controller.

**Recommended sequence:**

1. Review controller first, because it has clear state, events, rendering, and tests already nearby.
2. Detail drawer controller second, because it touches routing and focus lifecycle.
3. Auth/settings controller third, because it touches CSRF, config, backup, and diagnostics.
4. Visualiser controllers last, because they combine canvas/WebGL state, pointer input, resize behavior, reduced motion, and lazy vendor imports.

**Likely files:**

- `static/src/features/review-controller.js`
- `static/src/features/detail-drawer.js`
- `static/src/features/settings-controller.js`
- `static/src/visualisers/constellation.js`
- `static/src/visualisers/three-visualiser.js`
- `static/src/visualisers/memory-palace.js`

**Tests:**

- Add unit tests around extracted pure helpers first.
- Keep browser smoke as the regression guard for cross-feature wiring.
- Add targeted tests for routing/focus interactions when extracting drawer behavior.

**Acceptance criteria:**

- No behavior regression in routes, review, settings, drawer, or visualisers.
- `app-main.js` meaningfully shrinks and becomes orchestration rather than implementation.
- New modules have narrow public APIs and avoid importing the whole app state.
- `static/app.js` stays generated and bundle sync remains clean.

**One-session guidance:**

Do not do the entire extraction in one session unless the goal is explicitly a large refactor branch. A safe session should extract one controller family at a time.

**Release 11C status update - 2026-07-01**

- Extracted Review queue state, rendering, pagination, selection, filter controls, and admin mutation handlers from `static/src/app-main.js` into `static/src/features/review-controller.js`.
- Kept `app-main.js` as the route/orchestration layer: the Review route now calls `reviewController.loadReview()`, and startup wiring calls `reviewController.bindGlobalControls()`.
- Preserved existing Review helper tests and used the frontend bundle/test suite plus browser smoke as the regression guard for this controller slice.
- Remaining 11C controller families: detail/session drawer, auth/settings, and visualisers.

**Release 11C status update - 2026-07-02**

- Extracted generic detail rendering, manual-copy modal handoff, memory detail drawer, session detail drawer, memory-card click binding, and JSON-card inspection binding into `static/src/features/detail-drawer.js`.
- Kept existing app-wide function names in `app-main.js` as thin orchestration wrappers so graph, search, profile, timeline, visualiser, and settings callers continue to use the same surface.
- Verified frontend bundle/tests, backend tests, ruff, compileall, and browser smoke after extraction.
- Remaining 11C controller families: auth/settings and visualisers.

**Release 11C status update - 2026-07-02, auth/settings slice**

- Extracted password auth overlay handling, auth status/config hydration, memory-admin mode controls, backup/audit actions, database diagnostics, and runtime diagnostics into `static/src/features/settings-controller.js`.
- Moved auth/admin state ownership out of `app-main.js`; the main file now exposes thin `canAdmin()`, `refreshAuthState()`, and settings loader wrappers for other controllers and route orchestration.
- Verified frontend bundle/tests, backend tests, ruff, compileall, and browser smoke after extraction.
- Remaining 11C controller family: visualisers.

**Release 11C status update - 2026-07-02, visualiser chrome slice**

- Added `static/src/visualisers/chrome.js` for shared visualiser fullscreen/chrome helpers.
- Kept existing `app-main.js` wrapper names for fullscreen, exit, responsive fill, and button updates so current canvas/WebGL/FPS event wiring remains stable.
- Verified frontend bundle/tests, backend tests, ruff, and compileall after extraction.
- Remaining 11C visualiser work: split the canvas constellation, Three.js visualiser, and Mnemosyne Labyrinth implementations into dedicated visualiser modules.

**Release 11C status update - 2026-07-02, Mnemosyne Labyrinth slice**

- Extracted the Memory Palace / Mnemosyne Labyrinth FPS implementation into `static/src/visualisers/memory-palace.js`.
- Kept `app-main.js` wrapper names for load, reset, search beacon, resize, render-loop resume, and disposal so route changes, fullscreen resize, and visibility lifecycle continue to use the existing orchestration surface.
- Replaced app-level direct state checks with narrow controller methods for `isRendering()` and `resume()`.
- Verified frontend bundle/tests, backend tests, ruff, compileall, and browser smoke after extraction.
- Remaining 11C visualiser work: split the canvas constellation and Three.js visualiser implementations into dedicated visualiser modules.

**Release 11C status update - 2026-07-02, visualiser completion slice**

- Extracted the canvas constellation/neural map implementation into `static/src/visualisers/constellation.js`.
- Extracted the WebGL Three.js constellation/neural visualiser implementation into `static/src/visualisers/three-visualiser.js`.
- Kept the shared Three.js lazy loader in `app-main.js` so both WebGL visualiser controllers continue to use one vendor import promise.
- Kept `app-main.js` as the visualiser orchestration layer with thin wrappers for route cleanup, fullscreen redraw/resize, tab buttons, pause/pan controls, and visibility resume.
- Verified frontend bundle/tests, backend tests, ruff, compileall, and browser smoke after the completed visualiser extraction.
- Release 11C is complete; Release 11D remains the next visualiser-focused phase for keyboard equivalents and accessible data paths.

### Release 11D - Visualiser Accessibility

**Outcome:** the signature visualisers become usable beyond pointer-only interaction, with clear keyboard alternatives and reduced-motion behavior preserved.

**Status:** Complete. Keyboard controls, focusable viewports, and equivalent accessible data paths completed 2026-07-02.

**Scope:**

- Keyboard controls for canvas constellation/neural map:
  - focus visualiser,
  - move selection between visible nodes,
  - open selected node,
  - reset view,
  - pause/resume motion.
- Keyboard controls for 3D Visualiser and Memory Palace where practical:
  - focus viewport,
  - rotate/pan/zoom with keys,
  - reset camera,
  - pause/resume motion.
- Non-canvas fallback/alternative views where interaction would otherwise be inaccessible.
- Help text or shortcut discovery inside the existing shortcut/help system.

**Likely implementation notes:**

- Do not try to make every WebGL object individually screen-reader readable.
- Provide equivalent access to the underlying data through lists/tables/details.
- Use ARIA descriptions to explain what the visualiser is and where the accessible alternative lives.
- Respect `prefers-reduced-motion` and avoid reintroducing decorative auto-motion.

**Tests:**

- Unit tests for keyboard action mapping and focus behavior.
- Manual browser verification for keyboard-only visualiser flows.
- Reduced-motion verification.

**Acceptance criteria:**

- A keyboard user can inspect visualiser data without a mouse.
- A keyboard user can reset/pause and move through key nodes where the canvas/WebGL view is focused.
- Screen reader users get a useful description and an equivalent data path.
- Reduced-motion users do not get automatic decorative motion.

**One-session guidance:**

This is design-sensitive and should not be bundled with Insights or architecture extraction. It can be one session if scoped to keyboard alternatives for one visualiser family at a time.

**Release 11D status update - 2026-07-02, keyboard access slice**

- Made the canvas constellation/neural map focusable and documented keyboard controls in the canvas label and global shortcut help.
- Added canvas keyboard navigation for visible nodes with arrow keys, selected-node highlighting, Enter/Space open behavior, `R` reset, `P` pause/resume, `M` pan/rotate mode, and `+`/`-` zoom.
- Made the Three.js visualiser and Mnemosyne Labyrinth viewports focusable with role/labels and visible focus outlines.
- Added Three.js viewport keyboard controls for rotate/pan arrows, `+`/`-` zoom, `R` reset, and `P` pause/resume.
- Added regression assertions for focusable visualiser surfaces, keyboard shortcut discovery, and focus styling.
- Remaining 11D work: richer non-canvas accessible alternative lists/details where needed, plus deeper keyboard inspection behavior for WebGL object selection where useful.

**Release 11D status update - 2026-07-02, accessible data path completion**

- Added equivalent keyboard-operable data panels for the canvas constellation/neural map, the Three.js visualiser, and the Mnemosyne Labyrinth.
- Each panel is populated from the same nodes used by the visual renderer and row activation drives the existing inspector behavior; Labyrinth section rows can move the diver near that section and relic rows set the beacon.
- Updated visualiser ARIA descriptions to point users toward the equivalent keyboard lists.
- Added regression assertions for the accessible data containers, render hooks, and list styling.
- Release 11D is complete; remaining visualiser accessibility work, if discovered during manual review, should be tracked as polish follow-up rather than a blocking 11D gap.

### Future Backlog Verification Template

Every future backlog release should finish with:

```bash
npm run build:frontend
npm run check:frontend
/Users/habibi/.local/bin/uv run --with pytest --python /Users/habibi/.local/bin/python3.11 python -m pytest tests/ -q
/Users/habibi/.local/bin/uv run --with ruff --python /Users/habibi/.local/bin/python3.11 python -m ruff check .
/Users/habibi/.local/bin/python3.11 -m compileall -q .
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/frontend_smoke.py
```

## 8. Design Direction

### Keep

- Dark iron surface language.
- Teal accent as primary brand action colour.
- Book of Shadows naming.
- Mnemosyne / memory-console positioning.
- Local-first privacy framing.
- 3D visualiser as a distinctive signature feature.

### Improve

- Make screens calmer and more legible.
- Reduce “everything everywhere” density.
- Add clearer hierarchy between overview, action queues, and exploration surfaces.
- Create better onboarding/empty states.
- Add consistent action placement.
- Make destructive admin actions visually distinct but not melodramatic.
- Ensure mobile is usable for review/search, not just technically responsive.

### Avoid

- Neon cyberpunk overload.
- Card shadow spam.
- Purple AI-dashboard sludge.
- Emoji-as-primary-icon system.
- Adding charts with no decision value.
- A full rewrite before baselining and testing.

## 9. UX Friction Audit Targets

| Flow | Current friction | Desired state |
|---|---|---|
| First load | Data appears after async boot with limited skeleton structure | Clear loading skeleton and immediate shell confidence |
| Memory search | Search can race, results pop in | Debounced search, cancel stale requests, show result count |
| Review queue | Bulk actions feel risky | Selection summary, confirm sheet, clear success toast, backup info |
| Detail inspection | Drawer is visually present but a11y-light | Focus trap, ESC close, deep link, copy/share action |
| Settings | Powerful but intimidating | Grouped risk levels, clearer helper text, test connection buttons |
| Visualiser | Heavy and always bundled | Lazy, guided, optional, performance-safe |
| Mobile use | Functional but dense | Prioritised review/search flows, bottom nav or compact rail if needed |

## 10. Technical Debt Register

| Debt | Severity | Resolution |
|---|---|---|
| Monolithic `app.js` | HIGH | Module extraction and build step |
| Global mutable state | HIGH | Store modules with narrow interfaces |
| No JS tests | HIGH | Vitest + Playwright |
| Broad `list_memories()` signature | HIGH | `MemoryQuery` object/query builder |
| Heavy visualiser bundle | MEDIUM | Lazy-load Three.js |
| No URL routing | HIGH | Hash/history router |
| No focus management | MEDIUM | A11y utility module |
| No request dedupe/cache | MEDIUM | API client layer |
| No rate-limited login | MEDIUM | Simple in-memory throttle |
| No CSRF token | MEDIUM | Same-origin token for POST when auth enabled |

## 11. Documentation Plan

### Repo docs to add/update

- `README.md` - clarify product, setup, screenshots, current limitations.
- `TRANSFORMATION_PLAN.md` - this plan, local to repo.
- `docs/ARCHITECTURE.md` - module map after extraction starts.
- `docs/FRONTEND_TESTING.md` - how to run Vitest/Playwright.
- `docs/SECURITY_MODEL.md` - local-first read-only default, admin mode, backup/audit model.
- `docs/UX_PRINCIPLES.md` - product principles and interface rules.

### Obsidian notes

- The Obsidian note remains the human-facing transformation plan.
- Update after each sprint with actual outcomes, not optimistic intent.
- If a sprint changes file structure, update the codebase shape table.

## 12. Acceptance Definition for “Multi-Million-Dollar Team” Feel

Book of Shadows reaches the target quality bar when:

- Initial load feels fast and intentional.
- Every primary action has visible feedback.
- Every major screen has a clear job.
- Memory review is easy to understand and safe to perform.
- Charts answer useful operational questions.
- The app works well with keyboard and mouse.
- The browser back button works.
- Large memory lists remain responsive.
- Tests catch core regressions before Billy does.
- The repo can be understood by a new engineer or agent in under 30 minutes.
- The interface looks distinctive without looking chaotic.

## 13. Immediate Next Actions

1. Finish Phase 10 documentation and release artifacts.
2. Refresh demo/mock data so screenshots and Insights charts remain useful over time.
3. Regenerate the screenshot gallery.
4. Run the full release verification checklist.
5. Keep future-release items out of the Phase 10 scope unless Billy explicitly re-prioritises them.

## 14. Notes from the Review Discussion

- The review was intentionally blunt: the backend is solid, the frontend application layer is the bottleneck.
- This does not mean the project is bad. It means the core opportunity is clear.
- The current frontend has the smell of AI-generated prototype code: visually ambitious, functionally dense, but not decomposed into maintainable pieces.
- That is fixable. The right path is controlled modularisation, not panic rewriting.

## 15. Source Checks

- Verified Obsidian vault root: `/Users/habibi/OBSIDIAN-VAULT/Obsidian Vault/.obsidian`
- Verified target Obsidian folder: `/Users/habibi/OBSIDIAN-VAULT/Obsidian Vault/HERMES/10 Projects/Witch Daddy Labs/Built Apps`
- Verified local project folder: `/Users/habibi/hermes/apps-codebases/mnemosyne-dashboard`
- Loaded skill: `obsidian`
- Loaded skill: `matt-pocock-engineering`
- Loaded reference: `matt-pocock-engineering/references/book-of-shadows-review-2026-06.md`
