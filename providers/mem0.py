from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from .base import (
    MemoryProvider,
    ProviderCapabilities,
    ProviderHealth,
    Row,
)

_MEM0_BASE_URLS = ("https://api.mem0.ai", "http://localhost", "http://127.0.0.1")


def _validate_base_url(base_url: str | None, provider: str, allowed: tuple[str, ...]) -> str | None:
    """Validate a provider base_url against an allowlist to prevent SSRF."""
    if not base_url:
        return None
    if not base_url.startswith(("https://", "http://")):
        return None
    try:
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        hostname = parsed.hostname or ""
        if hostname in ("localhost", "127.0.0.1", "::1"):
            pass
        elif hostname.startswith("10.") or hostname.startswith("192.168.") or hostname.startswith("172."):
            if not any(base_url.startswith(a) for a in allowed):
                return None
        elif hostname == "169.254.169.254" or hostname.startswith("169.254."):
            return None
    except Exception:
        pass
    if not any(base_url.startswith(a) for a in allowed):
        return None
    return base_url


def _hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME", str(Path.home() / ".hermes")))


def _resolve_api_key() -> str | None:
    """Resolve MEM0_API_KEY from env, $HERMES_HOME/.env, or $HERMES_HOME/mem0.json."""
    # 1. Direct env var
    key = os.environ.get("MEM0_API_KEY")
    if key:
        return key

    home = _hermes_home()

    # 2. $HERMES_HOME/.env
    env_file = home / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("MEM0_API_KEY="):
                return line.split("=", 1)[1].strip().strip("'\"")

    # 3. $HERMES_HOME/mem0.json
    json_file = home / "mem0.json"
    if json_file.exists():
        import json

        try:
            data = json.loads(json_file.read_text())
            key = data.get("api_key")
            if key:
                return key
        except Exception:
            pass

    return None


def _resolve_config() -> dict[str, Any]:
    """Read optional user_id / agent_id from $HERMES_HOME/mem0.json."""
    home = _hermes_home()
    json_file = home / "mem0.json"
    if json_file.exists():
        import json

        try:
            return json.loads(json_file.read_text())
        except Exception:
            pass
    return {}


class Mem0Provider(MemoryProvider):
    """Adapter for the Mem0 cloud memory platform (https://mem0.ai)."""

    name: str = "Mem0"
    glyph: str = "☁️"
    color: str = "#3b82f6"  # blue

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        user_id: str | None = None,
        agent_id: str | None = None,
    ):
        self.api_key = api_key or _resolve_api_key() or ""
        self.base_url = _validate_base_url(base_url, "mem0", _MEM0_BASE_URLS)
        cfg = _resolve_config()
        self.user_id = user_id or cfg.get("user_id")
        self.agent_id = agent_id or cfg.get("agent_id")
        self._client: Any = None

    # ── resolver ──────────────────────────────────────────────────────
    @classmethod
    def detect(cls) -> bool:
        """True if a Mem0 API key can be resolved from any source."""
        try:
            from mem0 import MemoryClient  # noqa: F401
        except ImportError:
            return False
        return _resolve_api_key() is not None

    # ── ABC implementation ────────────────────────────────────────────
    def initialize(self) -> ProviderHealth:
        try:
            from mem0 import MemoryClient

            kwargs: dict[str, Any] = {"api_key": self.api_key}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            self._client = MemoryClient(**kwargs)
            counts = self.get_counts()
            total = counts.get("total", 0)
            msg = f"{total} memories" if total else "connected, no memories"
            return ProviderHealth("ok", total, msg)
        except ImportError:
            return ProviderHealth("error", 0, "mem0 package not installed — run `pip install mem0ai`")
        except Exception as e:
            return ProviderHealth("error", 0, str(e))

    def query(self, search: str, limit: int = 100) -> list[Row]:
        if self._client is None:
            raise RuntimeError("Mem0Provider not initialized — call initialize() first")
        filters: dict[str, Any] = {}
        if self.user_id:
            filters["user_id"] = self.user_id
        if self.agent_id:
            filters["agent_id"] = self.agent_id
        results = self._client.search(query=search, limit=limit, **filters)
        return [self._to_row(r) for r in results]

    def get_all(self, limit: int = 1000) -> list[Row]:
        if self._client is None:
            raise RuntimeError("Mem0Provider not initialized — call initialize() first")
        filters: dict[str, Any] = {}
        if self.user_id:
            filters["user_id"] = self.user_id
        if self.agent_id:
            filters["agent_id"] = self.agent_id
        results = self._client.get_all(limit=limit, **filters)
        return [self._to_row(r) for r in results]

    def get_counts(self) -> dict[str, int]:
        try:
            all_memories = self.get_all(limit=1000)
            return {"total": len(all_memories)}
        except Exception:
            return {"total": 0}

    def get_graph_edges(self, limit: int = 500) -> None:
        return None

    def get_timeline(self, limit: int = 200) -> None:
        return None

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(search=True, graph=False, timeline=False, editable=False)

    # ── helpers ───────────────────────────────────────────────────────
    @staticmethod
    def _to_row(d: dict[str, Any]) -> Row:
        """Map a Mem0 memory dict to a Row.

        Mem0 SDK returns a ``memory`` field (not ``content``).
        """
        return Row(
            id=str(d.get("id", "")),
            content=str(d.get("memory", "")),
            timestamp=str(d.get("created_at", "")),
            source="mem0",
            kind="working",
            metadata=d.get("metadata") or {},
            veracity="unknown",
            importance=0.5,
        )
