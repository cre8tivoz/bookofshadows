import json
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

from providers.mnemosyne import MnemosyneProvider
from server import Handler


def make_test_db(path: Path):
    con = sqlite3.connect(str(path))
    con.execute("CREATE TABLE working_memory (id TEXT PRIMARY KEY, content TEXT NOT NULL, source TEXT, timestamp TEXT, session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5, metadata_json TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL, valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL, scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT, veracity TEXT DEFAULT 'unknown')")
    con.execute("INSERT INTO working_memory(id,content,source,timestamp,session_id,importance,scope) VALUES (?,?,?,?,?,?,?)", ("t1", "test memory content", "preference", "2026-01-01", "s1", 0.8, "global"))
    con.execute("CREATE TABLE triples (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL, predicate TEXT NOT NULL, object TEXT NOT NULL, valid_from TEXT NOT NULL, valid_until TEXT)")
    con.execute("CREATE TABLE episodic_memory (rowid INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, content TEXT NOT NULL, source TEXT, timestamp TEXT, session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5, metadata_json TEXT, summary_of TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL, valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL, scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT, veracity TEXT DEFAULT 'unknown', tier INTEGER DEFAULT 1, degraded_at TEXT)")
    con.execute("CREATE TABLE consolidation_log (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, items_consolidated INTEGER, summary_preview TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
    con.commit()
    con.close()


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("test-db") / "test.db"
    make_test_db(db_path)

    provider = MnemosyneProvider(db_path)
    health = provider.initialize()

    from providers.registry import ProviderRegistry
    reg = ProviderRegistry()
    reg._providers["mnemosyne"] = provider
    reg._health["mnemosyne"] = health

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    httpd.registry = reg
    httpd.db_path = db_path
    httpd.bind_host = "127.0.0.1"
    httpd.bind_port = httpd.server_address[1]

    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.2)

    yield httpd
    httpd.shutdown()


def test_cross_search_endpoint(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/search?q=test"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert "results" in data
    assert "mnemosyne" in data["results"]
    assert data["query"] == "test"


def test_cross_search_with_provider_filter(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/search?q=test&providers=mnemosyne"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert "mnemosyne" in data["results"]


def test_unified_timeline_endpoint(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/timeline"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert "timeline" in data
    assert "total" in data


def test_providers_endpoint_includes_capabilities(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/providers"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    providers = data["providers"]
    assert "mnemosyne" in providers
    assert providers["mnemosyne"]["capabilities"]["graph"] is True
    assert providers["mnemosyne"]["capabilities"]["timeline"] is True


def test_provider_route_returns_404_for_inactive_provider(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/nonexistent/memories"
    try:
        urllib.request.urlopen(url)
        raise AssertionError("Expected HTTPError")
    except urllib.error.HTTPError as e:
        assert e.code == 404
        body = json.loads(e.read())
        assert "not active" in body.get("error", "")


def test_provider_memories_route(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/mnemosyne/memories?q=test"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert data["provider"] == "mnemosyne"
    assert "memories" in data
