from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure the project root is on sys.path so `providers` is importable
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from providers.base import Conclusion, PeerCard, Representation, SessionSummary
from providers.honcho import HonchoProvider, _resolve_api_key

# ── helpers ──────────────────────────────────────────────────────────────

def _make_peer(
    id: str = "peer-1",
    name: str = "Alice",
    metadata: dict | None = None,
    created_at: str = "2026-01-01T00:00:00",
) -> MagicMock:
    peer = MagicMock()
    peer.id = id
    peer.name = name
    peer.metadata = metadata or {}
    peer.created_at = created_at
    return peer


def _make_session(
    id: str = "sess-1",
    peers: list[str] | None = None,
    message_count: int = 5,
    created_at: str = "2026-01-01T00:00:00",
    updated_at: str = "2026-01-02T00:00:00",
) -> MagicMock:
    session = MagicMock()
    session.id = id
    session.peers = peers or ["peer-1"]
    session.message_count = message_count
    session.created_at = created_at
    session.updated_at = updated_at
    return session


def _make_representation(
    target_id: str = "peer-2",
    representation: str = "Alice thinks Bob is friendly",
    confidence: float = 0.85,
    updated_at: str = "2026-01-03T00:00:00",
) -> MagicMock:
    rep = MagicMock()
    rep.target_id = target_id
    rep.representation = representation
    rep.confidence = confidence
    rep.updated_at = updated_at
    return rep


def _make_conclusion(
    id: str = "conc-1",
    target_id: str = "peer-2",
    conclusion_type: str = "belief",
    content: str = "Bob prefers tea",
    confidence: float = 0.9,
    created_at: str = "2026-01-04T00:00:00",
) -> MagicMock:
    conc = MagicMock()
    conc.id = id
    conc.target_id = target_id
    conc.conclusion_type = conclusion_type
    conc.content = content
    conc.confidence = confidence
    conc.created_at = created_at
    return conc


def _make_context_result(
    id: str = "ctx-1",
    content: str = "Alice prefers tea over coffee",
    created_at: str = "2026-01-01T00:00:00",
    metadata: dict | None = None,
) -> dict:
    return {
        "id": id,
        "content": content,
        "created_at": created_at,
        "metadata": metadata or {},
    }


def _mock_honcho_module(mock_client=None):
    """Create a mock honcho module with a Honcho class."""
    mock_module = MagicMock()
    if mock_client is None:
        mock_client = MagicMock()
    mock_module.Honcho = MagicMock(return_value=mock_client)
    return mock_module


def _make_mock_client():
    """Create a fully mocked Honcho client with peers, sessions, representations, conclusions."""
    client = MagicMock()

    # peers
    peer1 = _make_peer(id="peer-1", name="Alice")
    peer2 = _make_peer(id="peer-2", name="Bob")
    client.peers.list.return_value = [peer1, peer2]

    # sessions
    sess1 = _make_session(id="sess-1", peers=["peer-1"])
    sess2 = _make_session(id="sess-2", peers=["peer-2"])
    client.sessions.list.return_value = [sess1, sess2]

    # representations - return different values based on peer_id
    def mock_representations_list(peer_id):
        if peer_id == "peer-1":
            return [_make_representation(target_id="peer-2", representation="Alice thinks Bob is friendly")]
        return []
    client.representations.list.side_effect = mock_representations_list

    # conclusions - return different values based on peer_id
    def mock_conclusions_list(peer_id=None):
        if peer_id == "peer-1":
            return [_make_conclusion(id="conc-1", target_id="peer-2", content="Bob prefers tea")]
        elif peer_id is None:
            # Batch call for workspace conclusions
            mock_page = MagicMock()
            mock_page.total = 1
            mock_page.items = [_make_conclusion(id="conc-1", target_id="peer-2", content="Bob prefers tea")]
            # Support iterator protocol if fallback is used
            mock_page.__iter__.return_value = iter(mock_page.items)
            return mock_page
        return []
    client.conclusions.list.side_effect = mock_conclusions_list

    # context search
    client.context.search.return_value = [_make_context_result()]

    return client


# ── tests ────────────────────────────────────────────────────────────────

class TestDetect:
    def test_detect_env_var(self, monkeypatch):
        monkeypatch.setenv("HONCHO_API_KEY", "sk-test-key")
        mock_module = _mock_honcho_module()
        with patch.dict("sys.modules", {"honcho": mock_module}):
            assert HonchoProvider.detect() is True

    def test_detect_reads_hermes_json(self, monkeypatch, tmp_path):
        monkeypatch.delenv("HONCHO_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        (tmp_path / "honcho.json").write_text(json.dumps({"api_key": "sk-from-json"}))
        mock_module = _mock_honcho_module()
        with patch.dict("sys.modules", {"honcho": mock_module}):
            assert HonchoProvider.detect() is True

    def test_detect_reads_honcho_config(self, monkeypatch, tmp_path):
        monkeypatch.delenv("HONCHO_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        honcho_dir = tmp_path / ".honcho"
        honcho_dir.mkdir()
        (honcho_dir / "config.json").write_text(json.dumps({"api_key": "sk-from-honcho"}))
        mock_module = _mock_honcho_module()
        with patch.dict("sys.modules", {"honcho": mock_module}):
            # Need to patch Path.home() to return tmp_path
            with patch("providers.honcho.Path.home", return_value=tmp_path):
                assert HonchoProvider.detect() is True

    def test_detect_no_key_returns_false(self, monkeypatch, tmp_path):
        monkeypatch.delenv("HONCHO_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        mock_module = _mock_honcho_module()
        with patch.dict("sys.modules", {"honcho": mock_module}):
            with patch("providers.honcho.Path.home", return_value=tmp_path):
                assert HonchoProvider.detect() is False

    def test_detect_no_package_returns_false(self, monkeypatch):
        monkeypatch.setenv("HONCHO_API_KEY", "sk-test-key")
        with patch.dict("sys.modules", {"honcho": None}):
            assert HonchoProvider.detect() is False


class TestInitialize:
    def test_initialize_reports_peer_count(self):
        mock_client = _make_mock_client()
        mock_module = _mock_honcho_module(mock_client)
        with patch.dict("sys.modules", {"honcho": mock_module}):
            provider = HonchoProvider(api_key="sk-test")
            health = provider.initialize()
        assert health.status == "ok"
        assert health.row_count == 2
        assert "2 peers" in health.message

    def test_initialize_import_error(self, monkeypatch):
        with patch.dict("sys.modules", {"honcho": None}):
            provider = HonchoProvider(api_key="sk-test")
            health = provider.initialize()
        assert health.status == "error"
        assert "honcho package not installed" in health.message


class TestQuery:
    def test_query_returns_rows_from_peer_context(self):
        ctx = _make_context_result(content="Alice prefers tea")
        mock_client = MagicMock()
        mock_client.context.search.return_value = [ctx]
        mock_module = _mock_honcho_module(mock_client)
        with patch.dict("sys.modules", {"honcho": mock_module}):
            provider = HonchoProvider(api_key="sk-test")
            provider._client = mock_client
            rows = provider.query("tea preference", limit=10)
        mock_client.context.search.assert_called_once()
        assert len(rows) == 1
        assert rows[0].content == "Alice prefers tea"
        assert rows[0].source == "honcho"

    def test_query_not_initialized_raises(self):
        provider = HonchoProvider(api_key="sk-test")
        with pytest.raises(RuntimeError, match="not initialized"):
            provider.query("test")


class TestGraphEdges:
    def test_graph_edges_from_representations(self):
        mock_client = _make_mock_client()
        mock_module = _mock_honcho_module(mock_client)
        with patch.dict("sys.modules", {"honcho": mock_module}):
            provider = HonchoProvider(api_key="sk-test")
            provider._client = mock_client
            edges = provider.get_graph_edges()
        assert edges is not None
        assert len(edges) == 1
        assert edges[0].source == "peer-1"
        assert edges[0].predicate == "represents"
        assert edges[0].target == "peer-2"
        assert edges[0].confidence == 0.85


class TestTimeline:
    def test_timelines_return_none(self):
        provider = HonchoProvider(api_key="sk-test")
        assert provider.get_timeline() is None


class TestCapabilities:
    def test_capabilities(self):
        provider = HonchoProvider(api_key="sk-test")
        caps = provider.capabilities()
        assert caps.search is True
        assert caps.graph is True
        assert caps.timeline is False
        assert caps.editable is False


class TestGetCounts:
    def test_get_counts_returns_peer_session_conclusion_totals(self):
        mock_client = _make_mock_client()
        mock_module = _mock_honcho_module(mock_client)
        with patch.dict("sys.modules", {"honcho": mock_module}):
            provider = HonchoProvider(api_key="sk-test")
            provider._client = mock_client
            counts = provider.get_counts()
        assert counts["peers"] == 2
        assert counts["sessions"] == 2
        assert counts["conclusions"] == 1  # 1 conclusion for peer-1, peer-2 has none


class TestPeerProvider:
    def test_get_peers_returns_peer_cards(self):
        mock_client = _make_mock_client()
        mock_module = _mock_honcho_module(mock_client)
        with patch.dict("sys.modules", {"honcho": mock_module}):
            provider = HonchoProvider(api_key="sk-test")
            provider._client = mock_client
            peers = provider.get_peers()
        assert len(peers) == 2
        assert isinstance(peers[0], PeerCard)
        assert peers[0].id == "peer-1"
        assert peers[0].name == "Alice"

    def test_get_sessions_returns_session_summaries(self):
        mock_client = _make_mock_client()
        mock_module = _mock_honcho_module(mock_client)
        with patch.dict("sys.modules", {"honcho": mock_module}):
            provider = HonchoProvider(api_key="sk-test")
            provider._client = mock_client
            sessions = provider.get_sessions()
        assert len(sessions) == 2
        assert isinstance(sessions[0], SessionSummary)
        assert sessions[0].id == "sess-1"
        assert sessions[0].message_count == 5

    def test_get_representations_returns_representations(self):
        mock_client = _make_mock_client()
        mock_module = _mock_honcho_module(mock_client)
        with patch.dict("sys.modules", {"honcho": mock_module}):
            provider = HonchoProvider(api_key="sk-test")
            provider._client = mock_client
            reps = provider.get_representations("peer-1")
        assert len(reps) == 1
        assert isinstance(reps[0], Representation)
        assert reps[0].target_id == "peer-2"
        assert reps[0].representation == "Alice thinks Bob is friendly"

    def test_get_conclusions_returns_conclusions(self):
        mock_client = _make_mock_client()
        mock_module = _mock_honcho_module(mock_client)
        with patch.dict("sys.modules", {"honcho": mock_module}):
            provider = HonchoProvider(api_key="sk-test")
            provider._client = mock_client
            conclusions = provider.get_conclusions("peer-1")
        assert len(conclusions) == 1
        assert isinstance(conclusions[0], Conclusion)
        assert conclusions[0].content == "Bob prefers tea"


class TestResolveApiKey:
    def test_env_var(self, monkeypatch):
        monkeypatch.setenv("HONCHO_API_KEY", "sk-env")
        assert _resolve_api_key() == "sk-env"

    def test_hermes_json_file(self, monkeypatch, tmp_path):
        monkeypatch.delenv("HONCHO_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        (tmp_path / "honcho.json").write_text(json.dumps({"api_key": "sk-json"}))
        assert _resolve_api_key() == "sk-json"

    def test_no_key_returns_none(self, monkeypatch, tmp_path):
        monkeypatch.delenv("HONCHO_API_KEY", raising=False)
        monkeypatch.setenv("HERMES_HOME", str(tmp_path))
        with patch("providers.honcho.Path.home", return_value=tmp_path):
            assert _resolve_api_key() is None
