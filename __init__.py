from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

from config import DashboardConfig, config_path, data_dir, effective_config, load_config, public_config, save_config

PLUGIN_NAME = "mnemosyne-dashboard"


def _pid_file() -> Path:
    return data_dir() / "server.pid"


def _runtime_file() -> Path:
    return data_dir() / "runtime.json"


def _json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2)


def _read_pid() -> int | None:
    try:
        return int(_pid_file().read_text().strip())
    except Exception:
        return None


def _read_runtime() -> dict[str, Any]:
    try:
        return json.loads(_runtime_file().read_text() or "{}")
    except Exception:
        return {}


def _write_runtime(pid: int, cfg: DashboardConfig, log: Path) -> None:
    _runtime_file().write_text(json.dumps({
        "pid": pid,
        "host": cfg.host,
        "port": cfg.port,
        "db_path": cfg.db_path,
        "bind_url": cfg.bind_url,
        "local_url": cfg.local_url,
        "log": str(log),
    }, ensure_ascii=False, indent=2) + "\n")


def _alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _probe_url(cfg: DashboardConfig) -> str:
    return cfg.local_url + "api/auth/status"


def _reachable(cfg: DashboardConfig, timeout: float = 2) -> bool:
    try:
        with urllib.request.urlopen(_probe_url(cfg), timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def _coerce_cfg(args: dict[str, Any] | None = None) -> DashboardConfig:
    args = args or {}
    return effective_config({
        "host": args.get("host"),
        "port": args.get("port"),
        "db_path": args.get("db_path") or args.get("db"),
        "auth_enabled": args.get("auth_enabled"),
    })


def _status(args=None, **kw):
    cfg = _coerce_cfg(args)
    runtime = _read_runtime()
    pid = int(runtime.get("pid") or _read_pid() or 0) or None
    alive = _alive(pid)
    runtime_cfg = effective_config(runtime) if runtime else cfg
    reachable = _reachable(runtime_cfg) if alive else False
    return _json({
        "ok": True,
        "running": alive,
        "reachable": reachable,
        "pid": pid,
        "bind_url": runtime.get("bind_url") or runtime_cfg.bind_url,
        "local_url": runtime.get("local_url") or runtime_cfg.local_url,
        "config": public_config(cfg),
        "runtime": runtime,
        "config_file": str(config_path()),
        "pid_file": str(_pid_file()),
    })


def _start(args=None, **kw):
    cfg = _coerce_cfg(args)
    pid = _read_pid()
    runtime = _read_runtime()
    if _alive(pid):
        return _json({
            "ok": True,
            "already_running": True,
            "pid": pid,
            "bind_url": runtime.get("bind_url") or cfg.bind_url,
            "local_url": runtime.get("local_url") or cfg.local_url,
            "message": "Stop and start again to apply a different host/port/db_path.",
            "runtime": runtime,
        })

    server = Path(__file__).parent / "server.py"
    log = data_dir() / "server.log"
    cmd = [sys.executable, str(server), "--host", cfg.host, "--port", str(cfg.port), "--db", cfg.db_path]
    with log.open("ab") as out:
        proc = subprocess.Popen(cmd, stdout=out, stderr=subprocess.STDOUT, start_new_session=True)
    _pid_file().write_text(str(proc.pid))
    _write_runtime(proc.pid, cfg, log)

    ready = False
    for _ in range(30):
        time.sleep(0.1)
        ready = _reachable(cfg, timeout=1)
        if ready:
            break
    return _json({
        "ok": ready,
        "pid": proc.pid,
        "bind_url": cfg.bind_url,
        "local_url": cfg.local_url,
        "host": cfg.host,
        "port": cfg.port,
        "db_path": cfg.db_path,
        "log": str(log),
        "message": "Mnemosyne dashboard started" if ready else "Server launched but readiness check failed; inspect log",
    })


def _stop(args=None, **kw):
    pid = _read_pid()
    if not pid:
        _runtime_file().unlink(missing_ok=True)
        return _json({"ok": True, "stopped": False, "message": "No pid file found"})
    if not _alive(pid):
        _pid_file().unlink(missing_ok=True)
        _runtime_file().unlink(missing_ok=True)
        return _json({"ok": True, "stopped": False, "message": "Process was already gone"})
    try:
        os.kill(pid, signal.SIGTERM)
        for _ in range(20):
            time.sleep(0.1)
            if not _alive(pid):
                break
        if _alive(pid):
            os.kill(pid, signal.SIGKILL)
        _pid_file().unlink(missing_ok=True)
        _runtime_file().unlink(missing_ok=True)
        return _json({"ok": True, "stopped": True, "pid": pid})
    except Exception as e:
        return _json({"ok": False, "error": str(e), "pid": pid})


def _config(args=None, **kw):
    args = args or {}
    updates = {k: args.get(k) for k in ("host", "port", "db_path", "auth_enabled", "password", "clear_password") if args.get(k) not in (None, "")}
    cfg = save_config(**updates) if updates else load_config(create=True)
    return _json({
        "ok": True,
        "config": public_config(cfg),
        "bind_url": cfg.bind_url,
        "local_url": cfg.local_url,
        "config_file": str(config_path()),
        "message": "Config saved. Restart the dashboard process for host/port/db_path changes to take effect." if updates else "Current config.",
    })


def register(ctx):
    cfg = load_config(create=True)
    ctx.register_tool(
        name="mnemosyne_dashboard_start",
        toolset="mnemosyne-dashboard",
        schema={"name":"mnemosyne_dashboard_start","description":"Start the Mnemosyne memory dashboard web UI.","parameters":{"type":"object","properties":{"host":{"type":"string","default":cfg.host,"description":"Bind address. Defaults to config; use 0.0.0.0 to expose on LAN."},"port":{"type":"integer","default":cfg.port,"description":"Bind port. Defaults to config."},"db_path":{"type":"string","default":cfg.db_path,"description":"Path to Mnemosyne SQLite DB. Defaults to config."}}}},
        handler=_start,
        check_fn=lambda: True,
        requires_env=[],
        description="Start Mnemosyne dashboard",
        emoji="🧠",
    )
    ctx.register_tool(
        name="mnemosyne_dashboard_stop",
        toolset="mnemosyne-dashboard",
        schema={"name":"mnemosyne_dashboard_stop","description":"Stop the Mnemosyne memory dashboard web UI.","parameters":{"type":"object","properties":{}}},
        handler=_stop,
        check_fn=lambda: True,
        requires_env=[],
        description="Stop Mnemosyne dashboard",
        emoji="🛑",
    )
    ctx.register_tool(
        name="mnemosyne_dashboard_status",
        toolset="mnemosyne-dashboard",
        schema={"name":"mnemosyne_dashboard_status","description":"Check Mnemosyne memory dashboard status and URL.","parameters":{"type":"object","properties":{"host":{"type":"string","default":cfg.host},"port":{"type":"integer","default":cfg.port},"db_path":{"type":"string","default":cfg.db_path}}}},
        handler=_status,
        check_fn=lambda: True,
        requires_env=[],
        description="Mnemosyne dashboard status",
        emoji="📊",
    )
    ctx.register_tool(
        name="mnemosyne_dashboard_config",
        toolset="mnemosyne-dashboard",
        schema={"name":"mnemosyne_dashboard_config","description":"Read or update default Mnemosyne dashboard config. Restart dashboard after changing host/port/db_path.","parameters":{"type":"object","properties":{"host":{"type":"string","description":"Default bind address, e.g. 127.0.0.1 or 0.0.0.0."},"port":{"type":"integer","description":"Default bind port."},"db_path":{"type":"string","description":"Mnemosyne SQLite DB path."},"auth_enabled":{"type":"boolean","description":"Enable optional password auth."},"password":{"type":"string","description":"Set/change dashboard password."},"clear_password":{"type":"boolean","description":"Disable auth and clear password."}}}},
        handler=_config,
        check_fn=lambda: True,
        requires_env=[],
        description="Configure Mnemosyne dashboard",
        emoji="⚙️",
    )
