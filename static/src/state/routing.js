const MEMORY_FILTER_KEYS = [
  "q",
  "status",
  "source",
  "scope",
  "session_id",
  "veracity",
  "degradation_tier",
  "trust",
  "sort",
  "kind",
];

export function canonicalTab(tab) {
  if (tab === "constellation") return "visualiserlegacy";
  if (tab === "visualiser3d") return "visualiser";
  if (tab === "history") return "activity";
  return tab || "overview";
}

export function routeTabState(tab = "overview", extra = {}) {
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

export function routeToUrl(state, currentUrl = `${location.pathname}${location.search}${location.hash}`) {
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

export function urlToRoute(currentUrl = `${location.pathname}${location.search}${location.hash}`) {
  const url = new URL(currentUrl, "http://dashboard.local");
  return routeFromHash(url.hash) || routeFromLegacyQuery(url);
}
