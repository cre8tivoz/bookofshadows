from __future__ import annotations

import json
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from test_dashboard_core import make_db  # noqa: E402

from server import Handler, ThreadingHTTPServer  # noqa: E402


def _request(url: str, method: str = "GET", body: dict[str, Any] | None = None) -> tuple[int, dict[str, str], bytes]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read()


class ServerHarness:
    def __init__(self, tmp_path: Path, monkeypatch):
        self.db = tmp_path / "mnemosyne.db"
        make_db(self.db)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path / "hermes"))
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.httpd.db_path = self.db
        self.httpd.bind_host = "127.0.0.1"
        self.httpd.bind_port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.httpd.server_address[1]}"

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=5)


def test_health_endpoint_and_security_headers(tmp_path, monkeypatch):
    server = ServerHarness(tmp_path, monkeypatch)
    try:
        status, headers, body = _request(f"{server.base}/api/health")
        payload = json.loads(body)
        assert status == 200
        assert payload["ok"] is True
        assert payload["read_only"] is True
        assert headers["X-Content-Type-Options"] == "nosniff"
        assert headers["X-Frame-Options"] == "DENY"
        assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
    finally:
        server.close()


def test_invalid_limit_query_falls_back_instead_of_500(tmp_path, monkeypatch):
    server = ServerHarness(tmp_path, monkeypatch)
    try:
        status, _headers, body = _request(f"{server.base}/api/memories?limit=not-a-number")
        payload = json.loads(body)
        assert status == 200
        assert len(payload["items"]) == 4
    finally:
        server.close()


def test_static_path_escape_is_blocked(tmp_path, monkeypatch):
    server = ServerHarness(tmp_path, monkeypatch)
    try:
        status, _headers, body = _request(f"{server.base}/static/%2e%2e/server.py")
        assert status == 404
        assert b"not found" in body
    finally:
        server.close()
