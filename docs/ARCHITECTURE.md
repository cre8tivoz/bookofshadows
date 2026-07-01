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
- `state/routing.js`: pure route parse/serialize helpers and legacy tab aliases.
- `features/memories.js`: pure memory card/meta rendering and mutability helper.
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
