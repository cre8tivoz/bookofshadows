# Security Policy

## Supported deployment model

Mnemosyne Dashboard is designed as a local read-only dashboard.

Default bind address:

```text
127.0.0.1
```

Binding to `0.0.0.0` is supported for LAN access, but it is an explicit opt-in. If you expose it beyond localhost, protect it with network controls, VPN, SSH tunnel, or reverse-proxy authentication.

## Data access

The dashboard opens the SQLite database using read-only URI mode:

```text
file:<db_path>?mode=ro
```

The HTTP API intentionally does not expose mutation endpoints.

## Reporting issues

For public repos, report vulnerabilities privately through GitHub Security Advisories if enabled, or open a minimal issue without sensitive memory/database contents.

Do not paste private Mnemosyne memory content into public issues.
