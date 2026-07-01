import { lowVolatilityTtlMs } from './endpoints.js';

export class ApiError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status ?? 0;
    this.path = opts.path || '';
    this.payload = opts.payload || null;
    this.retryable = Boolean(opts.retryable);
  }
}

function requestMethod(options = {}) {
  return String(options.method || 'GET').toUpperCase();
}

function cacheKey(path, options = {}) {
  return `${requestMethod(options)} ${path}`;
}

function ttlFor(path, ttlMap) {
  if (ttlMap[path] != null) return ttlMap[path];
  const [base] = String(path).split('?');
  return ttlMap[base] || 0;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalizeFetchError(error, path) {
  if (error?.name === 'AbortError') {
    return new ApiError('Request was cancelled because a newer request started.', {
      status: 0,
      path,
      retryable: false,
    });
  }
  return new ApiError('Network unavailable. Check the dashboard server connection and try again.', {
    status: 0,
    path,
    payload: error,
    retryable: true,
  });
}

export function createApiClient({
  fetchImpl = fetch,
  onUnauthorized = () => {},
  cacheTtlMs = lowVolatilityTtlMs,
  devTiming = false,
  onTiming = () => {},
  now = () => performance.now(),
} = {}) {
  const inflight = new Map();
  const cache = new Map();
  const keyedControllers = new Map();
  let csrfToken = '';

  function timing(start, path, method, status, cached = false) {
    if (!devTiming) return;
    onTiming({ method, path, status, durationMs: now() - start, cached });
  }

  async function api(path, options = {}) {
    const method = requestMethod(options);
    const start = now();
    const { requestKey, signal, ...fetchOptions } = options;
    const key = cacheKey(path, fetchOptions);
    const isGet = method === 'GET';
    const ttl = isGet ? ttlFor(path, cacheTtlMs) : 0;
    const cached = ttl ? cache.get(key) : null;

    if (cached && now() - cached.time < ttl) {
      timing(start, path, method, 200, true);
      return cached.value;
    }

    if (isGet && inflight.has(key) && !requestKey) {
      return inflight.get(key);
    }

    let controller = null;
    if (requestKey) {
      keyedControllers.get(requestKey)?.abort();
      controller = new AbortController();
      keyedControllers.set(requestKey, controller);
    }

    const request = (async () => {
      try {
        const r = await fetchImpl(path, {
          ...fetchOptions,
          ...(controller ? { signal: controller.signal } : signal ? { signal } : {}),
        });
        const j = await parseJsonResponse(r);
        timing(start, path, method, r.status, false);
        if (r.status === 401) {
          onUnauthorized(j);
          throw new ApiError(j.error || 'auth required', { status: r.status, path, payload: j, retryable: false });
        }
        if (!r.ok) {
          throw new ApiError(j.error || r.statusText || 'Request failed', {
            status: r.status,
            path,
            payload: j,
            retryable: r.status >= 500,
          });
        }
        if (ttl) cache.set(key, { value: j, time: now() });
        return j;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw normalizeFetchError(error, path);
      } finally {
        inflight.delete(key);
        if (requestKey && keyedControllers.get(requestKey) === controller) keyedControllers.delete(requestKey);
      }
    })();

    if (isGet && !requestKey) inflight.set(key, request);
    return request;
  }

  async function postJson(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const result = await api(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    });
    clearCache();
    return result;
  }

  function setCsrfToken(token) {
    csrfToken = token || '';
  }

  function clearCache(predicate = null) {
    if (!predicate) {
      cache.clear();
      return;
    }
    for (const [key, entry] of cache.entries()) {
      if (predicate(key, entry)) cache.delete(key);
    }
  }

  return { api, postJson, clearCache, setCsrfToken };
}
