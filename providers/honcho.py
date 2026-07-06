from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from .base import (
    Conclusion,
    Edge,
    PeerCard,
    PeerProvider,
    ProviderCapabilities,
    ProviderHealth,
    Representation,
    Row,
    SessionSummary,
)

_HONCHO_BASE_URLS = ("https://api.honcho.dev", "http://localhost", "http://127.0.0.1")


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
    """Resolve HONCHO_API_KEY from env, ~/.hermes/honcho.json, or ~/.honcho/config.json."""
    # 1. Direct env var
    key = os.environ.get("HONCHO_API_KEY")
    if key:
        return key

    # 2. ~/.hermes/honcho.json
    hermes_json = _hermes_home() / "honcho.json"
    if hermes_json.exists():
        import json

        try:
            data = json.loads(hermes_json.read_text())
            key = data.get("api_key")
            if key:
                return key
        except Exception:
            pass

    # 3. ~/.honcho/config.json
    honcho_json = Path.home() / ".honcho" / "config.json"
    if honcho_json.exists():
        import json

        try:
            data = json.loads(honcho_json.read_text())
            key = data.get("api_key")
            if key:
                return key
        except Exception:
            pass

    return None


class HonchoProvider(PeerProvider):
    """Adapter for the Honcho peer-based memory platform (https://honcho.dev)."""

    name: str = "Honcho"
    glyph: str = "🪞"
    color: str = "#ec4899"  # pink

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
    ):
        self.api_key = api_key or _resolve_api_key() or ""
        self.base_url = _validate_base_url(base_url, "honcho", _HONCHO_BASE_URLS)
        self._client: Any = None

    # ── resolver ──────────────────────────────────────────────────────
    @classmethod
    def detect(cls) -> bool:
        """True if a Honcho API key can be resolved from any source."""
        try:
            import honcho  # noqa: F401
        except ImportError:
            return False
        return _resolve_api_key() is not None

    # ── ABC implementation ────────────────────────────────────────────
    def initialize(self) -> ProviderHealth:
        try:
            import honcho

            kwargs: dict[str, Any] = {"api_key": self.api_key}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            self._client = honcho.Honcho(**kwargs)
            counts = self.get_counts()
            total = counts.get("peers", 0)
            msg = f"{total} peers" if total else "connected, no peers"
            return ProviderHealth("ok", total, msg)
        except ImportError:
            return ProviderHealth(
                "error", 0, "honcho package not installed — run `pip install honcho`"
            )
        except Exception as e:
            return ProviderHealth("error", 0, str(e))

    def query(self, search: str, limit: int = 100) -> list[Row]:
        """Maps to context search across peers."""
        if self._client is None:
            raise RuntimeError("HonchoProvider not initialized — call initialize() first")
        results = self._client.context.search(query=search, limit=limit)
        return [self._to_row(r) for r in results]

    def get_counts(self) -> dict[str, int]:
        """Return counts of peers, sessions, and conclusions."""
        try:
            peers = self.get_peers(limit=1000)
            sessions = self.get_sessions(limit=1000)
            # Count conclusions across all peers
            conclusion_count = 0
            for peer in peers:
                conclusion_count += len(self.get_conclusions(peer.id))
            return {
                "peers": len(peers),
                "sessions": len(sessions),
                "conclusions": conclusion_count,
            }
        except Exception:
            return {"peers": 0, "sessions": 0, "conclusions": 0}

    def get_graph_edges(self, limit: int = 500) -> list[Edge] | None:
        """Build peer → represents → peer edges from representations."""
        try:
            edges: list[Edge] = []
            peers = self.get_peers(limit=limit)
            for peer in peers:
                representations = self.get_representations(peer.id)
                for rep in representations:
                    edges.append(
                        Edge(
                            source=peer.id,
                            predicate="represents",
                            target=rep.target_id,
                            confidence=rep.confidence,
                        )
                    )
            return edges
        except Exception:
            return None

    def get_timeline(self, limit: int = 200) -> None:
        return None  # Honcho doesn't feed timeline

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(search=True, graph=True, timeline=False, editable=False)

    # ── PeerProvider methods ──────────────────────────────────────────
    def get_peers(self, limit: int = 100) -> list[PeerCard]:
        if self._client is None:
            raise RuntimeError("HonchoProvider not initialized — call initialize() first")
        peers = self._client.peers.list(limit=limit)
        return [
            PeerCard(
                id=str(p.id),
                name=str(getattr(p, "name", "")),
                metadata=getattr(p, "metadata", {}) or {},
                created_at=str(getattr(p, "created_at", "")),
            )
            for p in peers
        ]

    def get_sessions(self, peer_id: str | None = None, limit: int = 100) -> list[SessionSummary]:
        if self._client is None:
            raise RuntimeError("HonchoProvider not initialized — call initialize() first")
        if peer_id:
            sessions = self._client.sessions.list(peer_id=peer_id, limit=limit)
        else:
            sessions = self._client.sessions.list(limit=limit)
        return [
            SessionSummary(
                id=str(s.id),
                peers=list(getattr(s, "peers", [])),
                message_count=int(getattr(s, "message_count", 0)),
                created_at=str(getattr(s, "created_at", "")),
                updated_at=str(getattr(s, "updated_at", "")),
            )
            for s in sessions
        ]

    def get_representations(self, peer_id: str) -> list[Representation]:
        if self._client is None:
            raise RuntimeError("HonchoProvider not initialized — call initialize() first")
        reps = self._client.representations.list(peer_id=peer_id)
        return [
            Representation(
                target_id=str(r.target_id),
                representation=str(getattr(r, "representation", "")),
                confidence=float(getattr(r, "confidence", 0.0)),
                updated_at=str(getattr(r, "updated_at", "")),
            )
            for r in reps
        ]

    def get_conclusions(self, peer_id: str) -> list[Conclusion]:
        if self._client is None:
            raise RuntimeError("HonchoProvider not initialized — call initialize() first")
        conclusions = self._client.conclusions.list(peer_id=peer_id)
        return [
            Conclusion(
                id=str(c.id),
                target_id=str(c.target_id),
                conclusion_type=str(getattr(c, "conclusion_type", "")),
                content=str(getattr(c, "content", "")),
                confidence=float(getattr(c, "confidence", 0.0)),
                created_at=str(getattr(c, "created_at", "")),
            )
            for c in conclusions
        ]

    # ── helpers ───────────────────────────────────────────────────────
    @staticmethod
    def _to_row(d: dict[str, Any]) -> Row:
        """Map a Honcho context search result to a Row."""
        return Row(
            id=str(d.get("id", "")),
            content=str(d.get("content", d.get("text", ""))),
            timestamp=str(d.get("created_at", "")),
            source="honcho",
            kind="working",
            metadata=d.get("metadata") or {},
            veracity="unknown",
            importance=0.5,
        )
