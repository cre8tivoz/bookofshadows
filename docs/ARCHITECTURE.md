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
- `ui/render.js`: shared state-card, breakdown, select-option, and count-label rendering helpers.
- `utils/escape.js`: HTML escaping, ID shortening, chat-role prefix helpers.
- `utils/format.js`: time and byte formatting.
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
