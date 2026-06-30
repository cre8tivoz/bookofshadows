export function canonicalTab(tab) {
  if (tab === "constellation") return "visualiserlegacy";
  if (tab === "visualiser3d") return "visualiser";
  if (tab === "history") return "activity";
  return tab || "overview";
}

export function routeTabState(tab = "overview") {
  return { tab: canonicalTab(tab || "overview") };
}

export function routeToUrl(state, currentUrl = `${location.pathname}${location.search}`) {
  const url = new URL(currentUrl, "http://dashboard.local");
  const params = url.searchParams;
  ["tab", "memory", "session"].forEach((k) => params.delete(k));
  params.set("tab", state.tab || "overview");
  if (state.drawer?.type === "memory") params.set("memory", state.drawer.id);
  if (state.drawer?.type === "session") params.set("session", state.drawer.id);
  const qs = params.toString();
  return url.pathname + (qs ? `?${qs}` : "");
}

export function urlToRoute(currentUrl = `${location.pathname}${location.search}`) {
  const url = new URL(currentUrl, "http://dashboard.local");
  const params = url.searchParams;
  const route = { tab: canonicalTab(params.get("tab") || "overview") };
  if (params.get("memory")) route.drawer = { type: "memory", id: params.get("memory") };
  else if (params.get("session")) route.drawer = { type: "session", id: params.get("session") };
  if (route.drawer && (!params.get("tab") || route.tab === "overview")) {
    route.tab = route.drawer.type === "memory" ? "memories" : "timelineView";
  }
  return route;
}
