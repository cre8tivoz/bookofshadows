# Setup

Book of Shadows can run as a Hermes Agent plugin or as a standalone local dashboard pointed at a compatible Mnemosyne SQLite database.

## Hermes Plugin

If Hermes Agent is already installed, install and enable the plugin:

```bash
hermes plugins install cre8tivoz/mnemosyne-dashboard --enable
hermes gateway restart
```

The dashboard uses Hermes' normal plugin data directory for its config, backups, and audit log:

```text
$HERMES_HOME/plugin-data/mnemosyne-dashboard/
```

If `HERMES_HOME` is not set, the default is `~/.hermes`.

## Manual Plugin Install

```bash
git clone https://github.com/cre8tivoz/mnemosyne-dashboard.git ~/.hermes/plugins/mnemosyne-dashboard
hermes plugins enable mnemosyne-dashboard
hermes gateway restart
```

## Standalone Local Run

Run the server directly:

```bash
python3 server.py --host 127.0.0.1 --port 8765 --db /path/to/mnemosyne.db
```

Then open:

```text
http://127.0.0.1:8765/
```

The database is opened read-only for browsing. Admin memory actions are disabled unless explicitly enabled in Settings.

## Multi-Provider Setup (v0.2.0)

Book of Shadows now supports multiple memory providers. Each auto-detects its configuration:

### Mnemosyne
- **Config:** `~/.hermes/mnemosyne/data/mnemosyne.db` (or `MNEMOSYNE_DB_PATH` env var)
- **No additional setup required** if you're already running Hermes with Mnemosyne

### MemPalace
- **Config:** `~/.mempalace/config.json` (or `MEMPALACE_DIR` env var)
- **Setup:** Install MemPalace and create a palace structure

### Mem0
- **Config:** `MEM0_API_KEY` from env, `$HERMES_HOME/.env`, or `$HERMES_HOME/mem0.json`
- **Setup:**
  ```bash
  # Option 1: Environment variable
  export MEM0_API_KEY="sk-..."
  
  # Option 2: Hermes env file
  echo "MEM0_API_KEY=sk-..." >> ~/.hermes/.env
  
  # Option 3: Config file
  echo '{"api_key": "sk-...", "user_id": "..."}' > ~/.hermes/mem0.json
  ```

### Honcho
- **Config:** `HONCHO_API_KEY` from env, `~/.hermes/honcho.json`, or `~/.honcho/config.json`
- **Setup:**
  ```bash
  # Option 1: Environment variable
  export HONCHO_API_KEY="..."
  
  # Option 2: Hermes config file
  echo '{"api_key": "..."}' > ~/.hermes/honcho.json
  ```

### Verifying Provider Detection

Check which providers are active:

```bash
curl http://127.0.0.1:8765/api/providers
```

This returns a JSON object with each active provider's capabilities and health status.

## Environment Overrides

Useful variables:

```bash
export HERMES_HOME="$HOME/.hermes"
export MNEMOSYNE_DASHBOARD_DB="/path/to/mnemosyne.db"
export MNEMOSYNE_DASHBOARD_CONFIG="/path/to/config.json"
```

Database lookup order:

1. `MNEMOSYNE_DASHBOARD_DB`
2. `MNEMOSYNE_DB_PATH`
3. `MNEMOSYNE_DB`
4. `$HERMES_HOME/mnemosyne/data/mnemosyne.db`
5. `$HERMES_HOME/mnemosyne.db`
6. `~/.mnemosyne/mnemosyne.db`

## Developer Setup

Install frontend dependencies:

```bash
npm install
```

Build the generated frontend bundle:

```bash
npm run build:frontend
```

Run checks:

```bash
npm run check:frontend
/Users/habibi/.local/bin/uv run --with pytest --python /Users/habibi/.local/bin/python3.11 python -m pytest tests/ -q
/Users/habibi/.local/bin/uv run --with ruff --python /Users/habibi/.local/bin/python3.11 python -m ruff check .
/Users/habibi/.local/bin/python3.11 -m compileall -q .
```

Run the browser smoke test:

```bash
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/frontend_smoke.py
```
