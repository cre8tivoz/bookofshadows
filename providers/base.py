from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ProviderCapabilities:
    search: bool = True
    graph: bool = False
    timeline: bool = False
    editable: bool = False


@dataclass
class ProviderHealth:
    status: str = "ok"  # "ok" | "degraded" | "error"
    row_count: int = 0
    message: str = ""


@dataclass
class Row:
    id: str = ""
    content: str = ""
    timestamp: str = ""
    source: str = ""
    kind: str = "working"
    metadata: dict[str, Any] = field(default_factory=dict)
    veracity: str = "unknown"
    importance: float = 0.5


@dataclass
class Edge:
    source: str = ""
    predicate: str = ""
    target: str = ""
    confidence: float = 1.0


@dataclass
class TimelineEntry:
    id: str = ""
    content: str = ""
    timestamp: str = ""
    kind: str = ""


class MemoryProvider(ABC):
    """Abstract contract that every memory backend satisfies."""

    name: str = ""
    glyph: str = ""
    color: str = "#666666"

    @abstractmethod
    def initialize(self) -> ProviderHealth: ...

    @abstractmethod
    def query(self, search: str, limit: int = 100) -> list[Row]: ...

    @abstractmethod
    def get_counts(self) -> dict[str, int]: ...

    @abstractmethod
    def get_graph_edges(self, limit: int = 500) -> list[Edge] | None: ...

    @abstractmethod
    def get_timeline(self, limit: int = 200) -> list[TimelineEntry] | None: ...

    @abstractmethod
    def capabilities(self) -> ProviderCapabilities: ...

    @classmethod
    def detect(cls) -> bool:
        """Return True if the provider has a detectable backing store."""
        return False


# ── Peer model dataclasses ──────────────────────────────────────────────


@dataclass
class PeerCard:
    id: str = ""
    name: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: str = ""


@dataclass
class SessionSummary:
    id: str = ""
    peers: list[str] = field(default_factory=list)
    message_count: int = 0
    created_at: str = ""
    updated_at: str = ""


@dataclass
class Representation:
    target_id: str = ""
    representation: str = ""
    confidence: float = 0.0
    updated_at: str = ""


@dataclass
class Conclusion:
    id: str = ""
    target_id: str = ""
    conclusion_type: str = ""
    content: str = ""
    confidence: float = 0.0
    created_at: str = ""


class PeerProvider(MemoryProvider):
    """Base for providers with a peer/session model (Honcho)."""

    @abstractmethod
    def get_peers(self, limit: int = 100) -> list[PeerCard]: ...

    @abstractmethod
    def get_sessions(self, peer_id: str | None = None, limit: int = 100) -> list[SessionSummary]: ...

    @abstractmethod
    def get_representations(self, peer_id: str) -> list[Representation]: ...

    @abstractmethod
    def get_conclusions(self, peer_id: str) -> list[Conclusion]: ...
