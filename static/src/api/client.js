export function createApiClient({ fetchImpl = fetch, onUnauthorized = () => {} } = {}) {
  async function api(path, options = {}) {
    const r = await fetchImpl(path, options);
    const j = await r.json();
    if (r.status === 401) {
      onUnauthorized(j);
      throw new Error(j.error || "auth required");
    }
    if (!r.ok) throw new Error(j.error || r.statusText);
    return j;
  }

  async function postJson(path, body) {
    return api(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
  }

  return { api, postJson };
}
