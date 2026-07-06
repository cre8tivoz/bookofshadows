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
from providers.registry import ProviderRegistry
from server import Handler


def make_test_db(path: Path):
    """Create a minimal test DB with one memory."""
    con = sqlite3.connect(path)
    con.executescript("""
    CREATE TABLE working_memory (
        id TEXT PRIMARY KEY, content TEXT NOT NULL, source TEXT, timestamp TEXT,
        session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5,
        metadata_json TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL,
        valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL,
        scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT,
        veracity TEXT DEFAULT 'unknown'
    );
    CREATE TABLE episodic_memory (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL, content TEXT NOT NULL, source TEXT, timestamp TEXT,
        session_id TEXT DEFAULT 'default', importance REAL DEFAULT 0.5,
        metadata_json TEXT, summary_of TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        recall_count INTEGER DEFAULT 0, last_recalled TIMESTAMP DEFAULT NULL,
        valid_until TIMESTAMP DEFAULT NULL, superseded_by TEXT DEFAULT NULL,
        scope TEXT DEFAULT 'global', author_id TEXT, author_type TEXT, channel_id TEXT,
        veracity TEXT DEFAULT 'unknown', tier INTEGER DEFAULT 1, degraded_at TEXT
    );
    CREATE TABLE triples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL, predicate TEXT NOT NULL, object TEXT NOT NULL,
        valid_from TEXT NOT NULL, valid_until TEXT, source TEXT, confidence REAL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    con.execute("INSERT INTO working_memory(id,content,source,timestamp,session_id,importance,scope) VALUES (?,?,?,?,?,?,?)",
               ("t1", "test memory content", "preference", "2026-01-01", "s1", 0.8, "global"))
    con.commit()
    con.close()


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    """Start a test server with a temp DB containing one memory."""
    db_path = tmp_path_factory.mktemp("test-db") / "test.db"
    make_test_db(db_path)
    
    # Build registry with Mnemosyne provider
    reg = ProviderRegistry()
    prov = MnemosyneProvider(db_path)
    health = prov.initialize()
    reg._providers["mnemosyne"] = prov
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


def test_providers_endpoint_returns_mnemosyne(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/providers"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert "providers" in data
    assert "mnemosyne" in data["providers"]


def test_mnemosyne_memories_route(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/mnemosyne/memories"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert data["provider"] == "mnemosyne"
    assert "memories" in data


def test_unknown_provider_returns_404(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/nonexistent/memories"
    try:
        urllib.request.urlopen(url)
        raise AssertionError("Should have raised HTTPError")
    except urllib.error.HTTPError as e:
        assert e.code == 404


def test_mnemosyne_graph_route(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/mnemosyne/graph"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert data["graph"] is not None


def test_mnemosyne_counts_route(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/mnemosyne/counts"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert "counts" in data
    assert data["counts"]["total"] >= 1


def test_mnemosyne_timeline_route(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/mnemosyne/timeline"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert "timeline" in data


def test_health_endpoint_includes_providers(server):
    url = f"http://127.0.0.1:{server.server_address[1]}/api/health"
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())
    assert "providers" in data
    assert "mnemosyne" in data["providers"]
