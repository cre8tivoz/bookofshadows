import { beforeEach, describe, expect, test, vi } from "vitest";

import { ApiError, createApiClient } from "../../static/src/api/client.js";
import { endpoints } from "../../static/src/api/endpoints.js";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("returns parsed JSON for successful requests", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createApiClient({ fetchImpl });

    await expect(client.api("/api/health")).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith("/api/health", {});
  });

  test("throws useful API error messages for non-OK responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "bad request" }), { status: 400 }));
    const client = createApiClient({ fetchImpl });

    await expect(client.api("/api/nope")).rejects.toThrow("bad request");
  });

  test("invokes unauthorized callback on 401 before throwing", async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "auth required" }), { status: 401 }));
    const client = createApiClient({ fetchImpl, onUnauthorized });

    await expect(client.api("/api/private")).rejects.toThrow("auth required");
    expect(onUnauthorized).toHaveBeenCalledWith({ error: "auth required" });
  });

  test("postJson sends JSON headers and body", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createApiClient({ fetchImpl });

    await client.postJson("/api/config", { auth_enabled: true });

    expect(fetchImpl).toHaveBeenCalledWith("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_enabled: true }),
    });
  });

  test("deduplicates identical in-flight GET requests", async () => {
    let resolveResponse;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResponse = () => resolve(new Response(JSON.stringify({ counts: { memories: 3 } }), { status: 200 }));
        }),
    );
    const client = createApiClient({ fetchImpl });

    const first = client.api("/api/stats");
    const second = client.api("/api/stats");
    resolveResponse();

    await expect(Promise.all([first, second])).resolves.toEqual([{ counts: { memories: 3 } }, { counts: { memories: 3 } }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("serves configured low-volatility GETs from a short TTL cache", async () => {
    const now = vi.fn(() => 1_000);
    let counter = 0;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ n: ++counter }), { status: 200 }));
    const client = createApiClient({ fetchImpl, now, cacheTtlMs: { "/api/stats": 5_000 } });

    await expect(client.api("/api/stats")).resolves.toEqual({ n: 1 });
    await expect(client.api("/api/stats")).resolves.toEqual({ n: 1 });
    now.mockReturnValue(7_000);
    await expect(client.api("/api/stats")).resolves.toEqual({ n: 2 });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test("aborts stale requests with the same request key", async () => {
    const signals = [];
    const resolvers = [];
    const fetchImpl = vi.fn(async (_path, options = {}) => {
      signals.push(options.signal);
      return new Promise((resolve) => {
        resolvers.push(() => resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
      });
    });
    const client = createApiClient({ fetchImpl });

    const first = client.api("/api/search?q=a", { requestKey: "global-search" });
    const second = client.api("/api/search?q=ab", { requestKey: "global-search" });

    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    resolvers.forEach((resolve) => resolve());
    await Promise.all([first, second]);
  });

  test("normalizes network failures into ApiError with retry metadata", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const client = createApiClient({ fetchImpl });

    await expect(client.api("/api/stats")).rejects.toMatchObject({
      name: "ApiError",
      message: "Network unavailable. Check the dashboard server connection and try again.",
      status: 0,
      path: "/api/stats",
      retryable: true,
    });
  });

  test("emits development timing logs when enabled", async () => {
    const onTiming = vi.fn();
    const now = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(42);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createApiClient({ fetchImpl, devTiming: true, now, onTiming });

    await client.api("/api/stats");

    expect(onTiming).toHaveBeenCalledWith({ method: "GET", path: "/api/stats", status: 200, durationMs: 32, cached: false });
  });

  test("attaches the CSRF token header once set, and omits it otherwise", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createApiClient({ fetchImpl });

    await client.postJson("/api/config", { auth_enabled: true });
    expect(fetchImpl).toHaveBeenLastCalledWith("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_enabled: true }),
    });

    client.setCsrfToken("token-abc");
    await client.postJson("/api/config", { auth_enabled: true });
    expect(fetchImpl).toHaveBeenLastCalledWith("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": "token-abc" },
      body: JSON.stringify({ auth_enabled: true }),
    });

    client.setCsrfToken("");
    await client.postJson("/api/config", { auth_enabled: true });
    expect(fetchImpl).toHaveBeenLastCalledWith("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth_enabled: true }),
    });
  });

  test("clears cached GETs after JSON mutations", async () => {
    let counter = 0;
    const fetchImpl = vi.fn(async (path, options = {}) => {
      if (options.method === "POST") return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response(JSON.stringify({ n: ++counter, path }), { status: 200 });
    });
    const client = createApiClient({ fetchImpl, cacheTtlMs: { "/api/stats": 5_000 } });

    await expect(client.api("/api/stats")).resolves.toMatchObject({ n: 1 });
    await expect(client.api("/api/stats")).resolves.toMatchObject({ n: 1 });
    await client.postJson("/api/admin/memory/importance", { memory_id: "m-1", importance: 0.7 });
    await expect(client.api("/api/stats")).resolves.toMatchObject({ n: 2 });
  });
});

describe("endpoint map", () => {
  test("centralizes low-volatility and search endpoint paths", () => {
    expect(endpoints.stats()).toBe("/api/stats");
    expect(endpoints.config()).toBe("/api/config");
    expect(endpoints.diagnostics()).toBe("/api/diagnostics");
    expect(endpoints.lifecycle()).toBe("/api/lifecycle?limit=80");
    expect(endpoints.search("shadow pact", 30)).toBe("/api/search?q=shadow+pact&limit=30");
  });

  test("exposes ApiError for UI-level error handling", () => {
    const error = new ApiError("Nope", { status: 503, path: "/api/test", retryable: true });
    expect(error).toMatchObject({ name: "ApiError", status: 503, path: "/api/test", retryable: true });
  });
});
