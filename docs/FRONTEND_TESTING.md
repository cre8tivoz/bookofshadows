# Frontend Testing

Book of Shadows ships static HTML/CSS/JavaScript from the Python stdlib server. Frontend source now lives under `static/src/` and bundles back to the served `static/app.js` file.

## Build

```bash
npm install
npm run build:frontend
```

`static/app.js` is generated from `static/src/app.js`. Edit files under `static/src/`, not the generated bundle.

## Unit Tests

```bash
npm run test:frontend
```

The unit tests use Vitest and happy-dom for extracted modules.

## Smoke Test

Run the browser smoke test with Python 3.11 and the temporary `websocket-client` dependency:

```bash
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/frontend_smoke.py
```

The smoke test:

- Creates a temporary SQLite database with fictional Mnemosyne records.
- Starts `server.py` on a free localhost port.
- Verifies `/api/health`, `/api/stats`, `/`, `/static/app.js`, and `/static/style.css`.
- Opens headless Chrome through the DevTools protocol.
- Verifies the `overview`, `today`, `memories`, `graph`, and `settings` routes render active sections without a visible boot error.

It requires Google Chrome at:

```text
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

## Screenshot Baseline

Regenerate the screenshot gallery with:

```bash
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/generate_mock_screenshots.py
```

Screenshots are generated from the same fictional data model and written under `docs/screenshots/`.

## Static Checks

Useful frontend-adjacent checks:

```bash
npm run build:frontend
node --check static/app.js
/Users/habibi/.local/bin/python3.11 -m compileall -q .
```
