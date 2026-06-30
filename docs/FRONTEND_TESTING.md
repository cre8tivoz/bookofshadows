# Frontend Testing

Book of Shadows currently ships as static HTML/CSS/JavaScript served by the Python stdlib server. Phase 0 keeps that architecture intact and adds a repeatable smoke check before the larger frontend extraction begins.

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
node --check static/app.js
/Users/habibi/.local/bin/python3.11 -m compileall -q .
```

The planned Phase 1 work can add Vitest/Playwright or a bundler-backed harness after the baseline remains stable.
