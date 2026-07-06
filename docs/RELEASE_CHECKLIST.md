# Release Checklist

Use this before publishing or tagging a public release.

## Scope

- [ ] Confirm `TRANSFORMATION_PLAN.md` has no stale in-scope unchecked items.
- [ ] Confirm future feature ideas live in the Future Release Backlog.
- [ ] Confirm `README.md` reflects the current tabs and safety model.
- [ ] Confirm setup, architecture, accessibility, demo-data, and testing docs are current.

## Build And Test

```bash
npm run build:frontend
npm run check:frontend
/Users/habibi/.local/bin/uv run --with pytest --python /Users/habibi/.local/bin/python3.11 python -m pytest tests/ -q
/Users/habibi/.local/bin/uv run --with ruff --python /Users/habibi/.local/bin/python3.11 python -m ruff check .
/Users/habibi/.local/bin/python3.11 -m compileall -q .
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/frontend_smoke.py
```

## Screenshots

```bash
/Users/habibi/.local/bin/uv run --with websocket-client --python /Users/habibi/.local/bin/python3.11 python scripts/generate_mock_screenshots.py
```

- [ ] Gallery includes Overview, Today, Context Bank, Visualiser, Memories, Review, Knowledge Graph, Insights, MEMORIA, History, and Settings coverage.
- [ ] Gallery includes desktop and mobile examples.
- [ ] Gallery uses only fictional data.

## Safety

- [ ] No real database, memory content, config secret, auth cookie, or CSRF token is committed.
- [ ] Admin actions remain disabled by default.
- [ ] Password auth remains optional and password hashes are salted.
- [ ] Mutating POST routes still require CSRF when auth is enabled.
- [ ] Backups and audit logs are still written for admin memory mutations.
- [ ] Provider `base_url` parameters validated against allowlist (SSRF protection).
- [ ] POST endpoints reject non-JSON content types (415).
- [ ] Regex patterns limited to 100 chars (ReDoS protection).
- [ ] Rate limiting persists across server restarts.

## Multi-Provider (v0.2.0)

- [ ] All 4 provider adapters have unit tests with mocked dependencies.
- [ ] `/api/providers` returns correct structure for all active providers.
- [ ] `/api/search` cross-provider search works with provider filtering.
- [ ] `/api/timeline` unified timeline merges data from all providers.
- [ ] Frontend provider tabs render correctly for each active provider.
- [ ] Peer visualiser toggle only shown when Honcho is active.
- [ ] Cross-platform path resolution works on macOS, Linux, and Windows.

## Git Hygiene

- [ ] `git status --short` contains only intentional changes.
- [ ] `static/app.js` is generated from `static/src/app.js` and passes the bundle sync check.
- [ ] `uv.lock` is intentionally included or intentionally left untracked.
- [ ] Version numbers in `pyproject.toml`, `plugin.yaml`, and `server.py` tests agree.
