# Book of Shadows

**A local-first memory dashboard by [Witch Daddy Labs](https://github.com/cre8tivoz).**

Browse, visualise, and safely maintain your Mnemosyne memory store — no cloud, no nonsense, no accidental deletes.

![Book of Shadows dark theme](docs/screenshots/desktop-dark-overview.png)

## What is this?

It's intentionally small: Python stdlib server, static HTML/CSS/JS, zero external JS runtime. Browsing opens your SQLite DB in read-only mode. Optional password-gated admin mode lets you supersede, expire, or adjust importance — never hard-delete or raw-overwrite.

## Themes

Dark mode uses iron-charcoal surfaces with teal accents. Light mode is warm bone with dark teal. Both are easy on the eyes during long sessions.

![Book of Shadows light theme](docs/screenshots/desktop-light-overview.png)

## Features

- **Overview** — counts, breakdowns, quick actions, live memory stream
- **Today** — read-only daily digest of what was added, recalled, consolidated
- **Context Bank** — inferred context sections from active memory
- **Visualiser** — Constellation and Neural Map views with click-through inspectors
- **Visualiser 3D** — Three.js/WebGL comparison lab for GPU-rendered prototypes
- **Memories** — browser with filters, sorting, bulk selection, recall debugger
- **History** — timeline grouped by day or session, consolidation history
- **Knowledge Graph** — interactive relationship graph + triples table
- **MEMORIA** — structured fact extraction and retrieval
- **Settings** — password auth, server config, diagnostics, backups

## Install

```bash
hermes plugins install cre8tivoz/mnemosyne-dashboard --enable
hermes gateway restart
```

Or clone manually:

```bash
git clone https://github.com/cre8tivoz/mnemosyne-dashboard.git ~/.hermes/plugins/mnemosyne-dashboard
hermes plugins enable mnemosyne-dashboard
hermes gateway restart
```

## Run standalone

```bash
python server.py --host 0.0.0.0 --port 8765
```

Open `http://127.0.0.1:8765/`.

## Safety model

- Binds `0.0.0.0` by default (LAN reachable)
- Browsing uses `mode=ro` on the SQLite DB
- Admin actions limited to supersede / expire / importance updates
- No raw content overwrite, no hard deletes
- Automatic SQLite backups + JSONL audit log on mutations
- Optional password auth (disabled by default)
- CSP, no-sniff, frame-deny, no-referrer headers
- Static assets resolved under `static/`; path escapes rejected

## Screenshots

All screenshots are generated from a temporary mock database — no real memory data, no real file paths, no private information.

| ![Dark overview](docs/screenshots/desktop-dark-overview.png) | ![Light overview](docs/screenshots/desktop-light-overview.png) |
|---|---|
| Dark theme overview | Light theme overview |

| ![Dark visualiser](docs/screenshots/desktop-dark-constellation.png) | ![Dark search](docs/screenshots/desktop-dark-search.png) |
|---|---|
| Constellation visualiser | Search results |

| ![Dark knowledge graph](docs/screenshots/desktop-light-graph.png) | ![Mobile dark overview](docs/screenshots/mobile-dark-overview.png) |
|---|---|
| Knowledge graph (light theme) | Mobile dark overview |

Regenerate the full gallery locally:

```bash
python3 scripts/generate_mock_screenshots.py
```

## Development

```bash
python -m pytest tests/ -q
python -m compileall -q .
npm install
npm run build:frontend
npm run test:frontend
node --check static/app.js
```

## Credits

- **Design** — Witch Daddy Labs
- **Original dashboard** — [wysie](https://github.com/wysie)
- **Mnemosyne** — [AxDSan](https://github.com/AxDSan)
- **Built on** — [Hermes Agent](https://github.com/NousResearch/hermes-agent) by Nous Research
