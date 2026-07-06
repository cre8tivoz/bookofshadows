from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure the project root is on sys.path so `providers` is importable
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from providers.base import Row
from providers.mem0 import Mem0Provider, _resolve_api_key

# ── helpers ──────────────────────────────────────────────────────────────

def _make_memory(
    id: str = "m1",
    memory: str = "YC prefers local-only memory",
    user_id: str = "user-1",
    agent_id: str | None = None,
    created_at: str = "2026-01-01T00:00:00",
    metadata: dict | None = None,
    categories: list[str] | None = None,
) -> dict:
    return {
        "id": id,
        "memory": memory,
        "user_id": user_id,
        "agent_id": agent_id,
        "hash": "abc123",
        "metadata": metadata or {},
        "created_at": created_at,
        "categories": categories or [],
    }


def _mock_mem0_module(mock_client=None):
    """Create a mock mem0 module with a MemoryClient class."""
    mock_module = MagicMock()
    if mock_client is None:
        mock_client = MagicMock()
    mock_module.MemoryClient = MagicMock(return_value=mock_client)
    return mock_module


# ── tests ────────────────────────────────────────────────────────────────

class TestDetect:
    def test_detect_reads_env(self, monkeypatch):
        monkeypatch.setenv("MEM0_API_KEY", "sk-test-key")
        mock_module = _mock_mem0_module()
        with patch.dict("sys.modules", {"mem0": mock_module}):
            assert Mem0Provider.detect() is True

    def test_detect_reads_hermes_env(self, monkeypatch, tmp_path):
        monkeypatch.delenv("MEM0_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        (tmp_path / ".env").write_text("MEM0_API_KEY=sk-from-env\n")
        mock_module = _mock_mem0_module()
        with patch.dict("sys.modules", {"mem0": mock_module}):
            assert Mem0Provider.detect() is True

    def test_detect_reads_hermes_json(self, monkeypatch, tmp_path):
        monkeypatch.delenv("MEM0_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        (tmp_path / "mem0.json").write_text(json.dumps({"api_key": "sk-from-json", "user_id": "u1"}))
        mock_module = _mock_mem0_module()
        with patch.dict("sys.modules", {"mem0": mock_module}):
            assert Mem0Provider.detect() is True

    def test_detect_no_key_returns_false(self, monkeypatch, tmp_path):
        monkeypatch.delenv("MEM0_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        mock_module = _mock_mem0_module()
        with patch.dict("sys.modules", {"mem0": mock_module}):
            assert Mem0Provider.detect() is False

    def test_detect_no_package_returns_false(self, monkeypatch):
        monkeypatch.setenv("MEM0_API_KEY", "sk-test-key")
        # Setting sys.modules["mem0"] = None makes `from mem0 import X` raise ImportError
        with patch.dict("sys.modules", {"mem0": None}):
            assert Mem0Provider.detect() is False


class TestInitialize:
    def test_initialize_reports_counts(self):
        mock_client = MagicMock()
        mock_client.get_all.return_value = [_make_memory(id="m1"), _make_memory(id="m2")]
        mock_module = _mock_mem0_module(mock_client)
        with patch.dict("sys.modules", {"mem0": mock_module}):
            provider = Mem0Provider(api_key="sk-test")
            health = provider.initialize()
        assert health.status == "ok"
        assert health.row_count == 2
        assert "2 memories" in health.message

    def test_initialize_import_error(self, monkeypatch):
        with patch.dict("sys.modules", {"mem0": None}):
            provider = Mem0Provider(api_key="sk-test")
            health = provider.initialize()
        assert health.status == "error"
        assert "mem0 package not installed" in health.message


class TestQuery:
    def test_query_dispatches_search(self):
        mem = _make_memory(memory="local-only memory")
        mock_client = MagicMock()
        mock_client.search.return_value = [mem]
        mock_module = _mock_mem0_module(mock_client)
        with patch.dict("sys.modules", {"mem0": mock_module}):
            provider = Mem0Provider(api_key="sk-test", user_id="u1")
            provider._client = mock_client
            rows = provider.query("local", limit=10)
        mock_client.search.assert_called_once()
        call_kwargs = mock_client.search.call_args
        # Check query was passed (either positional or keyword)
        assert call_kwargs.kwargs.get("query") == "local" or (call_kwargs.args and call_kwargs.args[0] == "local")
        assert len(rows) == 1
        assert rows[0].content == "local-only memory"

    def test_query_not_initialized_raises(self):
        provider = Mem0Provider(api_key="sk-test")
        with pytest.raises(RuntimeError, match="not initialized"):
            provider.query("test")


class TestGetAll:
    def test_get_all_dispatches(self):
        mock_client = MagicMock()
        mock_client.get_all.return_value = [_make_memory(id="m1"), _make_memory(id="m2"), _make_memory(id="m3")]
        mock_module = _mock_mem0_module(mock_client)
        with patch.dict("sys.modules", {"mem0": mock_module}):
            provider = Mem0Provider(api_key="sk-test")
            provider._client = mock_client
            rows = provider.get_all(limit=50)
        mock_client.get_all.assert_called_once()
        assert len(rows) == 3


class TestCounts:
    def test_get_counts_returns_total(self):
        mock_client = MagicMock()
        mock_client.get_all.return_value = [_make_memory(id="m1"), _make_memory(id="m2")]
        mock_module = _mock_mem0_module(mock_client)
        with patch.dict("sys.modules", {"mem0": mock_module}):
            provider = Mem0Provider(api_key="sk-test")
            provider._client = mock_client
            counts = provider.get_counts()
        assert counts == {"total": 2}


class TestGraphAndTimeline:
    def test_timelines_and_graphs_return_none(self):
        provider = Mem0Provider(api_key="sk-test")
        assert provider.get_timeline() is None
        assert provider.get_graph_edges() is None


class TestCapabilities:
    def test_capabilities(self):
        provider = Mem0Provider(api_key="sk-test")
        caps = provider.capabilities()
        assert caps.search is True
        assert caps.graph is False
        assert caps.timeline is False
        assert caps.editable is False


class TestToRow:
    def test_to_row_maps_memory_field(self):
        mem = _make_memory(
            id="mem-42",
            memory="YC uses Obsidian for notes",
            user_id="u1",
            agent_id="a1",
            created_at="2026-03-15T12:00:00",
            metadata={"source": "test"},
            categories=["preferences"],
        )
        row = Mem0Provider._to_row(mem)
        assert isinstance(row, Row)
        assert row.id == "mem-42"
        assert row.content == "YC uses Obsidian for notes"
        assert row.timestamp == "2026-03-15T12:00:00"
        assert row.source == "mem0"
        assert row.metadata == {"source": "test"}

    def test_to_row_handles_missing_fields(self):
        row = Mem0Provider._to_row({})
        assert row.id == ""
        assert row.content == ""
        assert row.timestamp == ""
        assert row.source == "mem0"


class TestResolveApiKey:
    def test_env_var(self, monkeypatch):
        monkeypatch.setenv("MEM0_API_KEY", "sk-env")
        assert _resolve_api_key() == "sk-env"

    def test_hermes_env_file(self, monkeypatch, tmp_path):
        monkeypatch.delenv("MEM0_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        (tmp_path / ".env").write_text("OTHER=thing\nMEM0_API_KEY=sk-file\n")
        assert _resolve_api_key() == "sk-file"

    def test_hermes_json_file(self, monkeypatch, tmp_path):
        monkeypatch.delenv("MEM0_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        (tmp_path / "mem0.json").write_text(json.dumps({"api_key": "sk-json"}))
        assert _resolve_api_key() == "sk-json"

    def test_no_key_returns_none(self, monkeypatch, tmp_path):
        monkeypatch.delenv("MEM0_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        assert _resolve_api_key() is None
