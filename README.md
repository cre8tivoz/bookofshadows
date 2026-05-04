# Mnemosyne Dashboard

A local, read-only web dashboard for browsing and visualising a Mnemosyne memory store from Hermes Agent.

It is intentionally small: Python standard library server, static HTML/CSS/JS frontend, no external JS runtime, no cloud calls, and SQLite opened in read-only mode.

## Screenshots

The screenshots below are generated from a synthetic mock Mnemosyne database. They do not contain private memory data.

| Desktop | Mobile |
| --- | --- |
| ![Desktop dark overview](docs/screenshots/desktop-dark-overview.png) | ![Mobile dark overview](docs/screenshots/mobile-dark-overview.png) |
| ![Desktop light overview](docs/screenshots/desktop-light-overview.png) | ![Mobile light search](docs/screenshots/mobile-light-search.png) |
| ![Desktop dark global search](docs/screenshots/desktop-dark-search.png) | ![Mobile dark timeline](docs/screenshots/mobile-dark-timeline.png) |
| ![Desktop light graph](docs/screenshots/desktop-light-graph.png) | ![Mobile light graph](docs/screenshots/mobile-light-graph.png) |
| ![Desktop dark timeline](docs/screenshots/desktop-dark-timeline.png) | ![Mobile dark settings](docs/screenshots/mobile-dark-settings.png) |

Regenerate the gallery locally with:

```bash
python3 scripts/generate_mock_screenshots.py
```

The generator creates a temporary mock SQLite database, starts the dashboard on a random localhost port, captures desktop/mobile viewports in dark and light themes, and writes the images to `docs/screenshots/`.

## Features

- Five-section product navigation instead of raw database tabs:
  - Overview — counts, breakdowns, quick actions, and recent memories
  - Explore — global search, memory browser, and recall debugger
  - Activity — timeline and consolidation history
  - Graph — relationship graph and triples table
  - Settings — optional password authentication and server/database config
- Overview counts for working memory, episodic memory, triples, and consolidations
- Recent memory cards with raw JSON detail drawer
- Clickable overview breakdown rows and quick actions that jump into filtered workflows
- Explore section:
  - Global search across memories, triples, and consolidations
  - Memory browser with query, tier/source/scope/session filters, and sorting
  - Recall debugger with approximate ranking explanations
- Activity section:
  - Mini timeline grouped by day or session
  - Consolidation history with filtering, JSON inspection, and jump-to-session memories
- Graph section:
  - Interactive relationship graph with query filtering
  - Clickable nodes and edges
  - Inspector panel with jumps into Triples and Memories
  - Triples table with clickable row details
- Optional password authentication, configurable from the Settings tab
- Editable Settings fields for bind address, port, and Mnemosyne database path
- Desktop and mobile responsive layouts
- Dark and light themes
- Mnemosyne-inspired light theme with self-hosted fonts/assets
- `/api/health` endpoint for smoke checks and uptime probes
- Baseline browser security headers and hardened static asset serving

## Safety model

- Binds to `127.0.0.1` by default
- Can bind to `0.0.0.0` only when explicitly configured
- Opens the Mnemosyne SQLite database with `mode=ro`
- No edit/delete/write memory HTTP endpoints
- Optional password auth is disabled by default and can be enabled from Settings
- No external JavaScript or CSS dependencies
- Runtime state lives under `~/.hermes/plugin-data/mnemosyne-dashboard/`
- Static assets are resolved under `static/` before serving; path escapes are rejected
- Browser responses include CSP, no-sniff, frame-deny, and no-referrer headers

If you bind to `0.0.0.0`, the dashboard is reachable from your LAN. Treat that as exposing local memory metadata to your network. Put it behind a firewall/VPN/reverse proxy auth if needed.

## Installation as a Hermes directory plugin

Copy or clone this directory to:

```text
~/.hermes/plugins/mnemosyne-dashboard
```

Enable it:

```bash
hermes plugins enable mnemosyne-dashboard
```

Restart the running Hermes process so plugin tools are discovered.

## Hermes tools

The plugin registers:

- `mnemosyne_dashboard_start`
- `mnemosyne_dashboard_stop`
- `mnemosyne_dashboard_status`
- `mnemosyne_dashboard_config`

Example tool arguments:

```json
{
  "host": "0.0.0.0",
  "port": 9876,
  "db_path": "/Users/you/.hermes/mnemosyne/data/mnemosyne.db"
}
```

Changing host/port/db_path requires stopping and starting the dashboard process again.

## Configuration

Default config file:

```text
~/.hermes/plugin-data/mnemosyne-dashboard/config.json
```

Default config:

```json
{
  "host": "127.0.0.1",
  "port": 8765,
  "db_path": "~/.hermes/mnemosyne/data/mnemosyne.db",
  "auth_enabled": false
}
```

You can update it through the Hermes tool:

```json
{
  "host": "0.0.0.0",
  "port": 9876
}
```

Or edit JSON directly, then restart the dashboard.

Environment overrides are also supported:

- `MNEMOSYNE_DASHBOARD_CONFIG` — alternate config file path
- `MNEMOSYNE_DASHBOARD_HOST` — bind address
- `MNEMOSYNE_DASHBOARD_PORT` — bind port
- `MNEMOSYNE_DASHBOARD_DB` — SQLite DB path

## Manual run

```bash
python server.py --host 127.0.0.1 --port 8765
```

Bind to LAN explicitly:

```bash
python server.py --host 0.0.0.0 --port 9876
```

Open locally:

```text
http://127.0.0.1:8765/
```

If bound to `0.0.0.0`, use your machine’s LAN IP from another device, e.g.:

```text
http://192.168.1.10:9876/
```

## Development

```bash
cd ~/.hermes/plugins/mnemosyne-dashboard
~/.hermes/hermes-agent/venv/bin/python -m ruff check .
~/.hermes/hermes-agent/venv/bin/python -m pytest -q
~/.hermes/hermes-agent/venv/bin/python -m compileall -q .
node --check static/app.js
```

Restart the dashboard after backend/server changes:

```bash
~/.hermes/hermes-agent/venv/bin/python - <<'PY'
import importlib.util, pathlib
p=pathlib.Path.home()/'.hermes/plugins/mnemosyne-dashboard/__init__.py'
spec=importlib.util.spec_from_file_location('mnemo_dash', p)
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
print(mod._stop({}))
print(mod._start({}))
PY
```

## Repository layout

```text
plugin.yaml
__init__.py              # Hermes tool registration + process lifecycle
config.py                # Config file/env/default resolution
server.py                # ThreadingHTTPServer + API/static routes
dashboard_core.py        # Read-only SQLite access
tests/                   # pytest coverage for core/config behavior
static/                  # HTML/CSS/JS/fonts
.github/workflows/ci.yml # GitHub Actions smoke tests
```

## Font/assets note

The light theme uses locally hosted Playfair Display, Great Vibes, and Cormorant Garamond font assets. These font families are available under the SIL Open Font License from Google Fonts. Keep font licensing notices intact if replacing or redistributing assets.
