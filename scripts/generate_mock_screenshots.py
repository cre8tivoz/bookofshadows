#!/usr/bin/env python3

"""Generate mock-data screenshots for the README gallery.

This script intentionally builds a temporary SQLite database with fictional
records. It never reads the user's real Mnemosyne database.
"""

from __future__ import annotations

import base64
import json
import os
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
    raise SystemExit("websocket-client is required to generate screenshots") from exc

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "screenshots"
TMP_DIR = Path("/tmp/mnemosyne-dashboard-screenshots")
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class ChromeSession:
    def __init__(self, port: int, url: str, width: int, height: int, mobile: bool) -> None:
        self.port = port
        self.url = url
        self.width = width
        self.height = height
        self.mobile = mobile
        self.proc: subprocess.Popen[bytes] | None = None
        self.ws: websocket.WebSocket | None = None
        self.counter = 0

    def __enter__(self) -> ChromeSession:
        if not CHROME.exists():
            raise SystemExit(f"Chrome not found at {CHROME}")
        self.proc = subprocess.Popen(
            [
                str(CHROME),
                "--headless=new",
                "--disable-gpu",
                f"--remote-debugging-port={self.port}",
                "--remote-allow-origins=*",
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
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/json", timeout=1))
                if tabs:
                    break
            except Exception:
                time.sleep(0.2)
        tab = next(tab for tab in tabs if tab.get("type") == "page")
        self.ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=10)
        self.call("Page.enable")
        self.call("Runtime.enable")
        self.call(
            "Emulation.setDeviceMetricsOverride",
            {
                "width": self.width,
                "height": self.height,
                "deviceScaleFactor": 2 if self.mobile else 1,
                "mobile": self.mobile,
            },
        )
        return self

    def __exit__(self, *exc: object) -> None:
        if self.ws is not None:
            self.ws.close()
        if self.proc is not None:
            self.proc.terminate()
            self.proc.wait(timeout=10)

    def call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if self.ws is None:
            raise RuntimeError("Chrome session not started")
        self.counter += 1
        self.ws.send(json.dumps({"id": self.counter, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.counter:
                return msg

    def navigate_and_wait(self, url: str, wait_ms: int = 4000) -> None:
        self.call("Page.navigate", {"url": url})
        time.sleep(wait_ms / 1000)

    def screenshot(self, path: Path) -> None:
        data = self.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})["result"]["data"]
        path.write_bytes(base64.b64decode(data))


def wait_for_server(url: str) -> None:
    deadline = time.time() + 20
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1) as resp:
                if resp.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f"Server did not become ready: {url}")


def run() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
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
        shots = [
            ("desktop-dark-overview.png", 1440, 1000, False, "dark", "overview"),
            ("desktop-light-overview.png", 1440, 1000, False, "light", "overview"),
            ("desktop-dark-today.png", 1440, 1000, False, "dark", "today"),
            ("desktop-light-profile.png", 1440, 1000, False, "light", "profile"),
            ("desktop-dark-constellation.png", 1440, 1000, False, "dark", "constellation"),
            ("desktop-dark-neural.png", 1440, 1000, False, "dark", "neural"),
            ("desktop-dark-search.png", 1440, 1000, False, "dark", "search"),
            ("desktop-dark-review.png", 1440, 1000, False, "dark", "review"),
            ("desktop-dark-memories.png", 1440, 1000, False, "dark", "memories"),
            ("desktop-dark-lifecycle.png", 1440, 1000, False, "dark", "lifecycle"),
            ("desktop-light-graph.png", 1440, 1000, False, "light", "graph"),
            ("desktop-dark-memoria.png", 1440, 1000, False, "dark", "memoria"),
            ("desktop-dark-timeline.png", 1440, 1000, False, "dark", "timelineView"),
            ("desktop-dark-settings.png", 1440, 1000, False, "dark", "settings"),
            ("mobile-dark-overview.png", 390, 844, True, "dark", "overview"),
            ("mobile-light-today.png", 390, 844, True, "light", "today"),
            ("mobile-dark-profile.png", 390, 844, True, "dark", "profile"),
            ("mobile-light-constellation.png", 390, 844, True, "light", "constellation"),
            ("mobile-dark-neural.png", 390, 844, True, "dark", "neural"),
            ("mobile-light-search.png", 390, 844, True, "light", "search"),
            ("mobile-dark-timeline.png", 390, 844, True, "dark", "timelineView"),
            ("mobile-light-graph.png", 390, 844, True, "light", "graph"),
            ("mobile-dark-settings.png", 390, 844, True, "dark", "settings"),
        ]
        manifest: list[dict[str, Any]] = []
        for idx, (name, width, height, mobile, theme, tab) in enumerate(shots):
            with ChromeSession(9330 + idx, base_url, width, height, mobile) as chrome:
                # Navigate to the correct URL with tab parameter
                url_tab = 'visualiserlegacy' if tab == 'constellation' else ('visualiser3d' if tab == 'neural' else tab)
                chrome.navigate_and_wait(f"{base_url}?tab={url_tab}&theme={theme}", 5000)
                
                # For visualiser tabs, wait extra time for the graph to render
                if tab in ('constellation', 'neural'):
                    time.sleep(3)
                
                out = OUT_DIR / name
                chrome.screenshot(out)
                manifest.append({"file": name, "theme": theme, "tab": tab, "viewport": f"{width}x{height}"})
                print(f"wrote {out.relative_to(ROOT)}")
        (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    run()
