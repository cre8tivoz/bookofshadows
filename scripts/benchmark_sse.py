from __future__ import annotations

import shutil
import sys
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

from test_dashboard_core import make_db  # noqa: E402

from dashboard_core import DashboardStore  # noqa: E402
from server import Handler, ThreadingHTTPServer  # noqa: E402


def run_benchmark():
    tmp_path = ROOT / "tmp_bench"
    tmp_path.mkdir(exist_ok=True)
    db_path = tmp_path / "mnemosyne_bench.db"
    if db_path.exists():
        db_path.unlink()
    make_db(db_path)

    # Instrument Handler to track when _send_sse starts and finishes
    sse_thread_alive = {}
    lock = threading.Lock()

    orig_send_sse = Handler._send_sse

    def tracked_send_sse(self, events):
        tid = threading.get_ident()
        with lock:
            sse_thread_alive[tid] = True
        try:
            return orig_send_sse(self, events)
        finally:
            with lock:
                sse_thread_alive[tid] = False

    Handler._send_sse = tracked_send_sse

    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    httpd.db_path = db_path
    httpd.bind_host = "127.0.0.1"
    httpd.bind_port = httpd.server_address[1]

    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    base_url = f"http://127.0.0.1:{httpd.bind_port}"

    try:
        print("=== SSE Performance Benchmark ===")

        # Test 1: Disconnect Cleanup Latency
        disconnect_delays = []
        for i in range(5):
            req = urllib.request.Request(f"{base_url}/api/realtime/events")
            resp = urllib.request.urlopen(req)
            # Read headers / status
            _line = resp.readline()
            # Find the handler thread ID
            handler_tid = None
            while not handler_tid:
                with lock:
                    active = [tid for tid, alive in sse_thread_alive.items() if alive]
                    if active:
                        handler_tid = active[-1]
                time.sleep(0.001)

            t_close = time.time()
            resp.close()

            # Measure how long until sse_thread_alive[handler_tid] becomes False
            while True:
                with lock:
                    if not sse_thread_alive.get(handler_tid, False):
                        break
                time.sleep(0.001)
                if time.time() - t_close > 20:
                    break
            delay = time.time() - t_close
            disconnect_delays.append(delay)
            print(f"Disconnect iteration {i+1}: handler thread exited after {delay:.4f} seconds")

        avg_disconnect_delay = sum(disconnect_delays) / len(disconnect_delays)
        print(f"\nAverage Disconnect Cleanup Latency: {avg_disconnect_delay:.4f} s")

        # Test 2: Idle SSE Stream DB Poll Query Count
        db_query_count = 0
        orig_delta = DashboardStore.realtime_event_delta

        def tracked_delta(self, *args, **kwargs):
            nonlocal db_query_count
            db_query_count += 1
            return orig_delta(self, *args, **kwargs)

        DashboardStore.realtime_event_delta = tracked_delta

        req = urllib.request.Request(f"{base_url}/api/realtime/events")
        resp = urllib.request.urlopen(req)
        t0 = time.time()
        time.sleep(5.0)
        resp.close()
        _duration = time.time() - t0

        DashboardStore.realtime_event_delta = orig_delta

        print(f"Idle SSE Stream (5.0s): DB query count = {db_query_count}")

    finally:
        # Clean up
        Handler._send_sse = orig_send_sse
        httpd.shutdown()
        httpd.server_close()
        server_thread.join(timeout=5)
        if tmp_path.exists():
            shutil.rmtree(tmp_path, ignore_errors=True)
        print("\nBenchmark complete.\n")


if __name__ == "__main__":
    run_benchmark()
