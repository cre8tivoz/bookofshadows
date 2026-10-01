from __future__ import annotations

import sys
import time
from pathlib import Path
from unittest.mock import MagicMock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from providers.honcho import HonchoProvider


class MockPeer:
    def __init__(self, id_: str):
        self.id = id_
        self.name = f"Peer {id_}"
        self.metadata = {}
        self.created_at = "2026-01-01T00:00:00"


class MockSession:
    def __init__(self, id_: str):
        self.id = id_
        self.peers = ["peer-1"]
        self.message_count = 1
        self.created_at = "2026-01-01T00:00:00"
        self.updated_at = "2026-01-01T00:00:00"


class MockConclusion:
    def __init__(self, id_: str):
        self.id = id_
        self.target_id = "target"
        self.conclusion_type = "belief"
        self.content = "content"
        self.confidence = 0.9
        self.created_at = "2026-01-01T00:00:00"


def run_benchmark(num_peers: int = 100, simulated_latency_sec: float = 0.002):
    peers = [MockPeer(f"peer-{i}") for i in range(num_peers)]
    sessions = [MockSession(f"sess-{i}") for i in range(num_peers)]

    # Mock client for baseline (N+1 queries)
    client_baseline = MagicMock()
    client_baseline.peers.list.return_value = peers
    client_baseline.sessions.list.return_value = sessions

    def mock_peer_conclusions(peer_id=None):
        time.sleep(simulated_latency_sec)
        return [MockConclusion(f"conc-{peer_id}")]

    client_baseline.conclusions.list.side_effect = mock_peer_conclusions

    # Baseline implementation
    def baseline_get_counts(provider):
        p_list = provider.get_peers(limit=1000)
        s_list = provider.get_sessions(limit=1000)
        c_count = 0
        for p in p_list:
            c_count += len(provider.get_conclusions(p.id))
        return {"peers": len(p_list), "sessions": len(s_list), "conclusions": c_count}

    provider_baseline = HonchoProvider(api_key="sk-test")
    provider_baseline._client = client_baseline

    start = time.perf_counter()
    res_baseline = baseline_get_counts(provider_baseline)
    baseline_time = time.perf_counter() - start
    baseline_calls = client_baseline.conclusions.list.call_count

    # Mock client for optimized (batch workspace call)
    client_optimized = MagicMock()
    client_optimized.peers.list.return_value = peers
    client_optimized.sessions.list.return_value = sessions

    mock_workspace_page = MagicMock()
    mock_workspace_page.total = num_peers

    def mock_workspace_conclusions(peer_id=None):
        time.sleep(simulated_latency_sec)
        return mock_workspace_page

    client_optimized.conclusions.list.side_effect = mock_workspace_conclusions

    provider_optimized = HonchoProvider(api_key="sk-test")
    provider_optimized._client = client_optimized

    start = time.perf_counter()
    res_optimized = provider_optimized.get_counts()
    optimized_time = time.perf_counter() - start
    optimized_calls = client_optimized.conclusions.list.call_count

    print(f"Benchmark Results for N = {num_peers} peers (simulated latency {simulated_latency_sec*1000:.1f}ms per API call):")
    print("  Baseline (N+1 queries):")
    print(f"    - API conclusions call count: {baseline_calls}")
    print(f"    - Execution time: {baseline_time:.4f} seconds")
    print(f"    - Result: {res_baseline}")
    print("  Optimized (Batch query):")
    print(f"    - API conclusions call count: {optimized_calls}")
    print(f"    - Execution time: {optimized_time:.4f} seconds")
    print(f"    - Result: {res_optimized}")
    print("  Improvement:")
    print(f"    - Call count reduction: {baseline_calls - optimized_calls} calls ({(1 - optimized_calls/baseline_calls)*100:.1f}%)")
    print(f"    - Time saved: {baseline_time - optimized_time:.4f} seconds ({baseline_time / optimized_time:.1f}x speedup)")

if __name__ == "__main__":
    run_benchmark(num_peers=100, simulated_latency_sec=0.002)
