from unittest.mock import MagicMock

from providers.base import ProviderCapabilities, ProviderHealth
from providers.mnemosyne import MnemosyneProvider
from providers.registry import ProviderRegistry


def test_registry_starts_empty():
    reg = ProviderRegistry()
    assert reg.active() == {}
    assert reg.all_health() == {}
    assert reg.get("mnemosyne") is None


def test_registry_health_for_missing_returns_none():
    reg = ProviderRegistry()
    reg._providers["x"] = MagicMock()
    assert reg.health("missing") is None


def test_registry_all_provider_info_formats():
    reg = ProviderRegistry()
    mock_provider = MagicMock()
    mock_provider.name = "Test"
    mock_provider.glyph = "T"
    mock_provider.color = "#000"
    mock_provider.capabilities.return_value = ProviderCapabilities(
        search=True, graph=False, timeline=False, editable=False
    )
    reg._providers["test"] = mock_provider
    reg._health["test"] = ProviderHealth(status="ok", row_count=5, message="5 memories")
    infos = reg.all_provider_info()
    assert "test" in infos
    assert infos["test"]["name"] == "Test"
    assert infos["test"]["glyph"] == "T"
    assert infos["test"]["capabilities"]["search"] is True
    assert infos["test"]["health"]["status"] == "ok"


def test_registry_detect_catches_exceptions(monkeypatch):
    """A provider that throws during detect should not crash the registry."""
    monkeypatch.setattr(MnemosyneProvider, "detect", classmethod(lambda cls: 1 / 0))
    reg = ProviderRegistry()
    reg.discover()
    assert "mnemosyne" not in reg.active()
