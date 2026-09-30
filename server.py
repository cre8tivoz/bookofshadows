from __future__ import annotations

import argparse
import hmac
import json
import mimetypes
import os
import re
import select
import socket
import subprocess
import threading
import time
import tomllib
import urllib.parse
from dataclasses import asdict
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from config import (
    DashboardConfig,
    auth_cookie_value,
    csrf_token_value,
    data_dir,
    effective_config,
    public_config,
    save_config,
    verify_password,
)
from dashboard_core import MemoryQuery, default_db_path
from providers.mnemosyne import MnemosyneDashboardStore
from providers.registry import ProviderRegistry

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
MAX_JSON_BODY_BYTES = 64 * 1024


def _project_version() -> str:
    with (ROOT / "pyproject.toml").open("rb") as fh:
        return tomllib.load(fh)["project"]["version"]


VERSION = _project_version()


def _safe_int(value: str | None, default: int, minimum: int = 1, maximum: int = 1000) -> int:
    try:
        parsed = int(value or default)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(parsed, maximum))
AUTH_COOKIE = "mnemo_auth"

LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 300
_login_attempts: dict[str, list[float]] = {}
_login_attempts_lock = threading.Lock()


def _rate_limit_path() -> Path:
    """File-based rate limit storage to survive restarts."""
    return data_dir() / "login_attempts.json"


def _load_rate_limit_state() -> dict[str, list[float]]:
    path = _rate_limit_path()
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return {}


def _save_rate_limit_state(state: dict[str, list[float]]) -> None:
    path = _rate_limit_path()
    path.write_text(json.dumps(state, ensure_ascii=False, separators=(",", ":")))


def _auth_cookie_header(cfg: DashboardConfig, value: str) -> str:
    """Build Set-Cookie header with appropriate security flags."""
    flags = ["Path=/", "SameSite=Lax", "HttpOnly"]
    if cfg.cookie_secure:
        flags.append("Secure")
    return f"{AUTH_COOKIE}={value}; " + "; ".join(flags)


def _login_rate_limited(client_ip: str) -> bool:
    now = time.time()
    with _login_attempts_lock:
        state = _load_rate_limit_state()
        attempts = [t for t in state.get(client_ip, []) if now - t < LOGIN_WINDOW_SECONDS]
        state[client_ip] = attempts
        _save_rate_limit_state(state)
        return len(attempts) >= LOGIN_MAX_ATTEMPTS


def _record_login_failure(client_ip: str) -> None:
    with _login_attempts_lock:
        state = _load_rate_limit_state()
        state.setdefault(client_ip, []).append(time.time())
        _save_rate_limit_state(state)


def _clear_login_attempts(client_ip: str) -> None:
    with _login_attempts_lock:
        state = _load_rate_limit_state()
        state.pop(client_ip, None)
        _save_rate_limit_state(state)


def _db_mtime_ns(db_path: Path) -> int:
    """Get max modification time in nanoseconds for SQLite DB and journal/WAL files."""
    try:
        if not db_path.exists():
            return 0
        mtime = db_path.stat().st_mtime_ns
        wal = db_path.with_name(db_path.name + "-wal")
        if wal.exists():
            mtime = max(mtime, wal.stat().st_mtime_ns)
        return mtime
    except Exception:
        return -1


def _is_ssl_socket(sock: Any) -> bool:
    return hasattr(sock, "cipher") or hasattr(sock, "_sslobj")


def _socket_disconnected(sock: socket.socket | None) -> bool:
    """Check if the client socket is closed or disconnected."""
    if sock is None or _is_ssl_socket(sock):
        return False
    try:
        r, _, _ = select.select([sock], [], [], 0)
        if r:
            peek = sock.recv(1, socket.MSG_PEEK)
            if not peek:
                return True
    except (BrokenPipeError, ConnectionResetError):
        return True
    except OSError:
        pass
    return False


def _interruptible_sleep(sock: socket.socket | None, total_seconds: float = 2.0, step: float = 0.25) -> bool:
    """Sleep for total_seconds in step intervals, checking for socket disconnect.
    Returns True if disconnected, False if sleep completed normally.
    """
    end_time = time.time() + total_seconds
    is_ssl = _is_ssl_socket(sock)
    while True:
        now = time.time()
        remaining = end_time - now
        if remaining <= 0:
            return False
        wait_time = min(remaining, step)
        if sock is not None and not is_ssl:
            try:
                r, _, _ = select.select([sock], [], [], wait_time)
                if r:
                    peek = sock.recv(1, socket.MSG_PEEK)
                    if not peek:
                        return True
                    # Unread bytes on socket: sleep wait_time to prevent tight CPU spin
                    time.sleep(wait_time)
            except (BrokenPipeError, ConnectionResetError):
                return True
            except OSError:
                time.sleep(wait_time)
        else:
            time.sleep(wait_time)


def _json_bytes(obj: Any) -> bytes:
    return json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")


def _write_runtime_metadata(cfg) -> None:
    root = data_dir()
    log = root / "server.log"
    runtime = {
        "pid": os.getpid(),
        "host": cfg.host,
        "port": cfg.port,
        "db_path": cfg.db_path,
        "bind_url": cfg.bind_url,
        "local_url": cfg.local_url,
        "log": str(log),
        "source": "server.py",
        "started_at": time.time(),
    }
    (root / "server.pid").write_text(str(os.getpid()))
    (root / "runtime.json").write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + "\n")


def _read_json_file(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text() or "{}") if path.exists() else {}
    except Exception:
        return {}


def _read_pid_file(path: Path) -> int | None:
    try:
        return int(path.read_text().strip())
    except Exception:
        return None


def _pid_alive(pid: int | None) -> bool:
    if not pid or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except Exception:
        return False


def _listener_pids(port: int) -> list[int]:
    try:
        out = subprocess.check_output(
            ["lsof", "-nP", f"-iTCP:{int(port)}", "-sTCP:LISTEN", "-Fp"],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=2,
        )
    except Exception:
        return []
    pids: list[int] = []
    for line in out.splitlines():
        if line.startswith("p"):
            try:
                pids.append(int(line[1:]))
            except ValueError:
                pass
    return sorted(set(pids))


def _runtime_status(cfg) -> dict[str, Any]:
    root = data_dir()
    runtime = _read_json_file(root / "runtime.json")
    pid_file_pid = _read_pid_file(root / "server.pid")
    runtime_pid = int(runtime.get("pid") or 0) or None
    current_pid = os.getpid()
    effective_pid = runtime_pid or pid_file_pid or current_pid
    listener_pids = _listener_pids(cfg.port)
    probe = {"ok": True, "status": 200, "url": cfg.local_url + "api/auth/status", "error": ""}
    stale_pid = bool(pid_file_pid and pid_file_pid != current_pid and not _pid_alive(pid_file_pid))
    runtime_stale = bool(runtime_pid and runtime_pid != current_pid and not _pid_alive(runtime_pid))
    return {
        "ok": True,
        "running": True,
        "reachable": True,
        "pid": current_pid,
        "runtime_pid": runtime_pid,
        "pid_file_pid": pid_file_pid,
        "effective_pid": effective_pid,
        "listener_pids": listener_pids,
        "stale_pid": stale_pid,
        "runtime_stale": runtime_stale,
        "probe": probe,
        "runtime": runtime,
        "runtime_source": runtime.get("source") or "server.py",
        "config": public_config(cfg),
        "started_at": runtime.get("started_at"),
        "pid_file": str(root / "server.pid"),
        "runtime_file": str(root / "runtime.json"),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = f"MnemosyneDashboard/{VERSION}"

    def log_message(self, fmt, *args):
        return

    @property
    def registry(self) -> ProviderRegistry:
        return getattr(self.server, "registry", ProviderRegistry())

    @property
    def store(self) -> MnemosyneDashboardStore:
        return MnemosyneDashboardStore(getattr(self.server, "db_path", default_db_path()))

    def _route_provider_api(self, slug: str, path: str, q: dict[str, str]):
        """Dispatch /api/<provider>/<path> to the right adapter method."""
        provider = self.registry.get(slug)
        if not provider:
            return self._send_json({"error": f"Provider '{slug}' not active"}, 404)

        if path == "/memories" or path == "/":
            search = q.get("q", "")
            limit = _safe_int(q.get("limit"), 100)
            rows = provider.query(search, limit=limit)
            return self._send_json({"provider": slug, "memories": [asdict(r) for r in rows]})

        if path == "/graph":
            edges = provider.get_graph_edges()
            if edges is None:
                return self._send_json({"provider": slug, "graph": None, "message": "Graph not supported"})
            return self._send_json({"provider": slug, "graph": [asdict(e) for e in edges]})

        if path == "/timeline":
            entries = provider.get_timeline()
            if entries is None:
                return self._send_json({"provider": slug, "timeline": None, "message": "Timeline not supported"})
            return self._send_json({"provider": slug, "timeline": [asdict(e) for e in entries]})

        if path == "/counts":
            return self._send_json({"provider": slug, "counts": provider.get_counts()})

        return self._send_json({"error": f"Unknown route: /api/{slug}{path}"}, 404)

    @property
    def cfg(self):
        saved_cfg = getattr(self.server, "saved_config", None)
        if saved_cfg is not None:
            return saved_cfg
        return effective_config({
            "host": getattr(self.server, "bind_host", None),
            "port": getattr(self.server, "bind_port", None),
            "db_path": str(getattr(self.server, "db_path", default_db_path())),
        })

    def _send(self, status: int, body: bytes, ctype: str = "application/json; charset=utf-8", headers: dict[str, str] | None = None):
        try:
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; "
                "script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
            )
            for k, v in (headers or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return

    def _send_json(self, obj: Any, status: int = 200, headers: dict[str, str] | None = None):
        self._send(status, _json_bytes(obj), headers=headers)

    def _send_sse(self, events: list[dict[str, Any]]):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
        )
        self.end_headers()

        def write_event(name: str, data: dict[str, Any]):
            payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
            self.wfile.write(f"event: {name}\ndata: {payload}\n\n".encode())
            self.wfile.flush()

        sock = getattr(self, "connection", None)

        try:
            status = self.store.realtime_status()
            write_event("status", status)
            seen_ids: dict[str, str] = {}
            poll_limit = max(25, int(status.get("snapshot_event_count") or 25))
            for event in events:
                memory_id = str(event.get("memory_id") or "")
                if memory_id:
                    seen_ids[memory_id] = str(event.get("live_signature") or "")
                write_event("memory", event)

            last_mtime: int | None = None

            for tick in range(900):
                if _socket_disconnected(sock):
                    return

                current_mtime = _db_mtime_ns(self.store.db_path)
                if last_mtime is None or current_mtime != last_mtime:
                    for event in self.store.realtime_event_delta(seen_ids=seen_ids, limit=poll_limit):
                        memory_id = str(event.get("memory_id") or "")
                        if memory_id:
                            seen_ids[memory_id] = str(event.get("live_signature") or "")
                        write_event("memory", event)
                    last_mtime = current_mtime

                if tick % 8 == 0:
                    write_event("heartbeat", {"ok": True, "ts": time.time()})

                if _interruptible_sleep(sock, 2.0, step=0.25):
                    return
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    def _send_file(self, path: Path):
        try:
            resolved = path.resolve(strict=True)
            static_root = STATIC.resolve(strict=True)
            resolved.relative_to(static_root)
        except Exception:
            self._send_json({"error": "not found"}, 404)
            return
        if not resolved.is_file():
            self._send_json({"error": "not found"}, 404)
            return
        ctype = mimetypes.guess_type(str(resolved))[0] or "application/octet-stream"
        self._send(200, resolved.read_bytes(), ctype)

    def _params(self) -> dict[str, str]:
        parsed = urllib.parse.urlparse(self.path)
        return {k: v[-1] for k, v in urllib.parse.parse_qs(parsed.query).items()}

    def _json_body(self) -> dict[str, Any]:
        # Validate Content-Type to prevent form-encoded body confusion
        content_type = self.headers.get("Content-Type", "")
        if content_type and not content_type.startswith("application/json"):
            raise ValueError("Content-Type must be application/json")
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        if length > MAX_JSON_BODY_BYTES:
            raise ValueError("request body too large")
        return json.loads(self.rfile.read(length).decode("utf-8") or "{}")

    def _authenticated(self) -> bool:
        cfg = self.cfg
        if not cfg.auth_enabled:
            return True
        raw = self.headers.get("Cookie", "")
        jar = cookies.SimpleCookie(raw)
        morsel = jar.get(AUTH_COOKIE)
        return bool(morsel and morsel.value == auth_cookie_value(cfg))

    def _auth_status(self) -> dict[str, Any]:
        cfg = self.cfg
        authenticated = self._authenticated()
        status: dict[str, Any] = {
            "auth_enabled": cfg.auth_enabled,
            "has_password": cfg.has_password,
            "authenticated": authenticated,
            "config": public_config(cfg),
        }
        if cfg.auth_enabled and authenticated:
            status["csrf_token"] = csrf_token_value(cfg)
        return status

    def _require_auth(self, path: str) -> bool:
        public_paths = {"/api/auth/status", "/api/auth/login"}
        if path in public_paths or path == "/" or path.startswith("/static/"):
            return True
        if self._authenticated():
            return True
        self._send_json({"error": "auth required", **self._auth_status()}, 401)
        return False

    def _require_csrf(self) -> bool:
        cfg = self.cfg
        if not cfg.auth_enabled:
            return True
        provided = self.headers.get("X-CSRF-Token", "")
        if provided and hmac.compare_digest(provided, csrf_token_value(cfg)):
            return True
        self._send_json({"error": "missing or invalid CSRF token"}, 403)
        return False

    def _require_admin(self) -> bool:
        cfg = self.cfg
        if not cfg.memory_admin_enabled:
            self._send_json({"error": "memory admin mode is disabled", "config": public_config(cfg)}, 403)
            return False
        local_request = cfg.host in {"127.0.0.1", "localhost", "::1"} and self.client_address[0] in {"127.0.0.1", "::1"}
        if local_request:
            return True
        if not cfg.auth_enabled or not cfg.has_password or not self._authenticated():
            self._send_json({"error": "password auth is required for memory admin mode on LAN/non-local hosts", **self._auth_status()}, 401)
            return False
        return True

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/" or parsed.path == "/favicon.ico" or parsed.path.startswith("/static/") or parsed.path.startswith("/api/"):
            self.send_response(200)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        q = self._params()
        try:
            if path == "/":
                return self._send_file(STATIC / "index.html")
            if path == "/favicon.ico":
                return self._send_file(STATIC / "favicon.svg")
            if path.startswith("/static/"):
                rel = urllib.parse.unquote(path.removeprefix("/static/"))
                if rel.startswith(("/", "\\")):
                    return self._send_json({"error": "bad path"}, 400)
                return self._send_file(STATIC / rel)
            if not self._require_auth(path):
                return
            if path == "/api/auth/status":
                return self._send_json(self._auth_status())
            if path == "/api/providers":
                return self._send_json({"providers": self.registry.all_provider_info()})
            if path == "/api/health":
                health = {
                    name: asdict(h) for name, h in self.registry.all_health().items()
                }
                return self._send_json({
                    "ok": True,
                    "service": "mnemosyne-dashboard",
                    "read_only": not self.cfg.memory_admin_enabled,
                    "config": public_config(self.cfg),
                    "providers": health,
                })
            # Provider-scoped routes: /api/<provider>/*
            # Exclude reserved non-provider routes (memories, memory, graph, etc.)
            RESERVED_SLUGS = {
                "auth", "health", "providers", "config", "diagnostics",
                "runtime", "realtime", "admin", "stats", "digest",
                "insights", "review", "lifecycle", "profile", "patterns",
                "constellation", "search", "recall-debug", "timeline",
                "memories", "memory", "session", "triples", "graph",
                "consolidations", "memoria",
            }
            provider_match = re.match(r"^/api/([a-z0-9_-]+)(/.*)?$", path)
            if provider_match and provider_match.group(1) not in RESERVED_SLUGS:
                return self._route_provider_api(
                    provider_match.group(1),
                    provider_match.group(2) or "/",
                    q
                )
            # Unified cross-provider timeline (P3)
            if path == "/api/timeline":
                limit = _safe_int(q.get("limit"), 200)
                entries = []
                for name, provider in self.registry.active().items():
                    timeline = provider.get_timeline()
                    if timeline is None:
                        continue
                    for entry in timeline:
                        entries.append({
                            **asdict(entry),
                            "provider": name,
                            "provider_name": provider.name,
                            "provider_glyph": provider.glyph,
                            "provider_color": provider.color,
                        })
                entries.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
                return self._send_json({
                    "timeline": entries[:limit],
                    "total": len(entries),
                    "providers": list(self.registry.active().keys()),
                })
            # Cross-search across providers (P3)
            if path == "/api/search":
                search_q = q.get("q", "")
                search_limit = _safe_int(q.get("limit"), 100)
                provider_filter = q.get("providers", "")
                filter_set = None
                if provider_filter:
                    filter_set = set(p.strip() for p in provider_filter.split(",") if p.strip())
                results = {}
                for name, provider in self.registry.active().items():
                    if filter_set and name not in filter_set:
                        continue
                    try:
                        rows = provider.query(search_q, limit=search_limit)
                        results[name] = {
                            "provider": {
                                "name": provider.name,
                                "glyph": provider.glyph,
                                "color": provider.color,
                            },
                            "rows": [asdict(r) for r in rows],
                            "total": len(rows),
                        }
                    except Exception as e:
                        results[name] = {"error": str(e), "rows": [], "total": 0}
                return self._send_json({"query": search_q, "results": results})
            if path == "/api/config":
                return self._send_json({"ok": True, "config": public_config(self.cfg)})
            if path == "/api/diagnostics":
                return self._send_json(self.store.diagnostics())
            if path == "/api/runtime/status":
                return self._send_json(_runtime_status(self.cfg))
            if path == "/api/realtime/status":
                return self._send_json(self.store.realtime_status())
            if path == "/api/realtime/events":
                return self._send_sse(self.store.realtime_event_snapshot(limit=_safe_int(q.get("limit"), 25, maximum=100)))
            if path == "/api/admin/audit":
                if not self._require_admin():
                    return
                return self._send_json({"items": self.store.audit_log(limit=_safe_int(q.get("limit"), 100, maximum=1000))})
            if path == "/api/stats":
                return self._send_json(self.store.stats())
            if path == "/api/digest/today":
                return self._send_json(self.store.today_digest(day=q.get("day", ""), limit=_safe_int(q.get("limit"), 80, maximum=300)))
            if path == "/api/insights/memory-growth":
                return self._send_json(self.store.memory_growth_series(days=_safe_int(q.get("days"), 30, maximum=180)))
            if path == "/api/insights/audit-activity":
                return self._send_json(self.store.audit_activity_series(days=_safe_int(q.get("days"), 30, maximum=180)))
            if path == "/api/insights/recall-distribution":
                return self._send_json({"items": self.store.recall_distribution()})
            if path == "/api/insights/veracity-mix":
                return self._send_json(self.store.veracity_mix_series(days=_safe_int(q.get("days"), 30, maximum=180)))
            if path == "/api/insights/source-breakdown":
                return self._send_json(self.store.source_breakdown_series(days=_safe_int(q.get("days"), 30, maximum=180), limit=_safe_int(q.get("limit"), 6, maximum=12)))
            if path == "/api/insights/review-backlog":
                return self._send_json(self.store.review_backlog_series(days=_safe_int(q.get("days"), 30, maximum=180)))
            if path == "/api/insights/lifecycle-transitions":
                return self._send_json(self.store.lifecycle_transition_series(days=_safe_int(q.get("days"), 30, maximum=180)))
            if path == "/api/insights/entity-clusters":
                return self._send_json(self.store.entity_domain_clusters(limit=_safe_int(q.get("limit"), 10, maximum=30)))
            if path == "/api/insights/session-heatmap":
                return self._send_json(self.store.session_activity_heatmap(days=_safe_int(q.get("days"), 30, maximum=180)))
            if path == "/api/insights/action-cards":
                return self._send_json(self.store.actionable_insight_cards())
            if path == "/api/review":
                return self._send_json(self.store.review_queues(
                    queue=q.get("queue", "contaminated"), q=q.get("q", ""),
                    min_importance=q.get("min_importance", ""),
                    limit=_safe_int(q.get("limit"), 100, maximum=500),
                    offset=_safe_int(q.get("offset"), 0, minimum=0, maximum=100000),
                ))
            if path == "/api/lifecycle":
                return self._send_json(self.store.lifecycle_dashboard(limit=_safe_int(q.get("limit"), 50, maximum=200)))
            if path == "/api/profile/inferred":
                return self._send_json(self.store.inferred_profile(limit_per_section=_safe_int(q.get("limit"), 10, maximum=30)))
            if path == "/api/patterns":
                return self._send_json(self.store.pattern_insights(limit=_safe_int(q.get("limit"), 10, maximum=30)))
            if path == "/api/constellation":
                return self._send_json(self.store.constellation(limit=_safe_int(q.get("limit"), 240, minimum=40, maximum=600)))
            if path == "/api/search":
                return self._send_json(self.store.global_search(q=q.get("q", ""), limit=_safe_int(q.get("limit"), 30, maximum=100)))
            if path == "/api/recall-debug":
                return self._send_json(self.store.recall_debug(q=q.get("q", ""), limit=_safe_int(q.get("limit"), 20, maximum=100)))
            if path == "/api/timeline":
                return self._send_json(self.store.timeline(q=q.get("q", ""), group=q.get("group", "day"), limit=_safe_int(q.get("limit"), 300, maximum=1000)))
            if path == "/api/memories":
                query = MemoryQuery.from_raw(
                    kind=q.get("kind", "all"), q=q.get("q", ""), source=q.get("source", ""),
                    scope=q.get("scope", ""), session_id=q.get("session_id", ""), sort=q.get("sort", "recent"),
                    status=q.get("status", "active"), veracity=q.get("veracity", ""),
                    degradation_tier=q.get("degradation_tier", ""), contaminated_only=q.get("contaminated_only", ""),
                    degraded_only=q.get("degraded_only", ""), due_for_degradation=q.get("due_for_degradation", ""),
                    limit=_safe_int(q.get("limit"), 100, maximum=500),
                    offset=_safe_int(q.get("offset"), 0, minimum=0, maximum=100000),
                )
                items = self.store.query_memories(query)
                total = self.store.count_memories(query)
                next_offset = query.offset + len(items)
                return self._send_json({
                    "items": items,
                    "total": total,
                    "listed": len(items),
                    "limit": query.limit,
                    "offset": query.offset,
                    "next_offset": next_offset,
                    "has_more": next_offset < total,
                })
            if path == "/api/memory":
                mid = q.get("id", "")
                item = self.store.get_memory(mid) if mid else None
                return self._send_json({"item": item}, 200 if item else 404)
            if path == "/api/session":
                return self._send_json(self.store.session_detail(q.get("id", ""), limit=_safe_int(q.get("limit"), 200, maximum=500)))
            if path == "/api/triples":
                return self._send_json({"items": self.store.triples(
                    q=q.get("q", ""), subject=q.get("subject", ""), predicate=q.get("predicate", ""), object_=q.get("object", ""),
                    limit=_safe_int(q.get("limit"), 200, maximum=1000),
                )})
            if path == "/api/graph":
                return self._send_json(self.store.graph(q=q.get("q", ""), limit=_safe_int(q.get("limit"), 300, maximum=1000)))
            if path == "/api/consolidations":
                return self._send_json({"items": self.store.consolidations(q=q.get("q", ""), limit=_safe_int(q.get("limit"), 100, maximum=500))})
            if path == "/api/memoria/stats":
                return self._send_json(self.store.memoria_stats())
            if path == "/api/memoria/facts":
                return self._send_json({"items": self.store.memoria_facts(q=q.get("q", ""), limit=_safe_int(q.get("limit"), 200, maximum=1000), offset=_safe_int(q.get("offset"), 0, minimum=0, maximum=100000))})
            if path == "/api/memoria/timelines":
                return self._send_json({"items": self.store.memoria_timelines(q=q.get("q", ""), limit=_safe_int(q.get("limit"), 200, maximum=1000), offset=_safe_int(q.get("offset"), 0, minimum=0, maximum=100000))})
            if path == "/api/memoria/instructions":
                return self._send_json({"items": self.store.memoria_instructions(q=q.get("q", ""), limit=_safe_int(q.get("limit"), 200, maximum=1000), offset=_safe_int(q.get("offset"), 0, minimum=0, maximum=100000))})
            if path == "/api/memoria/kg":
                return self._send_json({"items": self.store.memoria_kg(q=q.get("q", ""), limit=_safe_int(q.get("limit"), 200, maximum=1000), offset=_safe_int(q.get("offset"), 0, minimum=0, maximum=100000))})
            if path == "/api/memoria/preferences":
                return self._send_json({"items": self.store.memoria_preferences(q=q.get("q", ""), limit=_safe_int(q.get("limit"), 200, maximum=1000), offset=_safe_int(q.get("offset"), 0, minimum=0, maximum=100000))})
            return self._send_json({"error": "not found"}, 404)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as e:
            return self._send_json({"error": str(e)}, 500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        try:
            body = self._json_body()
            cfg = self.cfg
            if path == "/api/auth/login":
                cfg = self.cfg
                if not cfg.auth_enabled:
                    return self._send_json({"ok": True, "auth_enabled": False})
                client_ip = self.client_address[0]
                if _login_rate_limited(client_ip):
                    return self._send_json({"ok": False, "error": "too many login attempts, try again later"}, 429)
                if verify_password(str(body.get("password") or ""), cfg):
                    _clear_login_attempts(client_ip)
                    return self._send_json(
                        {"ok": True, **self._auth_status()},
                        headers={"Set-Cookie": _auth_cookie_header(cfg, auth_cookie_value(cfg))},
                    )
                _record_login_failure(client_ip)
                return self._send_json({"ok": False, "error": "invalid password"}, 403)
            if not self._require_auth(path):
                return
            if not self._require_csrf():
                return
            if path == "/api/auth/logout":
                return self._send_json({"ok": True}, headers={"Set-Cookie": _auth_cookie_header(cfg, "") + "; Max-Age=0"})
            if path == "/api/config":
                allowed = {"host", "port", "db_path", "auth_enabled", "password", "clear_password", "memory_admin_enabled"}
                updates = {k: body.get(k) for k in allowed if k in body}
                cfg = save_config(**updates)
                self.server.saved_config = cfg
                return self._send_json({"ok": True, "config": public_config(cfg), "message": "Saved. Auth changes take effect immediately; host/port/db changes require restart."})
            if path == "/api/admin/backup":
                if not self._require_admin():
                    return
                return self._send_json({"ok": True, "backup": self.store.backup_database()})
            if path == "/api/admin/memory/invalidate":
                if not self._require_admin():
                    return
                return self._send_json(self.store.invalidate_memory(str(body.get("memory_id") or ""), backup=bool(body.get("backup", True))))
            if path == "/api/admin/memory/importance":
                if not self._require_admin():
                    return
                return self._send_json(self.store.set_memory_importance(str(body.get("memory_id") or ""), body.get("importance"), backup=bool(body.get("backup", True))))
            if path == "/api/admin/memory/veracity":
                if not self._require_admin():
                    return
                return self._send_json(self.store.set_memory_veracity(str(body.get("memory_id") or ""), str(body.get("veracity") or ""), backup=bool(body.get("backup", True))))
            if path == "/api/admin/memory/expiry":
                if not self._require_admin():
                    return
                return self._send_json(self.store.set_memory_expiry(str(body.get("memory_id") or ""), str(body.get("valid_until") or ""), backup=bool(body.get("backup", True))))
            if path == "/api/admin/memory/supersede":
                if not self._require_admin():
                    return
                return self._send_json(self.store.supersede_memory(str(body.get("memory_id") or ""), str(body.get("content") or ""), body.get("importance"), backup=bool(body.get("backup", True))))
            return self._send_json({"error": "not found"}, 404)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as e:
            return self._send_json({"ok": False, "error": str(e)}, 500)


def main():
    ap = argparse.ArgumentParser(description="LAN-friendly Mnemosyne memory dashboard with read-only browsing by default")
    ap.add_argument("--host", default=None, help="Bind address, e.g. 127.0.0.1 or 0.0.0.0. Defaults to plugin config.")
    ap.add_argument("--port", type=int, default=None, help="Bind port. Defaults to plugin config.")
    ap.add_argument("--db", default=None, help="Mnemosyne SQLite DB path. Defaults to plugin config.")
    args = ap.parse_args()
    cfg = effective_config({"host": args.host, "port": args.port, "db_path": args.db})
    registry = ProviderRegistry()
    registry.discover()
    print(f"Active providers: {', '.join(registry.active().keys()) or 'none'}", flush=True)
    httpd = ThreadingHTTPServer((cfg.host, cfg.port), Handler)
    _write_runtime_metadata(cfg)
    httpd.registry = registry
    httpd.db_path = Path(cfg.db_path)
    httpd.bind_host = cfg.host
    httpd.bind_port = cfg.port
    print(f"Mnemosyne dashboard listening on {cfg.bind_url}", flush=True)
    if cfg.host in {"0.0.0.0", "::"}:
        print(f"Local probe URL: {cfg.local_url}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
