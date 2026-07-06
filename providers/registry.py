from __future__ import annotations

from dataclasses import asdict
from typing import Any

from .base import MemoryProvider, ProviderCapabilities, ProviderHealth
from .honcho import HonchoProvider
from .mem0 import Mem0Provider
from .mempalace import MemPalaceProvider
from .mnemosyne import MnemosyneProvider


class ProviderRegistry:
    """Discovers, initializes, and routes to active memory providers."""

    PROVIDERS = [MnemosyneProvider, MemPalaceProvider, Mem0Provider, HonchoProvider]

    def __init__(self):
        self._providers: dict[str, MemoryProvider] = {}
        self._health: dict[str, ProviderHealth] = {}

    def discover(self) -> None:
        """Detect and initialize all available providers."""
        for cls in self.PROVIDERS:
            try:
                if cls.detect():
                    instance = cls()
                    health = instance.initialize()
                    self._providers[cls.name.lower()] = instance
                    self._health[cls.name.lower()] = health
            except Exception as e:
                # Don't let one failed provider break the whole registry
                self._health[cls.name.lower()] = ProviderHealth(
                    "error", 0, f"Failed to initialize {cls.name}: {e}"
                )

    def get(self, name: str) -> MemoryProvider | None:
        return self._providers.get(name)

    def active(self) -> dict[str, MemoryProvider]:
        return dict(self._providers)

    def health(self, name: str) -> ProviderHealth | None:
        return self._health.get(name)

    def all_health(self) -> dict[str, ProviderHealth]:
        return dict(self._health)

    def capabilities(self, name: str) -> ProviderCapabilities | None:
        p = self.get(name)
        return p.capabilities() if p else None

    def provider_info(self, name: str) -> dict[str, Any] | None:
        p = self.get(name)
        if not p:
            return None
        h = self._health.get(name)
        return {
            "name": p.name,
            "slug": name,
            "glyph": p.glyph,
            "color": p.color,
            "capabilities": asdict(p.capabilities()),
            "health": asdict(h) if h else None,
        }

    def all_provider_info(self) -> dict[str, dict[str, Any]]:
        return {name: info for name in self._providers
                if (info := self.provider_info(name)) is not None}
