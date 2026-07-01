(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // static/src/utils/escape.js
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }
  function shortId(value, head = 8, tail = 6) {
    const s = String(value || "").trim();
    return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
  }
  function cleanContent(content) {
    return String(content || "").replace(/^\[(USER|ASSISTANT|SYSTEM)\]\s*/i, "");
  }
  function roleOf(content) {
    const m = String(content || "").match(/^\[(USER|ASSISTANT|SYSTEM)\]/i);
    return m ? m[1].toLowerCase() : "";
  }

  // static/src/utils/format.js
  function prettyTime(value, formatter) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const dateFormatter = formatter || new Intl.DateTimeFormat(void 0, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    return dateFormatter.format(d);
  }
  function fmtBytes(n) {
    n = Number(n || 0);
    if (!n) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
  }

  // static/src/ui/dom.js
  var $ = (s, root = document) => root.querySelector(s);
  var $$ = (s, root = document) => [...root.querySelectorAll(s)];
  function fillSelect(sel, options, first) {
    const current = sel.value;
    sel.innerHTML = `<option value="">${first}</option>` + options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)} (${o.count})</option>`).join("");
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
  }
  function closeMobileMenu() {
    document.body.classList.remove("mobile-menu-open");
    const menuToggle = $("#mobileMenuToggle");
    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.textContent = "☰";
    }
  }
  function closeMobileMenuForViewportChange() {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.closest(".menu-search")) return;
    closeMobileMenu();
  }
  function bindActivatable(el, handler) {
    if (!el) return;
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    if (!el.hasAttribute("role")) el.setAttribute("role", "button");
    el.onclick = handler;
    el.onkeydown = (event) => {
      if (event.target !== el) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handler(event);
      }
    };
  }
  function showPanel(sectionId, panelId) {
    const section = $(`#${sectionId}`);
    if (!section || !panelId) return;
    section.querySelectorAll(".subpanel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === panelId);
    });
    section.querySelectorAll(".section-tabs button").forEach((button) => {
      const active = button.dataset.panel === panelId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  // static/src/ui/render.js
  function optionsFrom(rows, key, labelKey = key) {
    const seen = /* @__PURE__ */ new Set();
    return rows.map((r) => ({ value: r[key] || "", label: r[labelKey] || r[key] || "unknown", count: r.count || 0 })).filter((o) => o.value && !seen.has(o.value) && seen.add(o.value));
  }
  function breakdown(rows, labelKey, max = 8) {
    const items = rows.slice(0, max);
    const total = items.reduce((sum, r) => sum + Number(r.count || 0), 0) || 1;
    return items.map((r) => {
      const count = Number(r.count || 0);
      const pct = count ? Math.max(2, Math.round(count / total * 100)) : 0;
      return `<div class="break-row" data-filter="${esc(r[labelKey] || "")}"><span class="break-row-fill" style="width:${pct}%"></span><span class="break-row-label">${esc(r[labelKey] || "unknown")}</span><strong>${count.toLocaleString()}</strong></div>`;
    }).join("") || '<p class="muted">No data</p>';
  }
  function stateHtml(kind, title, body = "") {
    return `<div class="state-card state-${esc(kind)}"><strong>${esc(title)}</strong>${body ? `<p>${esc(body)}</p>` : ""}</div>`;
  }
  function countLabel(n, noun) {
    const count = Number(n || 0);
    const plural = noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`;
    return `${count.toLocaleString()} ${count === 1 ? noun : plural}`;
  }

  // static/src/ui/feedback.js
  function renderToast({ tone = "info", title, body = "", actionLabel = "" }) {
    return `<div class="toast toast-${esc(tone)}" role="status">
    <strong>${esc(title || "Notice")}</strong>
    ${body ? `<p>${esc(body)}</p>` : ""}
    ${actionLabel ? `<button type="button" class="toast-action">${esc(actionLabel)}</button>` : ""}
  </div>`;
  }
  function actionSummary(verb, { count = 0, failed = 0 } = {}) {
    const total = Number(count || 0);
    const failures = Number(failed || 0);
    const succeeded = Math.max(0, total - failures);
    const noun = total === 1 ? "item" : "items";
    if (failures > 0) {
      const failedNoun = failures === 1 ? "failed" : "failed";
      return `${verb} ${succeeded} of ${total} ${noun}. ${failures} ${failedNoun}.`;
    }
    return `${verb} ${total} ${noun}.`;
  }
  function setButtonPending(button, pending, pendingLabel = "Working...") {
    if (!button) return;
    if (pending) {
      if (!button.dataset.originalText) button.dataset.originalText = button.textContent || "";
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = pendingLabel;
      return;
    }
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
  function keyboardActionForEvent(event, chord = "") {
    const key = event.key;
    const target = event.target;
    const tag = String(target?.tagName || "").toLowerCase();
    const editable = target?.isContentEditable || ["input", "select", "textarea"].includes(tag);
    if (key === "Escape") return "close-overlay";
    if (editable) return "";
    if (key === "/") return "focus-search";
    if (key === "?" || key === "/" && event.shiftKey) return "show-shortcuts";
    if (chord === "g") {
      const map = { o: "go-overview", m: "go-memories", r: "go-review", k: "go-graph" };
      return map[String(key || "").toLowerCase()] || "";
    }
    if (String(key || "").toLowerCase() === "g") return "start-go-chord";
    if ((event.metaKey || event.ctrlKey) && String(key || "").toLowerCase() === "k") return "open-command";
    return "";
  }
  function skeletonHtml(title = "Loading", rows = 3) {
    const count = Math.max(1, Number(rows || 1));
    const lines = Array.from({ length: count }, (_, index) => `<span class="skeleton-line skeleton-line-${index + 1}"></span>`).join("");
    return `<div class="state-card state-skeleton" aria-busy="true">
    <strong>${esc(title)}</strong>
    <div class="skeleton-lines">${lines}</div>
  </div>`;
  }

  // static/src/api/endpoints.js
  function query(params) {
    return new URLSearchParams(params).toString();
  }
  var endpoints = {
    stats: () => "/api/stats",
    config: () => "/api/config",
    diagnostics: () => "/api/diagnostics",
    lifecycle: (limit = 80) => `/api/lifecycle?${query({ limit: String(limit) })}`,
    runtimeStatus: () => "/api/runtime/status",
    realtimeStatus: () => "/api/realtime/status",
    patterns: (limit = 10) => `/api/patterns?${query({ limit: String(limit) })}`,
    profile: (limit = 10) => `/api/profile/inferred?${query({ limit: String(limit) })}`,
    search: (q = "", limit = 30) => `/api/search?${query({ q, limit: String(limit) })}`,
    memories: (params = {}) => `/api/memories?${new URLSearchParams(params).toString()}`,
    graph: (q = "", limit = 300) => `/api/graph?${query({ q, limit: String(limit) })}`,
    review: (params = {}) => `/api/review?${new URLSearchParams(params).toString()}`,
    memoryGrowth: (days = 30) => `/api/insights/memory-growth?${query({ days: String(days) })}`,
    auditActivity: (days = 30) => `/api/insights/audit-activity?${query({ days: String(days) })}`,
    recallDistribution: () => "/api/insights/recall-distribution",
    veracityMix: (days = 30) => `/api/insights/veracity-mix?${query({ days: String(days) })}`,
    sourceBreakdown: (days = 30, limit = 6) => `/api/insights/source-breakdown?${query({ days: String(days), limit: String(limit) })}`,
    reviewBacklog: (days = 30) => `/api/insights/review-backlog?${query({ days: String(days) })}`,
    lifecycleTransitions: (days = 30) => `/api/insights/lifecycle-transitions?${query({ days: String(days) })}`,
    entityClusters: (limit = 10) => `/api/insights/entity-clusters?${query({ limit: String(limit) })}`,
    sessionHeatmap: (days = 30) => `/api/insights/session-heatmap?${query({ days: String(days) })}`,
    actionCards: () => "/api/insights/action-cards"
  };
  var lowVolatilityTtlMs = {
    "/api/auth/status": 3e3,
    "/api/stats": 3e3,
    "/api/config": 5e3,
    "/api/diagnostics": 5e3,
    "/api/consolidations": 5e3,
    "/api/lifecycle": 5e3,
    "/api/runtime/status": 5e3,
    "/api/realtime/status": 3e3,
    "/api/patterns": 5e3,
    "/api/profile/inferred": 5e3,
    "/api/constellation": 5e3,
    "/api/memoria/stats": 5e3
  };

  // static/src/api/client.js
  var ApiError = class extends Error {
    constructor(message, opts = {}) {
      super(message);
      this.name = "ApiError";
      this.status = opts.status ?? 0;
      this.path = opts.path || "";
      this.payload = opts.payload || null;
      this.retryable = Boolean(opts.retryable);
    }
  };
  function requestMethod(options = {}) {
    return String(options.method || "GET").toUpperCase();
  }
  function cacheKey(path, options = {}) {
    return `${requestMethod(options)} ${path}`;
  }
  function ttlFor(path, ttlMap) {
    if (ttlMap[path] != null) return ttlMap[path];
    const [base] = String(path).split("?");
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
    if (error?.name === "AbortError") {
      return new ApiError("Request was cancelled because a newer request started.", {
        status: 0,
        path,
        retryable: false
      });
    }
    return new ApiError("Network unavailable. Check the dashboard server connection and try again.", {
      status: 0,
      path,
      payload: error,
      retryable: true
    });
  }
  function createApiClient({
    fetchImpl = fetch,
    onUnauthorized = () => {
    },
    cacheTtlMs = lowVolatilityTtlMs,
    devTiming = false,
    onTiming = () => {
    },
    now = () => performance.now()
  } = {}) {
    const inflight = /* @__PURE__ */ new Map();
    const cache = /* @__PURE__ */ new Map();
    const keyedControllers = /* @__PURE__ */ new Map();
    let csrfToken = "";
    function timing(start, path, method, status, cached = false) {
      if (!devTiming) return;
      onTiming({ method, path, status, durationMs: now() - start, cached });
    }
    async function api2(path, options = {}) {
      const method = requestMethod(options);
      const start = now();
      const { requestKey, signal, ...fetchOptions } = options;
      const key = cacheKey(path, fetchOptions);
      const isGet = method === "GET";
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
            ...controller ? { signal: controller.signal } : signal ? { signal } : {}
          });
          const j = await parseJsonResponse(r);
          timing(start, path, method, r.status, false);
          if (r.status === 401) {
            onUnauthorized(j);
            throw new ApiError(j.error || "auth required", { status: r.status, path, payload: j, retryable: false });
          }
          if (!r.ok) {
            throw new ApiError(j.error || r.statusText || "Request failed", {
              status: r.status,
              path,
              payload: j,
              retryable: r.status >= 500
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
    async function postJson2(path, body) {
      const headers = { "Content-Type": "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const result = await api2(path, {
        method: "POST",
        headers,
        body: JSON.stringify(body || {})
      });
      clearCache();
      return result;
    }
    function setCsrfToken2(token) {
      csrfToken = token || "";
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
    return { api: api2, postJson: postJson2, clearCache, setCsrfToken: setCsrfToken2 };
  }

  // static/src/state/routing.js
  var MEMORY_FILTER_KEYS = [
    "q",
    "status",
    "source",
    "scope",
    "session_id",
    "veracity",
    "degradation_tier",
    "trust",
    "sort",
    "kind"
  ];
  function canonicalTab(tab) {
    if (tab === "constellation") return "visualiserlegacy";
    if (tab === "visualiser3d") return "visualiser";
    if (tab === "history") return "activity";
    return tab || "overview";
  }
  function routeTabState(tab = "overview", extra = {}) {
    return { tab: canonicalTab(tab || "overview"), ...extra };
  }
  function baseUrl(currentUrl) {
    const url = new URL(currentUrl, "http://dashboard.local");
    ["tab", "memory", "session"].forEach((k) => url.searchParams.delete(k));
    url.hash = "";
    const qs = url.searchParams.toString();
    return url.pathname + (qs ? `?${qs}` : "");
  }
  function filtersToParams(filters = {}) {
    const params = new URLSearchParams();
    for (const key of MEMORY_FILTER_KEYS) {
      if (filters[key]) params.set(key, filters[key]);
    }
    return params;
  }
  function hashPath(route = {}) {
    if (route.drawer?.type === "memory") return `/memory/${encodeURIComponent(route.drawer.id)}`;
    if (route.drawer?.type === "session") return `/session/${encodeURIComponent(route.drawer.id)}`;
    const tab = canonicalTab(route.tab || "overview");
    const path = `/${tab}`;
    if (tab !== "memories") return path;
    const params = filtersToParams(route.filters);
    const qs = params.toString();
    return path + (qs ? `?${qs}` : "");
  }
  function routeToUrl(state, currentUrl = `${location.pathname}${location.search}${location.hash}`) {
    return `${baseUrl(currentUrl)}#${hashPath(state)}`;
  }
  function filtersFromParams(params) {
    const filters = {};
    for (const key of MEMORY_FILTER_KEYS) {
      const value = params.get(key);
      if (value) filters[key] = value;
    }
    return filters;
  }
  function routeFromHash(hash) {
    const rawHash = hash.replace(/^#/, "");
    if (!rawHash) return null;
    const [rawPath, rawQuery = ""] = rawHash.split("?");
    const segments = rawPath.split("/").filter(Boolean).map(decodeURIComponent);
    const params = new URLSearchParams(rawQuery);
    if (segments[0] === "memory" && segments[1]) {
      return { tab: "memories", drawer: { type: "memory", id: segments[1] } };
    }
    if (segments[0] === "session" && segments[1]) {
      return { tab: "timelineView", drawer: { type: "session", id: segments[1] } };
    }
    const tab = canonicalTab(segments[0] || "overview");
    const route = { tab };
    const filters = tab === "memories" ? filtersFromParams(params) : {};
    if (Object.keys(filters).length) route.filters = filters;
    return route;
  }
  function routeFromLegacyQuery(url) {
    const params = url.searchParams;
    const route = { tab: canonicalTab(params.get("tab") || "overview") };
    if (params.get("memory")) route.drawer = { type: "memory", id: params.get("memory") };
    else if (params.get("session")) route.drawer = { type: "session", id: params.get("session") };
    if (route.drawer && (!params.get("tab") || route.tab === "overview")) {
      route.tab = route.drawer.type === "memory" ? "memories" : "timelineView";
    }
    return route;
  }
  function urlToRoute(currentUrl = `${location.pathname}${location.search}${location.hash}`) {
    const url = new URL(currentUrl, "http://dashboard.local");
    return routeFromHash(url.hash) || routeFromLegacyQuery(url);
  }

  // static/src/features/memories.js
  function meta(item, opts = {}) {
    const status = String(item.status || "active").toLowerCase();
    const scope = String(item.scope || "").trim();
    const session = String(item.session_id || "").trim();
    const rawTime = item.timestamp || item.created_at || "";
    const timeLabel = prettyTime(rawTime, opts.formatter);
    const kind = item.memory_kind || item.tier || item.source || "memory";
    const veracity = String(item.veracity || "unknown").toLowerCase();
    const lifecycle = item.degradation_label ? `${item.degradation_label}${item.degradation_tier ? ` · T${item.degradation_tier}` : ""}` : "";
    const importance = Number(item.importance ?? 0);
    const pills = [`<span class="chip chip-kind" title="memory type: ${esc(kind)}">${esc(kind)}</span>`];
    if (status && status !== "active") pills.push(`<span class="chip chip-status-${esc(status)}" title="status: ${esc(status)}">${esc(status)}</span>`);
    if (veracity && veracity !== "unknown") pills.push(`<span class="chip chip-trust-${esc(veracity)}" title="veracity: ${esc(veracity)} · recall weight ${Number(item.trust_weight ?? 0).toFixed(2)}">${esc(veracity)}</span>`);
    if (lifecycle) pills.push(`<span class="chip chip-lifecycle-${esc(item.degradation_label)}" title="degradation tier: ${esc(item.degradation_tier)} · recall weight ${Number(item.degradation_weight ?? 1).toFixed(2)}">${esc(lifecycle)}</span>`);
    if (importance > 0) pills.push(`<span class="chip chip-importance" title="importance: ${importance.toFixed(2)}">${importance.toFixed(2)}</span>`);
    if (scope && scope !== "session") pills.push(`<span class="chip chip-neutral" title="scope: ${esc(scope)}">${esc(scope)}</span>`);
    if (opts.sessionLink !== false && session && session !== "default") pills.push(`<button type="button" class="chip chip-session" data-session="${esc(session)}" title="Open session: ${esc(session)}">${esc(shortId(session))}</button>`);
    if (timeLabel) pills.push(`<span class="meta-time" title="${esc(rawTime)}">${esc(timeLabel)}</span>`);
    return `<div class="meta">${pills.join("")}</div>`;
  }
  function liveEventMeta(item) {
    const eventType = String(item.live_event_type || item.event_type || "").toUpperCase();
    const map = {
      MEMORY_ADDED: ["new", "new", "live-badge-new"],
      MEMORY_UPDATED: ["updated", "updated", "live-badge-updated"],
      MEMORY_RECALLED: ["recalled", "recalled", "live-badge-recalled"],
      MEMORY_INVALIDATED: ["invalidated", "invalidated", "live-badge-invalidated"],
      MEMORY_CONSOLIDATED: ["consolidated", "consolidated", "live-badge-consolidated"]
    };
    return map[eventType] || ["", ""];
  }
  function memoryItem(item, opts = {}) {
    const role = roleOf(item.content);
    const roleBadge = role ? `<span class="chip chip-role-${role}">${role}</span>` : "";
    const selectedSet = opts.selectedSet || /* @__PURE__ */ new Set();
    const checkClass = opts.checkClass || "memory-check";
    const selectable = opts.selectable ? `<label class="memory-select" title="Select memory"><input type="checkbox" class="${esc(checkClass)}" data-id="${esc(item.id)}" ${selectedSet.has(item.id) ? "checked" : ""} /></label>` : "";
    const [liveClass, liveLabel] = liveEventMeta(item);
    const liveBadge = liveLabel ? `<span class="chip chip-live-${esc(liveClass)}">${esc(liveLabel)}</span>` : "";
    const displayContent = cleanContent(item.content);
    return `<div class="item memory-card ${role ? "has-role" : ""} ${opts.selectable ? "selectable" : ""} ${liveClass ? `live-${esc(liveClass)}` : ""}" data-id="${esc(item.id)}">${selectable}<div class="item-topline">${roleBadge}${liveBadge}</div>${meta(item, opts)}<div class="content">${esc(displayContent)}</div></div>`;
  }
  function isMutableMemory(item) {
    return String(item?.status || "active").toLowerCase() === "active";
  }
  var MEMORY_PAGE_SIZE = 150;
  function memoryFilterParams(filters = {}, limit = MEMORY_PAGE_SIZE, offset = 0) {
    const trustPreset = filters.trustPreset || "";
    return new URLSearchParams({
      kind: filters.kind || "",
      q: String(filters.q || "").trim(),
      source: filters.source || "",
      scope: filters.scope || "",
      session_id: filters.sessionId || "",
      veracity: filters.veracity || "",
      degradation_tier: filters.degradationTier || "",
      contaminated_only: trustPreset === "contaminated" ? "1" : "",
      degraded_only: trustPreset === "degraded" ? "1" : "",
      due_for_degradation: trustPreset === "due" ? "1" : "",
      status: filters.status || "",
      sort: filters.sort || "",
      limit: String(limit),
      offset: String(offset)
    });
  }
  function mergeMemoryPage(existingItems, newItems, { append = false } = {}) {
    const merged = append ? [...existingItems, ...newItems] : newItems;
    return [...new Map(merged.map((item) => [item.id, item])).values()];
  }
  var MEMORY_FILTER_PRESETS = [
    { key: "needs-review", label: "Needs review", filters: { kind: "all", status: "active", trust: "contaminated", sort: "importance" } },
    { key: "high-importance", label: "High importance", filters: { kind: "all", status: "active", sort: "importance" } },
    { key: "recently-recalled", label: "Recently recalled", filters: { kind: "all", status: "active", sort: "recall" } },
    { key: "expiring-soon", label: "Expiring soon", filters: { kind: "all", status: "active", sort: "recent" }, special: "expiring-soon" },
    { key: "tool-generated", label: "Tool-generated", filters: { kind: "all", status: "active", veracity: "tool" } },
    { key: "unknown-trust", label: "Unknown trust", filters: { kind: "all", status: "active", veracity: "unknown" } }
  ];
  function memoryPresetByKey(key) {
    return MEMORY_FILTER_PRESETS.find((preset) => preset.key === key) || null;
  }
  function sortByExpiringSoon(items) {
    return items.filter((item) => item.valid_until).slice().sort((a, b) => Date.parse(a.valid_until) - Date.parse(b.valid_until));
  }
  function selectedMutableIds(items, selectedSet) {
    return items.filter((item) => selectedSet.has(item.id) && isMutableMemory(item)).map((item) => item.id);
  }
  function bulkSelectionState(items, selectedSet, canMutate) {
    const actionableCount = selectedMutableIds(items, selectedSet).length;
    return {
      hasItems: items.length > 0,
      selectedCount: selectedSet.size,
      actionableCount,
      statusLabel: `${selectedSet.size} selected · ${actionableCount} active`,
      actionsDisabled: !canMutate || !actionableCount,
      selectAllChecked: items.length > 0 && items.every((item) => selectedSet.has(item.id)),
      selectAllDisabled: !items.length
    };
  }

  // static/src/features/review.js
  function reviewReasonBadges(key, item = {}) {
    const reasons = [];
    if (key === "contaminated" || item.veracity && item.veracity !== "stated") reasons.push("Needs review");
    if (key === "important_contaminated" || Number(item.importance || 0) >= 0.75) reasons.push("High importance");
    if (key === "degraded" || Number(item.degradation_tier || 1) > 1) reasons.push("Degraded");
    if (key === "due_degradation") reasons.push("Due for degradation");
    return [...new Set(reasons)].map((reason) => `<span>${esc(reason)}</span>`).join("");
  }
  function reviewMemoryItem(key, item, opts = {}) {
    const reasons = reviewReasonBadges(key, item);
    return `<div class="review-memory-wrap">${memoryItem(item, opts)}${reasons ? `<div class="review-reasons" aria-label="Review reasons">${reasons}</div>` : ""}</div>`;
  }
  function reviewQueueHtml(key, queue, opts = {}) {
    const items = queue.items || [];
    const selectAction = opts.triage ? `<button class="tiny review-select-visible" data-review-key="${esc(key)}">Select visible</button>` : "";
    const renderedItems = opts.triage ? items.map((item) => reviewMemoryItem(key, item, { selectable: true, selectedSet: opts.selectedSet || /* @__PURE__ */ new Set(), checkClass: "review-check" })).join("") : items.map((item) => reviewMemoryItem(key, item)).join("");
    return `<section class="review-queue glass" data-review-key="${esc(key)}">
    <div class="section-head mini"><h2>${esc(queue.title || key)}</h2><span>${items.length} listed</span></div>
    <p class="muted">${esc(queue.description || "")}</p>
    <div class="review-actions"><button class="tiny primary review-filter" data-review-key="${esc(key)}">Open filtered browser</button>${selectAction}</div>
    <div class="list memory-grid">${renderedItems || stateHtml("empty", "No items in this queue.", "This queue is clear for now.")}</div>
  </section>`;
  }
  function lifecycleQueueHtml(key, queue) {
    return reviewQueueHtml(key, queue).replace("review-queue glass", "review-queue lifecycle-queue glass").replace("Open filtered browser", "Open lifecycle filter");
  }
  function reviewActionableIds(items, selectedSet) {
    return [...new Set(selectedMutableIds(items, selectedSet))];
  }
  function mergeReviewItems(existingItems = [], newItems = []) {
    return [...new Map([...existingItems, ...newItems].map((item) => [item.id, item])).values()];
  }
  function newReviewItems(existingItems = [], newItems = []) {
    const seen = new Set(existingItems.map((item) => item.id));
    return newItems.filter((item) => !seen.has(item.id));
  }
  function reviewFilterParams(filters = {}) {
    const params = new URLSearchParams(`queue=${encodeURIComponent(filters.queue || "")}&limit=${Number(filters.limit || 0)}&offset=${Number(filters.offset || 0)}`);
    const q = String(filters.q || "").trim();
    const minImportance = String(filters.minImportance || "").trim();
    if (q) params.set("q", q);
    if (minImportance && Number(minImportance) > 0) params.set("min_importance", minImportance);
    return params;
  }

  // static/src/features/review-controller.js
  var REVIEW_PAGE_SIZE = 100;
  function createReviewController({
    $: $2,
    $$: $$2,
    api: api2,
    postJson: postJson2,
    bindMemoryClicks: bindMemoryClicks2,
    canAdmin: canAdmin2,
    confirmAction: confirmAction2,
    askVeracity: askVeracity2,
    askExpiry: askExpiry2,
    runButtonAction: runButtonAction2,
    runBulkMutation: runBulkMutation2,
    loadStats: loadStats2,
    showToast: showToast2,
    isCancelledRequest: isCancelledRequest3,
    openMemoryFilter
  }) {
    let reviewSelection = /* @__PURE__ */ new Set();
    let selectedReviewQueue = "contaminated";
    let reviewOffset = 0;
    let latestReviewData = null;
    let latestReviewItems = [];
    function updateBulkBar2() {
      const bar = $2("#reviewBulkBar");
      if (!bar) return;
      const admin = canAdmin2();
      const visible = latestReviewItems.length;
      const actionable = reviewActionableIds(latestReviewItems, reviewSelection).length;
      bar.classList.toggle("hidden", !visible);
      $2("#reviewSelectionStatus").textContent = `${reviewSelection.size} selected`;
      $2("#reviewConfirm").disabled = !admin || !actionable;
      $2("#reviewVeracity").disabled = !admin || !actionable;
      $2("#reviewExpiry").disabled = !admin || !actionable;
      $2("#reviewExpire").disabled = !admin || !actionable;
      $2("#reviewSelectAll").checked = visible > 0 && latestReviewItems.every((item) => reviewSelection.has(item.id));
      $2("#reviewSelectAll").disabled = !visible;
    }
    function bindQueueControls(queues) {
      $$2("#review .review-check").forEach((chk) => {
        chk.onchange = (event) => {
          event.stopPropagation();
          chk.checked ? reviewSelection.add(chk.dataset.id) : reviewSelection.delete(chk.dataset.id);
          updateBulkBar2();
        };
      });
      $$2("#review .review-select-visible").forEach((el) => {
        el.onclick = (event) => {
          event.stopPropagation();
          latestReviewItems.forEach((item) => reviewSelection.add(item.id));
          $$2("#review .review-check").forEach((chk) => {
            chk.checked = true;
          });
          updateBulkBar2();
        };
      });
      $$2("#review .review-filter").forEach((el) => {
        el.onclick = (event) => {
          event.stopPropagation();
          const key = el.dataset.reviewKey;
          openMemoryFilter(queues[key]?.filter || {});
        };
      });
    }
    function updateImportanceLabel() {
      const slider = $2("#reviewMinImportance");
      const label = $2("#reviewMinImportanceValue");
      if (!slider || !label) return;
      const value = Number(slider.value || 0);
      label.textContent = value > 0 ? `≥ ${value.toFixed(2)}` : "any";
    }
    function renderSelectedQueue(data, append = false) {
      latestReviewData = data;
      const queues = data.queues || {};
      const cards = data.cards || [];
      const keys = cards.map((card) => card.key).filter((key) => queues[key]);
      if (!keys.length) {
        latestReviewItems = [];
        $2("#reviewCards").innerHTML = "";
        $2("#reviewQueueSelect").innerHTML = "";
        $2("#reviewQueueCount").textContent = "0 listed";
        $2("#reviewQueues").innerHTML = '<p class="muted">No review queues available.</p>';
        $2("#reviewLoadMore").classList.add("hidden");
        updateBulkBar2();
        return;
      }
      if (!queues[selectedReviewQueue]) selectedReviewQueue = data.queue || keys[0];
      const selectedCard = cards.find((card) => card.key === selectedReviewQueue) || { count: data.total || 0 };
      $2("#reviewCards").innerHTML = "";
      $2("#reviewQueueSelect").innerHTML = cards.map((card) => `<option value="${esc(card.key)}" ${card.key === selectedReviewQueue ? "selected" : ""}>${esc(card.title)} (${Number(card.count || 0).toLocaleString()})</option>`).join("");
      const newItems = queues[selectedReviewQueue]?.items || [];
      const appendedItems = append ? newReviewItems(latestReviewItems, newItems) : newItems;
      latestReviewItems = append ? mergeReviewItems(latestReviewItems, newItems) : mergeReviewItems([], newItems);
      $2("#reviewQueueCount").textContent = `${Number(data.total ?? selectedCard.count ?? 0).toLocaleString()} total · ${latestReviewItems.length.toLocaleString()} listed`;
      const renderedQueue = { ...queues[selectedReviewQueue], items: latestReviewItems };
      const existingQueue = $2(`#reviewQueues .review-queue[data-review-key="${CSS.escape(selectedReviewQueue)}"]`);
      const existingList = existingQueue?.querySelector(".list.memory-grid");
      if (append && existingQueue && existingList) {
        const count = existingQueue.querySelector(".section-head.mini span");
        if (count) count.textContent = `${latestReviewItems.length.toLocaleString()} listed`;
        const newHtml = appendedItems.map((item) => reviewMemoryItem(selectedReviewQueue, item, { selectable: true, selectedSet: reviewSelection, checkClass: "review-check" })).join("");
        if (newHtml) existingList.insertAdjacentHTML("beforeend", newHtml);
      } else {
        $2("#reviewQueues").innerHTML = reviewQueueHtml(selectedReviewQueue, renderedQueue, { triage: true, selectedSet: reviewSelection });
      }
      bindMemoryClicks2($2("#review"));
      bindQueueControls(queues);
      updateBulkBar2();
      $2("#reviewQueueSelect").onchange = (event) => {
        selectedReviewQueue = event.target.value;
        reviewOffset = 0;
        reviewSelection.clear();
        loadReviewPage(false);
      };
      $2("#reviewMinImportance").oninput = updateImportanceLabel;
      updateImportanceLabel();
      $2("#reviewApplyFilters").onclick = () => {
        reviewOffset = 0;
        reviewSelection.clear();
        loadReviewPage(false);
      };
      $2("#reviewClearFilters").onclick = () => {
        $2("#reviewSearchQuery").value = "";
        $2("#reviewMinImportance").value = "0";
        updateImportanceLabel();
        reviewOffset = 0;
        reviewSelection.clear();
        loadReviewPage(false);
      };
      $2("#reviewLoadMore").onclick = () => {
        if (data.next_offset != null) {
          reviewOffset = data.next_offset;
          loadReviewPage(true);
        }
      };
      $2("#reviewLoadMore").classList.toggle("hidden", !data.has_more);
    }
    async function loadReviewPage(append = false) {
      if (!append) $2("#reviewQueues").innerHTML = skeletonHtml("Loading review queue", 4);
      try {
        const data = await api2(endpoints.review(reviewFilterParams({
          queue: selectedReviewQueue,
          limit: REVIEW_PAGE_SIZE,
          offset: reviewOffset,
          q: $2("#reviewSearchQuery")?.value || "",
          minImportance: $2("#reviewMinImportance")?.value || ""
        })), { requestKey: "review" });
        renderSelectedQueue(data, append);
      } catch (error) {
        if (isCancelledRequest3(error)) return;
        $2("#reviewQueues").innerHTML = stateHtml("error", "Could not load review queue.", error.message || "Try again.");
      }
    }
    async function loadReview2() {
      reviewOffset = 0;
      reviewSelection.clear();
      await loadReviewPage(false);
    }
    async function confirmSelectedMemories(button) {
      const ids = reviewActionableIds(latestReviewItems, reviewSelection);
      if (!ids.length) return;
      const ok = await confirmAction2({ title: "Confirm selected memories?", description: `Mark ${ids.length} selected active memories as stated.`, confirmText: "Confirm selected" });
      if (!ok) return;
      const backup = $2("#backupBeforeMutation") ? $2("#backupBeforeMutation").checked : true;
      await runButtonAction2(button, "Confirming...", async () => {
        const result = await runBulkMutation2(ids, (id) => postJson2("/api/admin/memory/veracity", { memory_id: id, veracity: "stated", backup }), "Confirmed");
        if (!result.failed) reviewSelection.clear();
        await loadStats2();
        await loadReview2();
      });
    }
    async function setSelectedVeracity2(button) {
      const ids = reviewActionableIds(latestReviewItems, reviewSelection);
      if (!ids.length) return;
      const veracity = await askVeracity2("stated");
      if (veracity === null) return;
      const backup = $2("#backupBeforeMutation") ? $2("#backupBeforeMutation").checked : true;
      await runButtonAction2(button, "Saving...", async () => {
        const result = await runBulkMutation2(ids, (id) => postJson2("/api/admin/memory/veracity", { memory_id: id, veracity, backup }), "Updated");
        if (!result.failed) reviewSelection.clear();
        await loadStats2();
        await loadReview2();
      });
    }
    async function setSelectedExpiry2(button) {
      const ids = reviewActionableIds(latestReviewItems, reviewSelection);
      if (!ids.length) return;
      const validUntil = await askExpiry2("");
      if (validUntil === null) return;
      const backup = $2("#backupBeforeMutation") ? $2("#backupBeforeMutation").checked : true;
      await runButtonAction2(button, "Saving...", async () => {
        const result = await runBulkMutation2(ids, (id) => postJson2("/api/admin/memory/expiry", { memory_id: id, valid_until: validUntil, backup }), "Updated");
        if (!result.failed) reviewSelection.clear();
        await loadStats2();
        await loadReview2();
      });
    }
    async function expireSelectedMemories2(button) {
      const ids = reviewActionableIds(latestReviewItems, reviewSelection);
      if (!ids.length) return;
      const ok = await confirmAction2({ title: "Expire selected memories?", description: `Expire ${ids.length} selected active memories. Backups and audit entries will be created.`, confirmText: "Expire selected", tone: "warn" });
      if (!ok) return;
      const backup = $2("#backupBeforeMutation") ? $2("#backupBeforeMutation").checked : true;
      await runButtonAction2(button, "Expiring...", async () => {
        const result = await runBulkMutation2(ids, (id) => postJson2("/api/admin/memory/invalidate", { memory_id: id, backup }), "Expired");
        if (!result.failed) reviewSelection.clear();
        await loadStats2();
        await loadReview2();
      });
    }
    function bindGlobalControls() {
      $2("#reviewSelectAll").onchange = () => {
        const checked = $2("#reviewSelectAll").checked;
        latestReviewItems.forEach((item) => checked ? reviewSelection.add(item.id) : reviewSelection.delete(item.id));
        $$2("#review .review-check").forEach((chk) => {
          chk.checked = checked;
        });
        updateBulkBar2();
      };
      $2("#reviewClear").onclick = () => {
        const previous = new Set(reviewSelection);
        reviewSelection.clear();
        loadReview2();
        showToast2({
          tone: "info",
          title: "Review selection cleared",
          body: `Cleared ${previous.size} selected memories.`,
          actionLabel: "Undo",
          action: () => {
            reviewSelection = previous;
            loadReviewPage(false);
          }
        });
      };
      $2("#reviewConfirm").onclick = () => confirmSelectedMemories($2("#reviewConfirm"));
      $2("#reviewVeracity").onclick = () => setSelectedVeracity2($2("#reviewVeracity"));
      $2("#reviewExpiry").onclick = () => setSelectedExpiry2($2("#reviewExpiry"));
      $2("#reviewExpire").onclick = () => expireSelectedMemories2($2("#reviewExpire"));
    }
    return {
      bindGlobalControls,
      loadReview: loadReview2,
      loadReviewPage,
      latestData: () => latestReviewData,
      updateBulkBar: updateBulkBar2
    };
  }

  // static/src/utils/a11y.js
  var FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");
  function focusableElements(container) {
    if (!container) return [];
    return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
      (el) => !el.hasAttribute("hidden") && !el.closest(".hidden")
    );
  }
  function trapFocus(container) {
    const trigger = document.activeElement;
    const onKeydown = (event) => {
      if (event.key !== "Tab") return;
      const focusable = focusableElements(container);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      } else if (!container.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKeydown);
    return function releaseFocusTrap({ restoreFocus = true } = {}) {
      container.removeEventListener("keydown", onKeydown);
      if (restoreFocus && trigger && document.contains(trigger) && typeof trigger.focus === "function") {
        trigger.focus();
      }
    };
  }

  // static/src/features/detail-drawer.js
  function createDetailDrawerController({
    $: $2,
    $$: $$2,
    api: api2,
    postJson: postJson2,
    bindActivatable: bindActivatable2,
    canAdmin: canAdmin2,
    confirmAction: confirmAction2,
    askImportance: askImportance2,
    askReplacement: askReplacement2,
    askVeracity: askVeracity2,
    askExpiry: askExpiry2,
    runButtonAction: runButtonAction2,
    refreshAuthState: refreshAuthState2,
    loadStats: loadStats2,
    loadMemories: loadMemories2,
    openActionModal: openActionModal2,
    pushRoute: pushRoute2,
    getCurrentRoute,
    memoryRouteState: memoryRouteState2,
    switchTab: switchTab2
  }) {
    let focusRelease = null;
    function closeDetail2(opts = {}) {
      $2("#detail").classList.add("hidden");
      focusRelease?.();
      focusRelease = null;
      if (opts.push !== false) {
        const currentRoute2 = getCurrentRoute();
        pushRoute2(currentRoute2?.tab === "memories" ? memoryRouteState2() : routeTabState(currentRoute2?.tab || "overview"));
      }
    }
    function activateDrawerFocusTrap() {
      const drawer = $2("#detail");
      const wasHidden = drawer.classList.contains("hidden");
      drawer.classList.remove("hidden");
      if (wasHidden) {
        focusRelease = trapFocus(drawer);
        ($2("#closeDetail") || drawer).focus();
      }
    }
    function showSelectableCopy2(label, value) {
      openActionModal2({
        title: label,
        description: "Select the text below and press Cmd/Ctrl+C to copy. This works on non-HTTPS local dashboards.",
        kicker: "Copy",
        confirmText: "Done",
        bodyHtml: `<label class="modal-field"><span>${esc(label)}</span><textarea id="manualCopyValue" class="copy-value" rows="4" readonly>${esc(value || "")}</textarea></label>`,
        readValue: () => true
      });
      setTimeout(() => {
        const el = $2("#manualCopyValue");
        el?.focus();
        el?.select();
      }, 60);
    }
    function showDetail2(obj, title = "Detail", opts = {}) {
      const titleEl = document.querySelector(".drawer-title");
      if (titleEl) titleEl.textContent = title;
      $2("#detailBody").classList.remove("html-detail");
      $2("#detailBody").textContent = JSON.stringify(obj, null, 2);
      activateDrawerFocusTrap();
      if (opts.push !== false) pushRoute2(getCurrentRoute() || routeTabState());
    }
    function showHtmlDetail(html, title = "Detail") {
      const titleEl = document.querySelector(".drawer-title");
      if (titleEl) titleEl.textContent = title;
      $2("#detailBody").classList.add("html-detail");
      $2("#detailBody").innerHTML = html;
      activateDrawerFocusTrap();
    }
    function whyMemoryHtml(item) {
      const reasons = [];
      const q = $2("#memoryQuery")?.value.trim();
      const source = $2("#memorySource")?.value;
      const scope = $2("#memoryScope")?.value;
      const session = $2("#memorySession")?.value;
      const veracity = $2("#memoryVeracity")?.value;
      const degradation = $2("#memoryDegradation")?.value;
      const trustPreset = $2("#memoryTrustPreset")?.value;
      const sort = $2("#memorySort")?.value;
      if (q) reasons.push(`matches browser query “${q}” across content, id, session, source, or scope`);
      if (source && item.source === source) reasons.push(`source filter matched ${source}`);
      if (scope && item.scope === scope) reasons.push(`scope filter matched ${scope}`);
      if (session && item.session_id === session) reasons.push(`session filter matched ${session}`);
      if (veracity && item.veracity === veracity) reasons.push(`trust filter matched ${veracity}`);
      if (degradation && String(item.degradation_tier || "") === String(degradation)) reasons.push(`lifecycle filter matched tier ${degradation}`);
      if (trustPreset === "contaminated" && item.contaminated) reasons.push("needs-review filter matched");
      if (trustPreset === "degraded" && item.degraded_at) reasons.push("degraded-only filter matched");
      if (!reasons.length) reasons.push("shown from the current list/search context");
      return `<div class="result-section why-panel"><h3>Why shown <span>${esc(item.status || "active")}</span></h3><div class="diag-grid compact">
    <div class="diag-row"><span>Reason</span><strong>${esc(reasons.join(" · "))}</strong></div>
    <div class="diag-row"><span>Ranking</span><strong>${esc(sort || "recent")} · importance ${Number(item.importance ?? 0).toFixed(2)} · recalled ${Number(item.recall_count || 0).toLocaleString()}×</strong></div>
    <div class="diag-row"><span>Freshness</span><strong>created ${esc(prettyTime(item.created_at) || item.created_at || "unknown")} · last recalled ${esc(prettyTime(item.last_recalled) || item.last_recalled || "never")}</strong></div>
    <div class="diag-row"><span>Origin</span><strong>${esc(item.memory_kind || item.tier || "memory")} · ${esc(item.source || "unknown source")} · ${esc(item.scope || "unknown scope")}</strong></div>
  </div></div>`;
    }
    function memoryDetailHtml(item) {
      const admin = canAdmin2();
      const mutable = isMutableMemory(item);
      const adminActions = admin && mutable ? '<button id="expireMemory" class="drawer-action warn">Expire now</button><button id="editVeracity" class="drawer-action">Set trust</button><button id="editExpiry" class="drawer-action">Set expiry</button><button id="editImportance" class="drawer-action">Edit importance</button><button id="supersedeMemory" class="drawer-action primary">Supersede</button>' : "";
      const actionNote = admin ? mutable ? "" : `<span class="muted">This memory is ${esc(item.status || "not active")}; mutation actions are disabled.</span>` : '<span class="muted">Enable Settings → Memory maintenance to modify memories.</span>';
      const trust = String(item.veracity || "unknown").toLowerCase();
      const lifecycle = item.degradation_label ? `${item.degradation_label} · tier ${item.degradation_tier}` : "not degraded";
      return `
    <div class="memory-detail">
      ${meta(item, { sessionLink: false })}
      <div class="content detail-content">${esc(item.content)}</div>
      <div class="trust-strip">
        <span class="trust-chip trust-${esc(trust)}">${esc(trust)} trust · ×${Number(item.trust_weight ?? 0).toFixed(2)}</span>
        <span class="trust-chip lifecycle-${esc(item.degradation_label || "none")}">${esc(lifecycle)}${item.degradation_weight != null ? ` · ×${Number(item.degradation_weight).toFixed(2)}` : ""}</span>
        <span class="trust-chip">effective ×${Number(item.effective_memory_weight ?? 0).toFixed(2)}</span>
        ${item.contaminated ? '<span class="trust-chip review">needs review</span>' : ""}
      </div>
      ${whyMemoryHtml(item)}
      <div class="diag-grid compact">
        <div class="diag-row"><span>ID</span><strong>${esc(item.id)}</strong></div>
        <div class="diag-row"><span>Session</span>${item.session_id && item.session_id !== "default" ? `<button id="memorySessionLink" class="diag-link" title="Open session: ${esc(item.session_id)}">${esc(item.session_id)}</button>` : `<strong>${esc(item.session_id || "default")}</strong>`}</div>
        <div class="diag-row"><span>Source</span><strong>${esc(item.source || "unknown")}</strong></div>
        <div class="diag-row"><span>Trust</span><strong>${esc(trust)} · recall weight ×${Number(item.trust_weight ?? 0).toFixed(2)}${item.contaminated ? " · review recommended" : ""}</strong></div>
        <div class="diag-row"><span>Lifecycle</span><strong>${esc(lifecycle)} · degraded ${esc(item.degraded_at || "never")} · recall weight ×${Number(item.degradation_weight ?? 1).toFixed(2)}</strong></div>
        <div class="diag-row"><span>Effective weight</span><strong>×${Number(item.effective_memory_weight ?? 0).toFixed(2)}</strong></div>
        <div class="diag-row"><span>Valid until</span><strong>${esc(item.valid_until || "none")}</strong></div>
        <div class="diag-row"><span>Superseded by</span><strong>${esc(item.superseded_by || "none")}</strong></div>
      </div>
      <div class="drawer-actions memory-actions">
        <button id="copyMemoryId" class="drawer-action">Copy ID</button>
        ${adminActions}${actionNote}
      </div>
      <p id="memoryActionStatus" class="muted"></p>
    </div>`;
    }
    async function openMemoryDetail2(memoryId, opts = {}) {
      await refreshAuthState2();
      const item = (await api2("/api/memory?id=" + encodeURIComponent(memoryId))).item;
      showHtmlDetail(memoryDetailHtml(item), "Memory detail");
      if (opts.push !== false) pushRoute2({ tab: "memories", drawer: { type: "memory", id: memoryId } });
      const sessionLink = $2("#memorySessionLink");
      if (sessionLink) sessionLink.onclick = () => openSessionDetail2(item.session_id || "");
      $2("#copyMemoryId").onclick = () => showSelectableCopy2("Memory ID", item.id);
      if (!canAdmin2() || !isMutableMemory(item)) return;
      const backup = () => $2("#backupBeforeMutation") ? $2("#backupBeforeMutation").checked : true;
      $2("#expireMemory").onclick = async () => {
        const ok = await confirmAction2({
          title: "Expire this memory?",
          description: "It will disappear from active recall, but the original record stays available for history and audit.",
          confirmText: "Expire memory",
          tone: "warn"
        });
        if (!ok) return;
        try {
          const result = await runButtonAction2($2("#expireMemory"), "Expiring...", () => postJson2("/api/admin/memory/invalidate", { memory_id: item.id, backup: backup() }), () => ({ tone: "success", title: "Memory expired", body: "The original remains in history and audit." }));
          $2("#memoryActionStatus").textContent = `Expired. Backup: ${result.backup?.path || "not created"}`;
          await loadMemories2();
          await openMemoryDetail2(item.id);
        } catch (error) {
          $2("#memoryActionStatus").textContent = error.message;
        }
      };
      $2("#editImportance").onclick = async () => {
        const importance = await askImportance2(item.importance ?? 0.5);
        if (importance === null) return;
        try {
          const result = await runButtonAction2($2("#editImportance"), "Saving...", () => postJson2("/api/admin/memory/importance", { memory_id: item.id, importance: Number(importance), backup: backup() }), () => ({ tone: "success", title: "Importance updated", body: `New value: ${Number(importance).toFixed(2)}` }));
          $2("#memoryActionStatus").textContent = `Importance updated to ${result.importance}.`;
          await loadStats2();
          await loadMemories2();
          await openMemoryDetail2(item.id);
        } catch (error) {
          $2("#memoryActionStatus").textContent = error.message;
        }
      };
      $2("#editVeracity").onclick = async () => {
        const veracity = await askVeracity2(item.veracity || "unknown");
        if (veracity === null) return;
        try {
          const result = await runButtonAction2($2("#editVeracity"), "Saving...", () => postJson2("/api/admin/memory/veracity", { memory_id: item.id, veracity, backup: backup() }), () => ({ tone: "success", title: "Trust updated", body: `Trust is now ${veracity}.` }));
          $2("#memoryActionStatus").textContent = `Trust updated to ${result.veracity}.`;
          await loadStats2();
          await loadMemories2();
          await openMemoryDetail2(item.id);
        } catch (error) {
          $2("#memoryActionStatus").textContent = error.message;
        }
      };
      $2("#editExpiry").onclick = async () => {
        const validUntil = await askExpiry2(item.valid_until || "");
        if (validUntil === null) return;
        try {
          const result = await runButtonAction2($2("#editExpiry"), "Saving...", () => postJson2("/api/admin/memory/expiry", { memory_id: item.id, valid_until: validUntil, backup: backup() }), () => ({ tone: "success", title: "Expiry updated", body: validUntil ? `Valid until ${validUntil}` : "Scheduled expiry cleared." }));
          $2("#memoryActionStatus").textContent = `Expiry ${result.valid_until ? `set to ${result.valid_until}` : "cleared"}.`;
          await loadStats2();
          await loadMemories2();
          await openMemoryDetail2(item.id);
        } catch (error) {
          $2("#memoryActionStatus").textContent = error.message;
        }
      };
      $2("#supersedeMemory").onclick = async () => {
        const replacement = await askReplacement2(item.content || "");
        if (replacement === null) return;
        try {
          const result = await runButtonAction2($2("#supersedeMemory"), "Creating...", () => postJson2("/api/admin/memory/supersede", { memory_id: item.id, content: replacement, importance: Number(item.importance ?? 0.5), backup: backup() }), () => ({ tone: "success", title: "Memory superseded", body: "Opened the replacement memory." }));
          $2("#memoryActionStatus").textContent = `Superseded by ${result.replacement_id}.`;
          $2("#memoryStatus").value = "all";
          await loadStats2();
          await loadMemories2();
          await openMemoryDetail2(result.replacement_id);
        } catch (error) {
          $2("#memoryActionStatus").textContent = error.message;
        }
      };
    }
    function sessionEvent(event) {
      return `<div class="session-event" data-json='${esc(JSON.stringify(event.item))}'><div class="meta"><span class="badge">${esc(event.type)}</span><span>${esc(event.timestamp || "")}</span></div><div class="content"><strong>${esc(event.title)}</strong><br>${esc(event.preview || "")}</div></div>`;
    }
    async function openSessionDetail2(sessionId, opts = {}) {
      if (!sessionId || sessionId === "unknown") return;
      const data = await api2(`/api/session?id=${encodeURIComponent(sessionId)}&limit=200`);
      const counts = data.counts || {};
      showHtmlDetail(`
    <div class="session-summary">
      <div class="diag-pill"><strong>${esc(counts.memories || 0)}</strong><span>memories</span></div>
      <div class="diag-pill"><strong>${esc(counts.triples || 0)}</strong><span>triples</span></div>
      <div class="diag-pill"><strong>${esc(counts.consolidations || 0)}</strong><span>consolidations</span></div>
    </div>
    <div class="drawer-actions session-actions"><button id="sessionBrowseMemories" class="drawer-action primary">Browse memories</button><button id="sessionTimeline" class="drawer-action">Timeline by session</button><button id="sessionCopy" class="drawer-action">Copy session ID</button></div>
    <div class="result-section"><h3>Timeline <span>${esc(counts.events || 0)}</span></h3><div class="timeline">${(data.events || []).map(sessionEvent).join("") || '<p class="muted">No events for this session.</p>'}</div></div>
  `, `Session ${sessionId}`);
      if (opts.push !== false) pushRoute2({ tab: "timelineView", drawer: { type: "session", id: sessionId } });
      $2("#sessionBrowseMemories").onclick = () => {
        $2("#memorySession").value = sessionId;
        $2("#memoryKind").value = "all";
        $2("#memoryQuery").value = "";
        switchTab2("memories");
        closeDetail2({ push: false });
      };
      $2("#sessionTimeline").onclick = () => {
        $2("#timelineGroup").value = "session";
        $2("#timelineQuery").value = sessionId;
        switchTab2("timelineView");
        closeDetail2({ push: false });
      };
      $2("#sessionCopy").onclick = () => showSelectableCopy2("Session ID", sessionId);
      $$2("#detailBody .session-event").forEach((el) => bindActivatable2(el, () => showDetail2(JSON.parse(el.dataset.json), "Session event detail")));
    }
    function bindMemoryClicks2(root) {
      root.querySelectorAll(".session-link").forEach((btn) => {
        btn.onclick = (event) => {
          event.stopPropagation();
          openSessionDetail2(btn.dataset.session || "");
        };
      });
      root.querySelectorAll(".item[data-id]").forEach((el) => bindActivatable2(el, (event) => {
        if (event.target.closest(".session-link,button,a,label,input")) return;
        openMemoryDetail2(el.dataset.id);
      }));
    }
    function bindJsonCards2(root, title) {
      root.querySelectorAll("[data-json]").forEach((el) => bindActivatable2(el, () => showDetail2(JSON.parse(el.dataset.json), title)));
    }
    return {
      bindJsonCards: bindJsonCards2,
      bindMemoryClicks: bindMemoryClicks2,
      closeDetail: closeDetail2,
      openMemoryDetail: openMemoryDetail2,
      openSessionDetail: openSessionDetail2,
      showDetail: showDetail2,
      showHtmlDetail,
      showSelectableCopy: showSelectableCopy2
    };
  }

  // static/src/features/settings-controller.js
  function createSettingsController({
    $: $2,
    api: api2,
    postJson: postJson2,
    setCsrfToken: setCsrfToken2,
    confirmAction: confirmAction2,
    runButtonAction: runButtonAction2,
    showDetail: showDetail2,
    showSelectableCopy: showSelectableCopy2,
    loadStats: loadStats2
  }) {
    let authState = { config: {}, auth_enabled: false, authenticated: true };
    let loginFocusRelease = null;
    let lastDiagnostics = null;
    function setAuthState(state) {
      if (state) authState = state;
      if (authState.csrf_token) setCsrfToken2(authState.csrf_token || "");
      return authState;
    }
    function showLogin2() {
      const overlay = $2("#loginOverlay");
      if (!overlay) return;
      const wasHidden = overlay.classList.contains("hidden");
      overlay.classList.remove("hidden");
      if (wasHidden) {
        loginFocusRelease = trapFocus(overlay);
        $2("#loginPassword")?.focus();
      }
    }
    function hideLogin2() {
      const overlay = $2("#loginOverlay");
      if (!overlay) return;
      overlay.classList.add("hidden");
      loginFocusRelease?.();
      loginFocusRelease = null;
    }
    function canAdmin2() {
      const cfg = authState.config || {};
      const localOnly = ["127.0.0.1", "localhost", "::1"].includes(cfg.host || "0.0.0.0");
      return !!(cfg.memory_admin_enabled && (localOnly || authState.auth_enabled && authState.authenticated));
    }
    function runtimeRow(label, value, opts = {}) {
      const safe = value === void 0 || value === null || value === "" ? "—" : value;
      return `<div class="diag-row ${opts.wide ? "wide" : ""}"><span>${esc(label)}</span><strong title="${esc(safe)}">${esc(safe)}</strong></div>`;
    }
    function renderRuntimeDiagnostics(runtime) {
      const el = $2("#runtimeDiagnostics");
      if (!el) return;
      const probe = runtime.probe || {};
      const cfg = runtime.config || {};
      const health = runtime.running && runtime.reachable && !runtime.stale_pid && !runtime.runtime_stale ? "Healthy" : "Needs attention";
      const started = runtime.started_at ? prettyTime(Number(runtime.started_at) * 1e3) : "";
      el.innerHTML = [
        runtimeRow("Status", health),
        runtimeRow("PID", runtime.pid),
        runtimeRow("PID file", runtime.pid_file_pid),
        runtimeRow("Listener PID", (runtime.listener_pids || []).join(", ") || "none"),
        runtimeRow("Launch source", runtime.runtime_source || "server.py"),
        runtimeRow("Stale PID", runtime.stale_pid ? "yes — repaired on restart/start" : "no"),
        runtimeRow("Runtime stale", runtime.runtime_stale ? "yes" : "no"),
        runtimeRow("Probe", `${probe.status || "n/a"} ${probe.url || ""}`, { wide: true }),
        runtimeRow("Local URL", cfg.local_url || "", { wide: true }),
        runtimeRow("LAN URL", cfg.lan_url || "not exposed", { wide: true }),
        runtimeRow("Started", started || runtime.started_at || "", { wide: true })
      ].join("");
    }
    async function loadRuntimeDiagnostics2() {
      try {
        renderRuntimeDiagnostics(await api2(endpoints.runtimeStatus()));
      } catch (error) {
        const el = $2("#runtimeDiagnostics");
        if (el) el.innerHTML = `<div class="state-card state-error"><strong>Runtime diagnostics unavailable</strong><p>${esc(error.message)}</p></div>`;
      }
    }
    async function loadDiagnostics2() {
      const diag = await api2(endpoints.diagnostics());
      const counts = diag.table_counts || {};
      const core = ["working_memory", "episodic_memory", "triples", "consolidation_log"].filter((table) => table in counts);
      $2("#diagnosticsSummary").innerHTML = `
    <div class="diag-row"><span>Status</span><strong>${diag.ok ? "OK" : "Needs attention"}</strong></div>
    <div class="diag-row"><span>DB path</span><strong title="${esc(diag.db_path)}">${esc(diag.db_path)}</strong></div>
    <div class="diag-row"><span>Readable</span><strong>${diag.readable ? "yes" : "no"}</strong></div>
    <div class="diag-row"><span>Size</span><strong>${fmtBytes(diag.size_bytes)}</strong></div>
    <div class="diag-row"><span>Last modified</span><strong>${esc(diag.modified_at || "n/a")}</strong></div>
    <div class="diag-row"><span>Tables</span><strong>${esc((diag.tables || []).length)}</strong></div>
    <div class="diag-row wide"><span>Core rows</span><strong>${core.map((table) => `${table}: ${Number(counts[table] || 0).toLocaleString()}`).join(" · ") || "none"}</strong></div>`;
      $2("#diagnosticsStatus").textContent = diag.error || ((diag.missing_expected_tables || []).length ? `Missing expected tables: ${diag.missing_expected_tables.join(", ")}` : "Database looks healthy.");
      lastDiagnostics = diag;
      window.lastDiagnostics = diag;
    }
    async function copyDiagnostics() {
      if (!lastDiagnostics) await loadDiagnostics2();
      showSelectableCopy2("Diagnostics JSON", JSON.stringify(lastDiagnostics, null, 2));
    }
    async function refreshAuthState2() {
      authState = await api2("/api/auth/status");
      setCsrfToken2(authState.csrf_token || "");
      return authState;
    }
    async function loadAuthStatus2() {
      const data = await refreshAuthState2();
      const cfg = data.config || {};
      $2("#configHost").value = cfg.host || "";
      $2("#configPort").value = cfg.port || "";
      $2("#configDbPath").value = cfg.db_path || "";
      const urls = [`This Mac: ${cfg.local_url || ""}`];
      if (cfg.lan_url) urls.push(`LAN: ${cfg.lan_url}`);
      $2("#configStatus").textContent = `Current access URLs — ${urls.join(" · ")}`;
      authState = data;
      $2("#authEnabled").checked = !!data.auth_enabled;
      $2("#authStatus").textContent = data.has_password ? "Password is set." : "No password set.";
      $2("#memoryAdminEnabled").checked = !!cfg.memory_admin_enabled;
      $2("#memoryAdminStatus").textContent = cfg.memory_admin_enabled ? ["127.0.0.1", "localhost", "::1"].includes(cfg.host || "0.0.0.0") ? "Local-only admin mode is enabled. Mutations are audited; password is only required for LAN/non-local hosts." : "Admin maintenance mode is enabled. LAN/non-local mutations require password auth and are audited." : "Admin maintenance mode is disabled; dashboard is read-only.";
    }
    function bindControls() {
      $2("#loginButton").onclick = async () => {
        try {
          await runButtonAction2($2("#loginButton"), "Signing in...", () => postJson2("/api/auth/login", { password: $2("#loginPassword").value }), { tone: "success", title: "Signed in" });
          hideLogin2();
          $2("#loginError").textContent = "";
          await refreshAuthState2();
          loadStats2();
        } catch (error) {
          $2("#loginError").textContent = error.message;
        }
      };
      $2("#loginPassword").onkeydown = (event) => {
        if (event.key === "Enter") $2("#loginButton").click();
      };
      $2("#refreshDiagnostics").onclick = loadDiagnostics2;
      $2("#copyDiagnostics").onclick = copyDiagnostics;
      $2("#saveRuntimeConfig").onclick = async () => {
        try {
          const body = { host: $2("#configHost").value.trim(), port: $2("#configPort").value.trim(), db_path: $2("#configDbPath").value.trim() };
          const result = await runButtonAction2($2("#saveRuntimeConfig"), "Saving...", () => postJson2("/api/config", body), { tone: "success", title: "Server settings saved", body: "Restart the dashboard to apply host, port, or database changes." });
          const cfg = result.config || {};
          $2("#configHost").value = cfg.host || "";
          $2("#configPort").value = cfg.port || "";
          $2("#configDbPath").value = cfg.db_path || "";
          const urls = [`This Mac: ${cfg.local_url || ""}`];
          if (cfg.lan_url) urls.push(`LAN: ${cfg.lan_url}`);
          $2("#configStatus").textContent = `${result.message || "Saved. Restart the dashboard to apply server/database changes."} ${urls.join(" · ")}`;
        } catch (error) {
          $2("#configStatus").textContent = error.message;
        }
      };
      $2("#saveAuth").onclick = async () => {
        try {
          const body = { auth_enabled: $2("#authEnabled").checked };
          if ($2("#authPassword").value) body.password = $2("#authPassword").value;
          const result = await runButtonAction2($2("#saveAuth"), "Saving...", () => postJson2("/api/config", body), { tone: "success", title: "Auth settings saved" });
          $2("#authPassword").value = "";
          $2("#authStatus").textContent = result.message || "Saved";
        } catch (error) {
          $2("#authStatus").textContent = error.message;
        }
      };
      $2("#clearAuth").onclick = async () => {
        try {
          const ok = await confirmAction2({ title: "Disable password auth?", description: "This clears the dashboard password and disables password auth.", confirmText: "Disable auth", tone: "warn" });
          if (!ok) return;
          const result = await runButtonAction2($2("#clearAuth"), "Disabling...", () => postJson2("/api/config", { clear_password: true }), { tone: "success", title: "Password auth disabled" });
          $2("#authEnabled").checked = false;
          $2("#authPassword").value = "";
          $2("#memoryAdminEnabled").checked = !!(result.config && result.config.memory_admin_enabled);
          $2("#authStatus").textContent = result.message || "Auth disabled";
          await loadAuthStatus2();
        } catch (error) {
          $2("#authStatus").textContent = error.message;
        }
      };
      $2("#saveMemoryAdmin").onclick = async () => {
        try {
          const result = await runButtonAction2($2("#saveMemoryAdmin"), "Saving...", () => postJson2("/api/config", { memory_admin_enabled: $2("#memoryAdminEnabled").checked }), { tone: "success", title: "Memory admin settings saved" });
          authState.config = result.config || {};
          $2("#memoryAdminStatus").textContent = result.message || "Saved";
          await loadAuthStatus2();
        } catch (error) {
          $2("#memoryAdminStatus").textContent = error.message;
        }
      };
      $2("#createBackup").onclick = async () => {
        try {
          const result = await runButtonAction2($2("#createBackup"), "Creating...", () => postJson2("/api/admin/backup", {}), (response) => ({ tone: "success", title: "Backup created", body: response.backup?.path || "" }));
          $2("#memoryAdminStatus").textContent = `Backup created: ${result.backup.path}`;
        } catch (error) {
          $2("#memoryAdminStatus").textContent = error.message;
        }
      };
      $2("#viewAuditLog").onclick = async () => {
        try {
          const result = await api2("/api/admin/audit?limit=50");
          showDetail2(result.items, "Memory audit log");
        } catch (error) {
          $2("#memoryAdminStatus").textContent = error.message;
        }
      };
      $2("#logoutAuth").onclick = async () => {
        await runButtonAction2($2("#logoutAuth"), "Logging out...", () => postJson2("/api/auth/logout", {}), { tone: "success", title: "Logged out" });
        setCsrfToken2("");
        showLogin2();
      };
    }
    return {
      bindControls,
      canAdmin: canAdmin2,
      hideLogin: hideLogin2,
      loadAuthStatus: loadAuthStatus2,
      loadDiagnostics: loadDiagnostics2,
      loadRuntimeDiagnostics: loadRuntimeDiagnostics2,
      refreshAuthState: refreshAuthState2,
      setAuthState,
      showLogin: showLogin2
    };
  }

  // static/src/features/graph.js
  var GRAPH_WIDTH = 1e3;
  var GRAPH_HEIGHT = 650;
  var GRAPH_LIMIT = 300;
  function graphQueryPath(query2 = "") {
    return `/api/graph?q=${encodeURIComponent(String(query2 || "").trim())}&limit=${GRAPH_LIMIT}`;
  }
  function graphInspectorDefaultHtml() {
    return `<div class="inspector-kicker">Graph inspector</div><h3>Nothing selected</h3><p class="muted">Pick a node or edge to inspect connected triples, then jump into the Triples table.</p>`;
  }
  function graphNodeInspectorHtml(node, edges) {
    const connected = edges.filter((e) => e.source === node.id || e.target === node.id);
    const rows = connected.slice(0, 12).map((e) => `<button class="inspector-row" data-edge="${esc(e.id)}"><strong>${esc(e.predicate)}</strong><span>${esc(e.subject)} → ${esc(e.object)}</span></button>`).join("");
    return `<div class="inspector-kicker">Selected node</div><h3>${esc(node.label)}</h3><p class="muted">${connected.length} connected triple${connected.length === 1 ? "" : "s"}.</p><div class="inspector-actions"><button id="graphFilterTriples" class="primary tiny">Show in Triples</button><button id="graphSearchMemories" class="tiny">Search memories</button></div><div class="inspector-list">${rows || '<p class="muted">No connected edges.</p>'}</div>`;
  }
  function graphEdgeInspectorHtml(edge) {
    return `<div class="inspector-kicker">Selected triple</div><h3>${esc(edge.predicate)}</h3><p><strong>${esc(edge.subject)}</strong> → <strong>${esc(edge.object)}</strong></p><p class="muted">Confidence: ${esc(edge.confidence ?? "n/a")} · ${esc(edge.created_at || edge.valid_from || "")}</p><div class="inspector-actions"><button id="edgeDetail" class="primary tiny">Inspect JSON</button><button id="edgeTriples" class="tiny">Show in Triples</button></div>`;
  }
  function graphLayout(g) {
    const cx = GRAPH_WIDTH / 2;
    const cy = GRAPH_HEIGHT / 2;
    const r = 260;
    const rawNodes = g.nodes || [];
    const nodes = rawNodes.slice(0, 160).map((n, i, a) => ({ ...n, x: cx + Math.cos(i / a.length * Math.PI * 2) * r * (0.65 + i % 5 / 10), y: cy + Math.sin(i / a.length * Math.PI * 2) * r * (0.65 + i % 7 / 14) }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const edges = (g.edges || []).filter((e) => byId[e.source] && byId[e.target]).slice(0, 300);
    return { nodes, edges, byId };
  }
  function createGraphFeature({ $: $2, $$: $$2, api: api2, showDetail: showDetail2, switchTab: switchTab2 }) {
    let graphState = { nodes: [], edges: [], byId: {} };
    let graphView = { scale: 1, x: 0, y: 0, dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 };
    function graphInspectorDefault() {
      $2("#graphInspector").innerHTML = graphInspectorDefaultHtml();
    }
    function inspectNode(node) {
      const connected = graphState.edges.filter((e) => e.source === node.id || e.target === node.id);
      $$2(".node, .edge, .edgeLabel").forEach((x) => x.classList.remove("selected", "dim"));
      $$2(".node").forEach((x) => {
        if (x.dataset.id !== node.id) x.classList.add("dim");
      });
      connected.forEach((e) => {
        const edgeEl = document.querySelector(`.edge[data-id="${CSS.escape(e.id)}"]`);
        const labelEl = document.querySelector(`.edgeLabel[data-id="${CSS.escape(e.id)}"]`);
        if (edgeEl) edgeEl.classList.add("selected");
        if (labelEl) labelEl.classList.add("selected");
      });
      $2("#graphInspector").innerHTML = graphNodeInspectorHtml(node, graphState.edges);
      $2("#graphFilterTriples").onclick = () => {
        $2("#tripleQuery").value = node.label;
        switchTab2("triples");
      };
      $2("#graphSearchMemories").onclick = () => {
        $2("#memoryQuery").value = node.label;
        switchTab2("memories");
      };
      $$2("#graphInspector .inspector-row").forEach((btn) => btn.onclick = () => inspectEdge(graphState.edges.find((e) => e.id === btn.dataset.edge)));
    }
    function inspectEdge(edge) {
      if (!edge) return;
      $$2(".node, .edge, .edgeLabel").forEach((x) => x.classList.remove("selected", "dim"));
      $$2(".edge").forEach((x) => {
        if (x.dataset.id !== edge.id) x.classList.add("dim");
      });
      const edgeEl = document.querySelector(`.edge[data-id="${CSS.escape(edge.id)}"]`);
      const labelEl = document.querySelector(`.edgeLabel[data-id="${CSS.escape(edge.id)}"]`);
      if (edgeEl) edgeEl.classList.add("selected");
      if (labelEl) labelEl.classList.add("selected");
      $2("#graphInspector").innerHTML = graphEdgeInspectorHtml(edge);
      $2("#edgeDetail").onclick = () => showDetail2(edge, "Triple edge detail");
      $2("#edgeTriples").onclick = () => {
        $2("#tripleQuery").value = `${edge.subject} ${edge.predicate} ${edge.object}`;
        switchTab2("triples");
      };
    }
    function applyGraphView() {
      const vp = $2("#graphViewport");
      if (vp) vp.setAttribute("transform", `translate(${graphView.x} ${graphView.y}) scale(${graphView.scale})`);
    }
    function resetGraphView2() {
      graphView = { scale: 1, x: 0, y: 0, dragging: false, sx: 0, sy: 0, ox: 0, oy: 0 };
      applyGraphView();
    }
    function bindGraphPanZoom() {
      const svg = $2("#graphSvg");
      if (!svg || svg.dataset.panzoomBound) return;
      svg.dataset.panzoomBound = "1";
      svg.addEventListener("wheel", (e) => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width * GRAPH_WIDTH;
        const py = (e.clientY - rect.top) / rect.height * GRAPH_HEIGHT;
        const old = graphView.scale;
        const next = Math.max(0.35, Math.min(4, old * (e.deltaY < 0 ? 1.12 : 0.88)));
        graphView.x = px - (px - graphView.x) * (next / old);
        graphView.y = py - (py - graphView.y) * (next / old);
        graphView.scale = next;
        applyGraphView();
      }, { passive: false });
      svg.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".node,.edge,.edgeLabel")) return;
        graphView.dragging = true;
        graphView.sx = e.clientX;
        graphView.sy = e.clientY;
        graphView.ox = graphView.x;
        graphView.oy = graphView.y;
        svg.setPointerCapture(e.pointerId);
        svg.classList.add("panning");
      });
      svg.addEventListener("pointermove", (e) => {
        if (!graphView.dragging) return;
        graphView.x = graphView.ox + (e.clientX - graphView.sx);
        graphView.y = graphView.oy + (e.clientY - graphView.sy);
        applyGraphView();
      });
      svg.addEventListener("pointerup", (e) => {
        graphView.dragging = false;
        svg.classList.remove("panning");
        try {
          svg.releasePointerCapture(e.pointerId);
        } catch {
        }
      });
      svg.addEventListener("pointerleave", () => {
        graphView.dragging = false;
        svg.classList.remove("panning");
      });
    }
    function centerGraphOnMobile() {
      const wrap = document.querySelector(".graph-wrap");
      if (!wrap || !window.matchMedia("(max-width: 760px)").matches) return;
      requestAnimationFrame(() => {
        wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2);
      });
    }
    function drawGraph(g) {
      const svg = $2("#graphSvg");
      svg.innerHTML = "";
      const layout = graphLayout(g);
      graphState = { ...g, ...layout };
      svg.insertAdjacentHTML("afterbegin", `<defs><linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#65d6ff" stop-opacity=".25"/><stop offset="55%" stop-color="#7c7cff" stop-opacity=".78"/><stop offset="100%" stop-color="#ffd166" stop-opacity=".35"/></linearGradient></defs><g id="graphViewport"></g>`);
      const vp = $2("#graphViewport");
      if (!layout.nodes.length) {
        svg.insertAdjacentHTML("beforeend", '<text x="500" y="325" text-anchor="middle" class="nodeText">No triples match this graph filter. Add facts with mnemosyne_triple_add or mnemosyne_remember(... extract=true).</text>');
        graphInspectorDefault();
        bindGraphPanZoom();
        return;
      }
      for (const e of layout.edges) {
        const s = layout.byId[e.source], t = layout.byId[e.target];
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x);
        line.setAttribute("y1", s.y);
        line.setAttribute("x2", t.x);
        line.setAttribute("y2", t.y);
        line.setAttribute("class", "edge");
        line.dataset.id = e.id;
        line.onclick = () => inspectEdge(e);
        vp.appendChild(line);
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.textContent = e.predicate;
        label.setAttribute("x", (s.x + t.x) / 2);
        label.setAttribute("y", (s.y + t.y) / 2);
        label.setAttribute("class", "edgeLabel");
        label.dataset.id = e.id;
        label.onclick = () => inspectEdge(e);
        vp.appendChild(label);
      }
      for (const n of layout.nodes) {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", n.x);
        c.setAttribute("cy", n.y);
        c.setAttribute("r", Math.min(14, 6 + Math.sqrt(n.count || 1)));
        c.setAttribute("class", "node");
        c.dataset.id = n.id;
        c.onclick = () => inspectNode(n);
        vp.appendChild(c);
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.textContent = n.label.length > 38 ? n.label.slice(0, 35) + "…" : n.label;
        text.setAttribute("x", n.x + 12);
        text.setAttribute("y", n.y + 4);
        text.setAttribute("class", "nodeText");
        text.dataset.id = n.id;
        text.onclick = () => inspectNode(n);
        vp.appendChild(text);
      }
      resetGraphView2();
      bindGraphPanZoom();
      graphInspectorDefault();
      centerGraphOnMobile();
    }
    async function loadGraph2() {
      drawGraph(await api2(graphQueryPath($2("#graphQuery")?.value || ""), { requestKey: "graph" }));
    }
    return { drawGraph, loadGraph: loadGraph2, resetGraphView: resetGraphView2, inspectNode, inspectEdge };
  }

  // static/src/utils/charts.js
  var uplotModulePromise = null;
  function loadUplotModule() {
    if (!uplotModulePromise) uplotModulePromise = import("/static/vendor/uplot.esm.min.js");
    return uplotModulePromise;
  }
  function isoDayToUnixSeconds(day) {
    return Math.floor(Date.parse(`${day}T00:00:00Z`) / 1e3);
  }
  function buildGrowthChartData(series) {
    const days = series?.days || [];
    const xValues = days.map(isoDayToUnixSeconds);
    return [xValues, series?.working || days.map(() => 0), series?.episodic || days.map(() => 0)];
  }
  function zeroes(days) {
    return days.map(() => 0);
  }
  var AUDIT_ACTION_ORDER = ["invalidate", "veracity", "expiry", "importance", "supersede"];
  var AUDIT_ACTION_LABELS = {
    invalidate: "Expired",
    veracity: "Trust changed",
    expiry: "Expiry set",
    importance: "Importance changed",
    supersede: "Superseded"
  };
  function buildAuditActivityChartData(series) {
    const days = series?.days || [];
    const xValues = days.map(isoDayToUnixSeconds);
    const byAction = series?.by_action || {};
    return [xValues, ...AUDIT_ACTION_ORDER.map((action) => byAction[action] || zeroes(days))];
  }
  var VERACITY_ORDER = ["stated", "unknown", "inferred", "imported", "tool"];
  var VERACITY_LABELS = {
    stated: "Stated",
    unknown: "Unknown",
    inferred: "Inferred",
    imported: "Imported",
    tool: "Tool"
  };
  function buildVeracityMixChartData(series) {
    const days = series?.days || [];
    const xValues = days.map(isoDayToUnixSeconds);
    const byVeracity = series?.by_veracity || {};
    return [xValues, ...VERACITY_ORDER.map((label) => byVeracity[label] || zeroes(days))];
  }
  function buildNamedSeriesChartData(series, namesKey, valuesKey) {
    const days = series?.days || [];
    const xValues = days.map(isoDayToUnixSeconds);
    const names = series?.[namesKey] || Object.keys(series?.[valuesKey] || {});
    const values = series?.[valuesKey] || {};
    return { names, data: [xValues, ...names.map((name) => values[name] || zeroes(days))] };
  }
  function buildReviewBacklogChartData(series) {
    const days = series?.days || [];
    const xValues = days.map(isoDayToUnixSeconds);
    const order = ["needs_review", "high_value", "degraded"];
    const labels = ["Needs review", "High value", "Degraded"];
    const values = series?.by_queue || {};
    return { labels, data: [xValues, ...order.map((name) => values[name] || zeroes(days))] };
  }
  function buildLifecycleTransitionChartData(series) {
    const days = series?.days || [];
    const xValues = days.map(isoDayToUnixSeconds);
    const labels = ["hot", "warm", "cold"];
    const values = series?.by_tier || {};
    return { labels: ["Hot", "Warm", "Cold"], data: [xValues, ...labels.map((name) => values[name] || zeroes(days))] };
  }
  function recallDistributionBars(items = []) {
    const counts = items.map((item) => Number(item.count || 0));
    const max = Math.max(1, ...counts);
    return items.map((item) => {
      const count = Number(item.count || 0);
      return {
        bucket: item.bucket,
        count,
        percent: count ? Math.max(4, Math.round(count / max * 100)) : 0
      };
    });
  }
  function rankedBars(items = [], labelKey = "label") {
    const counts = items.map((item) => Number(item.count || 0));
    const max = Math.max(1, ...counts);
    return items.map((item) => {
      const count = Number(item.count || 0);
      return {
        label: item[labelKey] || item.label || "unknown",
        query: item.query || item[labelKey] || item.label || "",
        count,
        percent: count ? Math.max(4, Math.round(count / max * 100)) : 0
      };
    });
  }
  function heatmapCells(payload = {}) {
    const matrix = payload.matrix || [];
    const max = Math.max(1, ...matrix.flat().map((value) => Number(value || 0)));
    return (payload.weekdays || []).map((day, rowIndex) => ({
      day,
      cells: (payload.hours || []).map((hour, colIndex) => {
        const count = Number(matrix[rowIndex]?.[colIndex] || 0);
        return { hour, count, intensity: count ? Math.max(0.12, count / max) : 0 };
      })
    }));
  }

  // static/src/features/charts.js
  var CHART_HEIGHT_FALLBACK = 240;
  function isCancelledRequest(error) {
    return error?.name === "ApiError" && error.status === 0 && !error.retryable;
  }
  function resolveCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function withAlpha(hex, alpha) {
    return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex;
  }
  function loadingCardHtml(title, detail) {
    return `<div class="async-loading-card"><h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`;
  }
  function fallbackCardHtml(title, detail) {
    return `<div class="async-fallback-card"><h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`;
  }
  function chartTooltipPlugin(labels, colors) {
    let tooltip = null;
    return {
      hooks: {
        init: (u) => {
          tooltip = document.createElement("div");
          tooltip.className = "u-tooltip";
          tooltip.style.position = "absolute";
          tooltip.style.pointerEvents = "none";
          tooltip.style.display = "none";
          tooltip.style.zIndex = "5";
          u.over.appendChild(tooltip);
        },
        setCursor: (u) => {
          if (!tooltip) return;
          const { idx } = u.cursor;
          if (idx == null) {
            tooltip.style.display = "none";
            return;
          }
          const x = u.data[0][idx];
          const rows = labels.map((label, i) => {
            const value = u.data[i + 1]?.[idx] ?? 0;
            return `<div><span style="color:${esc(colors[i])}">${esc(label)}</span> <strong>${esc(String(value))}</strong></div>`;
          }).join("");
          tooltip.innerHTML = `<div class="u-tooltip-date">${esc(new Date(x * 1e3).toLocaleDateString())}</div>${rows}`;
          tooltip.style.display = "block";
          const overWidth = u.over.clientWidth;
          const left = u.cursor.left ?? 0;
          const top = u.cursor.top ?? 0;
          tooltip.style.left = `${Math.max(0, Math.min(left + 12, overWidth - tooltip.offsetWidth - 4))}px`;
          tooltip.style.top = `${Math.max(0, top - 8)}px`;
        }
      }
    };
  }
  function createChartsFeature({ $: $2, api: api2, switchTab: switchTab2, loadMemories: loadMemories2 }) {
    let growthChart = null;
    let auditChart = null;
    let veracityChart = null;
    let sourceChart = null;
    let reviewBacklogChart = null;
    let lifecycleChart = null;
    function disposeInsightsCharts2() {
      growthChart?.destroy();
      auditChart?.destroy();
      veracityChart?.destroy();
      sourceChart?.destroy();
      reviewBacklogChart?.destroy();
      lifecycleChart?.destroy();
      growthChart = null;
      auditChart = null;
      veracityChart = null;
      sourceChart = null;
      reviewBacklogChart = null;
      lifecycleChart = null;
    }
    function baseChartOptions(viewport, series) {
      const axisColor = resolveCssVar("--text-muted");
      const gridColor = resolveCssVar("--chart-grid");
      return {
        width: viewport.clientWidth || 600,
        height: viewport.clientHeight || CHART_HEIGHT_FALLBACK,
        series,
        scales: { x: { time: true } },
        axes: [
          { stroke: axisColor, grid: { stroke: gridColor }, ticks: { stroke: gridColor } },
          { stroke: axisColor, grid: { stroke: gridColor }, ticks: { stroke: gridColor } }
        ],
        cursor: { drag: { x: true, y: false } }
      };
    }
    async function renderGrowthChart(seriesData) {
      const viewport = $2("#growthChartViewport");
      if (!viewport) return;
      const { default: uPlot } = await loadUplotModule();
      const data = buildGrowthChartData(seriesData);
      const labels = ["Working", "Episodic"];
      const colors = [resolveCssVar("--chart-1"), resolveCssVar("--chart-2")];
      const series = [
        {},
        ...labels.map((label, i) => ({
          label,
          stroke: colors[i],
          width: 2,
          fill: withAlpha(colors[i], "26")
        }))
      ];
      growthChart?.destroy();
      viewport.innerHTML = "";
      growthChart = new uPlot(
        { ...baseChartOptions(viewport, series), plugins: [chartTooltipPlugin(labels, colors)] },
        data,
        viewport
      );
    }
    async function renderAuditChart(seriesData) {
      const viewport = $2("#auditChartViewport");
      if (!viewport) return;
      const { default: uPlot } = await loadUplotModule();
      const data = buildAuditActivityChartData(seriesData);
      const labels = AUDIT_ACTION_ORDER.map((action) => AUDIT_ACTION_LABELS[action]);
      const colors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"].map(resolveCssVar);
      const series = [
        {},
        ...labels.map((label, i) => ({
          label,
          stroke: colors[i],
          width: 2
        }))
      ];
      auditChart?.destroy();
      viewport.innerHTML = "";
      auditChart = new uPlot(
        { ...baseChartOptions(viewport, series), plugins: [chartTooltipPlugin(labels, colors)] },
        data,
        viewport
      );
    }
    async function renderMultiSeriesChart({ viewportId, labels, data, colors, currentChart, assignChart }) {
      const viewport = $2(`#${viewportId}`);
      if (!viewport) return;
      const { default: uPlot } = await loadUplotModule();
      const series = [
        {},
        ...labels.map((label, i) => ({
          label,
          stroke: colors[i % colors.length],
          width: 2,
          fill: labels.length <= 4 ? withAlpha(colors[i % colors.length], "1c") : void 0
        }))
      ];
      currentChart?.destroy();
      viewport.innerHTML = "";
      assignChart(new uPlot(
        { ...baseChartOptions(viewport, series), plugins: [chartTooltipPlugin(labels, colors)] },
        data,
        viewport
      ));
    }
    function chartColors(count) {
      const vars = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"];
      return Array.from({ length: count }, (_, i) => resolveCssVar(vars[i % vars.length]));
    }
    async function renderVeracityChart(seriesData) {
      const data = buildVeracityMixChartData(seriesData);
      const labels = VERACITY_ORDER.map((name) => VERACITY_LABELS[name]);
      await renderMultiSeriesChart({
        viewportId: "veracityChartViewport",
        labels,
        data,
        colors: chartColors(labels.length),
        currentChart: veracityChart,
        assignChart: (chart) => {
          veracityChart = chart;
        }
      });
    }
    async function renderSourceChart(seriesData) {
      const { names, data } = buildNamedSeriesChartData(seriesData, "sources", "by_source");
      await renderMultiSeriesChart({
        viewportId: "sourceChartViewport",
        labels: names,
        data,
        colors: chartColors(names.length),
        currentChart: sourceChart,
        assignChart: (chart) => {
          sourceChart = chart;
        }
      });
    }
    async function renderReviewBacklogChart(seriesData) {
      const { labels, data } = buildReviewBacklogChartData(seriesData);
      await renderMultiSeriesChart({
        viewportId: "reviewBacklogChartViewport",
        labels,
        data,
        colors: chartColors(labels.length),
        currentChart: reviewBacklogChart,
        assignChart: (chart) => {
          reviewBacklogChart = chart;
        }
      });
    }
    async function renderLifecycleChart(seriesData) {
      const { labels, data } = buildLifecycleTransitionChartData(seriesData);
      await renderMultiSeriesChart({
        viewportId: "lifecycleChartViewport",
        labels,
        data,
        colors: chartColors(labels.length),
        currentChart: lifecycleChart,
        assignChart: (chart) => {
          lifecycleChart = chart;
        }
      });
    }
    function renderRecallDistribution(items) {
      const el = $2("#recallDistribution");
      if (!el) return;
      const bars = recallDistributionBars(items);
      if (!bars.some((bar) => bar.count > 0)) {
        el.innerHTML = '<span class="muted">No recall activity recorded yet.</span>';
        return;
      }
      el.innerHTML = bars.map(
        (bar) => `<button class="pattern-bar" data-bucket="${esc(bar.bucket)}" title="Browse memories recalled ${esc(bar.bucket)} times"><span class="pattern-bar-fill" style="width:${bar.percent}%"></span><span class="pattern-bar-label">Recalled ${esc(bar.bucket)}×</span><strong>${bar.count.toLocaleString()}</strong></button>`
      ).join("");
      el.querySelectorAll(".pattern-bar").forEach((btn) => {
        btn.onclick = () => {
          switchTab2("memories");
          $2("#memoryStatus").value = "active";
          $2("#memorySort").value = "recall";
          $2("#memoryQuery").value = "";
          loadMemories2();
        };
      });
    }
    function renderBars(el, items, emptyText, onClick) {
      if (!el) return;
      const bars = rankedBars(items);
      if (!bars.some((bar) => bar.count > 0)) {
        el.innerHTML = `<span class="muted">${esc(emptyText)}</span>`;
        return;
      }
      el.innerHTML = bars.map(
        (bar) => `<button class="pattern-bar" data-query="${esc(bar.query)}"><span class="pattern-bar-fill" style="width:${bar.percent}%"></span><span class="pattern-bar-label">${esc(bar.label)}</span><strong>${bar.count.toLocaleString()}</strong></button>`
      ).join("");
      el.querySelectorAll(".pattern-bar").forEach((btn) => {
        btn.onclick = () => onClick(btn.dataset.query || "");
      });
    }
    function renderClusters(payload) {
      const jumpToMemories = (query2) => {
        switchTab2("memories");
        $2("#memoryStatus").value = "active";
        $2("#memoryQuery").value = query2 || "";
        loadMemories2();
      };
      renderBars($2("#domainClusters"), payload?.domains || [], "No domain clusters detected yet.", jumpToMemories);
      renderBars($2("#entityClusters"), payload?.entities || [], "No entity clusters detected yet.", jumpToMemories);
    }
    function renderSessionHeatmap(payload) {
      const el = $2("#sessionHeatmap");
      if (!el) return;
      const rows = heatmapCells(payload);
      if (!rows.length || !rows.some((row) => row.cells.some((cell) => cell.count > 0))) {
        el.innerHTML = '<span class="muted">No recent session activity found.</span>';
        return;
      }
      el.innerHTML = `
      <div class="heatmap-hours">${(payload.hours || []).map((hour) => `<span>${hour % 6 === 0 ? hour : ""}</span>`).join("")}</div>
      ${rows.map((row) => `
        <div class="heatmap-row">
          <strong>${esc(row.day)}</strong>
          <div class="heatmap-cells">${row.cells.map((cell) => `<span class="heat-cell" title="${esc(row.day)} ${cell.hour}:00 · ${cell.count} memories" style="--heat:${cell.intensity}"></span>`).join("")}</div>
        </div>
      `).join("")}
    `;
    }
    function renderActionCards(payload) {
      const el = $2("#insightCards");
      if (!el) return;
      const cards = payload?.cards || [];
      if (!cards.length) {
        el.innerHTML = '<span class="muted">No insight cards available yet.</span>';
        return;
      }
      el.innerHTML = cards.map((card) => `
      <button class="insight-action-card" data-tab="${esc(card.action?.tab || "")}" data-queue="${esc(card.action?.queue || "")}" data-query="${esc(card.action?.q || "")}" data-session="${esc(card.action?.session_id || "")}">
        <span>${esc(card.title || "Insight")}</span>
        <strong>${Number(card.value || 0).toLocaleString()}</strong>
        <em>${esc(card.detail || "")}</em>
      </button>
    `).join("");
      el.querySelectorAll(".insight-action-card").forEach((card) => {
        card.onclick = () => {
          if (card.dataset.tab === "review") {
            switchTab2("review");
            const select = $2("#reviewQueueSelect");
            if (select && card.dataset.queue) select.value = card.dataset.queue;
            return;
          }
          switchTab2("memories");
          $2("#memoryStatus").value = "active";
          if (card.dataset.query) $2("#memoryQuery").value = card.dataset.query;
          if (card.dataset.session) $2("#memorySession").value = card.dataset.session;
          loadMemories2();
        };
      });
    }
    async function loadInsights2() {
      const days = Number($2("#insightsDays")?.value || 30);
      const loadingTargets = [
        ["growthChartViewport", "Fetching memory growth history."],
        ["auditChartViewport", "Fetching admin activity history."],
        ["veracityChartViewport", "Fetching trust mix history."],
        ["sourceChartViewport", "Fetching source breakdown history."],
        ["reviewBacklogChartViewport", "Fetching review backlog history."],
        ["lifecycleChartViewport", "Fetching lifecycle events."]
      ];
      loadingTargets.forEach(([id, detail]) => {
        const el = $2(`#${id}`);
        if (el) el.innerHTML = loadingCardHtml("Loading chart…", detail);
      });
      try {
        const [growth, audit, recall, veracity, sources, reviewBacklog, lifecycle, clusters, heatmap, actionCards] = await Promise.all([
          api2(endpoints.memoryGrowth(days), { requestKey: "insights-growth" }),
          api2(endpoints.auditActivity(days), { requestKey: "insights-audit" }),
          api2(endpoints.recallDistribution(), { requestKey: "insights-recall" }),
          api2(endpoints.veracityMix(days), { requestKey: "insights-veracity" }),
          api2(endpoints.sourceBreakdown(days), { requestKey: "insights-sources" }),
          api2(endpoints.reviewBacklog(days), { requestKey: "insights-review-backlog" }),
          api2(endpoints.lifecycleTransitions(days), { requestKey: "insights-lifecycle" }),
          api2(endpoints.entityClusters(10), { requestKey: "insights-clusters" }),
          api2(endpoints.sessionHeatmap(days), { requestKey: "insights-heatmap" }),
          api2(endpoints.actionCards(), { requestKey: "insights-cards" })
        ]);
        await renderGrowthChart(growth);
        await renderAuditChart(audit);
        await renderVeracityChart(veracity);
        await renderSourceChart(sources);
        await renderReviewBacklogChart(reviewBacklog);
        await renderLifecycleChart(lifecycle);
        renderRecallDistribution(recall.items || []);
        renderClusters(clusters);
        renderSessionHeatmap(heatmap);
        renderActionCards(actionCards);
      } catch (e) {
        if (isCancelledRequest(e)) return;
        const message = e?.message || "Try again.";
        loadingTargets.forEach(([id]) => {
          const el = $2(`#${id}`);
          if (el) el.innerHTML = fallbackCardHtml("Could not load chart", message);
        });
      }
    }
    function resizeInsightsCharts() {
      const growthViewport = $2("#growthChartViewport");
      const auditViewport = $2("#auditChartViewport");
      if (growthChart && growthViewport) {
        growthChart.setSize({ width: growthViewport.clientWidth || 600, height: growthViewport.clientHeight || CHART_HEIGHT_FALLBACK });
      }
      if (auditChart && auditViewport) {
        auditChart.setSize({ width: auditViewport.clientWidth || 600, height: auditViewport.clientHeight || CHART_HEIGHT_FALLBACK });
      }
      [
        [veracityChart, $2("#veracityChartViewport")],
        [sourceChart, $2("#sourceChartViewport")],
        [reviewBacklogChart, $2("#reviewBacklogChartViewport")],
        [lifecycleChart, $2("#lifecycleChartViewport")]
      ].forEach(([chart, viewport]) => {
        if (chart && viewport) chart.setSize({ width: viewport.clientWidth || 600, height: viewport.clientHeight || CHART_HEIGHT_FALLBACK });
      });
    }
    window.addEventListener("resize", resizeInsightsCharts, { passive: true });
    return { loadInsights: loadInsights2, disposeInsightsCharts: disposeInsightsCharts2 };
  }

  // static/src/visualisers/chrome.js
  function createVisualiserChrome({ $: $2, redrawCanvas, resizeThree: resizeThree2, resizeMemoryPalace: resizeMemoryPalace2 }) {
    function responsiveFill(width, height) {
      const w = Math.max(0, Number(width) || 0);
      const h = Math.max(0, Number(height) || 0);
      if (w < 760 || h < 520) return 1;
      const widthFill = Math.max(0, Math.min(1, (w - 760) / 760));
      const heightFill = Math.max(0, Math.min(1, (h - 520) / 360));
      return 1 + Math.min(0.22, widthFill * 0.16 + heightFill * 0.06);
    }
    async function toggleFullscreen(selector) {
      const el = $2(selector);
      if (!el || !document.fullscreenEnabled) return;
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    }
    async function exitFullscreen(event) {
      event?.stopPropagation?.();
      if (document.fullscreenElement) await document.exitFullscreen();
    }
    function updateFullscreenButtons() {
      const current = document.fullscreenElement;
      const constellation = current === $2(".constellation-wrap");
      const three = current === $2("#threeViewport");
      const palace = current === $2("#palaceViewport");
      const constellationButton = $2("#constellationFullscreen");
      const threeButton = $2("#threeFullscreen");
      const palaceButton = $2("#palaceFullscreen");
      if (constellationButton) constellationButton.textContent = constellation ? "Exit fullscreen" : "Fullscreen";
      if (threeButton) threeButton.textContent = three ? "Exit fullscreen" : "Fullscreen";
      if (palaceButton) palaceButton.textContent = palace ? "Exit fullscreen" : "Fullscreen";
      redrawCanvas();
      resizeThree2();
      resizeMemoryPalace2();
    }
    return {
      exitFullscreen,
      responsiveFill,
      toggleFullscreen,
      updateFullscreenButtons
    };
  }

  // static/src/visualisers/constellation.js
  var VISUALISER_MODE_KEY = "mnemosyne-dashboard-visualiser-mode";
  var CONSTELLATION_MIN_ZOOM = 0.55;
  var CONSTELLATION_MAX_ZOOM = 6;
  var CONSTELLATION_DEFAULT_CAMERA = { rotation: 0.55, tilt: 0.78, zoom: 1, panX: 0, panY: 0 };
  function createCanvasConstellationVisualiser({
    $: $2,
    $$: $$2,
    api: api2,
    esc: esc2,
    openMemoryDetail: openMemoryDetail2,
    switchTab: switchTab2,
    visualiserResponsiveFill: visualiserResponsiveFill2,
    prefersReducedMotion: prefersReducedMotion2,
    isActive
  }) {
    let constellationScene = { frame: 0, nodes: [], edges: [], byId: {}, stars: [], ...CONSTELLATION_DEFAULT_CAMERA, paused: false, mode: "rotate", visualiserMode: localStorage.getItem(VISUALISER_MODE_KEY) || "constellation", lastFrameTime: 0, lastInteraction: 0, hits: [], selectedNodeId: null, data: null, drag: null, pointers: /* @__PURE__ */ new Map() };
    function stopCanvasVisualiserLoop2() {
      if (constellationScene.frame) cancelAnimationFrame(constellationScene.frame);
      constellationScene.frame = 0;
      constellationScene.drag = null;
      constellationScene.pointers?.clear?.();
      constellationScene.lastFrameTime = 0;
      constellationScene.renderLastTime = 0;
    }
    function constellationInspectorDefault() {
      const neural = constellationScene.visualiserMode === "neural";
      $2("#constellationInspector").innerHTML = neural ? `<div class="inspector-kicker">Neural inspector</div><h3>Nothing selected</h3><p class="muted">Pick a neuron hub, memory soma, or synapse to inspect the underlying read-only source.</p>` : `<div class="inspector-kicker">Constellation inspector</div><h3>Nothing selected</h3><p class="muted">Pick a star, memory, or link to inspect the underlying read-only source.</p>`;
    }
    function inspectConstellationNode(node) {
      constellationScene.selectedNodeId = node.id;
      $2("#constellationInspector").innerHTML = `<div class="inspector-kicker">${esc2(node.kind || "entity")}</div><h3>${esc2(node.label)}</h3><p class="muted">${esc2(node.category || "Other")} · ${Number(node.count || 0).toLocaleString()} signal(s) · weight ${Number(node.weight || 0).toFixed(2)}</p>${node.preview ? `<p>${esc2(node.preview)}</p>` : ""}<div class="inspector-actions">${node.memory_id ? '<button id="constellationMemory" class="primary tiny">Open memory</button>' : ""}<button id="constellationSearch" class="tiny">Search this</button></div>`;
      if (node.memory_id) $2("#constellationMemory").onclick = () => openMemoryDetail2(node.memory_id);
      $2("#constellationSearch").onclick = () => {
        $2("#memoryQuery").value = node.label.replace(/^memory:/, "");
        switchTab2("memories");
      };
    }
    function openConstellationNode(node) {
      if (!node) return;
      if (node.memory_id) openMemoryDetail2(node.memory_id);
      else {
        $2("#memoryQuery").value = String(node.label || "").replace(/^memory:/, "");
        switchTab2("memories");
      }
    }
    function constellationColors2() {
      const light = document.documentElement.dataset.theme === "light";
      return light ? { light: true, bg: "#fbf8f3", nebula: "rgba(101,214,255,.11)", star: "#087fa6", memory: "#c9a96e", text: "#2b2927", muted: "rgba(66,58,52,.62)", edge: "rgba(25,65,108,.50)", memoryEdge: "rgba(130,78,18,.48)" } : { light: false, bg: "#050711", nebula: "rgba(101,214,255,.14)", star: "#65d6ff", memory: "#ffe08a", text: "#f7f8ff", muted: "rgba(213,219,239,.64)", edge: "rgba(198,224,255,.44)", memoryEdge: "rgba(255,224,138,.50)" };
    }
    function projectConstellationNode(n, w, h, t) {
      const rot = constellationScene.rotation;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const x = n.x * cos - n.z * sin;
      const z0 = n.x * sin + n.z * cos;
      const tilt = constellationScene.tilt;
      const y = n.y * Math.cos(tilt) - z0 * Math.sin(tilt);
      const z = n.y * Math.sin(tilt) + z0 * Math.cos(tilt);
      const depth = 760;
      const scale = depth / (depth + z + 260);
      const fill = visualiserResponsiveFill2(w, h);
      const fit = w < 620 ? Math.min(0.72, Math.max(0.58, (w - 36) / 680)) : Math.min(1.18, Math.max(0.62, (w - 72) / 760) * fill);
      const cameraScale = fit * constellationScene.zoom;
      return { x: w / 2 + constellationScene.panX + x * scale * cameraScale, y: h / 2 + constellationScene.panY + y * scale * cameraScale, z, scale: scale * constellationScene.zoom, visible: scale > 0.35 };
    }
    function buildConstellationScene(data) {
      const nodes = (data.nodes || []).slice(0, 160);
      const categories = [...new Set(nodes.map((n) => n.category || "Other"))];
      const catIndex = Object.fromEntries(categories.map((c, i) => [c, i]));
      nodes.forEach((n, i) => {
        const ci = catIndex[n.category || "Other"] || 0;
        const angle = i / Math.max(nodes.length, 1) * Math.PI * 2 + ci * 0.62;
        const band = n.kind === "memory" ? 1.28 : 0.72 + ci % 4 * 0.16;
        const radius = 250 * band + i % 7 * 16;
        n.x = Math.cos(angle) * radius;
        n.y = Math.sin(angle * 1.23) * (100 + ci % 5 * 24) + (i * 53 % 131 - 65) * 0.82;
        n.z = Math.sin(angle) * radius * 0.82 + (i * 97 % 181 - 90) * 1.55 + (ci % 5 - 2) * 42;
        n.size = Math.min(22, 4 + Math.sqrt(Number(n.weight || n.count || 1)) * 3.4) * (n.kind === "memory" ? 1.08 : 1);
        n.twinkle = i % 17 / 17;
        const twinkleTier = i % 11 === 0 ? 2 : i % 5 === 0 ? 1 : 0;
        n.twinkleFreq = twinkleTier === 2 ? 62e-4 + i * 29 % 70 / 1e5 : twinkleTier === 1 ? 3e-3 + i * 29 % 80 / 1e5 : 115e-5 + i * 29 % 95 / 1e5;
        n.twinkleAmp = twinkleTier === 2 ? 0.18 : twinkleTier === 1 ? 0.12 : 0.075 + i * 31 % 55 / 1e3;
      });
      constellationScene.nodes = nodes;
      constellationScene.edges = (data.edges || []).filter((e) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target)).slice(0, 300);
      constellationScene.byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
      constellationScene.regions = [];
      constellationScene.data = data;
      constellationScene.stars = Array.from({ length: 140 }, (_, i) => {
        const fast = i % 13 === 0;
        const medium = !fast && i % 6 === 0;
        return { x: i * 73 % 1e3 / 1e3, y: i * 191 % 680 / 680, r: 0.35 + i * 37 % 100 / 90, a: 0.18 + i * 29 % 100 / 240, phase: i * 47 % 628 / 100, freq: fast ? 58e-4 + i * 41 % 80 / 1e5 : medium ? 27e-4 + i * 41 % 90 / 1e5 : 48e-5 + i * 41 % 95 / 1e5 };
      });
    }
    function buildNeuralMapScene(data) {
      const nodes = (data.nodes || []).slice(0, 170).map((n) => ({ ...n }));
      const nodeIds = new Set(nodes.map((n) => n.id));
      const edges = (data.edges || []).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)).slice(0, 340);
      const categories = [...new Set(nodes.map((n) => n.category || "Other"))];
      const catIndex = Object.fromEntries(categories.map((c, i) => [c, i]));
      const regionCount = Math.max(1, categories.length);
      const regions = Object.fromEntries(categories.map((cat, i) => {
        const t = regionCount === 1 ? 0 : i / Math.max(1, regionCount - 1) * 2 - 1;
        const angle = -Math.PI / 2 + i * 2.399963;
        const radial = Math.sqrt(Math.max(0, 1 - t * t));
        const side = i % 2 === 0 ? -1 : 1;
        return [cat, {
          label: cat,
          angle,
          cx: Math.cos(angle) * radial * 230,
          cy: t * 150 + Math.sin(angle * 0.7) * 24,
          cz: Math.sin(angle) * radial * 190 + side * 28,
          spread: 78 + i % 4 * 12
        }];
      }));
      const degree = /* @__PURE__ */ new Map();
      edges.forEach((e) => {
        degree.set(e.source, (degree.get(e.source) || 0) + 1);
        degree.set(e.target, (degree.get(e.target) || 0) + 1);
      });
      const hubsByCategory = {};
      nodes.filter((n) => n.kind !== "memory").sort((a, b) => Number(b.weight || b.count || 0) + (degree.get(b.id) || 0) - (Number(a.weight || a.count || 0) + (degree.get(a.id) || 0))).forEach((n) => {
        const cat = n.category || "Other";
        if (!hubsByCategory[cat]) hubsByCategory[cat] = [];
        hubsByCategory[cat].push(n);
      });
      const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
      nodes.forEach((n, i) => {
        const cat = n.category || "Other";
        const region = regions[cat] || regions.Other || { cx: 0, cy: 0, cz: 0, angle: 0, spread: 80 };
        const ci = catIndex[cat] || 0;
        const weight = Math.max(1, Number(n.weight || n.count || 1));
        const d = degree.get(n.id) || 0;
        if (n.kind === "memory") {
          const linked = edges.find((e) => e.source === n.id || e.target === n.id);
          const parent = linked ? byId[linked.source === n.id ? linked.target : linked.source] : null;
          const parentX = parent && parent.kind !== "memory" && Number.isFinite(parent.x) ? parent.x : region.cx;
          const parentY = parent && parent.kind !== "memory" && Number.isFinite(parent.y) ? parent.y : region.cy;
          const parentZ = parent && parent.kind !== "memory" && Number.isFinite(parent.z) ? parent.z : region.cz;
          const branch = (i * 137.508 + ci * 19) % 360 * Math.PI / 180;
          const yUnit = ((i * 43 + ci * 17) % 97 + 0.5) / 97 * 2 - 1;
          const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
          const dist = 46 + i % 6 * 13 + Math.min(48, Math.sqrt(weight) * 10);
          n.x = parentX + Math.cos(branch) * radial * dist;
          n.y = parentY + yUnit * dist * 0.82;
          n.z = parentZ + Math.sin(branch) * radial * dist * 0.86;
        } else {
          const rank = Math.max(0, (hubsByCategory[cat] || []).indexOf(n));
          const orbit = rank === 0 ? 0 : 30 + Math.sqrt(rank) * 20;
          const angle = region.angle + rank * 2.399963 + ci % 3 * 0.24;
          const yUnit = rank === 0 ? 0 : ((rank * 37 + ci * 11) % 89 + 0.5) / 89 * 2 - 1;
          const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
          n.x = region.cx + Math.cos(angle) * radial * orbit;
          n.y = region.cy + yUnit * orbit * 0.86;
          n.z = region.cz + Math.sin(angle) * radial * orbit * 0.8;
        }
        n.size = Math.min(30, 8 + Math.sqrt(weight + d) * (n.kind === "memory" ? 3.2 : 4.1));
        n.twinkle = i % 17 / 17;
        n.twinkleFreq = 17e-4 + i * 31 % 80 / 1e5;
        n.twinkleAmp = 0.08 + i * 19 % 40 / 1e3;
        n.neuralRegion = cat;
      });
      constellationScene.nodes = nodes;
      constellationScene.edges = edges;
      constellationScene.byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
      constellationScene.regions = Object.values(regions);
      constellationScene.data = data;
      constellationScene.stars = Array.from({ length: 60 }, (_, i) => ({ x: i * 89 % 1e3 / 1e3, y: i * 157 % 680 / 680, r: 0.25 + i * 17 % 100 / 120, a: 0.1 + i * 23 % 100 / 340, phase: i * 41 % 628 / 100, freq: 45e-5 + i * 29 % 70 / 1e5 }));
    }
    function projectNeuralNode(n, w, h) {
      const fit = w < 620 ? Math.min(0.88, Math.max(0.62, (w - 38) / 620)) : Math.min(1.1, Math.max(0.76, (w - 80) / 720));
      const cameraScale = fit * constellationScene.zoom;
      const x = Number(n.x || 0), y = Number(n.y || 0), z = Number(n.z || 0);
      const cosR = Math.cos(constellationScene.rotation || 0), sinR = Math.sin(constellationScene.rotation || 0);
      const xr = x * cosR - z * sinR, zr = x * sinR + z * cosR;
      const cosT = Math.cos(constellationScene.tilt || 0), sinT = Math.sin(constellationScene.tilt || 0);
      const yr = y * cosT - zr * sinT, zt = y * sinT + zr * cosT;
      const cameraDistance = w < 620 ? 760 : 980;
      const perspective = Math.max(0.48, Math.min(1.85, cameraDistance / Math.max(260, cameraDistance - zt)));
      const depthAlpha = Math.max(0.36, Math.min(1, 0.58 + zt / 620));
      return {
        x: w / 2 + constellationScene.panX + xr * cameraScale * perspective,
        y: h / 2 + constellationScene.panY + yr * cameraScale * perspective,
        z: zt,
        scale: cameraScale * perspective,
        alpha: depthAlpha,
        visible: true
      };
    }
    function drawSynapse(ctx, a, b, e, c, t, compactCanvas, pulse = false) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const curve = Math.min(compactCanvas ? 30 : 48, len * 0.16) * ((e.id || "").length % 2 ? 1 : -1);
      const cx = mx - dy / len * curve, cy = my + dx / len * curve;
      const depth = Math.min(1, Math.max(0.42, ((a.alpha || 1) + (b.alpha || 1)) / 2));
      ctx.strokeStyle = e.kind === "memory" ? c.memorySynapse : c.synapse;
      ctx.globalAlpha = (compactCanvas ? 0.24 : 0.3) * depth;
      ctx.lineWidth = compactCanvas ? 0.66 : 0.82;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, b.x, b.y);
      ctx.stroke();
      if (!pulse) return;
      const phase = (t * 12e-5 + (e.id || "").length % 17 / 17) % 1;
      const inv = 1 - phase;
      const qx = inv * inv * a.x + 2 * inv * phase * cx + phase * phase * b.x;
      const qy = inv * inv * a.y + 2 * inv * phase * cy + phase * phase * b.y;
      ctx.globalAlpha = (compactCanvas ? 0.36 : 0.54) * depth;
      ctx.fillStyle = e.kind === "memory" ? c.memory : c.star;
      ctx.beginPath();
      ctx.arc(qx, qy, compactCanvas ? 1.55 : 2.15, 0, Math.PI * 2);
      ctx.fill();
    }
    function drawNeuronSoma(ctx, n, p, c, t, compactCanvas, fast = false) {
      const weight = Math.max(1, Number(n.weight || n.count || 1));
      const base = n.kind === "memory" ? c.memory : c.star;
      const r = Math.min(compactCanvas ? 7.5 : 11, Math.max(compactCanvas ? 3.4 : 4.6, (2.8 + Math.sqrt(weight) * 1.15) * p.scale));
      const pulse = 1 + Math.sin(t * (n.twinkleFreq || 17e-4) + n.twinkle * 6.28) * (n.twinkleAmp || 0.07);
      const somaR = r * pulse;
      const halo = somaR * (n.kind === "memory" ? 2 : 2.4);
      const depthAlpha = p.alpha || 1;
      if (fast) {
        ctx.globalAlpha = (c.light ? 0.34 : 0.48) * depthAlpha;
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(p.x, p.y, somaR * 0.92, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.88 * depthAlpha;
        ctx.fillStyle = "rgba(255,255,255,.82)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.65, somaR * 0.3), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return { r: somaR, halo };
      }
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, halo);
      glow.addColorStop(0, "rgba(255,255,255,.82)");
      glow.addColorStop(0.2, base);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = (c.light ? 0.2 : 0.3) * depthAlpha;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, halo, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((n.twinkle || 0) * Math.PI * 2 + t * 4e-5);
      ctx.strokeStyle = base;
      ctx.lineCap = "round";
      ctx.shadowColor = base;
      ctx.shadowBlur = compactCanvas ? 5 : 8;
      const dendrites = n.kind === "memory" ? 3 : 6;
      for (let i = 0; i < dendrites; i++) {
        const a = i / dendrites * Math.PI * 2 + Math.sin(t * 18e-5 + i) * 0.1;
        const length = somaR * (n.kind === "memory" ? 1.55 : 2.15) + i % 3 * 2.5;
        ctx.globalAlpha = (c.light ? 0.22 : 0.34) * depthAlpha;
        ctx.lineWidth = Math.max(0.55, somaR * 0.1);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * somaR * 0.72, Math.sin(a) * somaR * 0.72);
        ctx.lineTo(Math.cos(a) * length, Math.sin(a) * length);
        ctx.stroke();
        if (n.kind !== "memory") {
          ctx.globalAlpha = (c.light ? 0.16 : 0.24) * depthAlpha;
          const fork = length * 0.72;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * fork, Math.sin(a) * fork);
          ctx.lineTo(Math.cos(a + 0.38) * length * 0.96, Math.sin(a + 0.38) * length * 0.96);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 0.96 * depthAlpha;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.beginPath();
      ctx.arc(0, 0, somaR * 0.88, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.78 * depthAlpha;
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(0, 0, somaR * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.72 * depthAlpha;
      ctx.fillStyle = c.bg;
      ctx.beginPath();
      ctx.arc(-somaR * 0.16, -somaR * 0.18, somaR * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return { r: somaR, halo };
    }
    function neuralFastMode(t = performance.now()) {
      return constellationScene.visualiserMode === "neural" && (Boolean(constellationScene.drag) || t - (constellationScene.lastInteraction || 0) < 220);
    }
    function visualiserDpr(compactCanvas, mode) {
      const raw = window.devicePixelRatio || 1;
      if (mode === "neural") return Math.min(raw, compactCanvas ? 1.8 : 1.25);
      return Math.min(raw, compactCanvas ? 2 : 1.5);
    }
    function drawNeuralFrame(t = 0) {
      const canvas = $2("#constellationCanvas");
      if (!canvas) return;
      const wrap = canvas.parentElement;
      const w = Math.max(320, wrap.clientWidth || canvas.clientWidth || 1e3);
      const h = Math.max(430, wrap.clientHeight || canvas.clientHeight || 680);
      const compactCanvas = w < 620;
      const dpr = visualiserDpr(compactCanvas, "neural");
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = neuralColors2();
      const fast = false;
      if (!constellationScene.paused && !constellationScene.drag && !prefersReducedMotion2()) {
        const delta = constellationScene.lastFrameTime ? Math.min(48, t - constellationScene.lastFrameTime) : 16;
        constellationScene.rotation += delta * 32e-6;
      }
      constellationScene.lastFrameTime = t;
      clampConstellationCamera(w, h);
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(w * 0.48, h * 0.44, 18, w * 0.48, h * 0.44, Math.max(w, h) * 0.78);
      bg.addColorStop(0, c.core);
      bg.addColorStop(0.48, c.mid);
      bg.addColorStop(1, c.bg);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      constellationScene.stars.forEach((s) => {
        const pulse = 0.5 + Math.sin(t * s.freq + s.phase) * 0.3;
        ctx.globalAlpha = s.a * Math.max(0.1, pulse) * (c.light ? 0.35 : 0.55);
        ctx.fillStyle = c.text;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r * (c.light ? 0.55 : 0.75), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      const projected = /* @__PURE__ */ new Map();
      constellationScene.nodes.forEach((n) => projected.set(n.id, projectNeuralNode(n, w, h)));
      (constellationScene.regions || []).slice(0, 10).forEach((region, i) => {
        const rp = projectNeuralNode({ x: region.cx, y: region.cy, z: region.cz || 0 }, w, h);
        const rx = (region.spread || 82) * (compactCanvas ? 1.2 : 1.55) * rp.scale;
        const ry = (region.spread || 82) * (compactCanvas ? 0.76 : 0.98) * rp.scale;
        const hue = i % 3;
        const fill = c.light ? hue === 0 ? "rgba(76,171,158,.075)" : hue === 1 ? "rgba(101,214,255,.065)" : "rgba(255,209,102,.060)" : hue === 0 ? "rgba(76,171,158,.115)" : hue === 1 ? "rgba(101,214,255,.092)" : "rgba(255,209,102,.070)";
        ctx.save();
        ctx.translate(rp.x, rp.y);
        ctx.rotate(region.angle * 0.42);
        ctx.globalAlpha = 1;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = c.light ? 0.14 : 0.18;
        ctx.strokeStyle = hue === 2 ? c.memorySynapse : c.synapseHot;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (!compactCanvas && region.label) {
          ctx.globalAlpha = c.light ? 0.32 : 0.28;
          ctx.fillStyle = c.text;
          ctx.font = "10px Inter, system-ui, sans-serif";
          ctx.fillText(region.label.slice(0, 22), -rx * 0.42, -ry * 0.48);
        }
        ctx.restore();
      });
      const edgeDegree = /* @__PURE__ */ new Map();
      let edgeDrawn = 0;
      const edgeLimit = fast ? compactCanvas ? 48 : 112 : compactCanvas ? 58 : 132;
      const degreeLimit = fast ? compactCanvas ? 3 : 4 : compactCanvas ? 3 : 5;
      for (const e of constellationScene.edges) {
        const a = projected.get(e.source), b = projected.get(e.target);
        if (!a || !b) continue;
        if (edgeDrawn >= edgeLimit) break;
        const da = edgeDegree.get(e.source) || 0, db = edgeDegree.get(e.target) || 0;
        if (da >= degreeLimit || db >= degreeLimit) continue;
        edgeDegree.set(e.source, da + 1);
        edgeDegree.set(e.target, db + 1);
        edgeDrawn++;
        const pulseStride = compactCanvas ? 4 : 3;
        const pulseLimit = compactCanvas ? 24 : 72;
        const shouldPulse = edgeDrawn <= (fast ? Math.floor(pulseLimit * 0.75) : pulseLimit) && (edgeDrawn + (e.id || "").length % pulseStride) % pulseStride === 0;
        drawSynapse(ctx, a, b, e, c, t, compactCanvas, shouldPulse);
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const hits = [];
      const labelBoxes = [];
      const nodeDegrees = /* @__PURE__ */ new Map();
      constellationScene.edges.forEach((e) => {
        nodeDegrees.set(e.source, (nodeDegrees.get(e.source) || 0) + 1);
        nodeDegrees.set(e.target, (nodeDegrees.get(e.target) || 0) + 1);
      });
      [...constellationScene.nodes].sort((a, b) => Number(a.z || 0) - Number(b.z || 0)).forEach((n) => {
        const p = projected.get(n.id);
        if (!p) return;
        const drawn = drawNeuronSoma(ctx, n, p, c, t, compactCanvas, fast);
        if (n.id === constellationScene.selectedNodeId) {
          ctx.globalAlpha = 0.92;
          ctx.strokeStyle = c.memory;
          ctx.lineWidth = compactCanvas ? 2 : 2.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(18, drawn.halo * 0.72), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        const labelRaw = (n.label || "").replace(/^memory:/, "mem ");
        const compactRaw = labelRaw.trim();
        const alphaChars = (compactRaw.match(/[A-Za-z]/g) || []).length;
        const isHashLike = /^[a-f0-9]{10,}$/i.test(compactRaw) || /^mem\s+[a-f0-9]{6,}$/i.test(compactRaw);
        const isMachineToken = /^[A-Z0-9_:/.-]{14,}$/.test(compactRaw) && /[_:/.-]/.test(compactRaw);
        const degree = nodeDegrees.get(n.id) || 0;
        const weight = Math.max(1, Number(n.weight || n.count || 1));
        const showLabel = !isHashLike && !isMachineToken && alphaChars >= 4 && (compactCanvas ? n.kind !== "memory" && (weight > 7.2 || degree > 2) : degree > 1 || weight > 4.2 || n.kind !== "memory");
        if (showLabel) {
          const label = /^[A-Z][A-Z_\s-]{2,}$/.test(labelRaw) ? labelRaw.toLowerCase().replace(/(^|[_\s-])([a-z])/g, (_m, sep, ch) => (sep === "_" ? " " : sep) + ch.toUpperCase()) : labelRaw;
          const short = label.length > 22 ? label.slice(0, 19) + "…" : label;
          ctx.font = `${Math.round((compactCanvas ? 9 : 10) + Math.min(3, Math.sqrt(weight)))}px Inter, system-ui, sans-serif`;
          const lx = p.x + drawn.halo * 0.55 + 6, ly = p.y + 4, tw = ctx.measureText(short).width;
          const box = { x: lx - 4, y: ly - 14, w: tw + 8, h: 19 };
          const onCanvas = box.x >= 10 && box.x + box.w <= w - 10 && box.y >= 10 && box.y + box.h <= h - 10;
          const collides = labelBoxes.some((b) => !(box.x + box.w < b.x || b.x + b.w < box.x || box.y + box.h < b.y || b.y + b.h < box.y));
          if (onCanvas && !collides) {
            labelBoxes.push(box);
            ctx.lineWidth = 5;
            ctx.strokeStyle = c.bg;
            ctx.fillStyle = c.text;
            ctx.globalAlpha = Math.min(0.82, 0.4 + p.scale * 0.32) * (p.alpha || 1);
            ctx.strokeText(short, lx, ly);
            ctx.fillText(short, lx, ly);
            ctx.globalAlpha = 1;
          }
        }
        hits.push({ x: p.x, y: p.y, r: Math.max(15, drawn.halo * 0.75), node: n });
      });
      constellationScene.hits = hits;
      if (!prefersReducedMotion2() && !document.hidden && isActive()) constellationScene.frame = requestAnimationFrame(drawVisualiserFrame);
    }
    function neuralColors2() {
      const light = document.documentElement.dataset.theme === "light";
      return light ? { light: true, bg: "#f7f0e7", core: "rgba(24,128,107,.18)", mid: "rgba(185,54,46,.12)", star: "#087f73", memory: "#c63e35", text: "#252220", synapse: "rgba(18,116,100,.34)", synapseHot: "rgba(8,126,106,.62)", memorySynapse: "rgba(190,54,46,.58)" } : { light: false, bg: "#06100f", core: "rgba(34,130,111,.28)", mid: "rgba(95,31,29,.40)", star: "#66e8c6", memory: "#ff5f57", text: "#f6fbf7", synapse: "rgba(82,214,181,.22)", synapseHot: "rgba(90,238,196,.52)", memorySynapse: "rgba(255,95,87,.58)" };
    }
    function updateVisualiserModeUI2() {
      const mode = constellationScene.visualiserMode === "neural" ? "neural" : "constellation";
      $$2(".visualiser-tabs button[data-visualiser]").forEach((b) => {
        const active = b.dataset.visualiser === mode;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", String(active));
      });
      const wrap = $2("#constellationCanvas")?.parentElement;
      if (wrap) wrap.dataset.visualiser = mode;
      const legend = $2(".constellation-legend");
      if (legend) legend.innerHTML = mode === "neural" ? '<span><i class="legend-dot entity"></i>Neuron hub</span><span><i class="legend-dot memory"></i>Memory soma</span><span><i class="legend-line"></i>Synapse</span>' : '<span><i class="legend-dot entity"></i>Entity/topic</span><span><i class="legend-dot memory"></i>Memory</span><span><i class="legend-line"></i>Link</span>';
      const help = $2("#visualiserHelp");
      if (help) help.textContent = mode === "neural" ? window.matchMedia("(max-width: 760px)").matches ? "Drag to orbit · Pan mode to move · pinch to zoom · tap a neuron." : "Drag to orbit the neural cloud · Pan mode/Shift-drag to pan · wheel/pinch to zoom." : "Drag to rotate · Pan mode/Shift-drag to pan · wheel/pinch to zoom.";
      const pause = $2("#constellationPause");
      if (pause) {
        pause.style.display = "";
        pause.textContent = constellationScene.paused ? mode === "neural" ? "Resume drift" : "Resume rotation" : mode === "neural" ? "Pause drift" : "Pause rotation";
      }
      const pan = $2("#constellationPanMode");
      if (pan) pan.textContent = constellationScene.mode === "pan" ? mode === "neural" ? "Orbit mode" : "Rotate mode" : "Pan mode";
    }
    function switchVisualiserMode2(mode) {
      constellationScene.visualiserMode = mode === "neural" ? "neural" : "constellation";
      localStorage.setItem(VISUALISER_MODE_KEY, constellationScene.visualiserMode);
      constellationScene.drag = null;
      constellationScene.pointers.clear();
      Object.assign(constellationScene, constellationScene.visualiserMode === "neural" ? { rotation: 0.34, tilt: 0.38, zoom: 1, panX: 0, panY: 0, mode: "rotate", lastFrameTime: 0, renderLastTime: 0 } : { ...CONSTELLATION_DEFAULT_CAMERA, mode: "rotate", lastFrameTime: 0, renderLastTime: 0 });
      updateVisualiserModeUI2();
      if (constellationScene.data) drawConstellation(constellationScene.data);
    }
    function drawVisualiserFrame(t = 0) {
      if (!isActive()) {
        stopCanvasVisualiserLoop2();
        return;
      }
      const mode = constellationScene.visualiserMode === "neural" ? "neural" : "constellation";
      const interval = 16;
      if (t && constellationScene.renderLastTime && t - constellationScene.renderLastTime < interval) {
        constellationScene.frame = isActive() && !document.hidden ? requestAnimationFrame(drawVisualiserFrame) : 0;
        return;
      }
      constellationScene.renderLastTime = t || 0;
      if (mode === "neural") drawNeuralFrame(t);
      else drawConstellationFrame(t);
    }
    function drawConstellationFrame(t = 0) {
      const canvas = $2("#constellationCanvas");
      if (!canvas) return;
      const wrap = canvas.parentElement;
      const w = Math.max(320, wrap.clientWidth || canvas.clientWidth || 1e3);
      const h = Math.max(430, wrap.clientHeight || canvas.clientHeight || 680);
      const compactCanvas = w < 620;
      const dpr = visualiserDpr(compactCanvas, "constellation");
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (!constellationScene.paused && !constellationScene.drag) {
        const delta = constellationScene.lastFrameTime ? Math.min(48, t - constellationScene.lastFrameTime) : 16;
        constellationScene.rotation += delta * 65e-6;
      }
      constellationScene.lastFrameTime = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = constellationColors2();
      clampConstellationCamera(w, h);
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(w * 0.52, h * 0.44, 20, w * 0.52, h * 0.44, Math.max(w, h) * 0.72);
      bg.addColorStop(0, compactCanvas ? "rgba(101,214,255,.055)" : c.nebula);
      bg.addColorStop(0.45, compactCanvas ? "rgba(60,110,150,.018)" : "rgba(72,130,160,.035)");
      bg.addColorStop(1, c.bg);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      constellationScene.stars.forEach((s) => {
        const pulse = 0.42 + Math.sin(t * s.freq + s.phase) * 0.34 + Math.sin(t * s.freq * 0.37 + s.phase * 1.9) * 0.18;
        ctx.globalAlpha = s.a * Math.max(0.12, Math.min(1, pulse)) * (c.light ? 0.48 : 0.78);
        ctx.fillStyle = c.text;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r * (c.light ? 0.72 : 0.9), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      const projected = /* @__PURE__ */ new Map();
      constellationScene.nodes.forEach((n) => projected.set(n.id, projectConstellationNode(n, w, h, t)));
      const edgeDegree = /* @__PURE__ */ new Map();
      let edgeDrawn = 0;
      const edgeLimit = compactCanvas ? 44 : 140;
      const degreeLimit = compactCanvas ? 2 : 4;
      for (const e of constellationScene.edges) {
        const a = projected.get(e.source), b = projected.get(e.target);
        if (!a || !b || !a.visible || !b.visible) continue;
        if (edgeDrawn >= edgeLimit) break;
        const da = edgeDegree.get(e.source) || 0, db = edgeDegree.get(e.target) || 0;
        if (da >= degreeLimit || db >= degreeLimit) continue;
        edgeDegree.set(e.source, da + 1);
        edgeDegree.set(e.target, db + 1);
        edgeDrawn++;
        const depthAlpha = Math.min(c.light ? 0.58 : 0.58, Math.max(c.light ? 0.24 : 0.24, (a.scale + b.scale) / (c.light ? 5.4 : 5.2)));
        ctx.strokeStyle = e.kind === "memory" ? c.memoryEdge : c.edge;
        ctx.globalAlpha = depthAlpha * (compactCanvas ? 0.74 : 0.92);
        ctx.lineWidth = (c.light ? 0.68 : 0.78) + Math.max(a.scale, b.scale) * (c.light ? 0.2 : 0.26);
        ctx.setLineDash(e.kind === "memory" ? [5, 7] : [4, 8]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      const hits = [];
      const labelBoxes = [];
      const compactLabels = compactCanvas;
      const nodeDegrees = /* @__PURE__ */ new Map();
      constellationScene.edges.forEach((e) => {
        nodeDegrees.set(e.source, (nodeDegrees.get(e.source) || 0) + 1);
        nodeDegrees.set(e.target, (nodeDegrees.get(e.target) || 0) + 1);
      });
      const labelCounts = /* @__PURE__ */ new Map();
      const categoryCounts = /* @__PURE__ */ new Map();
      constellationScene.nodes.forEach((n) => {
        const key = (n.label || "").replace(/^memory:/, "mem ").trim().toLowerCase();
        if (key) labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
        const category = (n.category || "").trim().toLowerCase();
        if (category) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      });
      [...constellationScene.nodes].sort((a, b) => projected.get(a.id).z - projected.get(b.id).z).forEach((n) => {
        const p = projected.get(n.id);
        if (!p?.visible) return;
        const base = n.kind === "memory" ? c.memory : c.star;
        const pulse = 1 + Math.sin(t * (n.twinkleFreq || 17e-4) + n.twinkle * 6.28) * (n.twinkleAmp || 0.09) + Math.sin(t * (n.twinkleFreq || 17e-4) * 0.43 + n.twinkle * 11.7) * ((n.twinkleAmp || 0.09) * 0.48);
        const weight = Math.max(1, Number(n.weight || n.count || 1));
        const starR = Math.min(compactCanvas ? 3.2 : 4.6, Math.max(compactCanvas ? 0.85 : 1.05, (1 + Math.sqrt(weight)) * p.scale * (compactCanvas ? 0.42 : 0.54))) * pulse;
        const important = weight > 3.2 || n.kind === "memory";
        const flare = Math.min(compactCanvas ? 8.5 : 12.5, starR * (important ? 2.45 : 1.65));
        const halo = Math.max(2.4, starR * (important ? 3.2 : 2.35));
        ctx.globalAlpha = Math.max(c.light ? 0.14 : 0.1, Math.min(compactCanvas ? 0.28 : 0.34, p.scale * (compactCanvas ? 0.18 : 0.24)));
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, halo);
        glow.addColorStop(0, "rgba(255,255,255,.92)");
        glow.addColorStop(0.18, base);
        glow.addColorStop(0.62, base);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, halo, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(t * 12e-5 + n.twinkle * Math.PI);
        ctx.shadowColor = base;
        ctx.shadowBlur = compactCanvas ? 3 : 5;
        ctx.strokeStyle = base;
        ctx.lineCap = "round";
        const majorStar = weight > (compactCanvas ? 7.5 : 6.2) || n.kind === "memory" && weight > (compactCanvas ? 5.6 : 4.8);
        if (majorStar) {
          ctx.globalAlpha = Math.max(0.34, Math.min(0.68, p.scale * 0.6));
          ctx.lineWidth = Math.max(0.45, starR * 0.18);
          ctx.beginPath();
          ctx.moveTo(-flare, 0);
          ctx.lineTo(flare, 0);
          ctx.moveTo(0, -flare);
          ctx.lineTo(0, flare);
          ctx.stroke();
          ctx.globalAlpha = Math.max(0.16, Math.min(0.36, p.scale * 0.32));
          ctx.lineWidth = Math.max(0.35, starR * 0.13);
          const diag = flare * 0.45;
          ctx.beginPath();
          ctx.moveTo(-diag, -diag);
          ctx.lineTo(diag, diag);
          ctx.moveTo(-diag, diag);
          ctx.lineTo(diag, -diag);
          ctx.stroke();
        }
        ctx.shadowBlur = compactCanvas ? 5 : 7;
        ctx.globalAlpha = 0.96;
        ctx.fillStyle = "rgba(255,255,255,.98)";
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.62, starR * 0.52), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = base;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.28, starR * 0.2), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
        if (n.id === constellationScene.selectedNodeId) {
          ctx.globalAlpha = 0.92;
          ctx.strokeStyle = c.memory;
          ctx.lineWidth = compactCanvas ? 2 : 2.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(16, flare + 5), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
        const labelRaw = (n.label || "").replace(/^memory:/, "mem ");
        const labelKey = labelRaw.trim().toLowerCase();
        const compactRaw = labelRaw.trim();
        const alphaChars = (compactRaw.match(/[A-Za-z]/g) || []).length;
        const isHashLike = /^[a-f0-9]{10,}$/i.test(compactRaw) || /^mem\s+[a-f0-9]{6,}$/i.test(compactRaw);
        const isMachineToken = /^[A-Z0-9_:/.-]{14,}$/.test(compactRaw) && /[_:/.-]/.test(compactRaw);
        const isDateLike = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(compactRaw);
        const lowInformation = alphaChars < 4;
        const technicalLabel = isHashLike || isMachineToken || isDateLike || lowInformation;
        const degree = nodeDegrees.get(n.id) || 0;
        const frequency = labelCounts.get(labelKey) || 1;
        const categoryFrequency = categoryCounts.get((n.category || "").trim().toLowerCase()) || 1;
        const dominantCategory = categoryFrequency > constellationScene.nodes.length * 0.35;
        const shoutingDominantToken = /^[A-Z]{4,}$/.test(compactRaw) && dominantCategory;
        const specificity = Math.max(0.35, Math.min(1.15, 1 / Math.sqrt(frequency)));
        const categorySpecificity = Math.max(0.05, Math.min(1.1, Math.log1p(constellationScene.nodes.length / categoryFrequency) / 2.4));
        const lengthQuality = Math.max(0.25, Math.min(1.1, (alphaChars - 2) / 8));
        const labelScore = p.scale * 2.05 + Math.log1p(weight) * 0.52 + Math.log1p(degree) * 0.38 + specificity + categorySpecificity + lengthQuality + (n.kind === "memory" ? 0.15 : 0) - (shoutingDominantToken ? 1.25 : 0);
        const showLabel = !technicalLabel && (compactLabels ? labelScore > 4.15 : labelScore > 3.95);
        if (showLabel) {
          const label = /^[A-Z][A-Z_\s-]{2,}$/.test(labelRaw) ? labelRaw.toLowerCase().replace(/(^|[_\s-])([a-z])/g, (_m, sep, ch) => (sep === "_" ? " " : sep) + ch.toUpperCase()) : labelRaw;
          const short = label.length > 22 ? label.slice(0, 19) + "…" : label;
          ctx.font = `${Math.round((compactLabels ? 9 : 10) + p.scale * 2.5)}px Inter, system-ui, sans-serif`;
          const lx = p.x + flare + 6, ly = p.y + 4, tw = ctx.measureText(short).width;
          const labelPad = compactLabels ? 4 : 4;
          const box = { x: lx - labelPad, y: ly - (compactLabels ? 13 : 14), w: tw + labelPad * 2, h: compactLabels ? 18 : 19 };
          const onCanvas = box.x >= 10 && box.x + box.w <= w - 10 && box.y >= 10 && box.y + box.h <= h - 10;
          const collides = labelBoxes.some((b) => !(box.x + box.w < b.x || b.x + b.w < box.x || box.y + box.h < b.y || b.y + b.h < box.y));
          if (onCanvas && !collides) {
            labelBoxes.push(box);
            ctx.lineWidth = 5;
            ctx.strokeStyle = c.bg;
            ctx.fillStyle = c.text;
            ctx.globalAlpha = Math.min(0.78, 0.3 + p.scale * 0.42);
            ctx.strokeText(short, lx, ly);
            ctx.fillText(short, lx, ly);
            ctx.globalAlpha = 1;
          }
        }
        hits.push({ x: p.x, y: p.y, r: Math.max(14, flare + 8), node: n });
      });
      constellationScene.hits = hits;
      if (!prefersReducedMotion2() && !document.hidden && isActive()) constellationScene.frame = requestAnimationFrame(drawVisualiserFrame);
    }
    function clampConstellationCamera(w, h) {
      constellationScene.zoom = Math.max(CONSTELLATION_MIN_ZOOM, Math.min(CONSTELLATION_MAX_ZOOM, Number.isFinite(constellationScene.zoom) ? constellationScene.zoom : 1));
      constellationScene.rotation = Number.isFinite(constellationScene.rotation) ? constellationScene.rotation : 0;
      constellationScene.tilt = Math.max(-1.05, Math.min(1.05, Number.isFinite(constellationScene.tilt) ? constellationScene.tilt : 0.35));
      const panLimitX = Math.max(80, w * (0.24 + constellationScene.zoom * 0.22));
      const panLimitY = Math.max(90, h * (0.16 + constellationScene.zoom * 0.14));
      constellationScene.panX = Math.max(-panLimitX, Math.min(panLimitX, Number.isFinite(constellationScene.panX) ? constellationScene.panX : 0));
      constellationScene.panY = Math.max(-panLimitY, Math.min(panLimitY, Number.isFinite(constellationScene.panY) ? constellationScene.panY : 0));
    }
    function resetConstellationView2() {
      Object.assign(constellationScene, constellationScene.visualiserMode === "neural" ? { rotation: 0.34, tilt: 0.38, zoom: 1, panX: 0, panY: 0, mode: "rotate", drag: null, lastFrameTime: 0, renderLastTime: 0 } : { ...CONSTELLATION_DEFAULT_CAMERA, mode: "rotate", drag: null, lastFrameTime: 0, renderLastTime: 0 });
      constellationScene.pointers.clear();
      updateConstellationPauseButton2();
      updateConstellationPanButton2();
      updateVisualiserModeUI2();
    }
    function updateConstellationPauseButton2() {
      const btn = $2("#constellationPause");
      if (btn) btn.textContent = constellationScene.paused ? constellationScene.visualiserMode === "neural" ? "Resume drift" : "Resume rotation" : constellationScene.visualiserMode === "neural" ? "Pause drift" : "Pause rotation";
    }
    function updateConstellationPanButton2() {
      const btn = $2("#constellationPanMode");
      if (btn) btn.textContent = constellationScene.mode === "pan" ? constellationScene.visualiserMode === "neural" ? "Orbit mode" : "Rotate mode" : "Pan mode";
    }
    function toggleConstellationPanMode2() {
      constellationScene.mode = constellationScene.mode === "pan" ? "rotate" : "pan";
      updateConstellationPanButton2();
    }
    function toggleConstellationPause2() {
      constellationScene.paused = !constellationScene.paused;
      constellationScene.lastFrameTime = 0;
      updateConstellationPauseButton2();
    }
    function zoomConstellation(factor, cx, cy) {
      constellationScene.lastInteraction = performance.now();
      const canvas = $2("#constellationCanvas");
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const oldZoom = constellationScene.zoom;
      const nextZoom = Math.max(CONSTELLATION_MIN_ZOOM, Math.min(CONSTELLATION_MAX_ZOOM, oldZoom * factor));
      if (Math.abs(nextZoom - oldZoom) < 1e-3) return;
      const x = cx - rect.left - rect.width / 2 - constellationScene.panX;
      const y = cy - rect.top - rect.height / 2 - constellationScene.panY;
      const ratio = nextZoom / oldZoom;
      constellationScene.panX -= x * (ratio - 1);
      constellationScene.panY -= y * (ratio - 1);
      constellationScene.zoom = nextZoom;
      clampConstellationCamera(rect.width, rect.height);
    }
    function keyboardSelectableHits() {
      const seen = /* @__PURE__ */ new Set();
      return (constellationScene.hits || []).filter((hit) => {
        const id = hit.node?.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }
    function selectConstellationHit(delta = 1) {
      const hits = keyboardSelectableHits();
      if (!hits.length) return;
      const current = Math.max(0, hits.findIndex((hit) => hit.node?.id === constellationScene.selectedNodeId));
      const index = (current + delta + hits.length) % hits.length;
      inspectConstellationNode(hits[index].node);
      redraw();
    }
    function selectedConstellationNode() {
      const hits = keyboardSelectableHits();
      return hits.find((hit) => hit.node?.id === constellationScene.selectedNodeId)?.node || hits[0]?.node || null;
    }
    function bindConstellationKeyboard(canvas) {
      if (canvas.dataset.keyboardBound === "true") return;
      canvas.dataset.keyboardBound = "true";
      canvas.addEventListener("keydown", (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const key = e.key;
        if (["ArrowRight", "ArrowDown"].includes(key)) {
          e.preventDefault();
          selectConstellationHit(1);
          return;
        }
        if (["ArrowLeft", "ArrowUp"].includes(key)) {
          e.preventDefault();
          selectConstellationHit(-1);
          return;
        }
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          const node = selectedConstellationNode();
          if (node) {
            inspectConstellationNode(node);
            openConstellationNode(node);
          }
          return;
        }
        if (key.toLowerCase() === "r") {
          e.preventDefault();
          resetConstellationView2();
          redraw();
          return;
        }
        if (key.toLowerCase() === "p") {
          e.preventDefault();
          toggleConstellationPause2();
          return;
        }
        if (key.toLowerCase() === "m") {
          e.preventDefault();
          toggleConstellationPanMode2();
          return;
        }
        if (key === "+" || key === "=") {
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          zoomConstellation(1.18, rect.left + rect.width / 2, rect.top + rect.height / 2);
          redraw();
          return;
        }
        if (key === "-" || key === "_") {
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          zoomConstellation(1 / 1.18, rect.left + rect.width / 2, rect.top + rect.height / 2);
          redraw();
        }
      });
    }
    function bindConstellationControls(canvas) {
      if (canvas.dataset.controlsBound === "true") return;
      canvas.dataset.controlsBound = "true";
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        zoomConstellation(Math.exp(-e.deltaY * 12e-4), e.clientX, e.clientY);
      }, { passive: false });
      canvas.addEventListener("pointerdown", (e) => {
        constellationScene.lastInteraction = performance.now();
        if (e.cancelable) e.preventDefault();
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (_err) {
        }
        constellationScene.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (constellationScene.pointers.size === 2) {
          const pts = [...constellationScene.pointers.values()];
          constellationScene.drag = { mode: "pinch", dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), midX: (pts[0].x + pts[1].x) / 2, midY: (pts[0].y + pts[1].y) / 2, zoom: constellationScene.zoom, panX: constellationScene.panX, panY: constellationScene.panY };
          return;
        }
        constellationScene.drag = { mode: constellationScene.mode === "pan" || e.shiftKey || e.button === 1 || e.button === 2 ? "pan" : "rotate", x: e.clientX, y: e.clientY, rotation: constellationScene.rotation, tilt: constellationScene.tilt, panX: constellationScene.panX, panY: constellationScene.panY, moved: false };
      });
      canvas.addEventListener("pointermove", (e) => {
        if (constellationScene.drag) constellationScene.lastInteraction = performance.now();
        if (constellationScene.drag && e.cancelable) e.preventDefault();
        if (constellationScene.pointers.has(e.pointerId)) constellationScene.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const d = constellationScene.drag;
        if (!d) return;
        if (d.mode === "pinch") {
          if (constellationScene.pointers.size < 2) return;
          const pts = [...constellationScene.pointers.values()];
          const dist = Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
          const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
          constellationScene.zoom = Math.max(CONSTELLATION_MIN_ZOOM, Math.min(CONSTELLATION_MAX_ZOOM, d.zoom * (dist / Math.max(1, d.dist))));
          constellationScene.panX = d.panX + (midX - d.midX);
          constellationScene.panY = d.panY + (midY - d.midY);
          clampConstellationCamera(canvas.clientWidth || canvas.getBoundingClientRect().width, canvas.clientHeight || canvas.getBoundingClientRect().height);
          return;
        }
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        if (d.mode === "pan") {
          constellationScene.panX = d.panX + dx;
          constellationScene.panY = d.panY + dy;
          canvas.style.cursor = "grabbing";
        } else {
          constellationScene.rotation = d.rotation + dx * 8e-3;
          constellationScene.tilt = Math.max(-1.05, Math.min(1.05, d.tilt + dy * 6e-3));
          canvas.style.cursor = "grabbing";
        }
      });
      const endPointer = (e) => {
        constellationScene.pointers.delete(e.pointerId);
        if (constellationScene.pointers.size === 0) {
          if (constellationScene.drag?.moved) canvas.dataset.suppressClick = "true";
          constellationScene.drag = null;
          constellationScene.lastInteraction = performance.now();
          canvas.style.cursor = "grab";
        }
      };
      canvas.addEventListener("pointerup", endPointer);
      canvas.addEventListener("pointercancel", endPointer);
      bindConstellationKeyboard(canvas);
    }
    function drawConstellation(data) {
      if (!isActive()) return;
      if (constellationScene.frame) cancelAnimationFrame(constellationScene.frame);
      constellationScene.frame = 0;
      constellationScene.renderLastTime = 0;
      if (constellationScene.visualiserMode === "neural") buildNeuralMapScene(data);
      else buildConstellationScene(data);
      updateVisualiserModeUI2();
      const canvas = $2("#constellationCanvas");
      bindConstellationControls(canvas);
      bindConstellationKeyboard(canvas);
      canvas.onclick = (e) => {
        if (canvas.dataset.suppressClick === "true") {
          canvas.dataset.suppressClick = "false";
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        const hit = [...constellationScene.hits].reverse().find((h) => Math.hypot(h.x - x, h.y - y) <= h.r);
        if (hit) inspectConstellationNode(hit.node);
      };
      canvas.onpointermove = (e) => {
        if (constellationScene.drag) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        canvas.style.cursor = constellationScene.hits.some((h) => Math.hypot(h.x - x, h.y - y) <= h.r) ? "pointer" : "grab";
      };
      $2("#constellationClusters").innerHTML = (data.clusters || []).map((c) => `<span class="cluster-pill">${esc2(c.label)} <strong>${Number(c.count).toLocaleString()}</strong></span>`).join("");
      constellationInspectorDefault();
      drawVisualiserFrame(0);
    }
    async function loadConstellation2() {
      drawConstellation(await api2("/api/constellation?limit=240"));
    }
    function redraw() {
      if (isActive() && constellationScene.data) drawConstellation(constellationScene.data);
    }
    function resume() {
      if (isActive() && !prefersReducedMotion2() && !constellationScene.frame) constellationScene.frame = requestAnimationFrame(drawVisualiserFrame);
    }
    return {
      stop: stopCanvasVisualiserLoop2,
      redraw,
      resume,
      isActive,
      constellationColors: constellationColors2,
      neuralColors: neuralColors2,
      loadConstellation: loadConstellation2,
      resetConstellationView: resetConstellationView2,
      toggleConstellationPanMode: toggleConstellationPanMode2,
      toggleConstellationPause: toggleConstellationPause2,
      switchVisualiserMode: switchVisualiserMode2,
      updateVisualiserModeUI: updateVisualiserModeUI2,
      updateConstellationPauseButton: updateConstellationPauseButton2,
      updateConstellationPanButton: updateConstellationPanButton2,
      drawConstellation
    };
  }

  // static/src/visualisers/three-visualiser.js
  function createThreeVisualiser({
    $: $2,
    $$: $$2,
    api: api2,
    esc: esc2,
    openMemoryDetail: openMemoryDetail2,
    switchTab: switchTab2,
    loadThreeModule: loadThreeModule2,
    constellationColors: constellationColors2,
    neuralColors: neuralColors2,
    visualiserResponsiveFill: visualiserResponsiveFill2,
    prefersReducedMotion: prefersReducedMotion2,
    isCancelledRequest: isCancelledRequest3
  }) {
    let threeVis = {
      mode: "constellation",
      data: null,
      renderer: null,
      scene: null,
      camera: null,
      group: null,
      nodes: [],
      edgePairs: [],
      labels: [],
      pulses: [],
      frame: 0,
      paused: false,
      panMode: false,
      drag: null,
      pointer: /* @__PURE__ */ new Map(),
      yaw: 0,
      pitch: 0.32,
      cameraZ: 780,
      panX: 0,
      panY: 0,
      lastT: 0
    };
    function threeInspectorDefault2() {
      const neural = threeVis.mode === "neural";
      $2("#threeInspector").innerHTML = neural ? `<div class="inspector-kicker">Neural inspector</div><h3>Nothing selected</h3><p class="muted">Pick a neuron hub, memory soma, or synapse to inspect the underlying read-only source.</p>` : `<div class="inspector-kicker">Constellation inspector</div><h3>Nothing selected</h3><p class="muted">Pick a star, memory, or link to inspect the underlying read-only source.</p>`;
    }
    function inspectThreeNode(node) {
      const mode = threeVis.mode === "neural" ? "Neural Map 3D" : "Constellation 3D";
      $2("#threeInspector").innerHTML = `<div class="inspector-kicker">${mode} · ${esc2(node.kind || "entity")}</div><h3>${esc2(node.label)}</h3><p class="muted">${esc2(node.category || "Other")} · ${Number(node.count || 0).toLocaleString()} signal(s) · weight ${Number(node.weight || 0).toFixed(2)}</p>${node.preview ? `<p>${esc2(node.preview)}</p>` : ""}<div class="inspector-actions">${node.memory_id ? '<button id="threeMemory" class="primary tiny">Open memory</button>' : ""}<button id="threeSearch" class="tiny">Search this</button></div>`;
      if (node.memory_id) $2("#threeMemory").onclick = () => openMemoryDetail2(node.memory_id);
      $2("#threeSearch").onclick = () => {
        $2("#memoryQuery").value = String(node.label || "").replace(/^memory:/, "");
        switchTab2("memories");
      };
    }
    function updateThreeUI() {
      $$2(".visualiser-tabs button[data-three-mode]").forEach((b) => {
        const active = b.dataset.threeMode === threeVis.mode;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", String(active));
      });
      const viewport = $2("#threeViewport");
      if (viewport) viewport.dataset.threeMode = threeVis.mode;
      const legend = $2("#threeLegend");
      if (legend) legend.innerHTML = threeVis.mode === "neural" ? '<span><i class="legend-dot entity"></i>Neuron hub</span><span><i class="legend-dot memory"></i>Memory soma</span><span><i class="legend-line"></i>Synapse</span>' : '<span><i class="legend-dot entity"></i>Entity/topic</span><span><i class="legend-dot memory"></i>Memory</span><span><i class="legend-line"></i>Link</span>';
      const help = $2("#threeHelp");
      if (help) help.textContent = threeVis.mode === "neural" ? window.matchMedia("(max-width: 760px)").matches ? "Drag to orbit · Pan mode to move · pinch to zoom · tap a neuron · focus viewport for keys." : "Drag to orbit the neural cloud · Pan mode/Shift-drag or arrow keys to pan · +/- to zoom." : "Drag to rotate · Pan mode/Shift-drag or arrow keys to pan · +/- to zoom · R reset · P pause.";
      const pause = $2("#threePause");
      if (pause) pause.textContent = threeVis.paused ? threeVis.mode === "neural" ? "Resume drift" : "Resume rotation" : threeVis.mode === "neural" ? "Pause drift" : "Pause rotation";
      const pan = $2("#threePanMode");
      if (pan) pan.textContent = threeVis.panMode ? "Orbit mode" : "Pan mode";
    }
    function resetThreeCamera2() {
      Object.assign(threeVis, { yaw: threeVis.mode === "neural" ? 0.12 : 0.7, pitch: threeVis.mode === "neural" ? 0.1 : 0.96, cameraZ: threeVis.mode === "neural" ? 600 : 760, panX: 0, panY: threeVis.mode === "neural" ? -10 : -84, lastT: 0 });
    }
    function clearThreeScene2() {
      if (threeVis.frame) cancelAnimationFrame(threeVis.frame);
      threeVis.frame = 0;
      if (threeVis.renderer) {
        threeVis.renderer.dispose();
        threeVis.renderer.domElement.remove();
      }
      $2("#threeLabels").innerHTML = "";
      Object.assign(threeVis, { renderer: null, scene: null, camera: null, group: null, nodes: [], edgePairs: [], labels: [], pulses: [] });
    }
    function cssHexToInt2(hex) {
      const m = String(hex || "").match(/^#([0-9a-f]{6})$/i);
      return m ? parseInt(m[1], 16) : 16777215;
    }
    function colorForTheme() {
      const c = threeVis.mode === "neural" ? neuralColors2() : constellationColors2();
      return {
        bg: cssHexToInt2(c.bg),
        entity: cssHexToInt2(c.star),
        memory: cssHexToInt2(c.memory),
        link: cssHexToInt2(threeVis.mode === "neural" ? c.light ? "#127464" : "#52d6b5" : c.light ? "#19416c" : "#c6e0ff"),
        pulse: cssHexToInt2(threeVis.mode === "neural" ? c.light ? "#6f6048" : "#fffaf0" : c.memory),
        text: c.text,
        light: c.light
      };
    }
    function makePointTexture(THREE, kind) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      const cx = 64, cy = 64;
      if (kind === "star") {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.28, "rgba(255,255,255,.92)");
        g.addColorStop(0.58, "rgba(255,255,255,.38)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.72)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(cx, 14);
        ctx.lineTo(cx, 114);
        ctx.moveTo(14, cy);
        ctx.lineTo(114, cy);
        ctx.stroke();
      } else if (kind === "neuron") {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 62);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.13, "rgba(255,255,255,.94)");
        g.addColorStop(0.42, "rgba(255,255,255,.28)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 61, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.70)";
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * Math.PI * 2 + 0.13;
          const len = 22 + i % 4 * 4;
          const fork = len * 0.62;
          const sx = cx + Math.cos(a) * 13, sy = cy + Math.sin(a) * 13;
          const mx = cx + Math.cos(a + 0.1 * Math.sin(i)) * fork, my = cy + Math.sin(a + 0.1 * Math.sin(i)) * fork;
          const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
          ctx.lineWidth = i % 3 === 0 ? 2.25 : 1.45;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(mx, my, ex, ey);
          ctx.stroke();
          ctx.lineWidth = 0.9;
          ctx.globalAlpha = 0.72;
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(cx + Math.cos(a + 0.38) * len * 0.66, cy + Math.sin(a + 0.38) * len * 0.66);
          ctx.stroke();
          if (i % 3 === 0) {
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(cx + Math.cos(a - 0.34) * len * 0.6, cy + Math.sin(a - 0.34) * len * 0.6);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        ctx.fillStyle = "rgba(255,255,255,.98)";
        ctx.beginPath();
        ctx.arc(cx, cy, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.54)";
        ctx.beginPath();
        ctx.arc(cx - 8, cy - 9, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "soma") {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 62);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.18, "rgba(255,255,255,.96)");
        g.addColorStop(0.42, "rgba(255,255,255,.34)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 62, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.68)";
        ctx.lineCap = "round";
        ctx.lineWidth = 1.55;
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2 + 0.22, len = 21 + i % 2 * 4;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
          ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
          ctx.stroke();
        }
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.beginPath();
        ctx.arc(cx, cy, 35, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.44, "rgba(255,255,255,.82)");
        g.addColorStop(0.78, "rgba(255,255,255,.22)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    }
    function buildThreePositions(data) {
      if (threeVis.mode === "neural") return buildThreeNeuralPositions(data);
      const nodes = (data.nodes || []).slice(0, 160).map((n) => ({ ...n }));
      const categories = [...new Set(nodes.map((n) => n.category || "Other"))];
      const catIndex = Object.fromEntries(categories.map((c, i) => [c, i]));
      nodes.forEach((n, i) => {
        const cat = n.category || "Other";
        const ci = catIndex[cat] || 0;
        const weight = Math.max(1, Number(n.weight || n.count || 1));
        const shell = n.kind === "memory" ? 1.12 : 0.74 + ci % 3 * 0.1;
        const radius = 285 * shell + i % 7 * 18 + Math.min(46, Math.sqrt(weight) * 5.5);
        const longitude = (i * 137.508 + ci * 23) % 360 * Math.PI / 180;
        const latitudeSeed = ((i * 53 + ci * 29) % 101 + 0.5) / 101;
        const latitude = Math.acos(1 - 2 * latitudeSeed) - Math.PI / 2;
        const radial = Math.cos(latitude);
        const orbitBias = Math.sin(i / Math.max(nodes.length, 1) * Math.PI * 2 + ci * 0.62) * 22;
        n.x = Math.cos(longitude) * radial * radius;
        n.y = Math.sin(latitude) * radius * 0.92 + orbitBias;
        n.z = Math.sin(longitude) * radial * radius * 1.12 + Math.cos(longitude * 1.7 + ci) * 54;
        const sizeJitter = 1 + (i * 37 % 11 - 5) * 0.035;
        n.size = Math.min(42, 9 + Math.sqrt(weight) * 6.2 + (n.kind === "memory" ? 3.5 : 4.5)) * sizeJitter;
        n.twinkle = i % 23 / 23;
        const twinkleTier = i % 17 === 0 ? 2 : i % 5 === 0 ? 1 : 0;
        n.twinkleFreq = twinkleTier === 2 ? 48e-4 + i * 41 % 130 / 1e5 : twinkleTier === 1 ? 24e-4 + i * 47 % 120 / 1e5 : 125e-5 + i * 53 % 110 / 1e5;
        n.twinkleAmp = twinkleTier === 2 ? 0.34 : twinkleTier === 1 ? 0.24 : 0.15 + i * 29 % 70 / 1e3;
        n._degree = 0;
        n._weight = weight;
      });
      return nodes;
    }
    function buildThreeNeuralPositions(data) {
      const nodes = (data.nodes || []).slice(0, 170).map((n) => ({ ...n }));
      const nodeIds = new Set(nodes.map((n) => n.id));
      const edges = (data.edges || []).filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)).slice(0, 340);
      const categories = [...new Set(nodes.map((n) => n.category || "Other"))];
      const catIndex = Object.fromEntries(categories.map((c, i) => [c, i]));
      const regionCount = Math.max(1, categories.length);
      const regions = Object.fromEntries(categories.map((cat, i) => {
        const angle = -Math.PI / 2 + i / regionCount * Math.PI * 2;
        const radius = regionCount <= 2 ? 86 : i === regionCount - 1 && regionCount > 5 ? 70 : 142 + i % 2 * 18;
        const lap = Math.floor(i / Math.max(1, regionCount));
        return [cat, {
          label: cat,
          angle,
          cx: Math.cos(angle) * radius + lap * 18,
          cy: Math.sin(angle) * radius * 0.96,
          cz: (i * 41 % 89 - 44) * 0.72,
          spread: 94 + i % 4 * 10
        }];
      }));
      const degree = /* @__PURE__ */ new Map();
      edges.forEach((e) => {
        degree.set(e.source, (degree.get(e.source) || 0) + 1);
        degree.set(e.target, (degree.get(e.target) || 0) + 1);
      });
      const hubsByCategory = {};
      nodes.filter((n) => n.kind !== "memory").sort((a, b) => Number(b.weight || b.count || 0) + (degree.get(b.id) || 0) - (Number(a.weight || a.count || 0) + (degree.get(a.id) || 0))).forEach((n) => {
        const cat = n.category || "Other";
        if (!hubsByCategory[cat]) hubsByCategory[cat] = [];
        hubsByCategory[cat].push(n);
      });
      const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
      nodes.forEach((n, i) => {
        const cat = n.category || "Other";
        const region = regions[cat] || regions.Other || { cx: 0, cy: 0, cz: 0, angle: 0, spread: 80 };
        const ci = catIndex[cat] || 0;
        const weight = Math.max(1, Number(n.weight || n.count || 1));
        const d = degree.get(n.id) || 0;
        if (n.kind === "memory") {
          const linked = edges.find((e) => e.source === n.id || e.target === n.id);
          const parent = linked ? byId[linked.source === n.id ? linked.target : linked.source] : null;
          const parentX = parent && parent.kind !== "memory" && Number.isFinite(parent.x) ? parent.x : region.cx;
          const parentY = parent && parent.kind !== "memory" && Number.isFinite(parent.y) ? parent.y : region.cy;
          const parentZ = parent && parent.kind !== "memory" && Number.isFinite(parent.z) ? parent.z : region.cz;
          const branch = (i * 137.508 + ci * 19) % 360 * Math.PI / 180;
          const yUnit = ((i * 43 + ci * 17) % 97 + 0.5) / 97 * 2 - 1;
          const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
          const dist = 46 + i % 6 * 13 + Math.min(48, Math.sqrt(weight) * 10);
          n.x = parentX + Math.cos(branch) * radial * dist;
          n.y = parentY + yUnit * dist * 0.82;
          n.z = parentZ + Math.sin(branch) * radial * dist * 0.86;
        } else {
          const rank = Math.max(0, (hubsByCategory[cat] || []).indexOf(n));
          const orbit = rank === 0 ? 0 : 30 + Math.sqrt(rank) * 20;
          const angle = region.angle + rank * 2.399963 + ci % 3 * 0.24;
          const yUnit = rank === 0 ? 0 : ((rank * 37 + ci * 11) % 89 + 0.5) / 89 * 2 - 1;
          const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
          n.x = region.cx + Math.cos(angle) * radial * orbit;
          n.y = region.cy + yUnit * orbit * 0.86;
          n.z = region.cz + Math.sin(angle) * radial * orbit * 0.8;
        }
        n.size = Math.min(30, 8 + Math.sqrt(weight + d) * (n.kind === "memory" ? 3.2 : 4.1));
        n._degree = d;
        n._weight = weight;
        n.neuralRegion = cat;
      });
      threeVis.neuralRegions = Object.values(regions);
      return nodes;
    }
    function limitedThreeEdges(data, byId, mobile = false) {
      const degree = /* @__PURE__ */ new Map();
      const out = [];
      const limit = threeVis.mode === "neural" ? 132 : mobile ? 92 : 140;
      const degreeLimit = threeVis.mode === "neural" ? 5 : mobile ? 3 : 4;
      for (const e of data.edges || []) {
        const a = byId.get(e.source), b = byId.get(e.target);
        if (!a || !b) continue;
        const da = degree.get(e.source) || 0, db = degree.get(e.target) || 0;
        if (da >= degreeLimit || db >= degreeLimit) continue;
        degree.set(e.source, da + 1);
        degree.set(e.target, db + 1);
        a._degree++;
        b._degree++;
        out.push({ ...e, a, b });
        if (out.length >= limit) break;
      }
      return out;
    }
    function neuralAuraOverlay(regions) {
      if (threeVis.mode !== "neural") return "";
      const regionList = (regions || []).slice(0, 9);
      return `<div class="three-aura-layer">${regionList.map((r, i) => `<span class="three-aura-oval" data-region="${esc2(r.label || "")}" style="opacity:0;transform:translate(-50%,-50%) rotate(${(Number(r.angle || 0) * 28).toFixed(1)}deg)"></span>`).join("")}</div>`;
    }
    function makeAuraOvalTexture(THREE) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 320;
      const ctx = canvas.getContext("2d");
      const cx = 256, cy = 160;
      const g = ctx.createRadialGradient(cx, cy, 12, cx, cy, 230);
      g.addColorStop(0, "rgba(102,232,198,.24)");
      g.addColorStop(0.52, "rgba(102,232,198,.13)");
      g.addColorStop(1, "rgba(102,232,198,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 238, 142, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(102,232,198,.16)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, 88 + i * 48, 46 + i * 28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    }
    function addNeuralAuraOvals(THREE, group, regions, colors) {
      const texture = makeAuraOvalTexture(THREE);
      (regions || []).slice(0, 10).forEach((region, i) => {
        const material = new THREE.SpriteMaterial({ map: texture, color: colors.entity, transparent: true, opacity: colors.light ? 0.13 : 0.18, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, rotation: (region.angle || 0) * 0.42 });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(region.cx || 0, region.cy || 0, (region.cz || 0) - 18 - i * 0.8);
        const spread = region.spread || 86;
        sprite.scale.set(spread * (3.9 + i % 3 * 0.35), spread * (2.35 + i % 2 * 0.22), 1);
        sprite.renderOrder = -10 + i;
        group.add(sprite);
      });
    }
    function addHaloPoints(THREE, scene, nodes, kind, color, size) {
      let selected = nodes.filter((n) => n.kind === "memory" === (kind === "memory"));
      if (threeVis.mode !== "neural") {
        selected = selected.filter((n) => {
          const weight = Math.max(1, Number(n.weight || n.count || 1));
          return weight > (kind === "memory" ? 3.6 : 4.4) || Number(n._degree || 0) > 3;
        }).sort((a, b) => Math.max(1, Number(b.weight || b.count || 1)) + Number(b._degree || 0) - (Math.max(1, Number(a.weight || a.count || 1)) + Number(a._degree || 0))).slice(0, kind === "memory" ? 30 : 44);
      }
      const positions = new Float32Array(selected.length * 3);
      selected.forEach((n, i) => {
        positions[i * 3] = n.x;
        positions[i * 3 + 1] = n.y;
        positions[i * 3 + 2] = n.z;
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const themeColors = colorForTheme();
      const isNeural = threeVis.mode === "neural";
      const opacity = isNeural ? kind === "memory" ? themeColors.light ? 0.16 : 0.28 : themeColors.light ? 0.18 : 0.34 : kind === "memory" ? themeColors.light ? 0.12 : 0.24 : themeColors.light ? 0.13 : 0.26;
      const material = new THREE.PointsMaterial({ color, map: makePointTexture(THREE, "orb"), alphaTest: 0.015, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, blending: themeColors.light ? THREE.NormalBlending : THREE.AdditiveBlending });
      const points = new THREE.Points(geometry, material);
      scene.add(points);
      return points;
    }
    function addNeuralDendrites(THREE, group, nodes, colors) {
      const trunks = [];
      const twigs = [];
      const tips = [];
      nodes.slice(0, 150).forEach((n, i) => {
        const arms = n.kind === "memory" ? 3 : 6;
        const base = n.kind === "memory" ? 10 : 17;
        for (let a = 0; a < arms; a++) {
          const theta = a / arms * Math.PI * 2 + i % 11 * 0.19;
          const phi = Math.sin(i * 0.37 + a) * 0.58;
          const len = base + (i + a * 13) % 9;
          const mid = [n.x + Math.cos(theta + 0.16) * Math.cos(phi) * len * 0.5, n.y + Math.sin(phi) * len * 0.36, n.z + Math.sin(theta + 0.16) * Math.cos(phi) * len * 0.5];
          const end = [n.x + Math.cos(theta) * Math.cos(phi) * len * 0.78, n.y + Math.sin(phi) * len * 0.54, n.z + Math.sin(theta) * Math.cos(phi) * len * 0.78];
          trunks.push(n.x, n.y, n.z, mid[0], mid[1], mid[2], mid[0], mid[1], mid[2], end[0], end[1], end[2]);
          if (n.kind !== "memory" && a % 2 === 0) {
            const side = theta + (a % 2 ? 0.44 : -0.4);
            const fork = [mid[0] + Math.cos(side) * len * 0.18, mid[1] + Math.sin(phi + 0.25) * len * 0.12, mid[2] + Math.sin(side) * len * 0.18];
            twigs.push(mid[0], mid[1], mid[2], fork[0], fork[1], fork[2]);
          }
          if (i % 3 === 0 && a % 2 === 0) tips.push(end[0], end[1], end[2]);
        }
      });
      const trunkGeom = new THREE.BufferGeometry();
      trunkGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(trunks), 3));
      group.add(new THREE.LineSegments(trunkGeom, new THREE.LineBasicMaterial({ color: colors.entity, transparent: true, opacity: colors.light ? 0.34 : 0.36, blending: colors.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false })));
      const twigGeom = new THREE.BufferGeometry();
      twigGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(twigs), 3));
      group.add(new THREE.LineSegments(twigGeom, new THREE.LineBasicMaterial({ color: colors.link, transparent: true, opacity: colors.light ? 0.28 : 0.24, blending: colors.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false })));
      const tipGeom = new THREE.BufferGeometry();
      tipGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tips), 3));
      group.add(new THREE.Points(tipGeom, new THREE.PointsMaterial({ color: colors.entity, map: makePointTexture(THREE, "orb"), alphaTest: 0.03, size: 3.8, transparent: true, opacity: colors.light ? 0.54 : 0.72, depthWrite: false, blending: colors.light ? THREE.NormalBlending : THREE.AdditiveBlending })));
    }
    function addPoints(THREE, scene, nodes, kind, color, size) {
      const selected = nodes.filter((n) => n.kind === "memory" === (kind === "memory"));
      const positions = new Float32Array(selected.length * 3);
      const sizes = new Float32Array(selected.length);
      const phases = new Float32Array(selected.length);
      const freqs = new Float32Array(selected.length);
      const amps = new Float32Array(selected.length);
      const majors = new Float32Array(selected.length);
      selected.forEach((n, i) => {
        const weight = Math.max(1, Number(n.weight || n.count || 1));
        positions[i * 3] = n.x;
        positions[i * 3 + 1] = n.y;
        positions[i * 3 + 2] = n.z;
        const degreeBoost = Math.min(10, Number(n._degree || 0) * 1.9);
        const variedSize = (n.size || size) + degreeBoost;
        sizes[i] = Math.max(size * 1.14, Math.min(size * 2.65, variedSize * 1.62));
        phases[i] = (n.twinkle || 0) * Math.PI * 2;
        freqs[i] = n.twinkleFreq || 12e-4;
        amps[i] = n.twinkleAmp || 0.12;
        majors[i] = weight > 6.2 || kind === "memory" && weight > 4.8 ? 1 : 0;
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
      geometry.setAttribute("aFreq", new THREE.BufferAttribute(freqs, 1));
      geometry.setAttribute("aAmp", new THREE.BufferAttribute(amps, 1));
      geometry.setAttribute("aMajor", new THREE.BufferAttribute(majors, 1));
      const themeColors = colorForTheme();
      let material;
      if (threeVis.mode === "neural") {
        material = new THREE.PointsMaterial({ color, map: makePointTexture(THREE, kind === "memory" ? "soma" : "neuron"), alphaTest: 0.04, size, sizeAttenuation: true, transparent: true, opacity: kind === "memory" ? themeColors.light ? 0.88 : 0.98 : themeColors.light ? 0.76 : 0.86, depthWrite: false, blending: themeColors.light ? THREE.NormalBlending : THREE.AdditiveBlending });
      } else {
        material = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uScale: { value: 420 },
            uColor: { value: new THREE.Color(color) },
            uIsStar: { value: kind === "memory" ? 0 : 1 },
            uOpacity: { value: kind === "memory" ? 0.98 : 0.96 }
          },
          vertexShader: `
          attribute float aSize;
          attribute float aPhase;
          attribute float aFreq;
          attribute float aAmp;
          attribute float aMajor;
          uniform float uTime;
          uniform float uScale;
          varying float vPulse;
          varying float vMajor;
          void main(){
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float wave = sin(uTime * aFreq + aPhase) + sin(uTime * aFreq * 0.43 + aPhase * 1.71) * 0.45;
            vPulse = 1.0 + wave * aAmp;
            vMajor = aMajor;
            gl_PointSize = aSize * (0.98 + (vPulse - 1.0) * 0.32) * (uScale / max(72.0, -mvPosition.z));
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
          fragmentShader: `
          uniform vec3 uColor;
          uniform float uIsStar;
          uniform float uOpacity;
          varying float vPulse;
          varying float vMajor;
          void main(){
            vec2 p = gl_PointCoord - vec2(0.5);
            float d = length(p);
            if(d > 0.5) discard;
            float core = 1.0 - smoothstep(0.026, 0.060, d);
            float body = 1.0 - smoothstep(0.060, 0.135, d);
            float halo = (1.0 - smoothstep(0.13, 0.48, d)) * (0.15 + clamp(vPulse - 1.0, -0.30, 0.46) * 0.82);
            float rayH = max(0.0, 1.0 - abs(p.y) / 0.010) * (1.0 - smoothstep(0.07, 0.44, abs(p.x)));
            float rayV = max(0.0, 1.0 - abs(p.x) / 0.010) * (1.0 - smoothstep(0.07, 0.44, abs(p.y)));
            float diag1 = max(0.0, 1.0 - abs(p.x - p.y) / 0.013) * (1.0 - smoothstep(0.06, 0.26, d));
            float diag2 = max(0.0, 1.0 - abs(p.x + p.y) / 0.013) * (1.0 - smoothstep(0.06, 0.26, d));
            float rays = vMajor * (max(rayH, rayV) * 0.50 + max(diag1, diag2) * 0.16);
            float alpha = (body * 0.46 + core * 1.02 + halo + rays) * uOpacity * clamp(0.72 + (vPulse - 1.0) * 0.92, 0.46, 1.35);
            if(alpha < 0.022) discard;
            vec3 starCore = mix(uColor, vec3(1.0), core * 0.88 + rays * 0.38);
            vec3 memoryCore = mix(uColor, vec3(1.0), core * 0.34);
            vec3 crisp = mix(memoryCore, starCore, uIsStar);
            gl_FragColor = vec4(crisp * (0.92 + (vPulse - 1.0) * 0.22), min(alpha, 1.0));
          }
        `,
          transparent: true,
          depthWrite: false,
          blending: THREE.NormalBlending
        });
      }
      const points = new THREE.Points(geometry, material);
      points.userData.nodes = selected;
      scene.add(points);
      return points;
    }
    function buildThreeLinkSegments(THREE, edges) {
      const positions = [];
      edges.forEach((e, i) => {
        if (threeVis.mode === "neural") {
          const ax = e.a.x, ay = e.a.y, az = e.a.z, bx = e.b.x, by = e.b.y, bz = e.b.z;
          const dx = bx - ax, dy = by - ay, dz = bz - az;
          const len = Math.max(1, Math.hypot(dx, dy, dz));
          const bend = (i % 2 ? 1 : -1) * Math.min(58, 18 + len * 0.12);
          const cx = (ax + bx) / 2 + -dy / len * bend;
          const cy = (ay + by) / 2 + dx / len * bend * 0.55 + Math.sin(i * 0.71) * 18;
          const cz = (az + bz) / 2 + Math.cos(i * 0.53) * bend * 0.72;
          e._curve = { cx, cy, cz };
          let px = ax, py = ay, pz = az;
          for (let step = 1; step <= 7; step++) {
            const t = step / 7, inv = 1 - t;
            const x = inv * inv * ax + 2 * inv * t * cx + t * t * bx;
            const y = inv * inv * ay + 2 * inv * t * cy + t * t * by;
            const z = inv * inv * az + 2 * inv * t * cz + t * t * bz;
            positions.push(px, py, pz, x, y, z);
            px = x;
            py = y;
            pz = z;
          }
        } else {
          positions.push(e.a.x, e.a.y, e.a.z, e.b.x, e.b.y, e.b.z);
        }
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
      return geometry;
    }
    async function renderThreeVisualiser(data) {
      const THREE = await loadThreeModule2();
      clearThreeScene2();
      threeVis.data = data;
      updateThreeUI();
      threeInspectorDefault2();
      const viewport = $2("#threeViewport");
      if (!viewport) return;
      const colors = colorForTheme();
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch (err) {
        $2("#threeViewport").classList.add("three-fallback");
        $2("#threeLabels").innerHTML = `<div class="three-fallback-card"><h3>3D visualiser unavailable</h3><p>The original Visualiser remains available for this browser.</p></div>`;
        $2("#threeInspector").innerHTML = `<div class="inspector-kicker">Constellation inspector</div><h3>3D visualiser unavailable</h3><p class="muted">Try the original Visualiser, or reopen this page in a browser that supports the 3D view.</p>`;
        return;
      }
      $2("#threeViewport").classList.remove("three-fallback");
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(colors.bg, 0);
      viewport.prepend(renderer.domElement);
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(colors.bg, threeVis.mode === "neural" ? 11e-4 : 9e-4);
      const mobileThree = (viewport.getBoundingClientRect?.().width || 650) < 520;
      const camera = new THREE.PerspectiveCamera(48, 1, 1, 5e3);
      const group = new THREE.Group();
      scene.add(group);
      const ambient = new THREE.AmbientLight(16777215, 0.55);
      scene.add(ambient);
      const light = new THREE.PointLight(colors.entity, 1.2, 1200);
      light.position.set(180, 220, 260);
      scene.add(light);
      const nodes = buildThreePositions(data);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const edges = limitedThreeEdges(data, byId, mobileThree);
      const linkGeom = buildThreeLinkSegments(THREE, edges);
      const linkMaterial = threeVis.mode === "neural" ? new THREE.LineBasicMaterial({ color: colors.link, transparent: true, opacity: colors.light ? 0.3 : 0.4, blending: colors.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false }) : new THREE.LineDashedMaterial({ color: colors.link, transparent: true, opacity: colors.light ? mobileThree ? 0.14 : 0.16 : mobileThree ? 0.13 : 0.12, dashSize: 9, gapSize: 8, blending: THREE.NormalBlending, depthWrite: false });
      const linkLines = new THREE.LineSegments(linkGeom, linkMaterial);
      if (threeVis.mode !== "neural") linkLines.computeLineDistances();
      group.add(linkLines);
      if (threeVis.mode === "neural") {
        addHaloPoints(THREE, group, nodes, "entity", colors.entity, 50);
        addHaloPoints(THREE, group, nodes, "memory", colors.memory, 48);
        addNeuralDendrites(THREE, group, nodes, colors);
      } else {
      }
      group.add(addPoints(THREE, group, nodes, "entity", colors.entity, threeVis.mode === "neural" ? 30 : 52));
      group.add(addPoints(THREE, group, nodes, "memory", colors.memory, threeVis.mode === "neural" ? 26 : 50));
      const starCount = threeVis.mode === "neural" ? 360 : 420;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 600 + i * 37 % 480, a = i * 2.17, b = (i * 53 % 180 - 90) * Math.PI / 180;
        starPositions.set([Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r], i * 3);
      }
      const starGeom = new THREE.BufferGeometry();
      starGeom.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
      scene.add(new THREE.Points(starGeom, new THREE.PointsMaterial({ color: 16777215, map: makePointTexture(THREE, "orb"), alphaTest: 0.04, size: 1.25, transparent: true, opacity: threeVis.mode === "neural" ? 0.38 : 0.24, depthWrite: false })));
      const pulseEdges = threeVis.mode === "neural" ? edges.slice(0, 90) : [];
      const pulseGeom = new THREE.BufferGeometry();
      const pulsePositions = new Float32Array(pulseEdges.length * 3);
      pulseGeom.setAttribute("position", new THREE.BufferAttribute(pulsePositions, 3));
      const pulsePoints = new THREE.Points(pulseGeom, new THREE.PointsMaterial({ color: colors.pulse, map: makePointTexture(THREE, "star"), alphaTest: 0.03, size: threeVis.mode === "neural" ? 10.5 : 5.2, transparent: true, opacity: threeVis.mode === "neural" ? colors.light ? 0.54 : 0.98 : 0.85, depthWrite: false, depthTest: false, blending: colors.light ? THREE.NormalBlending : THREE.AdditiveBlending }));
      group.add(pulsePoints);
      const labelNodes = nodes.filter((n) => !/^[a-f0-9]{10,}$/i.test(String(n.label || ""))).sort((a, b) => b._degree + b._weight - (a._degree + a._weight)).slice(0, threeVis.mode === "neural" ? 72 : 56);
      $2("#threeLabels").innerHTML = neuralAuraOverlay(threeVis.neuralRegions) + labelNodes.map((n, i) => `<span class="three-label ${n.kind === "memory" ? "memory" : ""}" data-i="${i}">${esc2(String(n.label || "").replace(/^memory:/, "mem ").slice(0, 24))}</span>`).join("");
      Object.assign(threeVis, { THREE, renderer, scene, camera, group, nodes, edgePairs: edges, labels: labelNodes, pulses: pulseEdges, pulsePoints, paused: prefersReducedMotion2() });
      $2("#threeClusters").innerHTML = (data.clusters || []).map((c) => `<span class="cluster-pill">${esc2(c.label)} <strong>${Number(c.count).toLocaleString()}</strong></span>`).join("");
      resetThreeCamera2();
      bindThreeControls();
      resizeThree2();
      updateThreeUI();
      animateThree(0);
    }
    function resizeThree2() {
      if (!threeVis.renderer) return;
      const viewport = $2("#threeViewport");
      const rect = viewport.getBoundingClientRect();
      const w = Math.max(320, rect.width), h = Math.max(320, rect.height);
      threeVis.renderer.setSize(w, h, false);
      threeVis.camera.aspect = w / h;
      threeVis.camera.updateProjectionMatrix();
    }
    function threeEffectiveCameraZ(rect) {
      const box = rect || $2("#threeViewport")?.getBoundingClientRect?.() || { width: 650, height: 650 };
      const fill = visualiserResponsiveFill2(box.width, box.height);
      const mobile = box.width < 760 || box.height < 520;
      return threeVis.cameraZ / (mobile ? 1 : fill);
    }
    function updateThreeAuras(rect, projectVector) {
      if (threeVis.mode !== "neural") return;
      const mobile = rect.width < 520;
      $$2("#threeLabels .three-aura-oval").forEach((el) => {
        const region = el.dataset.region || "";
        const pts = threeVis.nodes.filter((n) => n.neuralRegion === region);
        const screens = [];
        pts.forEach((n) => {
          projectVector.set(n.x, n.y, n.z).applyMatrix4(threeVis.group.matrixWorld).project(threeVis.camera);
          if (projectVector.z < 1 && projectVector.z > -1) screens.push({ x: (projectVector.x * 0.5 + 0.5) * rect.width, y: (-projectVector.y * 0.5 + 0.5) * rect.height });
        });
        if (screens.length < 2) {
          el.style.opacity = "0";
          return;
        }
        const xs = screens.map((p) => p.x), ys = screens.map((p) => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        const maxW = mobile ? rect.width * 0.62 : Math.min(340, rect.width * 0.34);
        const maxH = mobile ? rect.height * 0.3 : Math.min(230, rect.height * 0.26);
        const w = Math.max(mobile ? 92 : 128, Math.min(maxW, maxX - minX + (mobile ? 46 : 74)));
        const h = Math.max(mobile ? 58 : 78, Math.min(maxH, maxY - minY + (mobile ? 34 : 56)));
        el.style.left = `${cx}px`;
        el.style.top = `${cy}px`;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        el.style.opacity = screens.length > 4 ? ".42" : ".28";
      });
    }
    function updateThreeLabels() {
      if (!threeVis.camera || !threeVis.group) return;
      const viewport = $2("#threeViewport");
      const rect = viewport.getBoundingClientRect();
      const v = new threeVis.THREE.Vector3();
      updateThreeAuras(rect, v);
      const labelBoxes = [];
      const effectiveCameraZ = threeEffectiveCameraZ(rect);
      const zoomReveal = threeVis.mode === "neural" ? Math.max(0, Math.min(1, (900 - effectiveCameraZ) / 420)) : Math.max(0, Math.min(1, (760 - effectiveCameraZ) / 520));
      const maxLabels = threeVis.mode === "neural" ? (rect.width < 520 ? 14 : 24) + Math.round(zoomReveal * (rect.width < 520 ? 14 : 18)) : rect.width < 520 ? 12 + Math.round(zoomReveal * 12) : 20 + Math.round(zoomReveal * 18);
      let shown = 0;
      $$2("#threeLabels .three-label").forEach((el, i) => {
        const n = threeVis.labels[i];
        if (!n) return;
        v.set(n.x, n.y, n.z).applyMatrix4(threeVis.group.matrixWorld).project(threeVis.camera);
        const sx = (v.x * 0.5 + 0.5) * rect.width, sy = (-v.y * 0.5 + 0.5) * rect.height;
        const visible = v.z < 1 && v.z > -1 && sx > 8 && sx < rect.width - 8 && sy > 8 && sy < rect.height - 8;
        const pulse = threeVis.mode === "neural" && i > 3 ? Math.sin((threeVis.lastT || 0) * 32e-5 + i * 1.73) : 1;
        const box = { x: sx - 54, y: sy - 13, w: 108, h: 24 };
        const collides = labelBoxes.some((b) => !(box.x + box.w < b.x || b.x + b.w < box.x || box.y + box.h < b.y || b.y + b.h < box.y));
        const show = visible && shown < maxLabels && !collides && (threeVis.mode !== "neural" || i <= 3 || pulse > 0.08);
        el.style.display = show ? "" : "none";
        if (show) {
          shown++;
          labelBoxes.push(box);
          el.style.left = `${sx}px`;
          el.style.top = `${sy}px`;
          const depthAlpha = Math.max(0.32, Math.min(0.86, 1 - Math.abs(v.z) * 0.35));
          const pulseAlpha = threeVis.mode === "neural" && i > 3 ? Math.min(0.78, 0.38 + pulse * 0.36) : depthAlpha;
          el.style.opacity = String(Math.min(depthAlpha, pulseAlpha));
        }
      });
    }
    function animateThree(t = 0) {
      if (!threeVis.renderer) return;
      resizeThree2();
      const delta = threeVis.lastT ? Math.min(48, t - threeVis.lastT) : 16;
      threeVis.lastT = t;
      if (!threeVis.paused && !threeVis.drag) threeVis.yaw += delta * (threeVis.mode === "neural" ? 9e-5 : 55e-6);
      clampThreeCamera();
      threeVis.group.rotation.y = threeVis.yaw;
      threeVis.group.rotation.x = threeVis.pitch;
      const viewport = $2("#threeViewport");
      const rect = viewport?.getBoundingClientRect?.() || { width: 650, height: 650 };
      const effectiveCameraZ = threeEffectiveCameraZ(rect);
      threeVis.camera.position.set(threeVis.panX, threeVis.panY, effectiveCameraZ);
      threeVis.camera.lookAt(threeVis.panX, threeVis.panY, 0);
      if (threeVis.pulsePoints && !threeVis.paused) {
        const attr = threeVis.pulsePoints.geometry.attributes.position;
        const arr = attr.array;
        threeVis.pulses.forEach((e, i) => {
          const phase = (t * 3e-4 + i % 17 / 17) % 1;
          const inv = 1 - phase;
          if (e._curve) {
            arr[i * 3] = inv * inv * e.a.x + 2 * inv * phase * e._curve.cx + phase * phase * e.b.x;
            arr[i * 3 + 1] = inv * inv * e.a.y + 2 * inv * phase * e._curve.cy + phase * phase * e.b.y;
            arr[i * 3 + 2] = inv * inv * e.a.z + 2 * inv * phase * e._curve.cz + phase * phase * e.b.z;
          } else {
            arr[i * 3] = e.a.x + (e.b.x - e.a.x) * phase;
            arr[i * 3 + 1] = e.a.y + (e.b.y - e.a.y) * phase;
            arr[i * 3 + 2] = e.a.z + (e.b.z - e.a.z) * phase;
          }
        });
        attr.needsUpdate = true;
      }
      if (!threeVis.paused) threeVis.scene.traverse((obj) => {
        if (obj.isPoints && obj.material?.uniforms?.uTime) {
          obj.material.uniforms.uTime.value = t;
          obj.material.uniforms.uScale.value = Math.max(360, Math.min(820, threeVis.renderer.domElement.clientHeight || 420));
        }
      });
      threeVis.renderer.render(threeVis.scene, threeVis.camera);
      updateThreeLabels();
      threeVis.frame = document.hidden ? 0 : requestAnimationFrame(animateThree);
    }
    async function loadThreeVisualiser2() {
      const labels = $2("#threeLabels");
      if (labels) labels.innerHTML = '<div class="three-loading-card"><h3>Loading 3D visualiser…</h3><p>Fetching the render engine and memory graph.</p></div>';
      try {
        renderThreeVisualiser(await api2("/api/constellation?limit=320"));
      } catch (e) {
        if (isCancelledRequest3(e)) return;
        if (labels) labels.innerHTML = `<div class="three-fallback-card"><h3>Could not load the 3D visualiser</h3><p>${esc2(e.message || "Try again.")}</p></div>`;
      }
    }
    function switchThreeMode2(mode) {
      threeVis.mode = mode === "neural" ? "neural" : "constellation";
      if (threeVis.data) renderThreeVisualiser(threeVis.data);
      else loadThreeVisualiser2();
    }
    function clampThreeCamera() {
      const viewport = $2("#threeViewport");
      const rect = viewport?.getBoundingClientRect?.() || { width: 650, height: 650 };
      const fallbackZ = threeVis.mode === "neural" ? 600 : 760;
      const minCameraZ = fallbackZ / 10;
      threeVis.cameraZ = Math.max(minCameraZ, Math.min(1800, Number.isFinite(threeVis.cameraZ) ? threeVis.cameraZ : fallbackZ));
      threeVis.yaw = Number.isFinite(threeVis.yaw) ? threeVis.yaw : 0;
      threeVis.pitch = Math.max(-1.15, Math.min(1.15, Number.isFinite(threeVis.pitch) ? threeVis.pitch : 0.32));
      const zoomFactor = 900 / Math.max(80, threeVis.cameraZ);
      const panLimitX = Math.max(120, rect.width * (0.45 + zoomFactor * 0.18));
      const panLimitY = Math.max(120, rect.height * (0.34 + zoomFactor * 0.12));
      threeVis.panX = Math.max(-panLimitX, Math.min(panLimitX, Number.isFinite(threeVis.panX) ? threeVis.panX : 0));
      threeVis.panY = Math.max(-panLimitY, Math.min(panLimitY, Number.isFinite(threeVis.panY) ? threeVis.panY : 0));
    }
    function bindThreeControls() {
      const viewport = $2("#threeViewport");
      if (!viewport || viewport.dataset.controlsBound === "true") return;
      viewport.dataset.controlsBound = "true";
      const pointers = threeVis.pointer || /* @__PURE__ */ new Map();
      threeVis.pointer = pointers;
      const dist = () => {
        const ps = [...pointers.values()];
        return ps.length < 2 ? 1 : Math.max(1, Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y));
      };
      const center = () => {
        const ps = [...pointers.values()];
        return ps.length < 2 ? { x: 0, y: 0 } : { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      };
      viewport.addEventListener("contextmenu", (e) => e.preventDefault());
      viewport.addEventListener("wheel", (e) => {
        if (e.cancelable) e.preventDefault();
        threeVis.cameraZ *= Math.exp(e.deltaY * 1e-3);
        clampThreeCamera();
      }, { passive: false });
      viewport.addEventListener("pointerdown", (e) => {
        if (e.cancelable) e.preventDefault();
        try {
          viewport.setPointerCapture?.(e.pointerId);
        } catch (_err) {
        }
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size >= 2) {
          const c = center();
          threeVis.drag = { mode: "pinch", x: c.x, y: c.y, dist: dist(), cameraZ: threeVis.cameraZ, panX: threeVis.panX, panY: threeVis.panY, moved: false };
        } else threeVis.drag = { mode: "drag", x: e.clientX, y: e.clientY, yaw: threeVis.yaw, pitch: threeVis.pitch, panX: threeVis.panX, panY: threeVis.panY, moved: false };
        viewport.style.cursor = "grabbing";
      }, { passive: false });
      viewport.addEventListener("pointermove", (e) => {
        if (!pointers.has(e.pointerId) || !threeVis.drag) return;
        if (e.cancelable) e.preventDefault();
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const d = threeVis.drag;
        if (d.mode === "pinch") {
          if (pointers.size < 2) return;
          const c = center();
          const scale = dist() / Math.max(1, d.dist);
          threeVis.cameraZ = d.cameraZ / Math.max(0.35, Math.min(2.8, scale));
          threeVis.panX = d.panX - (c.x - d.x) * 0.72;
          threeVis.panY = d.panY + (c.y - d.y) * 0.72;
          d.moved = d.moved || Math.abs(c.x - d.x) + Math.abs(c.y - d.y) > 3 || Math.abs(scale - 1) > 0.015;
          clampThreeCamera();
          return;
        }
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        if (threeVis.panMode || e.shiftKey) {
          threeVis.panX = d.panX - dx * 0.7;
          threeVis.panY = d.panY + dy * 0.7;
        } else {
          threeVis.yaw = d.yaw + dx * 6e-3;
          threeVis.pitch = d.pitch + dy * 4e-3;
        }
        clampThreeCamera();
      }, { passive: false });
      const end = (e) => {
        pointers.delete(e.pointerId);
        if (threeVis.drag?.moved) viewport.dataset.suppressClick = "true";
        if (pointers.size === 1) {
          const p = [...pointers.values()][0];
          threeVis.drag = { mode: "drag", x: p.x, y: p.y, yaw: threeVis.yaw, pitch: threeVis.pitch, panX: threeVis.panX, panY: threeVis.panY, moved: true };
        } else {
          threeVis.drag = null;
          viewport.style.cursor = "grab";
        }
      };
      viewport.addEventListener("pointerup", end);
      viewport.addEventListener("pointercancel", end);
      viewport.addEventListener("pointerleave", end);
      viewport.addEventListener("click", (e) => {
        if (viewport.dataset.suppressClick === "true") {
          viewport.dataset.suppressClick = "false";
          return;
        }
        pickThreeNode(e);
      });
      viewport.addEventListener("keydown", (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const panStep = e.shiftKey || threeVis.panMode ? 34 : 0;
        const rotateStep = e.shiftKey || threeVis.panMode ? 0 : 0.075;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (panStep) threeVis.panX -= panStep;
          else threeVis.yaw -= rotateStep;
          clampThreeCamera();
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          if (panStep) threeVis.panX += panStep;
          else threeVis.yaw += rotateStep;
          clampThreeCamera();
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (panStep) threeVis.panY += panStep;
          else threeVis.pitch = Math.max(-1.15, threeVis.pitch - rotateStep);
          clampThreeCamera();
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (panStep) threeVis.panY -= panStep;
          else threeVis.pitch = Math.min(1.15, threeVis.pitch + rotateStep);
          clampThreeCamera();
          return;
        }
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          threeVis.cameraZ /= 1.14;
          clampThreeCamera();
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          threeVis.cameraZ *= 1.14;
          clampThreeCamera();
          return;
        }
        if (e.key.toLowerCase() === "r") {
          e.preventDefault();
          resetThreeCamera2();
          threeInspectorDefault2();
          return;
        }
        if (e.key.toLowerCase() === "p") {
          e.preventDefault();
          togglePause();
        }
      });
    }
    function pickThreeNode(e) {
      if (!threeVis.camera || !threeVis.group) return;
      const rect = $2("#threeViewport").getBoundingClientRect();
      const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
      const v = new threeVis.THREE.Vector3();
      let best = null, bestD = Infinity;
      for (const n of threeVis.nodes) {
        v.set(n.x, n.y, n.z).applyMatrix4(threeVis.group.matrixWorld).project(threeVis.camera);
        if (v.z < -1 || v.z > 1) continue;
        const sx = (v.x * 0.5 + 0.5) * rect.width, sy = (-v.y * 0.5 + 0.5) * rect.height;
        const d = Math.hypot(sx - mouseX, sy - mouseY);
        if (d < bestD && d < 18) {
          bestD = d;
          best = n;
        }
      }
      if (best) inspectThreeNode(best);
    }
    function togglePanMode() {
      threeVis.panMode = !threeVis.panMode;
      updateThreeUI();
    }
    function togglePause() {
      threeVis.paused = !threeVis.paused;
      updateThreeUI();
    }
    return {
      loadThreeVisualiser: loadThreeVisualiser2,
      resetThreeCamera: resetThreeCamera2,
      threeInspectorDefault: threeInspectorDefault2,
      clearThreeScene: clearThreeScene2,
      resizeThree: resizeThree2,
      switchThreeMode: switchThreeMode2,
      updateThreeUI,
      togglePanMode,
      togglePause,
      isRendering: () => Boolean(threeVis.renderer),
      resume: () => {
        if (threeVis.renderer && !threeVis.frame) threeVis.frame = requestAnimationFrame(animateThree);
      }
    };
  }

  // static/src/visualisers/memory-palace.js
  function createMemoryPalaceVisualiser({
    $: $2,
    $$: $$2,
    api: api2,
    esc: esc2,
    openMemoryDetail: openMemoryDetail2,
    loadThreeModule: loadThreeModule2,
    cssHexToInt: cssHexToInt2,
    constellationColors: constellationColors2,
    prefersReducedMotion: prefersReducedMotion2,
    isCancelledRequest: isCancelledRequest3,
    isActive
  }) {
    const palaceKeys = {};
    let memoryPalace = {
      data: null,
      renderer: null,
      scene: null,
      camera: null,
      group: null,
      nodes: [],
      labels: [],
      frame: 0,
      yaw: 0,
      pitch: -0.05,
      pos: null,
      velocity: null,
      raycaster: null,
      mouse: null,
      avatar: null,
      drone: null,
      beacon: null,
      beaconNode: null,
      joystick: { x: 0, y: 0 },
      lastT: 0,
      pointer: null,
      cullTick: 0,
      lastObjectCount: 0,
      streamedChunks: null,
      streamTick: 0,
      colors: null,
      paused: false
    };
    function palaceInspectorDefault() {
      $2("#palaceInspector").innerHTML = `<div class="inspector-kicker">Mnemosyne Labyrinth</div><h3>The Archive Gate</h3><p class="muted">Move between artifact rooms, scan relics on pedestals, and use search to summon a golden thread.</p><div class="trust-strip"><span class="trust-chip">WASD / joystick</span><span class="trust-chip">Drag to look</span><span class="trust-chip">Tap relic</span></div>`;
    }
    function clearPalaceScene2() {
      if (memoryPalace.frame) cancelAnimationFrame(memoryPalace.frame);
      memoryPalace.frame = 0;
      if (memoryPalace.renderer) {
        memoryPalace.renderer.dispose();
        memoryPalace.renderer.domElement.remove();
      }
      $2("#palaceLabels").innerHTML = "";
      Object.assign(memoryPalace, { renderer: null, scene: null, camera: null, group: null, nodes: [], labels: [], avatar: null, drone: null, beacon: null, beaconNode: null, lastT: 0 });
    }
    function resetMemoryPalaceDiver2() {
      if (!memoryPalace.THREE) return;
      memoryPalace.pos = new memoryPalace.THREE.Vector3(0, 118, 940);
      memoryPalace.velocity = new memoryPalace.THREE.Vector3();
      memoryPalace.yaw = 0;
      memoryPalace.pitch = -0.24;
      $2("#palaceHudStatus").textContent = "drifting at palace gate";
    }
    function palaceCreateHammyDrone(THREE) {
      const drone = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(5.5, 18, 12), new THREE.MeshStandardMaterial({ color: 16765345, emissive: 3807496, roughness: 0.42 }));
      const glow = new THREE.PointLight(16758891, 0.9, 120);
      glow.position.set(0, 0, 0);
      drone.add(body, glow);
      return drone;
    }
    function inspectPalaceNode(node) {
      const scanLabel = node.scanLabel || (node.kind === "memory" ? "Memory book" : "Entity obelisk");
      $2("#palaceInspector").innerHTML = `<div class="inspector-kicker">${esc2(scanLabel)} · ${esc2(node.room || node.category || "Artifact room")}</div><h3>${esc2(node.label || "Memory artifact")}</h3><p class="muted">${Number(node.count || 0).toLocaleString()} signal(s) · weight ${Number(node.weight || node._weight || 0).toFixed(2)}</p>${node.preview ? `<p>${esc2(node.preview)}</p>` : ""}<div class="inspector-actions">${node.memory_id ? '<button id="palaceOpenMemory" class="primary tiny">Open memory</button>' : ""}<button id="palaceBeaconHere" class="tiny">Beacon here</button></div>`;
      if (node.memory_id) $2("#palaceOpenMemory").onclick = () => openMemoryDetail2(node.memory_id);
      $2("#palaceBeaconHere").onclick = () => palaceSetBeacon(node);
    }
    function palaceSetBeacon(node) {
      if (!node || !memoryPalace.THREE || !memoryPalace.scene) return;
      if (memoryPalace.beacon) memoryPalace.beacon.removeFromParent();
      const THREE = memoryPalace.THREE;
      const beacon = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(24, 1.2, 8, 48), new THREE.MeshBasicMaterial({ color: 16769162, transparent: true, opacity: 0.82 }));
      const light = new THREE.PointLight(16769162, 1.8, 220);
      light.position.y = 22;
      beacon.add(ring, light);
      beacon.position.set(node.x, node.y + 28, node.z);
      memoryPalace.scene.add(beacon);
      memoryPalace.beacon = beacon;
      memoryPalace.beaconNode = node;
      $2("#palaceHudStatus").textContent = `beacon: ${String(node.label || "").slice(0, 34)}`;
    }
    function palaceSearchBeacon2() {
      const q = $2("#palaceSearchQuery").value.trim().toLowerCase();
      if (!q) {
        $2("#palaceHudStatus").textContent = "type a search to place beacon";
        return;
      }
      const node = memoryPalace.nodes.find((n) => [n.label, n.category, n.preview].some((v) => String(v || "").toLowerCase().includes(q)));
      if (node) {
        palaceSetBeacon(node);
        inspectPalaceNode(node);
      } else $2("#palaceHudStatus").textContent = `no artifact found for “${q.slice(0, 32)}”`;
    }
    function palaceForwardRight() {
      const THREE = memoryPalace.THREE;
      return { forward: new THREE.Vector3(Math.sin(memoryPalace.yaw), 0, -Math.cos(memoryPalace.yaw)), right: new THREE.Vector3(Math.cos(memoryPalace.yaw), 0, Math.sin(memoryPalace.yaw)) };
    }
    function palaceClampFpsPosition() {
      if (!memoryPalace.pos) return;
      const z = memoryPalace.pos.z;
      let xLimit = 900;
      if (z > -260) xLimit = 185;
      else if (z > -720) xLimit = 260;
      else if (z > -1320) xLimit = 420;
      memoryPalace.pos.x = Math.max(-xLimit, Math.min(xLimit, memoryPalace.pos.x));
      memoryPalace.pos.y = Math.max(46, Math.min(150, memoryPalace.pos.y));
      memoryPalace.pos.z = Math.max(-1500, Math.min(720, memoryPalace.pos.z));
    }
    function palaceNearestMemory(maxDist = 170) {
      if (!memoryPalace.pos) return null;
      let best = null, bestD = maxDist;
      memoryPalace.nodes.forEach((n) => {
        if (!n.mesh || n.kind !== "memory") return;
        const d = Math.hypot(memoryPalace.pos.x - n.x, memoryPalace.pos.z - n.z);
        if (d < bestD) {
          best = n;
          bestD = d;
        }
      });
      return best;
    }
    function updatePalaceNearbyPrompt() {
      const near = palaceNearestMemory(155);
      if (near) $2("#palaceHudStatus").textContent = `tap to scan memory: ${String(near.label || "").replace(/^memory:/, "").slice(0, 30)}`;
      else if ($2("#palaceHudStatus").textContent.startsWith("tap to scan memory:")) $2("#palaceHudStatus").textContent = "walk forward — memories are grouped by domain";
    }
    function palaceApplyVisibilityCulling() {
      if (!memoryPalace.scene || !memoryPalace.pos) return;
      memoryPalace.cullTick = (memoryPalace.cullTick || 0) + 1;
      if (memoryPalace.cullTick % 8 !== 0) return;
      let total = 0, visible = 0;
      const p = memoryPalace.pos;
      memoryPalace.scene.traverse((obj) => {
        total += 1;
        if (obj === memoryPalace.drone || obj === memoryPalace.beacon || obj.isHemisphereLight || obj.isDirectionalLight) {
          obj.visible = true;
          visible += 1;
          return;
        }
        if (!obj.parent || obj === memoryPalace.scene) {
          visible += 1;
          return;
        }
        const wp = obj.getWorldPosition ? obj.getWorldPosition(new memoryPalace.THREE.Vector3()) : obj.position;
        const d = Math.hypot(wp.x - p.x, wp.z - p.z);
        const limit = obj.isLight ? 760 : obj.userData?.node ? 620 : 980;
        obj.visible = d < limit;
        if (obj.visible) visible += 1;
      });
      memoryPalace.lastObjectCount = total;
      memoryPalace.lastVisibleObjectCount = visible;
    }
    function updatePalaceZoneBadge() {
      const badge = $2(".palace-zone-badge");
      if (!badge || !memoryPalace.pos) return;
      let best = null, bestD = Infinity;
      const zones = (memoryPalace.pathSections?.length ? memoryPalace.pathSections : memoryPalace.rooms) || [];
      zones.forEach((r) => {
        const d = Math.hypot(memoryPalace.pos.x - r.x, memoryPalace.pos.z - r.z);
        if (d < bestD) {
          bestD = d;
          best = r;
        }
      });
      badge.textContent = best?.label || "The Archive Gate";
    }
    async function loadMemoryPalace2() {
      const labels = $2("#palaceLabels");
      if (labels) labels.innerHTML = '<div class="three-loading-card"><h3>Loading the labyrinth…</h3><p>Fetching the render engine and memory graph.</p></div>';
      try {
        renderMemoryPalace(await api2("/api/constellation?limit=360"));
      } catch (e) {
        if (isCancelledRequest3(e)) return;
        if (labels) labels.innerHTML = `<div class="three-fallback-card"><h3>Could not load the labyrinth</h3><p>${esc2(e.message || "Try again.")}</p></div>`;
      }
    }
    function pickPalaceNode(e) {
      if (!memoryPalace.raycaster) return;
      const rect = $2("#palaceViewport").getBoundingClientRect();
      memoryPalace.mouse.x = (e.clientX - rect.left) / rect.width * 2 - 1;
      memoryPalace.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      memoryPalace.raycaster.setFromCamera(memoryPalace.mouse, memoryPalace.camera);
      const meshes = memoryPalace.nodes.map((n) => n.mesh).filter(Boolean);
      const hit = memoryPalace.raycaster.intersectObjects(meshes, false)[0];
      if (hit?.object?.userData?.node) {
        inspectPalaceNode(hit.object.userData.node);
        return;
      }
      const near = palaceNearestMemory(180);
      if (near) {
        inspectPalaceNode(near);
        return;
      }
      $2("#palaceHudStatus").textContent = "walk nearer to a memory book, then tap to scan";
    }
    function stopPalaceJoystickEvent(e) {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    }
    function bindPalaceControls() {
      const viewport = $2("#palaceViewport");
      if (!viewport || viewport.dataset.controlsBound === "true") return;
      viewport.dataset.controlsBound = "true";
      window.addEventListener("keydown", (e) => {
        if (isActive()) palaceKeys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
      });
      window.addEventListener("keyup", (e) => {
        palaceKeys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false;
      });
      viewport.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".fullscreen-exit") || e.target.closest("#palaceJoystick")) return;
        viewport.setPointerCapture?.(e.pointerId);
        memoryPalace.pointer = { x: e.clientX, y: e.clientY, moved: false };
      });
      viewport.addEventListener("pointermove", (e) => {
        if (!memoryPalace.pointer) return;
        const dx = e.clientX - memoryPalace.pointer.x, dy = e.clientY - memoryPalace.pointer.y;
        memoryPalace.pointer.x = e.clientX;
        memoryPalace.pointer.y = e.clientY;
        memoryPalace.pointer.moved = memoryPalace.pointer.moved || Math.abs(dx) + Math.abs(dy) > 3;
        memoryPalace.yaw -= dx * 32e-4;
        memoryPalace.pitch = Math.max(-1.05, Math.min(0.82, memoryPalace.pitch - dy * 24e-4));
      });
      const end = () => {
        setTimeout(() => {
          memoryPalace.pointer = null;
        }, 0);
      };
      viewport.addEventListener("pointerup", end);
      viewport.addEventListener("pointercancel", end);
      viewport.addEventListener("click", (e) => {
        if (e.target.closest("#palaceJoystick") || memoryPalace.pointer?.moved) return;
        pickPalaceNode(e);
      });
      const joy = $2("#palaceJoystick");
      const updateJoy = (e) => {
        stopPalaceJoystickEvent(e);
        if (joy.dataset.active !== "true") return;
        const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width * 0.38;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > max) {
          dx = dx / dist * max;
          dy = dy / dist * max;
        }
        const rawX = dx / max, rawY = dy / max, mag = Math.min(1, Math.hypot(rawX, rawY));
        const dead = 0.16, scaled = mag <= dead ? 0 : (mag - dead) / (1 - dead);
        const nx = mag ? rawX / mag * scaled : 0, ny = mag ? rawY / mag * scaled : 0;
        memoryPalace.joystick = { x: nx, y: ny };
        joy.querySelector("span").style.transform = `translate(${rawX * 28}px,${rawY * 28}px)`;
      };
      joy.addEventListener("pointerdown", (e) => {
        stopPalaceJoystickEvent(e);
        joy.setPointerCapture?.(e.pointerId);
        joy.dataset.active = "true";
        memoryPalace.pointer = null;
        updateJoy(e);
      });
      joy.addEventListener("pointermove", updateJoy);
      const stopJoy = (e) => {
        stopPalaceJoystickEvent(e);
        joy.dataset.active = "false";
        memoryPalace.joystick = { x: 0, y: 0 };
        joy.querySelector("span").style.transform = "translate(0,0)";
      };
      joy.addEventListener("pointerup", stopJoy);
      joy.addEventListener("pointercancel", stopJoy);
    }
    function updatePalaceLabels() {
      if (!memoryPalace.camera) return;
      const rect = $2("#palaceViewport").getBoundingClientRect();
      const v = new memoryPalace.THREE.Vector3();
      let shown = 0;
      $$2("#palaceLabels .three-label").forEach((el, i) => {
        const n = memoryPalace.labels[i];
        if (!n) return;
        v.set(n.x, n.y, n.z).project(memoryPalace.camera);
        const sx = (v.x * 0.5 + 0.5) * rect.width, sy = (-v.y * 0.5 + 0.5) * rect.height;
        const visible = v.z > -1 && v.z < 1 && sx > 10 && sx < rect.width - 10 && sy > 10 && sy < rect.height - 10 && shown < 30;
        el.style.display = visible ? "" : "none";
        if (visible) {
          shown++;
          el.style.left = `${sx}px`;
          el.style.top = `${sy}px`;
          el.style.opacity = String(n.room ? 0.78 : 0.96);
        }
      });
    }
    function palaceFpsRooms(data) {
      const raw = (data.nodes || []).map((n) => ({ ...n }));
      const memoryNodes = raw.filter((n) => n.kind === "memory" || n.memory_id);
      const domainSource = (memoryNodes.length ? memoryNodes : raw).slice(0, 140);
      const domainGroups = {};
      domainSource.forEach((n) => {
        const c = String(n.category || "Other");
        if (!domainGroups[c]) domainGroups[c] = [];
        domainGroups[c].push(n);
      });
      const countByCat = Object.fromEntries(Object.entries(domainGroups).map(([cat, items]) => [cat, items.length]));
      const cats = Object.keys(countByCat).sort((a, b) => countByCat[b] - countByCat[a] || a.localeCompare(b));
      const nodes = [];
      for (let round = 0; nodes.length < 40 && round < 20; round++) {
        cats.forEach((cat) => {
          const n = domainGroups[cat]?.[round];
          if (n && nodes.length < 40) nodes.push(n);
        });
      }
      const rooms = [
        { label: "Archive Gate", x: 0, z: 0, w: 420, d: 360, color: 16765286 },
        { label: String(cats[0] || "Episodic Vault").slice(0, 20), x: -520, z: -520, w: 380, d: 340, color: 6674175 },
        { label: String(cats[1] || "Working Stream").slice(0, 20), x: 520, z: -520, w: 380, d: 340, color: 5428917 },
        { label: String(cats[2] || "Entity Gardens").slice(0, 20), x: -520, z: -1120, w: 380, d: 340, color: 12166911 },
        { label: String(cats[3] || "Cold Storage").slice(0, 20), x: 520, z: -1120, w: 380, d: 340, color: 9085129 },
        { label: "Review Wing", x: 0, z: -1680, w: 430, d: 360, color: 16736135 }
      ];
      const sectionColors = [16765286, 6674175, 5428917, 12166911, 16752494, 9085129];
      const pathSections = cats.slice(0, 6).map((cat, i) => ({
        label: String(cat || "Other").slice(0, 20),
        category: cat,
        x: 0,
        y: 150,
        z: 245 - i * 330,
        kind: "section",
        chunkId: Math.floor((245 - i * 330 + 1600) / 350),
        color: sectionColors[i % sectionColors.length],
        count: countByCat[cat] || 0
      }));
      const seenInSection = {};
      let featured = 0;
      nodes.forEach((n, i) => {
        const contaminated = ["unknown", "inferred", "imported"].includes(String(n.veracity || "").toLowerCase()) || /contaminat|unknown|untrusted/i.test(String(n.reason || n.preview || ""));
        let room = contaminated ? rooms[5] : rooms[1 + i % 4];
        if (!contaminated && n.kind === "memory" && featured < 24) {
          const cat = String(n.category || "Other");
          const section = pathSections.find((s) => s.category === cat) || pathSections[0] || { label: "Archive Gate", z: 245 };
          const within = seenInSection[cat] || 0;
          seenInSection[cat] = within + 1;
          room = rooms[0];
          const side = within % 2 === 0 ? -1 : 1;
          const row = Math.floor(within / 2);
          n.x = side * (row < 2 ? 58 : 86);
          n.z = section.z - row * 105;
          n.y = 34;
          n.room = section.label;
          n.pathGroup = section.label;
          n.featuredPath = true;
          featured += 1;
        } else {
          const col = i % 4, row = Math.floor(i % 20 / 4);
          n.x = room.x - room.w * 0.3 + col * (room.w * 0.2);
          n.z = room.z - room.d * 0.22 + row * (room.d * 0.11);
          n.y = 34;
          n.room = room.label;
        }
        n.contaminated = contaminated;
        n.size = Math.min(28, 10 + Math.sqrt(Math.max(1, Number(n.weight || n.count || 1))) * 4);
        n.chunkId = Math.floor((n.z + 1600) / 350);
      });
      nodes.pathSections = pathSections;
      nodes.rooms = rooms;
      return nodes;
    }
    function palaceFpsMat(THREE, color, opts = {}) {
      return new THREE.MeshStandardMaterial({ color, emissive: opts.emissive || 328458, emissiveIntensity: opts.emissiveIntensity ?? 0.08, roughness: opts.roughness ?? 0.76, metalness: opts.metalness ?? 0.04 });
    }
    function palaceFpsBox(THREE, scene, size, pos, mat) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
      mesh.position.set(...pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    }
    function palaceFpsTexture(THREE, kind, base = "#4b344d", line = "rgba(255,224,138,.28)") {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const g = c.getContext("2d");
      g.fillStyle = base;
      g.fillRect(0, 0, 128, 128);
      if (kind === "stone") {
        g.strokeStyle = line;
        g.lineWidth = 2;
        for (let y = 0; y <= 128; y += 32) {
          g.beginPath();
          g.moveTo(0, y + 0.5);
          g.lineTo(128, y + 0.5);
          g.stroke();
        }
        for (let y = 0; y < 128; y += 32) {
          for (let x = y / 32 % 2 ? 32 : 0; x < 128; x += 64) {
            g.beginPath();
            g.moveTo(x + 0.5, y);
            g.lineTo(x + 0.5, y + 32);
            g.stroke();
          }
        }
        g.fillStyle = "rgba(255,255,255,.055)";
        for (let i = 0; i < 70; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
        g.fillStyle = "rgba(0,0,0,.16)";
        for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
      } else if (kind === "gold") {
        const grad = g.createLinearGradient(0, 0, 128, 128);
        grad.addColorStop(0, "#f3d589");
        grad.addColorStop(0.45, base);
        grad.addColorStop(1, "#7f622b");
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        g.strokeStyle = "rgba(255,245,190,.34)";
        g.lineWidth = 3;
        for (let y = 18; y < 128; y += 28) {
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(128, y + 10);
          g.stroke();
        }
        g.fillStyle = "rgba(0,0,0,.10)";
        for (let i = 0; i < 45; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
      } else if (kind === "door") {
        const grad = g.createRadialGradient(64, 58, 5, 64, 64, 78);
        grad.addColorStop(0, "#ffc078");
        grad.addColorStop(0.45, base);
        grad.addColorStop(1, "#2f1f25");
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        g.strokeStyle = "rgba(255,220,150,.24)";
        g.lineWidth = 2;
        for (let x = 18; x < 128; x += 24) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x + 6, 128);
          g.stroke();
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 2;
      return tex;
    }
    function palaceFpsTexturedBasic(THREE, kind, color, repeat = [1, 1], opacity = 1) {
      const map = palaceFpsTexture(THREE, kind, color);
      map.repeat.set(...repeat);
      return new THREE.MeshBasicMaterial({ color: 16777215, map, transparent: opacity < 1, opacity, side: THREE.DoubleSide });
    }
    function palaceFpsAddRoom(THREE, scene, room, i) {
      const floorMat = palaceFpsMat(THREE, i === 0 ? 4141386 : 3155005, { emissive: room.color, emissiveIntensity: 0.025 });
      const wallMat = palaceFpsMat(THREE, 5588065, { emissive: room.color, emissiveIntensity: 0.035, roughness: 0.82 });
      palaceFpsBox(THREE, scene, [room.w, 16, room.d], [room.x, -8, room.z], floorMat, room.color, 0.28);
      const wallH = i === 0 ? 150 : 126, t = 24;
      const door = 120;
      [[0, room.d / 2, room.w, t, "north"], [0, -room.d / 2, room.w, t, "south"], [room.w / 2, 0, t, room.d, "east"], [-room.w / 2, 0, t, room.d, "west"]].forEach(([ox, oz, w, d, side]) => {
        const isDoorSide = i === 0 && side === "north";
        if (isDoorSide) {
          palaceFpsBox(THREE, scene, [(w - door) / 2, wallH, d], [room.x - (w + door) / 4, wallH / 2, room.z + oz], wallMat, 15259903, 0.16);
          palaceFpsBox(THREE, scene, [(w - door) / 2, wallH, d], [room.x + (w + door) / 4, wallH / 2, room.z + oz], wallMat, 15259903, 0.16);
          palaceFpsBox(THREE, scene, [door + 32, 24, d + 8], [room.x, wallH + 12, room.z + oz], wallMat, 16765286, 0.35);
          return;
        }
        palaceFpsBox(THREE, scene, [w, wallH, d], [room.x + ox, wallH / 2, room.z + oz], wallMat, 15259903, 0.13);
      });
      const tileMat = palaceFpsMat(THREE, 4667476, { emissive: room.color, emissiveIntensity: 0.018, roughness: 0.86 });
      for (let x = -room.w / 2 + 64; x < room.w / 2 - 24; x += 96) {
        for (let z = -room.d / 2 + 64; z < room.d / 2 - 24; z += 96) {
          const inset = new THREE.Mesh(new THREE.BoxGeometry(54, 2, 54), tileMat);
          inset.position.set(room.x + x, 2, room.z + z);
          inset.receiveShadow = true;
          scene.add(inset);
        }
      }
      const light = new THREE.PointLight(room.color, i === 0 ? 1.1 : 0.72, 480);
      light.position.set(room.x, 130, room.z);
      scene.add(light);
      if (i === 0) {
        const gateMat = palaceFpsTexturedBasic(THREE, "gold", "#caa45c", [2.2, 1.1]);
        const sideMat = palaceFpsTexturedBasic(THREE, "stone", "#4b344d", [1, 4]);
        const floorMat2 = palaceFpsTexturedBasic(THREE, "stone", "#2f2440", [3, 8]);
        const railMat = palaceFpsTexturedBasic(THREE, "gold", "#d7b36d", [1, 5]);
        const doorMat = palaceFpsTexturedBasic(THREE, "door", "#9b6041", [1.2, 1], 0.62);
        palaceFpsBox(THREE, scene, [360, 14, 660], [room.x, -7, room.z + 270], floorMat2);
        palaceFpsBox(THREE, scene, [22, 18, 620], [room.x - 116, 8, room.z + 254], railMat);
        palaceFpsBox(THREE, scene, [22, 18, 620], [room.x + 116, 8, room.z + 254], railMat);
        for (let z = 450; z > -80; z -= 90) {
          palaceFpsBox(THREE, scene, [230, 8, 12], [room.x, 6, room.z + z], railMat);
        }
        palaceFpsBox(THREE, scene, [46, 168, 46], [room.x - 126, 86, room.z - 120], gateMat);
        palaceFpsBox(THREE, scene, [46, 168, 46], [room.x + 126, 86, room.z - 120], gateMat);
        palaceFpsBox(THREE, scene, [298, 42, 52], [room.x, 170, room.z - 120], gateMat);
        palaceFpsBox(THREE, scene, [34, 132, 430], [room.x - 210, 66, room.z + 90], sideMat);
        palaceFpsBox(THREE, scene, [34, 132, 430], [room.x + 210, 66, room.z + 90], sideMat);
        palaceFpsBox(THREE, scene, [156, 122, 18], [room.x, 76, room.z - 152], palaceFpsTexturedBasic(THREE, "door", "#6f4e3a", [1, 1]));
        const doorway = new THREE.Mesh(new THREE.PlaneGeometry(126, 104), doorMat);
        doorway.position.set(room.x, 80, room.z - 164);
        scene.add(doorway);
        [-1, 1].forEach((side) => {
          const torch = new THREE.Mesh(new THREE.BoxGeometry(14, 46, 12), new THREE.MeshBasicMaterial({ color: 16768923 }));
          torch.position.set(room.x + side * 158, 112, room.z - 82);
          scene.add(torch);
          const flame = new THREE.PointLight(16757596, 2.1, 460);
          flame.position.copy(torch.position);
          scene.add(flame);
        });
        const glow = new THREE.PointLight(16765286, 2.4, 720);
        glow.position.set(room.x, 112, room.z - 150);
        scene.add(glow);
        const hallFloor = palaceFpsBox(THREE, scene, [240, 10, 1500], [room.x, -5, room.z - 860], floorMat2);
        hallFloor.userData.walkable = true;
        palaceFpsBox(THREE, scene, [18, 16, 1450], [room.x - 112, 5, room.z - 840], railMat);
        palaceFpsBox(THREE, scene, [18, 16, 1450], [room.x + 112, 5, room.z - 840], railMat);
        for (let z = -260; z > -1280; z -= 240) {
          palaceFpsBox(THREE, scene, [150, 8, 10], [room.x, 8, room.z + z], railMat);
          [-1, 1].forEach((side) => {
            palaceFpsBox(THREE, scene, [16, 60, 16], [room.x + side * 150, 34, room.z + z], gateMat);
          });
        }
        palaceFpsBox(THREE, scene, [300, 120, 26], [room.x, 60, room.z - 1510], sideMat);
        palaceFpsBox(THREE, scene, [170, 88, 18], [room.x, 62, room.z - 1494], doorMat);
        const endLight = new THREE.PointLight(16765286, 1.1, 360);
        endLight.position.set(room.x, 92, room.z - 1420);
        scene.add(endLight);
      }
    }
    function palaceFpsAddPathSections(THREE, scene, sections) {
      const markerMat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 });
      (sections || []).forEach((section) => {
        const mat = markerMat(section.color || 16765286);
        palaceFpsBox(THREE, scene, [250, 8, 18], [0, 12, section.z + 42], mat);
        palaceFpsBox(THREE, scene, [18, 92, 18], [-138, 48, section.z + 42], mat);
        palaceFpsBox(THREE, scene, [18, 92, 18], [138, 48, section.z + 42], mat);
        const glow = new THREE.PointLight(section.color || 16765286, 0.55, 300);
        glow.position.set(0, 86, section.z + 42);
        scene.add(glow);
      });
    }
    function palaceFpsAddCorridor(THREE, scene, a, b) {
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), midX = (a.x + b.x) / 2, midZ = (a.z + b.z) / 2;
      const mat = palaceFpsMat(THREE, 3615302, { emissive: 16765286, emissiveIntensity: 0.025 });
      const road = palaceFpsBox(THREE, scene, [118, 12, len], [midX, -6, midZ], mat, 16765286, 0.18);
      road.rotation.y = Math.atan2(dx, dz);
      const wallMat = palaceFpsMat(THREE, 4864600, { emissive: 1313312, emissiveIntensity: 0.04 });
      [-1, 1].forEach((side) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 86, len), wallMat);
        wall.position.set(midX + Math.cos(road.rotation.y) * side * 68, 43, midZ - Math.sin(road.rotation.y) * side * 68);
        wall.rotation.y = road.rotation.y;
        wall.castShadow = wall.receiveShadow = true;
        scene.add(wall);
      });
    }
    function palaceFpsAddRelic(THREE, scene, node, colors) {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(17, 24, 16, 7), palaceFpsMat(THREE, 2168620));
      plinth.position.set(node.x, 10, node.z);
      plinth.castShadow = plinth.receiveShadow = false;
      scene.add(plinth);
      const color = node.contaminated ? 16732039 : cssHexToInt2(colors.memory);
      if (node.featuredPath) {
        const bookMat = new THREE.MeshBasicMaterial({ color: 16765286 });
        const cover = new THREE.Mesh(new THREE.BoxGeometry(44, 54, 8), bookMat);
        cover.position.set(node.x, 48, node.z);
        cover.rotation.x = -0.18;
        cover.userData.node = node;
        node.mesh = cover;
        scene.add(cover);
        const page = new THREE.Mesh(new THREE.BoxGeometry(34, 40, 4), new THREE.MeshBasicMaterial({ color: 16773314 }));
        page.position.set(node.x, 50, node.z - 5);
        page.rotation.x = -0.18;
        scene.add(page);
        const plaque = new THREE.Mesh(new THREE.BoxGeometry(58, 4, 34), new THREE.MeshBasicMaterial({ color: 5979949 }));
        plaque.position.set(node.x, 23, node.z + 18);
        scene.add(plaque);
        const halo = new THREE.PointLight(color, 0.55, 220);
        halo.position.copy(cover.position);
        scene.add(halo);
        return;
      }
      const geo = node.contaminated ? new THREE.IcosahedronGeometry(node.size, 1) : new THREE.OctahedronGeometry(node.size, 1);
      const relic = new THREE.Mesh(geo, palaceFpsMat(THREE, color, { emissive: color, emissiveIntensity: node.contaminated ? 0.48 : 0.24, roughness: 0.32, metalness: 0.08 }));
      relic.position.set(node.x, 40 + node.size * 0.2, node.z);
      relic.castShadow = false;
      relic.userData.node = node;
      node.mesh = relic;
      scene.add(relic);
      if (node.contaminated) {
        const halo = new THREE.PointLight(color, 0.45, 150);
        halo.position.copy(relic.position);
        scene.add(halo);
        node.scanLabel = "Needs-review memory";
      }
    }
    function palaceStreamRelicChunks(force = false) {
      if (!memoryPalace.scene || !memoryPalace.THREE || !memoryPalace.pos || !memoryPalace.streamedChunks) return;
      memoryPalace.streamTick = (memoryPalace.streamTick || 0) + 1;
      if (!force && memoryPalace.streamTick % 10 !== 0) return;
      const THREE = memoryPalace.THREE, active = /* @__PURE__ */ new Set();
      const current = Math.floor((memoryPalace.pos.z + 1600) / 350);
      [current - 1, current, current + 1].forEach((id) => active.add(id));
      for (const [id, group] of memoryPalace.streamedChunks.entries()) {
        if (!active.has(id)) {
          group.traverse((obj) => {
            if (obj.userData?.node) obj.userData.node.mesh = null;
          });
          group.removeFromParent();
          memoryPalace.streamedChunks.delete(id);
        }
      }
      active.forEach((id) => {
        if (memoryPalace.streamedChunks.has(id)) return;
        const group = new THREE.Group();
        group.userData.chunkId = id;
        memoryPalace.nodes.filter((n) => n.chunkId === id).forEach((n) => palaceFpsAddRelic(THREE, group, n, memoryPalace.colors));
        memoryPalace.scene.add(group);
        memoryPalace.streamedChunks.set(id, group);
      });
    }
    async function renderMemoryPalace(data) {
      const THREE = await loadThreeModule2();
      clearPalaceScene2();
      memoryPalace.data = data;
      memoryPalace.THREE = THREE;
      palaceInspectorDefault();
      const viewport = $2("#palaceViewport");
      if (!viewport) return;
      const colors = constellationColors2();
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch (err) {
        $2("#palaceLabels").innerHTML = `<div class="three-fallback-card"><h3>Mnemosyne Labyrinth unavailable</h3><p>This browser could not start WebGL.</p></div>`;
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
      renderer.setClearColor(cssHexToInt2(colors.bg), 0);
      renderer.shadowMap.enabled = false;
      viewport.prepend(renderer.domElement);
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(525582, 115e-5);
      const camera = new THREE.PerspectiveCamera(72, 1, 1, 4200);
      scene.add(new THREE.HemisphereLight(13482751, 459532, 0.78));
      const key = new THREE.DirectionalLight(16771268, 0.78);
      key.position.set(260, 520, 380);
      scene.add(key);
      const nodes = palaceFpsRooms(data);
      const rooms = nodes.rooms || [], pathSections = nodes.pathSections || [];
      rooms.slice(1).forEach((room) => palaceFpsAddCorridor(THREE, scene, rooms[0], room));
      rooms.forEach((room, i) => palaceFpsAddRoom(THREE, scene, room, i));
      palaceFpsAddPathSections(THREE, scene, pathSections);
      const drone = palaceCreateHammyDrone(THREE);
      scene.add(drone);
      const mobilePalace = window.matchMedia("(max-width:760px), (max-width:940px) and (max-height:520px)").matches;
      Object.assign(memoryPalace, { renderer, scene, camera, group: scene, nodes, rooms, pathSections, colors, streamedChunks: /* @__PURE__ */ new Map(), labels: pathSections.map((s) => ({ label: `${s.label} (${s.count})`, x: s.x, y: s.y, z: s.z, kind: "section" })).concat(nodes.filter((n) => n.featuredPath || n.contaminated || n.kind === "memory").filter((n) => !/^[a-f0-9]{10,}$/i.test(String(n.label || ""))).slice(0, 18)), raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(), avatar: null, drone, pos: new THREE.Vector3(0, mobilePalace ? 82 : 78, mobilePalace ? 430 : 360), velocity: new THREE.Vector3(), yaw: 0, pitch: mobilePalace ? -0.14 : -0.1, iso: false, paused: prefersReducedMotion2() });
      palaceStreamRelicChunks(true);
      $2("#palaceLabels").innerHTML = memoryPalace.labels.map((n, i) => `<span class="three-label ${n.kind === "memory" ? "memory" : ""}" data-i="${i}">${esc2(String(n.label || "").replace(/^memory:/, "mem ").slice(0, 24))}</span>`).join("");
      $2("#palaceHudStatus").textContent = "walk forward — memories are grouped by domain";
      bindPalaceControls();
      resizeMemoryPalace2();
      animateMemoryPalace(0);
    }
    function resizeMemoryPalace2() {
      if (!memoryPalace.renderer) return;
      const rect = $2("#palaceViewport").getBoundingClientRect();
      const w = Math.max(320, rect.width), h = Math.max(320, rect.height);
      memoryPalace.renderer.setSize(w, h, false);
      memoryPalace.camera.aspect = w / h;
      memoryPalace.camera.updateProjectionMatrix();
    }
    function animateMemoryPalace(t = 0) {
      if (!memoryPalace.renderer) return;
      resizeMemoryPalace2();
      const delta = memoryPalace.lastT ? Math.min(48, t - memoryPalace.lastT) / 1e3 : 0.016;
      memoryPalace.lastT = t;
      const { forward, right } = palaceForwardRight();
      const move = new memoryPalace.THREE.Vector3();
      if (palaceKeys.w || palaceKeys.ArrowUp) move.add(forward);
      if (palaceKeys.s || palaceKeys.ArrowDown) move.sub(forward);
      if (palaceKeys.d || palaceKeys.ArrowRight) move.add(right);
      if (palaceKeys.a || palaceKeys.ArrowLeft) move.sub(right);
      if (memoryPalace.joystick.x || memoryPalace.joystick.y) {
        move.addScaledVector(right, memoryPalace.joystick.x);
        move.addScaledVector(forward, -memoryPalace.joystick.y);
      }
      if (move.lengthSq() > 1) move.normalize();
      if (move.lengthSq() > 0) move.multiplyScalar((palaceKeys.Shift ? 420 : 235) * delta);
      memoryPalace.pos.add(move);
      palaceClampFpsPosition();
      memoryPalace.camera.rotation.order = "YXZ";
      memoryPalace.camera.position.copy(memoryPalace.pos);
      memoryPalace.camera.rotation.y = memoryPalace.yaw;
      memoryPalace.camera.rotation.x = memoryPalace.pitch;
      if (memoryPalace.drone) {
        const bob = memoryPalace.paused ? 0 : Math.sin(t * 3e-3) * 5;
        const dronePos = memoryPalace.pos.clone().add(right.clone().multiplyScalar(38)).add(forward.clone().multiplyScalar(-46)).add(new memoryPalace.THREE.Vector3(0, 14 + bob, 0));
        memoryPalace.drone.position.lerp(dronePos, 0.16);
      }
      palaceStreamRelicChunks();
      if (memoryPalace.beacon && !memoryPalace.paused) memoryPalace.beacon.rotation.y += delta * 1.4;
      if (!memoryPalace.paused) memoryPalace.nodes.forEach((n, i) => {
        if (n.mesh && n.mesh.visible && (n.featuredPath || i < 18)) {
          n.mesh.rotation.y += delta * (0.14 + i % 5 * 0.02);
        }
      });
      palaceApplyVisibilityCulling();
      memoryPalace.renderer.render(memoryPalace.scene, memoryPalace.camera);
      updatePalaceNearbyPrompt();
      updatePalaceLabels();
      updatePalaceZoneBadge();
      memoryPalace.frame = document.hidden ? 0 : requestAnimationFrame(animateMemoryPalace);
    }
    return {
      loadMemoryPalace: loadMemoryPalace2,
      resetMemoryPalaceDiver: resetMemoryPalaceDiver2,
      palaceSearchBeacon: palaceSearchBeacon2,
      clearPalaceScene: clearPalaceScene2,
      resizeMemoryPalace: resizeMemoryPalace2,
      animateMemoryPalace,
      isRendering: () => Boolean(memoryPalace.renderer),
      resume: () => {
        if (memoryPalace.renderer && !memoryPalace.frame) memoryPalace.frame = requestAnimationFrame(animateMemoryPalace);
      }
    };
  }

  // static/src/utils/motion.js
  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // static/src/app-main.js
  var THEME_KEY = "mnemosyne-dashboard-theme";
  var consolidationState = [];
  var realtimeState = { paused: false, source: null, events: [], status: null };
  var LIVE_MEMORY_PAGE_SIZE = 25;
  var liveMemoryItems = [];
  var liveMemoryOffset = 0;
  var liveMemoryHasMore = true;
  var liveMemoryLoading = false;
  var liveMemoryObserver = null;
  var currentRoute = { tab: "overview" };
  var applyingHistory = false;
  var lastBootError = null;
  var bulkSelection = /* @__PURE__ */ new Set();
  var latestMemoryItems = [];
  var memoryOffset = 0;
  var memoryHasMore = true;
  var memoryTotal = null;
  var memoryListIsPreset = false;
  var goChordUntil = 0;
  var toastTimer = 0;
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    $$(".theme-icon").forEach((icon) => {
      icon.textContent = theme === "light" ? "☀" : "☾";
    });
    $$(".theme-label").forEach((label) => {
      label.textContent = theme === "light" ? "Light" : "Dark";
    });
  }
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const preferred = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(saved || preferred);
  }
  var settingsController;
  var { api, postJson, setCsrfToken } = createApiClient({
    onUnauthorized: () => settingsController?.showLogin(),
    devTiming: localStorage.getItem("mnemosyne-debug-api") === "1",
    onTiming: (info) => console.debug("[api]", info)
  });
  settingsController = createSettingsController({
    $,
    api,
    postJson,
    setCsrfToken,
    confirmAction,
    runButtonAction,
    showDetail,
    showSelectableCopy,
    loadStats
  });
  function showLogin() {
    settingsController.showLogin();
  }
  function hideLogin() {
    settingsController.hideLogin();
  }
  function refreshAuthState() {
    return settingsController.refreshAuthState();
  }
  function loadAuthStatus() {
    return settingsController.loadAuthStatus();
  }
  function loadDiagnostics() {
    return settingsController.loadDiagnostics();
  }
  function loadRuntimeDiagnostics() {
    return settingsController.loadRuntimeDiagnostics();
  }
  var detailDrawer = createDetailDrawerController({
    $,
    $$,
    api,
    postJson,
    bindActivatable,
    canAdmin,
    confirmAction,
    askImportance,
    askReplacement,
    askVeracity,
    askExpiry,
    runButtonAction,
    refreshAuthState,
    loadStats,
    loadMemories,
    openActionModal,
    pushRoute,
    getCurrentRoute: () => currentRoute,
    memoryRouteState,
    switchTab
  });
  var { loadGraph, resetGraphView } = createGraphFeature({ $, $$, api, showDetail, switchTab });
  var { loadInsights, disposeInsightsCharts } = createChartsFeature({ $, api, switchTab, loadMemories });
  var visualiserChrome = createVisualiserChrome({
    $,
    redrawCanvas: redrawConstellation,
    resizeThree,
    resizeMemoryPalace
  });
  var reviewController = createReviewController({
    $,
    $$,
    api,
    postJson,
    bindMemoryClicks,
    canAdmin,
    confirmAction,
    askVeracity,
    askExpiry,
    runButtonAction,
    runBulkMutation,
    loadStats,
    showToast,
    isCancelledRequest: isCancelledRequest2,
    openMemoryFilter: applyReviewFilter
  });
  function isCancelledRequest2(error) {
    return error?.name === "ApiError" && error.status === 0 && !error.retryable;
  }
  function bootErrorPayload() {
    return lastBootError ? JSON.stringify(lastBootError, null, 2) : "";
  }
  function renderBootErrorStatus() {
    const status = $("#bootErrorStatus");
    const stack = $("#bootErrorStack");
    const copy = $("#copyBootError");
    if (!status || !stack) return;
    if (!lastBootError) {
      status.textContent = "No frontend boot errors recorded in this page session.";
      stack.textContent = "";
      stack.classList.add("hidden");
      if (copy) copy.disabled = true;
      return;
    }
    status.textContent = `${lastBootError.time} · ${lastBootError.message}`;
    stack.textContent = lastBootError.stack || lastBootError.message;
    stack.classList.remove("hidden");
    if (copy) copy.disabled = false;
  }
  function setBootError(title, body = "") {
    const el = $("#bootError");
    if (!el) return;
    el.innerHTML = `<strong>${esc(title)}</strong>${body ? `<p>${esc(body)}</p>` : ""}<div class="item-actions"><button id="bootErrorRetry" class="primary">Retry load</button><button id="bootErrorCopy">Copy error details</button></div>`;
    el.classList.remove("hidden");
    $("#bootErrorRetry")?.addEventListener("click", () => bootstrapDashboard());
    $("#bootErrorCopy")?.addEventListener("click", () => copyBootErrorDetails());
  }
  function clearBootError() {
    const el = $("#bootError");
    if (!el) return;
    el.innerHTML = "";
    el.classList.add("hidden");
  }
  function copyBootErrorDetails() {
    if (!lastBootError) return;
    showSelectableCopy("Boot error details", bootErrorPayload());
  }
  async function handleInitError(error) {
    console.error("Dashboard bootstrap failed", error);
    lastBootError = {
      time: (/* @__PURE__ */ new Date()).toISOString(),
      message: error?.message || String(error || "Unknown startup error"),
      stack: error?.stack || ""
    };
    let status = null;
    try {
      const r = await fetch("/api/auth/status", { cache: "no-store" });
      status = await r.json();
      if (r.ok) settingsController.setAuthState(status);
    } catch {
    }
    const authRequired = !!(status && status.auth_enabled && !status.authenticated);
    if (authRequired) {
      clearBootError();
      renderBootErrorStatus();
      showLogin();
      return;
    }
    hideLogin();
    setBootError("Dashboard failed to finish loading.", lastBootError.message);
    renderBootErrorStatus();
  }
  async function bootstrapDashboard() {
    clearBootError();
    const route = urlToRoute();
    if (route.tab !== "overview" || route.drawer) switchTab(route.tab || "overview", { push: false });
    const s = await refreshAuthState();
    if (s.auth_enabled && !s.authenticated) {
      renderBootErrorStatus();
      showLogin();
      return;
    }
    hideLogin();
    await loadStats();
    await initRealtime();
    if (route.tab !== "overview" || route.drawer) await applyRoute(route);
    renderBootErrorStatus();
  }
  function pushRoute(state, replace = false) {
    if (applyingHistory) return;
    currentRoute = { ...state };
    const fn = replace ? "replaceState" : "pushState";
    history[fn](currentRoute, "", routeToUrl(currentRoute));
  }
  function currentMemoryFilters() {
    return {
      kind: $("#memoryKind")?.value || "",
      q: $("#memoryQuery")?.value.trim() || "",
      source: $("#memorySource")?.value || "",
      scope: $("#memoryScope")?.value || "",
      session_id: $("#memorySession")?.value || "",
      veracity: $("#memoryVeracity")?.value || "",
      degradation_tier: $("#memoryDegradation")?.value || "",
      trust: $("#memoryTrustPreset")?.value || "",
      status: $("#memoryStatus")?.value || "",
      sort: $("#memorySort")?.value || ""
    };
  }
  function memoryRouteState() {
    const filters = Object.fromEntries(Object.entries(currentMemoryFilters()).filter(([, value]) => value));
    return routeTabState("memories", Object.keys(filters).length ? { filters } : {});
  }
  function applyMemoryRouteFilters(filters = {}) {
    if ("kind" in filters) $("#memoryKind").value = filters.kind || "all";
    if ("q" in filters) $("#memoryQuery").value = filters.q || "";
    if ("source" in filters) $("#memorySource").value = filters.source || "";
    if ("scope" in filters) $("#memoryScope").value = filters.scope || "";
    if ("session_id" in filters) $("#memorySession").value = filters.session_id || "";
    if ("veracity" in filters) $("#memoryVeracity").value = filters.veracity || "";
    if ("degradation_tier" in filters) $("#memoryDegradation").value = filters.degradation_tier || "";
    if ("trust" in filters) $("#memoryTrustPreset").value = filters.trust || "";
    if ("status" in filters) $("#memoryStatus").value = filters.status || "active";
    if ("sort" in filters) $("#memorySort").value = filters.sort || "recent";
  }
  function resetMemoryFilterControls() {
    ["memoryQuery", "memorySource", "memoryScope", "memorySession", "memoryVeracity", "memoryDegradation", "memoryTrustPreset"].forEach((id) => $("#" + id).value = "");
    $("#memoryKind").value = "all";
    $("#memoryStatus").value = "active";
    $("#memorySort").value = "recent";
  }
  function closeDetail(opts = {}) {
    detailDrawer.closeDetail(opts);
  }
  async function applyRoute(state) {
    applyingHistory = true;
    try {
      const route = state || urlToRoute();
      if (route.tab === "memories" && route.filters) applyMemoryRouteFilters(route.filters);
      switchTab(route.tab || "overview", { push: false });
      if (route.drawer?.type === "memory") await openMemoryDetail(route.drawer.id, { push: false });
      else if (route.drawer?.type === "session") await openSessionDetail(route.drawer.id, { push: false });
      else closeDetail({ push: false });
      currentRoute = route;
      const canonicalUrl = routeToUrl(route);
      if (location.pathname + location.search + location.hash !== canonicalUrl) history.replaceState(route, "", canonicalUrl);
    } finally {
      applyingHistory = false;
    }
  }
  function showSelectableCopy(label, value) {
    detailDrawer.showSelectableCopy(label, value);
  }
  function showDetail(obj, title = "Detail", opts = {}) {
    detailDrawer.showDetail(obj, title, opts);
  }
  function modalTemplate() {
    let modal = $("#actionModal");
    if (modal) return modal;
    document.body.insertAdjacentHTML("beforeend", `
    <div id="actionModal" class="action-modal hidden" role="dialog" aria-modal="true" aria-labelledby="actionModalTitle" aria-describedby="actionModalDescription">
      <div class="action-modal-card glass">
        <button id="actionModalClose" class="modal-close" aria-label="Close dialog">×</button>
        <div id="actionModalKicker" class="modal-kicker">Memory maintenance</div>
        <h2 id="actionModalTitle">Confirm action</h2>
        <p id="actionModalDescription" class="muted"></p>
        <div id="actionModalBody"></div>
        <p id="actionModalError" class="modal-error"></p>
        <div class="modal-actions">
          <button id="actionModalCancel">Cancel</button>
          <button id="actionModalConfirm" class="primary">Confirm</button>
        </div>
      </div>
    </div>`);
    return $("#actionModal");
  }
  function openActionModal({ title, description = "", kicker = "Memory maintenance", confirmText = "Confirm", tone = "", bodyHtml = "", readValue = () => true, validate = () => "" }) {
    return new Promise((resolve) => {
      const modal = modalTemplate();
      $("#actionModalKicker").textContent = kicker;
      $("#actionModalTitle").textContent = title;
      $("#actionModalDescription").textContent = description;
      $("#actionModalBody").innerHTML = bodyHtml;
      $("#actionModalConfirm").textContent = confirmText;
      $("#actionModalConfirm").className = `primary ${tone}`.trim();
      $("#actionModalError").textContent = "";
      let releaseFocusTrap = () => {
      };
      const close = (value) => {
        modal.classList.add("hidden");
        document.removeEventListener("keydown", onKey);
        releaseFocusTrap();
        resolve(value);
      };
      const onKey = (e) => {
        if (e.key === "Escape") close(null);
        if (e.key === "Enter" && !e.target.matches("textarea")) $("#actionModalConfirm").click();
      };
      $("#actionModalClose").onclick = () => close(null);
      $("#actionModalCancel").onclick = () => close(null);
      modal.onclick = (e) => {
        if (e.target === modal) close(null);
      };
      $("#actionModalConfirm").onclick = () => {
        const value = readValue(modal);
        const error = validate(value);
        if (error) {
          $("#actionModalError").textContent = error;
          return;
        }
        close(value);
      };
      modal.classList.remove("hidden");
      document.addEventListener("keydown", onKey);
      releaseFocusTrap = trapFocus(modal);
      const first = modal.querySelector("textarea,input,button.primary");
      setTimeout(() => first?.focus(), 30);
    });
  }
  function confirmAction(opts) {
    return openActionModal(opts);
  }
  function toastHost() {
    let host = $("#toastHost");
    if (host) return host;
    document.body.insertAdjacentHTML("beforeend", '<div id="toastHost" class="toast-host" aria-live="polite" aria-atomic="false"></div>');
    return $("#toastHost");
  }
  function showToast(opts = {}) {
    const host = toastHost();
    host.innerHTML = renderToast(opts);
    const action = host.querySelector(".toast-action");
    if (action && typeof opts.action === "function") action.onclick = opts.action;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      host.innerHTML = "";
    }, opts.timeout || 5200);
  }
  async function runButtonAction(button, pendingLabel, action, success) {
    setButtonPending(button, true, pendingLabel);
    try {
      const result = await action();
      if (success) showToast(typeof success === "function" ? success(result) : success);
      return result;
    } catch (e) {
      showToast({ tone: "error", title: "Action failed", body: e.message || "Try again." });
      throw e;
    } finally {
      setButtonPending(button, false);
    }
  }
  async function runBulkMutation(ids, mutate, verb) {
    let failed = 0;
    for (const id of ids) {
      try {
        await mutate(id);
      } catch (e) {
        failed += 1;
        console.warn("[bulk mutation]", id, e);
      }
    }
    const summary = actionSummary(verb, { count: ids.length, failed });
    showToast({ tone: failed ? "warning" : "success", title: summary, body: failed ? "The failed items were left selected for retry." : "The list has been refreshed." });
    return { failed };
  }
  async function openCommandSearch() {
    const query2 = await openActionModal({
      title: "Command search",
      description: "Search memories, facts, and consolidations from anywhere.",
      kicker: "Global command",
      confirmText: "Search",
      bodyHtml: '<label class="modal-field"><span>Search query</span><input id="modalCommandSearch" type="search" placeholder="whoop, project, session, person..." /></label>',
      readValue: () => $("#modalCommandSearch").value.trim(),
      validate: (v) => v ? "" : "Type a search query."
    });
    if (query2 === null) return;
    $("#globalSearchQuery").value = query2;
    switchTab("search");
    await loadGlobalSearch();
  }
  function openShortcutHelp() {
    openActionModal({
      title: "Keyboard shortcuts",
      description: "Fast paths for the dashboard.",
      kicker: "Command map",
      confirmText: "Done",
      bodyHtml: `<div class="shortcut-grid">
      <span>/</span><strong>Focus search</strong>
      <span>⌘K / Ctrl K</span><strong>Open command search</strong>
      <span>Esc</span><strong>Close drawer or dialog</strong>
      <span>g o</span><strong>Go to Overview</strong>
      <span>g m</span><strong>Go to Memories</strong>
      <span>g r</span><strong>Go to Review</strong>
      <span>g k</span><strong>Go to Knowledge Graph</strong>
      <span>Canvas arrows</span><strong>Move between visible visualiser nodes</strong>
      <span>Canvas Enter</span><strong>Open selected visualiser node</strong>
      <span>Canvas R / P</span><strong>Reset or pause the canvas visualiser</strong>
      <span>3D arrows</span><strong>Rotate or pan the 3D visualiser</strong>
      <span>3D +/-</span><strong>Zoom the 3D visualiser</strong>
      <span>Labyrinth WASD</span><strong>Move through the Memory Palace</strong>
    </div>`
    });
  }
  function focusPrimarySearch() {
    const target = sectionFor(currentRoute.tab) === "explore" ? $("#memoryQuery") : $("#menuSearchQuery") || $("#globalSearchQuery");
    target?.focus();
    target?.select?.();
  }
  function handleGlobalKeyboard(e) {
    const chord = performance.now() < goChordUntil ? "g" : "";
    const action = keyboardActionForEvent(e, chord);
    if (!action) return;
    if (action === "start-go-chord") {
      goChordUntil = performance.now() + 1100;
      return;
    }
    goChordUntil = 0;
    e.preventDefault();
    if (action === "focus-search") focusPrimarySearch();
    else if (action === "show-shortcuts") openShortcutHelp();
    else if (action === "close-overlay") closeDetail();
    else if (action === "open-command") openCommandSearch();
    else if (action === "go-overview") switchTab("overview");
    else if (action === "go-memories") switchTab("memories");
    else if (action === "go-review") switchTab("review");
    else if (action === "go-graph") switchTab("graph");
  }
  function askImportance(current) {
    return openActionModal({
      title: "Edit importance",
      description: "Set a value from 0.00 to 1.00. Higher importance makes this memory more likely to surface.",
      confirmText: "Save importance",
      bodyHtml: `<label class="modal-field"><span>Importance</span><input id="modalImportance" type="number" min="0" max="1" step="0.01" value="${esc(Number(current ?? 0.5).toFixed(2))}" /></label>`,
      readValue: () => Number($("#modalImportance").value),
      validate: (v) => Number.isFinite(v) && v >= 0 && v <= 1 ? "" : "Enter a number between 0.00 and 1.00."
    });
  }
  function askReplacement(content) {
    return openActionModal({
      title: "Supersede memory",
      description: "Create a corrected replacement memory and expire the old one. The original stays in history.",
      confirmText: "Create replacement",
      tone: "dangerish",
      bodyHtml: `<label class="modal-field"><span>Replacement memory content</span><textarea id="modalReplacement" rows="9">${esc(content || "")}</textarea></label>`,
      readValue: () => $("#modalReplacement").value.trim(),
      validate: (v) => v ? "" : "Replacement content cannot be empty."
    });
  }
  function askVeracity(current) {
    const value = String(current || "unknown").toLowerCase();
    return openActionModal({
      title: "Set trust / veracity",
      description: "Use this only after human review. Lifecycle hot/warm/cold stays automatic.",
      confirmText: "Save trust",
      bodyHtml: `<label class="modal-field"><span>Trust / veracity</span><select id="modalVeracity">
      ${["stated", "inferred", "tool", "imported", "unknown"].map((v) => `<option value="${v}"${v === value ? " selected" : ""}>${v}</option>`).join("")}
    </select></label>`,
      readValue: () => $("#modalVeracity").value,
      validate: (v) => ["stated", "inferred", "tool", "imported", "unknown"].includes(v) ? "" : "Choose a valid trust value."
    });
  }
  function askExpiry(current) {
    return openActionModal({
      title: "Set expiry",
      description: "Set valid_until as an ISO timestamp, or leave blank to clear expiry. Expire now remains the safer one-click option for wrong memories.",
      confirmText: "Save expiry",
      bodyHtml: `<label class="modal-field"><span>Valid until</span><input id="modalExpiry" type="text" placeholder="2026-06-01T00:00:00" value="${esc(current || "")}" /></label><p class="muted">Blank means no scheduled expiry.</p>`,
      readValue: () => $("#modalExpiry").value.trim(),
      validate: (v) => {
        if (!v) return "";
        const d = Date.parse(v);
        return Number.isFinite(d) ? "" : "Enter an ISO timestamp like 2026-06-01T00:00:00, or leave blank.";
      }
    });
  }
  function sectionFor(name) {
    return { visualiser: "visualiser3d", palace: "memoryPalace", visualiserlegacy: "constellation", constellation: "constellation", recall: "explore", memories: "explore", history: "activity", timelineView: "activity", consolidations: "activity", triples: "graph", todayAdded: "today", todayRecalled: "today", todayTriples: "today", todayConsolidations: "today" }[name] || name;
  }
  function defaultPanelFor(section) {
    return { explore: "exploreMemories", activity: "activityTimeline", graph: "graphGraph", today: "todayAdded" }[section];
  }
  function panelFor(name) {
    return { memories: "exploreMemories", recall: "exploreRecall", history: "activityTimeline", timelineView: "activityTimeline", consolidations: "activityConsolidations", graph: "graphGraph", triples: "graphTriples", today: "todayAdded", todayAdded: "todayAdded", todayRecalled: "todayRecalled", todayTriples: "todayTriples", todayConsolidations: "todayConsolidations" }[name] || defaultPanelFor(name);
  }
  function visualiserResponsiveFill(width, height) {
    return visualiserChrome.responsiveFill(width, height);
  }
  async function toggleVisualiserFullscreen(selector) {
    await visualiserChrome.toggleFullscreen(selector);
  }
  async function exitVisualiserFullscreen(event) {
    await visualiserChrome.exitFullscreen(event);
  }
  function updateVisualiserFullscreenButtons() {
    visualiserChrome.updateFullscreenButtons();
  }
  function switchTab(name, opts = {}) {
    const section = sectionFor(name);
    if (section !== "constellation") stopCanvasVisualiserLoop();
    if (section !== "visualiser3d" && isThreeVisualiserRendering()) clearThreeScene();
    if (section !== "memoryPalace" && isMemoryPalaceRendering()) clearPalaceScene();
    if (section !== "insights") disposeInsightsCharts();
    document.body.classList.toggle("compact-page", section !== "overview");
    $$(".tab").forEach((x) => x.classList.remove("active"));
    $$("nav button").forEach((x) => {
      x.classList.remove("active");
      x.setAttribute("aria-selected", "false");
    });
    $(`#${section}`).classList.add("active");
    const nav = document.querySelector(`nav button[data-tab="${canonicalTab(name)}"]`) || document.querySelector(`nav button[data-tab="${section}"]`);
    if (nav) {
      nav.classList.add("active");
      nav.setAttribute("aria-selected", "true");
    }
    showPanel(section, panelFor(name));
    closeDetail({ push: false });
    closeMobileMenu();
    currentRoute = section === "explore" && panelFor(name) === "exploreMemories" ? memoryRouteState() : routeTabState(name);
    if (opts.push !== false) pushRoute(currentRoute);
    if (name === "graph" || section === "graph") loadGraph();
    if (name === "triples") loadTriples();
    if (name === "consolidations") loadConsolidations();
    if (name === "memories") loadMemories();
    if (name === "search") loadGlobalSearch();
    if (name === "recall") loadRecallDebug();
    if (name === "timelineView" || section === "activity") loadTimeline();
    if (section === "today") loadTodayDigest();
    if (section === "profile") loadProfile();
    if (section === "review") loadReview();
    if (section === "lifecycle") loadLifecycle();
    if (section === "constellation") loadConstellation();
    if (section === "visualiser3d") loadThreeVisualiser();
    if (section === "memoryPalace") loadMemoryPalace();
    if (section === "settings") {
      loadAuthStatus();
      loadDiagnostics();
      loadRuntimeDiagnostics();
      loadRealtimePanel();
    }
    if (section === "memoria") loadMemoria();
    if (section === "insights") loadInsights();
  }
  async function loadStats() {
    const s = await api(endpoints.stats());
    $("#dbPath").textContent = s.db_path;
    $("#dbPath").title = s.db_path;
    const cards = [
      ["Working", s.counts.working_memory],
      ["Episodic", s.counts.episodic_memory],
      ["Needs review", s.contamination?.total || 0],
      ["Degraded", s.degradation?.degraded || 0],
      ["Triples", s.counts.triples],
      ["Consolidations", s.counts.consolidation_log]
    ];
    $("#cards").innerHTML = cards.map(([label, num]) => `<div class="card"><div class="num">${Number(num).toLocaleString()}</div><div class="label">${label}</div></div>`).join("");
    $("#sourceBreakdown").innerHTML = breakdown(s.by_source, "source");
    $("#scopeBreakdown").innerHTML = breakdown(s.by_scope, "scope");
    $("#sessionBreakdown").innerHTML = breakdown(s.by_session, "session_id", 6);
    $("#veracityBreakdown").innerHTML = breakdown(s.by_veracity || [], "veracity", 8);
    $("#degradationBreakdown").innerHTML = breakdown(s.by_degradation || [], "degradation_label", 8);
    fillSelect($("#memorySource"), optionsFrom(s.by_source, "source"), "all sources");
    fillSelect($("#memoryScope"), optionsFrom(s.by_scope, "scope"), "all scopes");
    fillSelect($("#memorySession"), optionsFrom(s.by_session, "session_id"), "all sessions");
    bindBreakdownClicks();
    loadLiveMemoryStream(false);
  }
  function renderRealtimeStatus() {
  }
  function sortRealtimeEventsNewestFirst(events) {
    return [...events].sort((a, b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0));
  }
  function renderLiveMemoryStream() {
    const list = $("#liveMemoryStream");
    if (!list) return;
    list.innerHTML = liveMemoryItems.length ? liveMemoryItems.map(memoryItem).join("") : stateHtml("empty", "No memories found.", "The memory stream will appear here once memories exist.");
    bindMemoryClicks($("#liveMemoryStream"));
    const status = $("#liveMemoryStatus");
    if (status) {
      status.textContent = liveMemoryLoading ? "Loading older memories…" : liveMemoryHasMore ? "Scroll to load older memories." : "End of memory stream.";
    }
  }
  async function loadLiveMemoryStream(append = false) {
    if (liveMemoryLoading) return;
    if (append && !liveMemoryHasMore) return;
    liveMemoryLoading = true;
    renderLiveMemoryStream();
    if (!append) {
      liveMemoryItems = [];
      liveMemoryOffset = 0;
      liveMemoryHasMore = true;
    }
    const params = new URLSearchParams({
      kind: "all",
      status: "active",
      sort: "recent",
      limit: String(LIVE_MEMORY_PAGE_SIZE),
      offset: String(liveMemoryOffset)
    });
    try {
      const data = await api(`/api/memories?${params.toString()}`);
      const items = data.items || [];
      const seen = new Set(liveMemoryItems.map((item) => item.id));
      liveMemoryItems = append ? [...liveMemoryItems, ...items.filter((item) => !seen.has(item.id))] : items;
      liveMemoryOffset += items.length;
      liveMemoryHasMore = items.length === LIVE_MEMORY_PAGE_SIZE;
    } finally {
      liveMemoryLoading = false;
      renderLiveMemoryStream();
    }
  }
  function initLiveMemoryInfiniteScroll() {
    const sentinel = $("#liveMemorySentinel");
    if (!sentinel) return;
    if (liveMemoryObserver) liveMemoryObserver.disconnect();
    if (!("IntersectionObserver" in window)) {
      window.addEventListener("scroll", () => {
        if (liveMemoryHasMore && !liveMemoryLoading && window.innerHeight + window.scrollY >= document.body.offsetHeight - 700) loadLiveMemoryStream(true);
      }, { passive: true });
      return;
    }
    liveMemoryObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadLiveMemoryStream(true);
    }, { rootMargin: "700px 0px" });
    liveMemoryObserver.observe(sentinel);
  }
  function addLiveMemoryEvent(event) {
    if (!event || !event.memory_id) return;
    const existing = liveMemoryItems.find((item2) => item2.id === event.memory_id);
    if (existing && event.event_type === "MEMORY_SNAPSHOT") return;
    const item = {
      ...existing || {},
      id: event.memory_id,
      content: event.content || existing?.content || "",
      source: event.source || existing?.source || "",
      timestamp: event.timestamp || existing?.timestamp || "",
      created_at: event.timestamp || existing?.created_at || "",
      importance: event.importance ?? existing?.importance ?? 0,
      veracity: event.veracity || existing?.veracity || "unknown",
      memory_kind: event.memory_kind || existing?.memory_kind || "memory",
      status: event.status || existing?.status || "active",
      live_event_type: event.event_type || "MEMORY_ADDED"
    };
    if (event.event_type === "MEMORY_INVALIDATED") {
      liveMemoryItems = liveMemoryItems.map((existingItem) => existingItem.id === item.id ? item : existingItem);
    } else {
      liveMemoryItems = [item, ...liveMemoryItems.filter((existingItem) => existingItem.id !== item.id)];
    }
    renderLiveMemoryStream();
  }
  function renderRealtimeEvents() {
    const feeds = ["#liveEventFeed", "#realtimeEventFeed"].map((sel) => $(sel)).filter(Boolean);
    if (!feeds.length) return;
    const orderedEvents = sortRealtimeEventsNewestFirst(realtimeState.events);
    const html = orderedEvents.length ? orderedEvents.slice(0, 20).map((ev) => {
      const kind = ev.memory_kind || "memory";
      const label = ev.event_type || "MEMORY_EVENT";
      const when = ev.timestamp ? prettyTime(ev.timestamp) : "just now";
      const source = ev.source ? `<span class="badge">${esc(ev.source)}</span>` : "";
      return `<div class="realtime-event" data-memory-id="${esc(ev.memory_id || "")}"><div><strong>${esc(label)}</strong> <span class="muted">${esc(kind)}</span></div><div class="meta"><span class="badge">${esc(shortId(ev.memory_id || "unknown"))}</span><span class="badge trust-${esc(ev.veracity || "unknown")}">${esc(ev.veracity || "unknown")}</span>${source}<span class="meta-time">${esc(when)}</span></div><div class="content realtime-content">${esc(ev.content || "")}</div></div>`;
    }).join("") : '<div class="state-empty">Waiting for memory events…</div>';
    feeds.forEach((feed) => {
      feed.innerHTML = html;
      feed.querySelectorAll(".realtime-event").forEach((row) => bindActivatable(row, () => openMemoryDetail(row.dataset.memoryId || "")));
    });
  }
  function renderRealtimePanel() {
    const status = realtimeState.status || {};
    const cards = [
      ["Streaming", status.streaming_supported ? "Ready" : "Unavailable"],
      ["DeltaSync", status.deltasync_supported ? "Ready" : "Unavailable"],
      ["Installed package", status.mnemosyne_version || "unknown"],
      ["Realtime API", status.realtime_generation || "unknown"],
      ["Events", status.snapshot_event_count || 0]
    ];
    const delta = $("#settingsDeltaSync");
    if (delta) delta.innerHTML = cards.map(([label, num]) => `<div class="realtime-kv"><strong>${esc(label)}</strong><span>${esc(num)}</span></div>`).join("") + `<div class="realtime-kv"><strong>Transport</strong><span>${esc(status.transport || "sse")}</span></div><div class="realtime-kv"><strong>Tables</strong><span>${esc((status.deltasync_tables || []).join(", ") || "none")}</span></div><div class="realtime-kv"><strong>DeltaSync methods</strong><span>${esc((status.deltasync_methods || []).join(", ") || "none")}</span></div><div class="realtime-kv"><strong>Event types</strong><span>${esc((status.event_types || []).join(", ") || "none")}</span></div><div class="realtime-kv"><strong>Payload policy</strong><span>${esc(status.payload_policy || "private dashboard payload")}</span></div><div class="realtime-kv"><strong>DB modified</strong><span>${esc(status.db_modified_at || "")}</span></div>`;
  }
  async function loadRealtimePanel() {
    try {
      realtimeState.status = await api(endpoints.realtimeStatus());
      renderRealtimeStatus();
      renderRealtimePanel();
    } catch (e) {
      const delta = $("#settingsDeltaSync");
      if (delta) delta.innerHTML = `<div class="state-card state-error"><strong>Sync diagnostics unavailable</strong><p>${esc(e.message)}</p></div>`;
    }
  }
  function addRealtimeEvent(event) {
    if (realtimeState.paused) return;
    if (!event || !event.memory_id) return;
    realtimeState.events = sortRealtimeEventsNewestFirst([event, ...realtimeState.events.filter((e) => `${e.event_type}:${e.memory_id}:${e.timestamp}` !== `${event.event_type}:${event.memory_id}:${event.timestamp}`)]).slice(0, 50);
    renderRealtimeEvents();
    addLiveMemoryEvent(event);
  }
  async function initRealtime() {
    try {
      realtimeState.status = await api(endpoints.realtimeStatus());
      renderRealtimeStatus();
      renderRealtimeEvents();
    } catch (e) {
      return;
    }
    if (!("EventSource" in window)) return;
    if (realtimeState.source) realtimeState.source.close();
    const source = new EventSource("/api/realtime/events?limit=25");
    realtimeState.source = source;
    source.addEventListener("status", (e) => {
      realtimeState.status = JSON.parse(e.data);
      renderRealtimeStatus();
    });
    source.addEventListener("memory", (e) => addRealtimeEvent(JSON.parse(e.data)));
  }
  function bindBreakdownClicks() {
    $$("#sourceBreakdown .break-row").forEach((row) => bindActivatable(row, () => {
      $("#memorySource").value = row.dataset.filter || "";
      switchTab("memories");
    }));
    $$("#scopeBreakdown .break-row").forEach((row) => bindActivatable(row, () => {
      $("#memoryScope").value = row.dataset.filter || "";
      switchTab("memories");
    }));
    $$("#veracityBreakdown .break-row").forEach((row) => bindActivatable(row, () => {
      $("#memoryVeracity").value = row.dataset.filter || "";
      switchTab("memories");
    }));
    $$("#degradationBreakdown .break-row").forEach((row) => bindActivatable(row, () => {
      const map = { hot: "1", warm: "2", cold: "3" };
      $("#memoryDegradation").value = map[row.dataset.filter] || "";
      switchTab("memories");
    }));
    $$("#sessionBreakdown .break-row").forEach((row) => bindActivatable(row, () => openSessionDetail(row.dataset.filter || "")));
  }
  function currentMemoryFilterValues() {
    return {
      kind: $("#memoryKind").value,
      q: $("#memoryQuery").value,
      source: $("#memorySource").value,
      scope: $("#memoryScope").value,
      sessionId: $("#memorySession").value,
      veracity: $("#memoryVeracity").value,
      degradationTier: $("#memoryDegradation").value,
      trustPreset: $("#memoryTrustPreset").value,
      status: $("#memoryStatus").value,
      sort: $("#memorySort").value
    };
  }
  function updateMemoryListMeta() {
    const countEl = $("#memoryListCount");
    if (countEl) {
      const loaded = latestMemoryItems.length.toLocaleString();
      countEl.textContent = Number.isFinite(memoryTotal) ? `${loaded} loaded · ${memoryTotal.toLocaleString()} total` : `${loaded} loaded`;
    }
    const loadBar = $("#memoryLoadBar");
    if (loadBar) loadBar.classList.toggle("hidden", memoryListIsPreset || !memoryHasMore);
  }
  async function loadMemories() {
    memoryListIsPreset = false;
    memoryOffset = 0;
    memoryTotal = null;
    $("#memoryList").innerHTML = skeletonHtml("Loading memories", 4);
    try {
      const params = memoryFilterParams(currentMemoryFilterValues(), MEMORY_PAGE_SIZE, memoryOffset);
      const data = await api(endpoints.memories(params), { requestKey: "memories" });
      const items = data.items || [];
      latestMemoryItems = mergeMemoryPage([], items);
      memoryTotal = Number.isFinite(Number(data.total)) ? Number(data.total) : null;
      memoryOffset = Number.isFinite(Number(data.next_offset)) ? Number(data.next_offset) : items.length;
      memoryHasMore = typeof data.has_more === "boolean" ? data.has_more : items.length === MEMORY_PAGE_SIZE;
      $("#memoryList").innerHTML = latestMemoryItems.map((item) => memoryItem(item, { selectable: true, selectedSet: bulkSelection })).join("") || stateHtml("empty", "No memories found.", "Try clearing filters or broadening the memory content search.");
      bindMemoryClicks($("#memoryList"));
      bindBulkMemoryControls();
      updateBulkBar();
      updateMemoryListMeta();
    } catch (e) {
      if (isCancelledRequest2(e)) return;
      $("#memoryList").innerHTML = stateHtml("error", "Could not load memories.", e.message || "Try again.");
      memoryHasMore = false;
      updateMemoryListMeta();
    }
  }
  async function loadMoreMemories() {
    if (memoryListIsPreset || !memoryHasMore) return;
    await runButtonAction($("#memoryLoadMore"), "Loading...", async () => {
      const params = memoryFilterParams(currentMemoryFilterValues(), MEMORY_PAGE_SIZE, memoryOffset);
      const data = await api(endpoints.memories(params), { requestKey: "memories-more" });
      const items = data.items || [];
      const seen = new Set(latestMemoryItems.map((item) => item.id));
      const newItems = items.filter((item) => !seen.has(item.id));
      latestMemoryItems = mergeMemoryPage(latestMemoryItems, items, { append: true });
      memoryTotal = Number.isFinite(Number(data.total)) ? Number(data.total) : memoryTotal;
      memoryOffset = Number.isFinite(Number(data.next_offset)) ? Number(data.next_offset) : memoryOffset + items.length;
      memoryHasMore = typeof data.has_more === "boolean" ? data.has_more : items.length === MEMORY_PAGE_SIZE;
      const newHtml = newItems.map((item) => memoryItem(item, { selectable: true, selectedSet: bulkSelection })).join("");
      if (newHtml) $("#memoryList").insertAdjacentHTML("beforeend", newHtml);
      bindMemoryClicks($("#memoryList"));
      bindBulkMemoryControls();
      updateBulkBar();
      updateMemoryListMeta();
    });
  }
  async function loadExpiringSoonPreset() {
    memoryListIsPreset = true;
    memoryTotal = null;
    $("#memoryList").innerHTML = skeletonHtml("Loading memories", 4);
    try {
      const params = memoryFilterParams({ kind: "all", status: "active", sort: "recent" }, 500, 0);
      const data = await api(endpoints.memories(params), { requestKey: "memories" });
      latestMemoryItems = sortByExpiringSoon(data.items || []).slice(0, 100);
      memoryTotal = latestMemoryItems.length;
      memoryHasMore = false;
      $("#memoryList").innerHTML = latestMemoryItems.map((item) => memoryItem(item, { selectable: true, selectedSet: bulkSelection })).join("") || stateHtml("empty", "No memories with a scheduled expiry found.", "Expiring soon only lists active memories with an explicit expiry date set.");
      bindMemoryClicks($("#memoryList"));
      bindBulkMemoryControls();
      updateBulkBar();
      updateMemoryListMeta();
    } catch (e) {
      if (isCancelledRequest2(e)) return;
      $("#memoryList").innerHTML = stateHtml("error", "Could not load memories.", e.message || "Try again.");
    }
  }
  function applyMemoryPreset(key) {
    const preset = memoryPresetByKey(key);
    if (!preset) return;
    resetMemoryFilterControls();
    applyMemoryRouteFilters(preset.filters);
    if (preset.special === "expiring-soon") {
      loadExpiringSoonPreset().then(() => pushRoute(memoryRouteState(), true));
      return;
    }
    refreshMemoriesRouteAndLoad();
  }
  function refreshMemoriesRouteAndLoad() {
    pushRoute(memoryRouteState(), true);
    loadMemories();
  }
  function updateBulkBar() {
    const bar = $("#bulkMemoryBar");
    if (!bar) return;
    const state = bulkSelectionState(latestMemoryItems, bulkSelection, canAdmin());
    bar.classList.toggle("hidden", !state.hasItems);
    $("#bulkSelectionStatus").textContent = state.statusLabel;
    $("#bulkExpire").disabled = state.actionsDisabled;
    $("#bulkVeracity").disabled = state.actionsDisabled;
    $("#bulkExpiry").disabled = state.actionsDisabled;
    $("#bulkImportance").disabled = state.actionsDisabled;
    $("#bulkSelectAll").checked = state.selectAllChecked;
    $("#bulkSelectAll").disabled = state.selectAllDisabled;
  }
  function bindBulkMemoryControls() {
    $$("#memoryList .memory-check").forEach((chk) => chk.onchange = (e) => {
      e.stopPropagation();
      chk.checked ? bulkSelection.add(chk.dataset.id) : bulkSelection.delete(chk.dataset.id);
      updateBulkBar();
    });
  }
  async function expireSelectedMemories(button) {
    const ids = selectedMutableIds(latestMemoryItems, bulkSelection);
    if (!ids.length) return;
    const ok = await confirmAction({ title: "Expire selected memories?", description: `Expire ${ids.length} selected active memories. Backups and audit entries will be created.`, confirmText: "Expire selected", tone: "warn" });
    if (!ok) return;
    await runButtonAction(button, "Expiring...", async () => {
      const result = await runBulkMutation(ids, (id) => postJson("/api/admin/memory/invalidate", { memory_id: id, backup: $("#backupBeforeMutation") ? $("#backupBeforeMutation").checked : true }), "Expired");
      if (!result.failed) bulkSelection.clear();
      await loadStats();
      await loadMemories();
    });
  }
  async function setSelectedImportance(button) {
    const ids = selectedMutableIds(latestMemoryItems, bulkSelection);
    if (!ids.length) return;
    const v = await askImportance(0.5);
    if (v === null) return;
    await runButtonAction(button, "Saving...", async () => {
      const result = await runBulkMutation(ids, (id) => postJson("/api/admin/memory/importance", { memory_id: id, importance: Number(v), backup: $("#backupBeforeMutation") ? $("#backupBeforeMutation").checked : true }), "Updated");
      if (!result.failed) bulkSelection.clear();
      await loadStats();
      await loadMemories();
    });
  }
  async function setSelectedVeracity(button) {
    const ids = selectedMutableIds(latestMemoryItems, bulkSelection);
    if (!ids.length) return;
    const v = await askVeracity("stated");
    if (v === null) return;
    await runButtonAction(button, "Saving...", async () => {
      const result = await runBulkMutation(ids, (id) => postJson("/api/admin/memory/veracity", { memory_id: id, veracity: v, backup: $("#backupBeforeMutation") ? $("#backupBeforeMutation").checked : true }), "Updated");
      if (!result.failed) bulkSelection.clear();
      await loadStats();
      await loadMemories();
    });
  }
  async function setSelectedExpiry(button) {
    const ids = selectedMutableIds(latestMemoryItems, bulkSelection);
    if (!ids.length) return;
    const v = await askExpiry("");
    if (v === null) return;
    await runButtonAction(button, "Saving...", async () => {
      const result = await runBulkMutation(ids, (id) => postJson("/api/admin/memory/expiry", { memory_id: id, valid_until: v, backup: $("#backupBeforeMutation") ? $("#backupBeforeMutation").checked : true }), "Updated");
      if (!result.failed) bulkSelection.clear();
      await loadStats();
      await loadMemories();
    });
  }
  function bindMemoryClicks(root) {
    detailDrawer.bindMemoryClicks(root);
  }
  function canAdmin() {
    return settingsController.canAdmin();
  }
  async function openMemoryDetail(memoryId, opts = {}) {
    await detailDrawer.openMemoryDetail(memoryId, opts);
  }
  async function openSessionDetail(sessionId, opts = {}) {
    await detailDrawer.openSessionDetail(sessionId, opts);
  }
  async function loadTriples() {
    const q = $("#tripleQuery").value.trim();
    try {
      const data = await api(`/api/triples?q=${encodeURIComponent(q)}&limit=300`, { requestKey: "triples" });
      $("#tripleRows").innerHTML = data.items.map((t) => `<tr class="triple-row" data-triple='${esc(JSON.stringify(t))}'><td>${esc(t.subject)}</td><td>${esc(t.predicate)}</td><td>${esc(t.object)}</td><td>${esc(t.confidence ?? "")}</td></tr>`).join("") || '<tr><td colspan="4" class="empty-cell">No triples found.</td></tr>';
      $$("#tripleRows .triple-row").forEach((row) => bindActivatable(row, () => showDetail(JSON.parse(row.dataset.triple), "Triple detail")));
    } catch (e) {
      if (isCancelledRequest2(e)) return;
      $("#tripleRows").innerHTML = `<tr><td colspan="4" class="empty-cell">Could not load triples: ${esc(e.message || "Try again.")}</td></tr>`;
    }
  }
  function consolidationItem(c) {
    return `<div class="item consolidation-item" data-consolidation='${esc(JSON.stringify(c))}'>
    <div class="meta"><span class="badge">${esc(c.session_id || "unknown session")}</span><span class="badge">${esc(c.items_consolidated)} items</span><span>${esc(c.created_at)}</span></div>
    <div class="content">${esc(c.summary_preview)}</div>
    <div class="item-actions"><button class="tiny inspect-consolidation">Inspect</button><button class="tiny view-session" data-session="${esc(c.session_id || "")}">View session memories</button></div>
  </div>`;
  }
  function renderConsolidations() {
    const q = ($("#consolidationQuery")?.value || "").trim().toLowerCase();
    const rows = q ? consolidationState.filter((c) => `${c.session_id || ""} ${c.summary_preview || ""} ${c.created_at || ""}`.toLowerCase().includes(q)) : consolidationState;
    $("#consolidationList").innerHTML = rows.map(consolidationItem).join("") || '<p class="muted">No consolidations found.</p>';
    $$("#consolidationList .consolidation-item").forEach((el) => {
      const data = JSON.parse(el.dataset.consolidation);
      bindActivatable(el, (e) => {
        if (e.target.closest("button")) return;
        showDetail(data, "Consolidation detail");
      });
      el.querySelector(".inspect-consolidation").onclick = () => showDetail(data, "Consolidation detail");
      el.querySelector(".view-session").onclick = () => openSessionDetail(data.session_id || "");
    });
  }
  async function loadConsolidations() {
    const data = await api("/api/consolidations?limit=200");
    consolidationState = data.items;
    renderConsolidations();
  }
  function searchMemoryCard(m) {
    return memoryItem(m);
  }
  function tripleCard(t) {
    return `<div class="item" data-json='${esc(JSON.stringify(t))}'><div class="meta"><span class="badge">fact</span><span>${esc(t.created_at || t.valid_from || "")}</span></div><div class="content"><strong>${esc(t.subject)}</strong> — ${esc(t.predicate)} → <strong>${esc(t.object)}</strong></div></div>`;
  }
  function consolidationCard(c) {
    return `<div class="item" data-json='${esc(JSON.stringify(c))}'><div class="meta"><span class="badge">consolidation</span><span class="badge">${esc(c.items_consolidated)} items</span><span>${esc(c.created_at)}</span></div><div class="content">${esc(c.session_id || "")}: ${esc(c.summary_preview || "")}</div></div>`;
  }
  function bindJsonCards(root, title) {
    detailDrawer.bindJsonCards(root, title);
  }
  async function runSearchFromInput(inputId) {
    const q = $(inputId)?.value.trim() || "";
    if (!q) return;
    $("#globalSearchQuery").value = q;
    switchTab("search");
    await loadGlobalSearch();
  }
  async function menuSearch() {
    await runSearchFromInput("#menuSearchQuery");
  }
  async function loadGlobalSearch() {
    const q = $("#globalSearchQuery")?.value.trim() || "";
    if (!q) {
      $("#globalSearchResults").innerHTML = stateHtml("empty", "Search from the sidebar or type a query above.", "Search looks across memories, facts, and consolidations.");
      return;
    }
    $("#globalSearchResults").innerHTML = skeletonHtml(`Searching for "${q}"`, 3);
    try {
      const data = await api(endpoints.search(q, 30), { requestKey: "global-search" });
      const memories = data.memories || [];
      const triples = data.triples || [];
      const consolidations = data.consolidations || [];
      const total = memories.length + triples.length + consolidations.length;
      $("#globalSearchResults").innerHTML = `
      <div class="search-summary glass"><h3>Search results for “${esc(q)}”</h3><p>${countLabel(total, "result")} · ${countLabel(memories.length, "memory")} · ${countLabel(triples.length, "fact")} · ${countLabel(consolidations.length, "consolidation")}</p></div>
      ${total ? "" : stateHtml("empty", "No results found.", "Try broader terms, a person/project name, or search inside Memories for record-only filters.")}
      <div class="result-section"><h3>Memories <span>${memories.length}</span></h3><div class="memory-grid">${memories.map(searchMemoryCard).join("") || stateHtml("empty", "No memory records matched.")}</div></div>
      <div class="result-section"><h3>Facts <span>${triples.length}</span></h3><div class="memory-grid">${triples.map(tripleCard).join("") || stateHtml("empty", "No graph facts matched.")}</div></div>
      <div class="result-section"><h3>Consolidations <span>${consolidations.length}</span></h3><div class="memory-grid">${consolidations.map(consolidationCard).join("") || stateHtml("empty", "No consolidation summaries matched.")}</div></div>`;
      bindMemoryClicks($("#globalSearchResults"));
      bindJsonCards($("#globalSearchResults"), "Search result detail");
    } catch (e) {
      if (isCancelledRequest2(e)) return;
      $("#globalSearchResults").innerHTML = stateHtml("error", "Search failed.", e.message || "The dashboard could not load search results.");
    }
  }
  function recallItem(x) {
    const m = x.memory;
    return `<div class="item" data-id="${esc(m.id)}"><div class="meta"><span class="badge">score ${esc(x.approx_score)}</span></div>${meta(m)}<div class="content">${esc(m.content)}</div><div class="reasons">${x.reasons.map((r) => `<span>${esc(r)}</span>`).join("")}</div></div>`;
  }
  async function loadRecallDebug() {
    const q = $("#recallQuery")?.value.trim() || "";
    if (!q) {
      $("#recallNote").textContent = "Type a query to explain approximate recall ranking.";
      $("#recallResults").innerHTML = "";
      return;
    }
    $("#recallResults").innerHTML = skeletonHtml("Explaining recall ranking", 3);
    try {
      const data = await api(`/api/recall-debug?q=${encodeURIComponent(q)}&limit=30`, { requestKey: "recall-debug" });
      $("#recallNote").textContent = data.note;
      $("#recallResults").innerHTML = data.items.map(recallItem).join("") || '<p class="muted">No matching memories.</p>';
      bindMemoryClicks($("#recallResults"));
    } catch (e) {
      if (isCancelledRequest2(e)) return;
      $("#recallNote").textContent = "Recall debug failed.";
      $("#recallResults").innerHTML = stateHtml("error", "Could not explain recall ranking.", e.message || "Try again.");
    }
  }
  function timelineEvent(e) {
    return `<div class="timeline-event item" data-json='${esc(JSON.stringify(e.item))}'><div class="meta"><span class="badge">${esc(e.type)}</span><button class="session-chip" data-session="${esc(e.session_id || "")}">${esc(e.session_id || "no session")}</button><span>${esc(e.timestamp)}</span></div><div class="content"><strong>${esc(e.title)}</strong><br>${esc(e.preview)}</div></div>`;
  }
  async function loadTimeline() {
    const q = $("#timelineQuery")?.value.trim() || "";
    const group = $("#timelineGroup")?.value || "day";
    $("#timelineResults").innerHTML = skeletonHtml("Loading timeline", 4);
    try {
      const data = await api(`/api/timeline?q=${encodeURIComponent(q)}&group=${encodeURIComponent(group)}&limit=300`, { requestKey: "timeline" });
      $("#timelineResults").innerHTML = data.groups.map((g) => `<div class="timeline-group"><div class="section-head mini"><h2>${esc(g.key)}</h2><span>${g.count} events</span>${group === "session" && g.key !== "no session" ? `<button class="tiny open-session" data-session="${esc(g.key)}">Open session</button>` : ""}</div><div class="timeline">${g.events.map(timelineEvent).join("")}</div></div>`).join("") || '<p class="muted">No timeline events.</p>';
      bindJsonCards($("#timelineResults"), "Timeline event detail");
      $$("#timelineResults .session-chip").forEach((btn) => btn.onclick = (e) => {
        e.stopPropagation();
        openSessionDetail(btn.dataset.session || "");
      });
      $$("#timelineResults .open-session").forEach((btn) => btn.onclick = () => openSessionDetail(btn.dataset.session || ""));
    } catch (e) {
      if (isCancelledRequest2(e)) return;
      $("#timelineResults").innerHTML = stateHtml("error", "Could not load timeline.", e.message || "Try again.");
    }
  }
  function tinyRows(rows, key = "label") {
    return (rows || []).map((r) => `<div class="break-row"><span>${esc(r[key] || r.label || "unknown")}</span><strong>${Number(r.count || 0).toLocaleString()}</strong></div>`).join("") || '<p class="muted">No data</p>';
  }
  function tripleItem(t) {
    return `<div class="item" data-json='${esc(JSON.stringify(t))}'><div class="meta"><span class="badge">fact</span><span>${esc(t.created_at || t.valid_from || "")}</span></div><div class="content"><strong>${esc(t.subject)}</strong> — ${esc(t.predicate)} → <strong>${esc(t.object)}</strong></div></div>`;
  }
  async function loadTodayDigest(day = "") {
    const suffix = day ? `&day=${encodeURIComponent(day)}` : "";
    const data = await api(`/api/digest/today?limit=80${suffix}`);
    const c = data.counts || {};
    $("#todayCards").innerHTML = [["Added", c.memories_added], ["Retrieved", c.memories_recalled], ["Needs review", c.contaminated_added], ["Lifecycle changes", c.degraded_added], ["Facts", c.triples_added], ["Consolidations", c.consolidations]].map(([label, num]) => `<div class="card"><div class="num">${Number(num || 0).toLocaleString()}</div><div class="label">${label}</div></div>`).join("");
    $("#todayEntities").innerHTML = tinyRows(data.breakdowns?.entities || []);
    $("#todayVeracity").innerHTML = tinyRows(data.breakdowns?.veracity || []);
    $("#todayDegradation").innerHTML = tinyRows(data.breakdowns?.degradation || []);
    $("#todaySources").innerHTML = tinyRows(data.breakdowns?.sources || []);
    $("#todaySessions").innerHTML = tinyRows(data.breakdowns?.sessions || []);
    $("#todayAdded .memory-grid").innerHTML = (data.memories_added || []).map(memoryItem).join("") || '<p class="muted">No memories added today.</p>';
    $("#todayRecalled .memory-grid").innerHTML = (data.memories_recalled || []).map(memoryItem).join("") || '<p class="muted">No memories recalled today.</p>';
    $("#todayTriples .memory-grid").innerHTML = (data.triples_added || []).map(tripleItem).join("") || stateHtml("empty", "No facts added today.");
    $("#todayConsolidations .memory-grid").innerHTML = (data.consolidations || []).map(consolidationCard).join("") || '<p class="muted">No consolidations today.</p>';
    ["todayAdded", "todayRecalled"].forEach((id) => bindMemoryClicks($(`#${id}`)));
    bindJsonCards($("#todayTriples"), "Triple detail");
    bindJsonCards($("#todayConsolidations"), "Consolidation detail");
  }
  function contextLabel(label) {
    return { "Temporary context": "Short-term notes", "Project context": "Project notes" }[label] || label;
  }
  function contextSummary(data) {
    const s = data.summary || {};
    const typeChips = (s.types || []).map((t) => `<span class="context-type-chip">${esc(contextLabel(t.label))} <strong>${Number(t.count || 0).toLocaleString()}</strong></span>`).join("");
    return `<div class="context-summary glass">
    <div><span>Indexed signals</span><strong>${Number(s.indexed_signals || s.active_items || 0).toLocaleString()}</strong></div>
    <div><span>Needs review</span><strong>${Number(s.needs_review || 0).toLocaleString()}</strong></div>
    <div><span>Sensitive</span><strong>${Number(s.sensitive || 0).toLocaleString()}</strong></div>
    <div><span>Sections</span><strong>${Number(s.sections || 0).toLocaleString()}</strong></div>
    ${typeChips ? `<div class="context-types">${typeChips}</div>` : ""}
  </div>`;
  }
  function profileItem(row) {
    const item = row.item || {};
    const attrs = row.kind === "memory" ? `data-id="${esc(item.id || "")}"` : `data-json='${esc(JSON.stringify(item))}'`;
    const confidence = row.confidence_label || "Confidence unknown";
    const pct = Number(row.confidence_pct || row.importance * 100 || 0);
    const extracted = (row.extracted || []).slice(0, 3).map((m) => `<span title="${esc(m.value)}">${esc(m.label)}: ${esc(m.value)}</span>`).join("");
    const provenance = [row.category, row.tier || row.kind, row.source, row.scope, row.status].filter(Boolean).slice(0, 5).map((x) => `<span>${esc(x)}</span>`).join("");
    return `<div class="profile-item context-card ${esc(row.type_tone || "")}" ${attrs}>
    <div class="context-card-head"><span class="badge">${esc(contextLabel(row.context_type || row.kind))}</span><span class="confidence ${pct < 70 ? "warn" : ""}">${esc(confidence)} · ${Math.round(pct)}%</span></div>
    <p>${esc(row.label || "")}</p>
    ${extracted ? `<div class="context-meta extracted">${extracted}</div>` : ""}
    <div class="context-meta"><span>${esc(prettyTime(row.timestamp) || row.timestamp || "")}</span>${provenance}</div>
  </div>`;
  }
  function patternSummary(data = {}) {
    const s = data.summary || {};
    const items = [
      ["Memories scanned", s.indexed_memories || 0],
      ["Triples scanned", s.indexed_triples || 0],
      ["Patterns found", s.patterns_found || data.mnemosyne_summary?.patterns_found || 0],
      ["Provider", data.provider ? "Mnemosyne" : "Dashboard"]
    ];
    return items.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${typeof value === "number" ? Number(value || 0).toLocaleString() : esc(value || "")}</strong></div>`).join("");
  }
  function renderPatternBars(items = [], kind = "pattern") {
    if (!items.length) return '<span class="muted">No patterns yet.</span>';
    const max = Math.max(...items.map((item) => Number(item.count || 0)), 1);
    return items.map((item) => {
      const count = Number(item.count || 0);
      const pct = Math.max(5, Math.round(count / max * 100));
      const query2 = item.query ?? item.label ?? "";
      return `<button class="pattern-bar" data-pattern-kind="${esc(kind)}" data-pattern-query="${esc(query2)}" title="Filter memories for ${esc(item.label || "")}"><span class="pattern-bar-fill" style="width:${pct}%"></span><span class="pattern-bar-label">${esc(item.label || "")}</span><strong>${count.toLocaleString()}</strong></button>`;
    }).join("");
  }
  function applyPatternFilter(kind = "", query2 = "") {
    switchTab("memories");
    $("#memoryKind").value = "all";
    $("#memoryStatus").value = "active";
    $("#memorySort").value = "importance";
    $("#memorySource").value = "";
    $("#memoryScope").value = "";
    $("#memorySession").value = "";
    $("#memoryVeracity").value = "";
    $("#memoryDegradation").value = "";
    $("#memoryTrustPreset").value = "";
    $("#memoryQuery").value = query2 || "";
    loadMemories();
  }
  async function loadPatternInsights() {
    const data = await api(endpoints.patterns(10));
    $("#patternSummary").innerHTML = patternSummary(data);
    $("#patternContent").innerHTML = renderPatternBars(data.content_patterns || [], "content-pattern");
    $("#patternTemporal").innerHTML = renderPatternBars(data.temporal_patterns || [], "temporal-pattern");
    $("#patternSequence").innerHTML = renderPatternBars(data.sequence_patterns || [], "sequence-pattern");
    $("#contextDomainBars").innerHTML = renderPatternBars(data.context_domains || [], "context-domain");
    $("#patternOrigins").innerHTML = renderPatternBars(data.origins || data.sources || [], "origin");
    $("#patternTypes").innerHTML = renderPatternBars(data.memory_types || [], "type");
    $$("#patternInsights .pattern-bar,#contextDomains .pattern-bar").forEach((el) => el.onclick = () => applyPatternFilter(el.dataset.patternKind || "", el.dataset.patternQuery || ""));
  }
  async function loadProfile() {
    const [data] = await Promise.all([api(endpoints.profile(10)), loadPatternInsights()]);
    $("#profileGrid").innerHTML = `${contextSummary(data)}${(data.sections || []).map((s) => `<section class="profile-section glass"><div class="section-head mini"><h2>${esc(contextLabel(s.name))}</h2><span>${esc(s.count)} active item${Number(s.count) === 1 ? "" : "s"}</span></div>${(s.items || []).map(profileItem).join("")}</section>`).join("") || '<p class="muted">No inferred profile data found.</p>'}`;
    $$("#profileGrid .profile-item[data-id]").forEach((el) => bindActivatable(el, () => openMemoryDetail(el.dataset.id)));
    $$("#profileGrid .profile-item[data-json]").forEach((el) => bindActivatable(el, () => showDetail(JSON.parse(el.dataset.json), "Profile source detail")));
  }
  function applyReviewFilter(filter = {}) {
    $("#memoryKind").value = filter.kind || "all";
    $("#memoryQuery").value = "";
    $("#memorySource").value = "";
    $("#memoryScope").value = "";
    $("#memorySession").value = "";
    $("#memoryVeracity").value = filter.veracity || "";
    $("#memoryDegradation").value = filter.degradation_tier || "";
    $("#memoryTrustPreset").value = filter.contaminated_only ? "contaminated" : filter.degraded_only ? "degraded" : filter.due_for_degradation ? "due" : "";
    $("#memoryStatus").value = filter.status || "active";
    $("#memorySort").value = filter.sort || "importance";
    switchTab("memories");
  }
  async function loadReview() {
    await reviewController.loadReview();
  }
  async function loadLifecycle() {
    const data = await api(endpoints.lifecycle(80));
    const queues = data.queues || {};
    const t = data.thresholds || {};
    const weights = t.weights || {};
    $("#lifecycleThresholds").innerHTML = [
      `Tier 2 after ${Number(t.tier2_days || 30).toLocaleString()} days`,
      `Tier 3 after ${Number(t.tier3_days || 180).toLocaleString()} days`,
      `Weights: hot ×${Number(weights["1"] || 1).toFixed(2)} · warm ×${Number(weights["2"] || 0.5).toFixed(2)} · cold ×${Number(weights["3"] || 0.25).toFixed(2)}`,
      "Read-only: no degradation is triggered from this page"
    ].map((x) => `<span>${esc(x)}</span>`).join("");
    $("#lifecycleCards").innerHTML = (data.cards || []).map((card) => `<button class="card review-card lifecycle-card" data-lifecycle-key="${esc(card.key)}"><div class="num">${Number(card.count || 0).toLocaleString()}</div><div class="label">${esc(card.title)}</div><p>${esc(card.description || "")}</p></button>`).join("");
    $("#lifecycleQueues").innerHTML = Object.entries(queues).map(([key, queue]) => lifecycleQueueHtml(key, queue)).join("") || '<p class="muted">No lifecycle queues available.</p>';
    bindMemoryClicks($("#lifecycle"));
    $$("#lifecycle [data-lifecycle-key]").forEach((el) => el.onclick = (e) => {
      e.stopPropagation();
      applyReviewFilter(queues[el.dataset.lifecycleKey]?.filter || {});
    });
    $$("#lifecycle .review-filter").forEach((el) => el.onclick = (e) => {
      e.stopPropagation();
      const key = el.closest("[data-review-key]")?.dataset.reviewKey;
      applyReviewFilter(queues[key]?.filter || {});
    });
  }
  var canvasConstellationVisualiser = createCanvasConstellationVisualiser({
    $,
    $$,
    api,
    esc,
    openMemoryDetail,
    switchTab,
    visualiserResponsiveFill,
    prefersReducedMotion,
    isActive: () => $("#constellation")?.classList.contains("active")
  });
  function stopCanvasVisualiserLoop() {
    return canvasConstellationVisualiser.stop();
  }
  function redrawConstellation() {
    return canvasConstellationVisualiser.redraw();
  }
  function resumeCanvasVisualiser() {
    return canvasConstellationVisualiser.resume();
  }
  function constellationColors() {
    return canvasConstellationVisualiser.constellationColors();
  }
  function neuralColors() {
    return canvasConstellationVisualiser.neuralColors();
  }
  function loadConstellation() {
    return canvasConstellationVisualiser.loadConstellation();
  }
  function resetConstellationView() {
    return canvasConstellationVisualiser.resetConstellationView();
  }
  function toggleConstellationPanMode() {
    return canvasConstellationVisualiser.toggleConstellationPanMode();
  }
  function toggleConstellationPause() {
    return canvasConstellationVisualiser.toggleConstellationPause();
  }
  function switchVisualiserMode(mode) {
    return canvasConstellationVisualiser.switchVisualiserMode(mode);
  }
  function updateVisualiserModeUI() {
    return canvasConstellationVisualiser.updateVisualiserModeUI();
  }
  function updateConstellationPauseButton() {
    return canvasConstellationVisualiser.updateConstellationPauseButton();
  }
  function updateConstellationPanButton() {
    return canvasConstellationVisualiser.updateConstellationPanButton();
  }
  var threeModulePromise = null;
  function loadThreeModule() {
    if (!threeModulePromise) threeModulePromise = import("/static/vendor/three.module.min.js");
    return threeModulePromise;
  }
  function cssHexToInt(hex) {
    const m = String(hex || "").match(/^#([0-9a-f]{6})$/i);
    return m ? parseInt(m[1], 16) : 16777215;
  }
  var threeVisualiser = createThreeVisualiser({
    $,
    $$,
    api,
    esc,
    openMemoryDetail,
    switchTab,
    loadThreeModule,
    constellationColors,
    neuralColors,
    visualiserResponsiveFill,
    prefersReducedMotion,
    isCancelledRequest: isCancelledRequest2
  });
  function loadThreeVisualiser() {
    return threeVisualiser.loadThreeVisualiser();
  }
  function resetThreeCamera() {
    return threeVisualiser.resetThreeCamera();
  }
  function threeInspectorDefault() {
    return threeVisualiser.threeInspectorDefault();
  }
  function clearThreeScene() {
    return threeVisualiser.clearThreeScene();
  }
  function resizeThree() {
    return threeVisualiser.resizeThree();
  }
  function switchThreeMode(mode) {
    return threeVisualiser.switchThreeMode(mode);
  }
  function toggleThreePanMode() {
    return threeVisualiser.togglePanMode();
  }
  function toggleThreePause() {
    return threeVisualiser.togglePause();
  }
  function isThreeVisualiserRendering() {
    return threeVisualiser.isRendering();
  }
  function resumeThreeVisualiser() {
    return threeVisualiser.resume();
  }
  var memoryPalaceVisualiser = createMemoryPalaceVisualiser({
    $,
    $$,
    api,
    esc,
    openMemoryDetail,
    loadThreeModule,
    cssHexToInt,
    constellationColors,
    prefersReducedMotion,
    isCancelledRequest: isCancelledRequest2,
    isActive: () => sectionFor(currentRoute.tab) === "memoryPalace"
  });
  function loadMemoryPalace() {
    return memoryPalaceVisualiser.loadMemoryPalace();
  }
  function resetMemoryPalaceDiver() {
    return memoryPalaceVisualiser.resetMemoryPalaceDiver();
  }
  function palaceSearchBeacon() {
    return memoryPalaceVisualiser.palaceSearchBeacon();
  }
  function clearPalaceScene() {
    return memoryPalaceVisualiser.clearPalaceScene();
  }
  function resizeMemoryPalace() {
    return memoryPalaceVisualiser.resizeMemoryPalace();
  }
  function isMemoryPalaceRendering() {
    return memoryPalaceVisualiser.isRendering();
  }
  function resumeMemoryPalace() {
    return memoryPalaceVisualiser.resume();
  }
  async function loadMemoria() {
    const nameMap = { facts: "Facts", timelines: "Timelines", instructions: "Instructions", kg: "KG", preferences: "Preferences" };
    const stats = await api("/api/memoria/stats");
    $("#memoriaCards").innerHTML = Object.entries(stats.tables || {}).map(
      ([tbl, info]) => `<div class="card"><div class="num">${Number(info.count).toLocaleString()}</div><div class="label">${nameMap[tbl.replace("memoria_", "")] || tbl.replace("memoria_", "")}</div></div>`
    ).join("");
    $("#memoriaCounts").innerHTML = Object.entries(stats.tables || {}).map(
      ([tbl, info]) => `<div class="break-row"><span>${nameMap[tbl.replace("memoria_", "")] || tbl.replace("memoria_", "")}</span><strong>${Number(info.count).toLocaleString()}</strong></div>`
    ).join("");
    const sessionEl = $("#memoriaSessions");
    sessionEl.innerHTML = (stats.top_sessions || []).map(
      (s) => `<div class="break-row"><span>${esc(s.session_id.slice(0, 24))}</span><strong>${s.count}</strong></div>`
    ).join("") || '<span class="muted">no data</span>';
    loadMemoriaTable("memoriaFacts", "/api/memoria/facts", "memoriaFactsList", "memoriaFactsCount");
    loadMemoriaTable("memoriaTimelines", "/api/memoria/timelines", "memoriaTimelinesList", "memoriaTimelinesCount");
    loadMemoriaTable("memoriaInstructions", "/api/memoria/instructions", "memoriaInstructionsList", "memoriaInstructionsCount");
    loadMemoriaKg();
    loadMemoriaTable("memoriaPreferences", "/api/memoria/preferences", "memoriaPreferencesList", "memoriaPreferencesCount");
  }
  async function loadMemoriaTable(inputId, apiPath, listId, countId) {
    const q = $(`#${inputId}Query`)?.value?.trim() || "";
    const list = $(`#${listId}`);
    if (!list) return;
    list.innerHTML = skeletonHtml("Loading MEMORIA entries", 3);
    try {
      const r = await api(`${apiPath}?q=${encodeURIComponent(q)}&limit=200`, { requestKey: `memoria:${apiPath}` });
      const items = r.items || [];
      if (countId) $(`#${countId}`).textContent = `${items.length} entries`;
      if (!items.length) {
        list.innerHTML = '<div class="muted" style="padding:2rem;text-align:center">No entries found.</div>';
        return;
      }
      const renderer = memoriaRenderer(apiPath);
      list.innerHTML = items.map((item) => renderer(item)).join("");
    } catch (e) {
      if (isCancelledRequest2(e)) return;
      list.innerHTML = stateHtml("error", "Could not load MEMORIA entries.", e.message || "Try again.");
    }
  }
  function memoriaRenderer(apiPath) {
    const hidden = /* @__PURE__ */ new Set(["id", "message_idx", "updated_msg_idx", "valid_from_msg_idx", "valid_to_msg_idx", "version_id", "previous_value"]);
    if (apiPath.includes("/facts")) {
      return function(item) {
        const key = esc(item.key || "");
        const value = esc(item.value || "");
        const ctx = item.context_snippet ? esc(item.context_snippet) : "";
        const meta2 = [
          item.fact_type ? `<span class="badge">${esc(item.fact_type)}</span>` : "",
          item.importance ? `<span class="badge">imp ${Number(item.importance).toFixed(2)}</span>` : "",
          item.session_id && item.session_id !== "default" ? `<span class="badge">${esc(item.session_id.slice(0, 19))}</span>` : ""
        ].filter(Boolean).join("");
        return `<div class="item"><div class="meta">${meta2}</div><div class="content"><strong>${key}</strong>${value ? ": " + value : ""}</div>${ctx ? `<div class="content" style="font-size:.85em;opacity:.7;word-break:break-word">${ctx}</div>` : ""}</div>`;
      };
    }
    if (apiPath.includes("/timelines")) {
      return function(item) {
        const desc = esc(String(item.description || ""));
        const date = item.date ? esc(item.date) : "";
        const meta2 = [
          date ? `<span class="badge">${date}</span>` : "",
          item.source ? `<span class="badge">${esc(item.source)}</span>` : "",
          item.session_id && item.session_id !== "default" ? `<span class="badge">${esc(item.session_id.slice(0, 19))}</span>` : ""
        ].filter(Boolean).join("");
        return `<div class="item"><div class="meta">${meta2}</div><div class="content">${desc}</div></div>`;
      };
    }
    if (apiPath.includes("/instructions")) {
      return function(item) {
        const instr = esc(item.instruction || "");
        const topic = item.topic ? esc(item.topic) : "";
        const ctx = item.context_snippet ? esc(item.context_snippet) : "";
        const meta2 = [
          topic ? `<span class="badge">${topic}</span>` : "",
          item.active == 1 ? '<span class="badge status-active">active</span>' : '<span class="badge status-expired">inactive</span>',
          item.session_id && item.session_id !== "default" ? `<span class="badge">${esc(item.session_id.slice(0, 19))}</span>` : ""
        ].filter(Boolean).join("");
        return `<div class="item"><div class="meta">${meta2}</div><div class="content">${instr}</div>${ctx ? `<div class="content" style="font-size:.85em;opacity:.7;word-break:break-word">${ctx}</div>` : ""}</div>`;
      };
    }
    return function(item) {
      const content = item.preference || item.instruction || item.description || item.value || JSON.stringify(item);
      const meta2 = Object.entries(item).filter(([k, v]) => !hidden.has(k) && v !== null && v !== void 0 && v !== "" && !["preference", "instruction", "description", "value", "context_snippet", "key"].includes(k)).map(([k, v]) => `<span class="badge">${esc(k)}: ${esc(String(v).slice(0, 40))}</span>`).join("");
      return `<div class="item"><div class="meta">${meta2}</div><div class="content">${esc(String(content).slice(0, 500))}</div></div>`;
    };
  }
  async function loadMemoriaKg() {
    const q = $("#memoriaKgQuery")?.value?.trim() || "";
    const tbody = $("#memoriaKgRows");
    if (!tbody) return;
    let items = [];
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Loading MEMORIA graph entries...</td></tr>';
    try {
      const r = await api(`/api/memoria/kg?q=${encodeURIComponent(q)}&limit=200`, { requestKey: "memoria:kg" });
      items = r.items || [];
      $("#memoriaKgCount").textContent = `${items.length} entries`;
    } catch (e) {
      if (isCancelledRequest2(e)) return;
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">Could not load MEMORIA KG: ${esc(e.message || "Try again.")}</td></tr>`;
      return;
    }
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center">No triples found.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map((item) => {
      const confidence = item.confidence !== null && item.confidence !== void 0 ? Number(item.confidence).toFixed(2) : "—";
      return `<tr><td>${esc(item.subject || "")}</td><td>${esc(item.predicate || "")}</td><td>${esc(item.object || "")}</td><td>${confidence}</td></tr>`;
    }).join("");
  }
  $$("nav button").forEach((b) => b.onclick = () => switchTab(b.dataset.tab));
  $$(".section-tabs button").forEach((b) => b.onclick = () => {
    const panelRoute = { exploreMemories: "memories", exploreRecall: "recall", activityTimeline: "timelineView", activityConsolidations: "consolidations", graphGraph: "graph", graphTriples: "triples", todayAdded: "todayAdded", todayRecalled: "todayRecalled", todayTriples: "todayTriples", todayConsolidations: "todayConsolidations" }[b.dataset.panel];
    if (panelRoute) {
      switchTab(panelRoute);
      return;
    }
    const section = b.closest(".tab")?.id;
    showPanel(section, b.dataset.panel);
  });
  $$("[data-jump]").forEach((b) => b.onclick = () => switchTab(b.dataset.jump));
  $("#mobileMenuToggle").onclick = () => {
    document.body.classList.toggle("mobile-menu-open");
    const isOpen = document.body.classList.contains("mobile-menu-open");
    $("#mobileMenuToggle").textContent = isOpen ? "×" : "☰";
    $("#mobileMenuToggle").setAttribute("aria-expanded", String(isOpen));
  };
  window.addEventListener("resize", closeMobileMenuForViewportChange, { passive: true });
  window.addEventListener("orientationchange", closeMobileMenuForViewportChange, { passive: true });
  document.addEventListener("fullscreenchange", updateVisualiserFullscreenButtons);
  $("#memorySearch").onclick = refreshMemoriesRouteAndLoad;
  $("#bulkSelectAll").onchange = () => {
    latestMemoryItems.forEach((x) => $("#bulkSelectAll").checked ? bulkSelection.add(x.id) : bulkSelection.delete(x.id));
    loadMemories();
  };
  $("#bulkClear").onclick = () => {
    const previous = new Set(bulkSelection);
    bulkSelection.clear();
    loadMemories();
    showToast({ tone: "info", title: "Selection cleared", body: `Cleared ${previous.size} selected memories.`, actionLabel: "Undo", action: () => {
      bulkSelection = previous;
      loadMemories();
    } });
  };
  $("#bulkExpire").onclick = () => expireSelectedMemories($("#bulkExpire"));
  $("#bulkVeracity").onclick = () => setSelectedVeracity($("#bulkVeracity"));
  $("#bulkExpiry").onclick = () => setSelectedExpiry($("#bulkExpiry"));
  $("#bulkImportance").onclick = () => setSelectedImportance($("#bulkImportance"));
  $("#memoryQuery").onkeydown = (e) => {
    if (e.key === "Enter") refreshMemoriesRouteAndLoad();
  };
  reviewController.bindGlobalControls();
  $("#globalSearchButton").onclick = () => runButtonAction($("#globalSearchButton"), "Searching...", loadGlobalSearch);
  $("#globalSearchQuery").onkeydown = (e) => {
    if (e.key === "Enter") $("#globalSearchButton").click();
  };
  $("#menuSearchButton").onclick = () => runButtonAction($("#menuSearchButton"), "Searching...", menuSearch);
  $("#menuSearchQuery").onkeydown = (e) => {
    if (e.key === "Enter") $("#menuSearchButton").click();
  };
  $("#recallButton").onclick = () => runButtonAction($("#recallButton"), "Explaining...", loadRecallDebug);
  $("#recallQuery").onkeydown = (e) => {
    if (e.key === "Enter") $("#recallButton").click();
  };
  $("#timelineButton").onclick = () => runButtonAction($("#timelineButton"), "Loading...", loadTimeline);
  $("#timelineQuery").onkeydown = (e) => {
    if (e.key === "Enter") $("#timelineButton").click();
  };
  $("#timelineGroup").onchange = loadTimeline;
  $("#memoryClear").onclick = () => {
    resetMemoryFilterControls();
    refreshMemoriesRouteAndLoad();
  };
  ["memoryKind", "memorySource", "memoryScope", "memorySession", "memoryVeracity", "memoryDegradation", "memoryTrustPreset", "memoryStatus", "memorySort"].forEach((id) => $("#" + id).onchange = refreshMemoriesRouteAndLoad);
  $("#memoryLoadMore").onclick = loadMoreMemories;
  $$("#memoryPresetBar [data-memory-preset]").forEach((btn) => btn.onclick = () => applyMemoryPreset(btn.dataset.memoryPreset));
  $("#tripleSearch").onclick = loadTriples;
  $("#tripleQuery").onkeydown = (e) => {
    if (e.key === "Enter") loadTriples();
  };
  $("#graphRefresh").onclick = loadGraph;
  $("#graphQuery").onkeydown = (e) => {
    if (e.key === "Enter") loadGraph();
  };
  $("#graphClear").onclick = () => {
    $("#graphQuery").value = "";
    loadGraph();
  };
  $("#graphResetView").onclick = resetGraphView;
  $("#insightsRefresh").onclick = loadInsights;
  $("#insightsDays").onchange = loadInsights;
  $("#constellationRefresh").onclick = loadConstellation;
  $("#constellationReset").onclick = resetConstellationView;
  $("#constellationPanMode").onclick = toggleConstellationPanMode;
  $("#constellationPause").onclick = toggleConstellationPause;
  $("#constellationFullscreen").onclick = () => toggleVisualiserFullscreen(".constellation-wrap");
  $("#constellationExitFullscreen").onclick = exitVisualiserFullscreen;
  $$(".visualiser-tabs button[data-visualiser]").forEach((b) => b.onclick = () => switchVisualiserMode(b.dataset.visualiser));
  $("#threeRefresh").onclick = loadThreeVisualiser;
  $("#threeReset").onclick = () => {
    resetThreeCamera();
    threeInspectorDefault();
  };
  $("#threePanMode").onclick = toggleThreePanMode;
  $("#threePause").onclick = toggleThreePause;
  $("#threeFullscreen").onclick = () => toggleVisualiserFullscreen("#threeViewport");
  $("#threeExitFullscreen").onclick = exitVisualiserFullscreen;
  $("#palaceRefresh").onclick = loadMemoryPalace;
  $("#palaceReset").onclick = resetMemoryPalaceDiver;
  $("#palaceSearchButton").onclick = palaceSearchBeacon;
  $("#palaceSearchQuery").onkeydown = (e) => {
    if (e.key === "Enter") palaceSearchBeacon();
  };
  $("#palaceFullscreen").onclick = () => toggleVisualiserFullscreen("#palaceViewport");
  $("#palaceExitFullscreen").onclick = exitVisualiserFullscreen;
  $$(".visualiser-tabs button[data-three-mode]").forEach((b) => b.onclick = () => switchThreeMode(b.dataset.threeMode));
  updateVisualiserModeUI();
  updateConstellationPauseButton();
  updateConstellationPanButton();
  $("#consolidationQuery").oninput = renderConsolidations;
  $("#consolidationClear").onclick = () => {
    $("#consolidationQuery").value = "";
    renderConsolidations();
  };
  $("#memoriaFactsSearch").onclick = () => loadMemoriaTable("memoriaFacts", "/api/memoria/facts", "memoriaFactsList", "memoriaFactsCount");
  $("#memoriaFactsQuery").onkeydown = (e) => {
    if (e.key === "Enter") $("#memoriaFactsSearch").click();
  };
  $("#memoriaTimelinesSearch").onclick = () => loadMemoriaTable("memoriaTimelines", "/api/memoria/timelines", "memoriaTimelinesList", "memoriaTimelinesCount");
  $("#memoriaTimelinesQuery").onkeydown = (e) => {
    if (e.key === "Enter") $("#memoriaTimelinesSearch").click();
  };
  $("#memoriaInstructionsSearch").onclick = () => loadMemoriaTable("memoriaInstructions", "/api/memoria/instructions", "memoriaInstructionsList", "memoriaInstructionsCount");
  $("#memoriaInstructionsQuery").onkeydown = (e) => {
    if (e.key === "Enter") $("#memoriaInstructionsSearch").click();
  };
  $("#memoriaKgSearch").onclick = loadMemoriaKg;
  $("#memoriaKgQuery").onkeydown = (e) => {
    if (e.key === "Enter") loadMemoriaKg();
  };
  $("#memoriaPreferencesSearch").onclick = () => loadMemoriaTable("memoriaPreferences", "/api/memoria/preferences", "memoriaPreferencesList", "memoriaPreferencesCount");
  $("#memoriaPreferencesQuery").onkeydown = (e) => {
    if (e.key === "Enter") $("#memoriaPreferencesSearch").click();
  };
  $("#closeDetail").onclick = () => closeDetail();
  settingsController.bindControls();
  $("#retryBootstrap").onclick = () => bootstrapDashboard().catch(handleInitError);
  $("#copyBootError").onclick = copyBootErrorDetails;
  function toggleTheme() {
    setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
  }
  $("#themeToggle").onclick = toggleTheme;
  $("#mobileThemeToggle").onclick = toggleTheme;
  initLiveMemoryInfiniteScroll();
  window.addEventListener("popstate", (e) => applyRoute(e.state || urlToRoute()));
  window.addEventListener("hashchange", () => applyRoute(urlToRoute()));
  window.addEventListener("keydown", handleGlobalKeyboard);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    resumeThreeVisualiser();
    resumeMemoryPalace();
    resumeCanvasVisualiser();
  });
  initTheme();
  var initialRoute = urlToRoute();
  pushRoute(initialRoute, true);
  renderBootErrorStatus();
  bootstrapDashboard().catch(handleInitError);
})();
