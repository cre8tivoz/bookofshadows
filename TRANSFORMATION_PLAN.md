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

- [ ] Confirm repo remote is clean and disconnected from original fork lineage.
- [ ] Run and record backend tests: `python -m pytest tests/ -v`.
- [ ] Add a lightweight frontend smoke test if none exists.
- [ ] Capture baseline screenshots for every major tab: Overview, Today, Visualiser, Review, Memories, Context Bank, Lifecycle, Knowledge Graph, MEMORIA, History, Settings.
- [ ] Record baseline frontend payload sizes:
  - `static/app.js`
  - `static/style.css`
  - `static/vendor/three.module.min.js`
- [ ] Record baseline performance in browser:
  - first load
  - tab switch latency
  - memory search latency
  - visualiser open time
- [ ] Add a local `docs/` folder if needed for screenshots and architecture docs.

### Acceptance criteria

- Baseline is documented in the repo.
- Backend tests are green.
- There is at least one repeatable browser smoke check.
- No feature work begins without a known baseline.

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
- [ ] Move visualisers into lazy-loaded modules.
  - Current status: visualiser lifecycle code is isolated behind the guarded `app.js` entrypoint in transitional `app-main.js`; the true lazy canvas/Three/palace split remains the main unfinished Phase 1 extraction target.
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
- The outstanding Phase 1 item is true lazy-loaded visualiser extraction for canvas constellation/neural map, Three.js, and memory palace.

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

- [ ] Add URL routes for tabs, e.g. `#/overview`, `#/memories`, `#/graph`.
- [ ] Add route params for key filters, e.g. `#/memories?q=whoop&status=active`.
- [ ] Support deep links to memory detail drawers, e.g. `#/memory/<id>`.
- [ ] Ensure browser back/forward works.
- [ ] Preserve active tab on reload.
- [ ] Add route-aware sidebar active states.

### Acceptance criteria

- Every major tab can be bookmarked.
- Browser back returns to previous dashboard state.
- A memory detail link can be opened directly.
- No broken default route.

## Phase 4 - Friction Reduction and Product UX

**Goal:** make daily use feel premium, safe, and low-friction.

### Tasks

- [ ] Add toast notifications for save, backup, expire, trust update, auth changes, and errors.
- [ ] Add disabled/loading states to every mutating button.
- [ ] Add confirmation sheets for destructive or bulk actions.
- [ ] Add undo affordance where feasible for safe reversible actions.
- [ ] Add skeleton screens for major data panels.
- [ ] Improve empty states with specific next steps.
- [ ] Add a global command/search entry point.
- [ ] Add keyboard shortcuts:
  - `/` focus search
  - `?` shortcuts/help
  - `Esc` close drawer/modal
  - `g o` overview
  - `g m` memories
  - `g r` review
  - `g k` knowledge graph
- [ ] Add action summary after bulk review actions.

### Acceptance criteria

- A user always knows whether an action is running, succeeded, failed, or needs retry.
- Bulk actions feel safe and deliberate.
- Common navigation can be done without the mouse.

## Phase 5 - Accessibility and Interface Quality

**Goal:** raise the interface from visually interesting to genuinely polished.

### Tasks

- [ ] Add `:focus-visible` styles for all interactive elements.
- [ ] Add `prefers-reduced-motion` handling for animations and visualisers.
- [ ] Add `font-variant-numeric: tabular-nums` for counters, tables, diagnostics, and chart labels.
- [ ] Add consistent pointer affordance for buttons and clickable rows.
- [ ] Add modal/drawer focus trapping.
- [ ] Add ARIA labels and roles for drawers, modals, tabs, and graph controls.
- [ ] Ensure Escape closes overlays safely.
- [ ] Audit colour contrast in dark and light themes.
- [ ] Remove emoji-as-icon reliance where it hurts product polish.

### Acceptance criteria

- Keyboard-only navigation works across core flows.
- Screen reader landmarks are sensible.
- Motion can be reduced without breaking layout.
- Data feels visually aligned and professional.

## Phase 6 - Memory Browser Scalability

**Goal:** make the app stay fast with thousands of memories.

### Tasks

- [ ] Add paginated or virtualised rendering for memory grids.
- [ ] Avoid rebuilding entire lists via `innerHTML` on every minor state change.
- [ ] Add stable item keys.
- [ ] Cache source/scope/session filter lists.
- [ ] Add visible count and loaded count indicators.
- [ ] Add saved filter presets:
  - Needs review
  - High importance
  - Recently recalled
  - Expiring soon
  - Tool-generated
  - Unknown trust
- [ ] Add bulk selection persistence across paginated loads only if explicit.

### Acceptance criteria

- Memory browser remains responsive with 1,000+ items.
- Loading more does not re-render the whole world.
- Filter changes feel instant or clearly loading.

## Phase 7 - Backend Interface Cleanup

**Goal:** reduce shallow interfaces and make backend queries safer to evolve.

### Tasks

- [ ] Introduce a `MemoryQuery` dataclass or equivalent value object.
- [ ] Replace the broad `list_memories()` parameter list with a smaller query interface.
- [ ] Split query normalisation from SQL construction.
- [ ] Add tests for each query mode:
  - status filtering
  - veracity filtering
  - degradation filtering
  - due-for-degradation filtering
  - source/scope/session filtering
  - q search
  - sort modes
- [ ] Create a `MemoryMutationService` or equivalent for admin actions.
- [ ] Keep backup/audit behaviour centralised.
- [ ] Add explicit CSRF token validation for POST endpoints if auth is enabled.
- [ ] Add login rate limiting.

### Acceptance criteria

- Public data-store interfaces are smaller and clearer.
- Backend tests cover the query object behaviour.
- Admin mutation guarantees remain intact.
- Security posture improves without making local use painful.

## Phase 8 - Lazy Visualisers and Performance

**Outcome:** visualisers become premium without taxing the whole app.

- [ ] Lazy-load Three.js.
- [ ] Add visualiser loading/error states.
- [ ] Stop render loops when visualisers are hidden.
- [ ] Add WebGL fallback.
- [ ] Add reduced-motion visualiser mode.

## Phase 9 - Charts and Insights Layer

**Goal:** add the charts and analysis layer Billy wants, but only after the architecture can support it.

### High-value chart ideas

- Memory growth over time.
- Working vs episodic memory split.
- Trust/veracity mix over time.
- Source breakdown over time.
- Review backlog burn-down.
- Recall frequency distribution.
- Lifecycle tier transitions: hot → warm → cold.
- Entity/domain clusters.
- Session activity heatmap.
- Admin mutation/audit activity.

### Product-grade insight cards

- “Needs review now” with reason.
- “High-value memories at risk of degradation.”
- “Most recalled entities this week.”
- “Sessions generating the most durable memory.”
- “Potential stale or contradicted memories.”

### Implementation notes

Use a lightweight charting layer only after modularisation. Avoid dumping a heavy chart library into the current raw frontend.

## Phase 10 - Product Polish and Release Package

**Outcome:** public repo feels saleable/shareable.

- [ ] README polish.
- [ ] Screenshots/gallery update.
- [ ] Setup docs.
- [ ] Architecture docs.
- [ ] Accessibility notes.
- [ ] Demo fixture DB or sanitized sample mode.
- [ ] Release checklist.

## 7. Proposed Sprint Breakdown

## Sprint 1 - Baseline and Build Harness

**Outcome:** no visible product changes, but the app becomes safer to change.

- [ ] Add frontend build step.
- [ ] Add frontend test harness.
- [ ] Add baseline screenshots.
- [ ] Document current payload sizes and performance.
- [ ] Keep existing static output path compatible with server.

## Sprint 2 - Modular Frontend Core

**Outcome:** `app.js` stops being the source of all truth.

- [ ] Extract API client.
- [ ] Extract DOM/render utilities.
- [ ] Extract route/state store.
- [ ] Extract memory browser module.
- [ ] Add tests for extracted utilities.

## Sprint 3 - UX Feedback Layer

**Outcome:** every action has clear feedback.

- [ ] Toasts.
- [ ] Loading states.
- [ ] Disabled mutating buttons.
- [ ] Confirmations for destructive actions.
- [ ] Error panels with retry.

## Sprint 4 - Routing and Deep Links

**Outcome:** dashboard behaves like a real app.

- [ ] URL routes for tabs.
- [ ] URL params for filters.
- [ ] Deep link to memory details.
- [ ] Browser back/forward support.

## Sprint 5 - Accessibility and Keyboard Power

**Outcome:** keyboard users and power users get a dramatically better app.

- [ ] Focus visible styles.
- [ ] Drawer/modal focus trap.
- [ ] Escape-to-close.
- [ ] Keyboard shortcuts.
- [ ] Reduced motion support.

## Sprint 6 - Scalable Memory Browser

**Outcome:** large memory banks remain usable.

- [ ] Virtual or paginated rendering.
- [ ] Saved filter presets.
- [ ] Request dedupe and abort handling.
- [ ] Better loaded-count UI.

## Sprint 7 - Backend Query Interface

**Outcome:** backend gets deeper, safer seams.

- [ ] Add `MemoryQuery` object.
- [ ] Refactor `list_memories()` behind compatibility layer.
- [ ] Add query-builder tests.
- [ ] Centralise mutation/audit backup logic.
- [ ] Add login rate limiting and CSRF token validation where appropriate.

## Sprint 8 - Lazy Visualisers and Performance

**Outcome:** visualisers become premium without taxing the whole app.

- [ ] Lazy-load Three.js.
- [ ] Add visualiser loading/error states.
- [ ] Stop render loops when visualisers are hidden.
- [ ] Add WebGL fallback.
- [ ] Add reduced-motion visualiser mode.

## Sprint 9 - Charts and Insights Layer

**Outcome:** Book of Shadows starts feeling like an intelligence product, not only a browser.

- [ ] Add memory growth chart.
- [ ] Add trust mix over time.
- [ ] Add review backlog chart.
- [ ] Add lifecycle transition panel.
- [ ] Add insight cards with actionable summaries.

## Sprint 10 - Product Polish and Release Package

**Outcome:** public repo feels saleable/shareable.

- [ ] README polish.
- [ ] Screenshots/gallery update.
- [ ] Setup docs.
- [ ] Architecture docs.
- [ ] Accessibility notes.
- [ ] Demo fixture DB or sanitized sample mode.
- [ ] Release checklist.

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

1. Create a branch for Sprint 1.
2. Add baseline docs and screenshots.
3. Add a frontend build/test harness without changing behaviour.
4. Extract API client and utility modules first.
5. Add one Playwright smoke test around loading the dashboard.
6. Only then start UX improvements.

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
