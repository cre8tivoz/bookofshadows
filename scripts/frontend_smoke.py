#!/usr/bin/env python3

"""Run a lightweight browser smoke check against the static dashboard.

The script starts the local server with fictional data, checks key HTTP assets,
then uses headless Chrome to render representative routes. It is intended as
the Phase 0 repeatable frontend baseline before deeper modularisation.
"""

from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

from mock_data import make_mock_db

try:
    import websocket
except ImportError as exc:
    raise SystemExit("websocket-client is required to run the browser smoke check") from exc

ROOT = Path(__file__).resolve().parents[1]
TMP_DIR = Path("/tmp/mnemosyne-dashboard-smoke")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def fetch(url: str, timeout: float = 5) -> tuple[int, str, float]:
    started = time.perf_counter()
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        elapsed_ms = (time.perf_counter() - started) * 1000
        return resp.status, body, elapsed_ms


def wait_for_server(url: str) -> None:
    deadline = time.time() + 20
    while time.time() < deadline:
        try:
            status, _body, _elapsed = fetch(url, timeout=1)
            if status == 200:
                return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f"Server did not become ready: {url}")


def assert_contains(label: str, body: str, expected: str) -> None:
    if expected not in body:
        raise AssertionError(f"{label} did not contain expected marker: {expected!r}")


def check_http_baseline(base_url: str) -> dict[str, float]:
    timings: dict[str, float] = {}
    checks = {
        "health": ("api/health", '"ok": true'),
        "stats": ("api/stats", '"counts"'),
        "index": ("", "Book of Shadows"),
        "app_js": ("static/app.js", "bootstrapDashboard"),
        "style_css": ("static/style.css", ".shell"),
    }
    for label, (path, marker) in checks.items():
        status, body, elapsed_ms = fetch(base_url + path)
        if status != 200:
            raise AssertionError(f"{label} returned HTTP {status}")
        assert_contains(label, body, marker)
        timings[label] = elapsed_ms
    return timings


class ChromeSession:
    def __init__(self, url: str, width: int = 1440, height: int = 1000) -> None:
        self.port = free_port()
        self.url = url
        self.width = width
        self.height = height
        self.proc: subprocess.Popen[bytes] | None = None
        self.ws: websocket.WebSocket | None = None
        self.counter = 0
        self.user_data_dir = TMP_DIR / f"chrome-cdp-{self.port}"

    def __enter__(self) -> ChromeSession:
        if not CHROME.exists():
            raise RuntimeError(f"Chrome not found at {CHROME}")
        if self.user_data_dir.exists():
            shutil.rmtree(self.user_data_dir)
        self.proc = subprocess.Popen(
            [
                str(CHROME),
                "--headless=new",
                "--disable-gpu",
                "--no-first-run",
                "--disable-dev-shm-usage",
                "--remote-allow-origins=*",
                f"--remote-debugging-port={self.port}",
                f"--user-data-dir={self.user_data_dir}",
                f"--window-size={self.width},{self.height}",
                self.url,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        deadline = time.time() + 20
        tabs: list[dict[str, Any]] = []
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json", timeout=1) as resp:
                    tabs = json.loads(resp.read().decode("utf-8"))
                if tabs:
                    break
            except Exception:
                time.sleep(0.2)
        tab = next((item for item in tabs if item.get("type") == "page"), None)
        if not tab:
            raise RuntimeError("Chrome did not expose a page target")
        self.ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=10)
        self.call("Page.enable")
        self.call("Runtime.enable")
        self.call(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": self.width,
                "height": self.height,
                "deviceScaleFactor": 1,
                "mobile": False,
            },
        )
        return self

    def __exit__(self, *exc: object) -> None:
        if self.ws is not None:
            self.ws.close()
        if self.proc is not None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if self.user_data_dir.exists():
            shutil.rmtree(self.user_data_dir)

    def call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if self.ws is None:
            raise RuntimeError("Chrome session not started")
        self.counter += 1
        self.ws.send(json.dumps({"id": self.counter, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.counter:
                if "error" in msg:
                    raise RuntimeError(f"Chrome call failed: {msg['error']}")
                return msg

    def navigate_and_wait(self, url: str, wait_ms: int = 3500) -> None:
        self.call("Page.navigate", {"url": url})
        time.sleep(wait_ms / 1000)

    def eval(self, expression: str) -> Any:
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        details = result.get("result", {})
        if details.get("exceptionDetails"):
            raise AssertionError(details["exceptionDetails"])
        return details.get("result", {}).get("value")


def run_chrome_route(base_url: str, tab: str) -> float:
    started = time.perf_counter()
    route_ids = {
        "memories": "explore",
        "visualiserlegacy": "constellation",
    }
    route_id = route_ids.get(tab, tab)
    with ChromeSession(base_url) as chrome:
        chrome.navigate_and_wait(f"{base_url}?tab={tab}")
        checks = chrome.eval(
            f"""(() => {{
              const section = document.getElementById({json.dumps(route_id)});
              const text = document.body ? document.body.innerText : '';
              return {{
                title: document.title,
                hasSection: !!section,
                sectionActive: !!section && section.classList.contains('active'),
                hasBrand: text.includes('Book of Shadows'),
                hasBootError: !!document.querySelector('#bootError:not(.hidden)')
              }};
            }})()"""
        )
    elapsed_ms = (time.perf_counter() - started) * 1000
    if not checks.get("hasSection"):
        raise AssertionError(f"Chrome smoke did not find section for {tab}: {checks}")
    if not checks.get("sectionActive"):
        raise AssertionError(f"Chrome smoke section was not active for {tab}: {checks}")
    if not checks.get("hasBrand"):
        raise AssertionError(f"Chrome smoke did not render brand text for {tab}: {checks}")
    if checks.get("hasBootError"):
        raise AssertionError(f"Chrome smoke rendered boot error for {tab}: {checks}")
    return elapsed_ms


def run() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    db_path = TMP_DIR / "mock-mnemosyne.db"
    make_mock_db(db_path)
    port = free_port()
    base_url = f"http://127.0.0.1:{port}/"
    server = subprocess.Popen(
        [sys.executable, str(ROOT / "server.py"), "--host", "127.0.0.1", "--port", str(port), "--db", str(db_path)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env={**os.environ, "MNEMOSYNE_DASHBOARD_CONFIG": str(TMP_DIR / "config.json")},
    )
    try:
        wait_for_server(f"{base_url}api/health")
        timings = check_http_baseline(base_url)
        route_timings = {
            tab: run_chrome_route(base_url, tab)
            for tab in ("overview", "today", "memories", "graph", "settings")
        }
        result: dict[str, Any] = {
            "ok": True,
            "base_url": base_url,
            "http_ms": {k: round(v, 1) for k, v in timings.items()},
            "chrome_route_ms": {k: round(v, 1) for k, v in route_timings.items()},
        }
        print(json.dumps(result, indent=2))
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    run()
