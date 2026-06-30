import { beforeEach, describe, expect, test, vi } from "vitest";

import { createApiClient } from "../../static/src/api/client.js";

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
});
