# Architecture

## Frontend Source Layout

Phase 1 introduces a source tree under `static/src/` and bundles it back to `static/app.js` so the Python server and HTML shell keep serving the same asset path.

```text
static/src/
  app.js
  api/
    client.js
  features/
    memories.js
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

- `api/client.js`: fetch wrapper, JSON POST helper, and unauthorized callback seam.
- `ui/dom.js`: selector helpers, select rendering, section panel switching, mobile menu helpers.
- `ui/render.js`: shared state-card, breakdown, select-option, and count-label rendering helpers.
- `utils/escape.js`: HTML escaping, ID shortening, chat-role prefix helpers.
- `utils/format.js`: time and byte formatting.
- `state/routing.js`: pure route parse/serialize helpers and legacy tab aliases.
- `features/memories.js`: pure memory card/meta rendering and mutability helper.

Large controller functions such as `switchTab()`, `applyRoute()`, feature loaders, drawer actions, and visualiser lifecycle remain in `static/src/app.js` for now. They should move only after dependencies are explicit and covered by tests.

## Test Strategy

Frontend unit tests live in `tests/frontend/` and run with Vitest + happy-dom:

```bash
npm run test:frontend
```

The browser smoke test still exercises the generated `static/app.js` through the Python server:

```bash
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/frontend_smoke.py
```
