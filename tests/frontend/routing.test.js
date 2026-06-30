import { describe, expect, test } from "vitest";

import { canonicalTab, routeTabState, routeToUrl, urlToRoute } from "../../static/src/state/routing.js";

describe("routing helpers", () => {
  test("canonicalizes legacy tab aliases", () => {
    expect(canonicalTab("constellation")).toBe("visualiserlegacy");
    expect(canonicalTab("visualiser3d")).toBe("visualiser");
    expect(canonicalTab("history")).toBe("activity");
    expect(canonicalTab("")).toBe("overview");
  });

  test("returns canonical route tab state", () => {
    expect(routeTabState("history")).toEqual({ tab: "activity" });
    expect(routeTabState()).toEqual({ tab: "overview" });
  });

  test("parses tab and memory drawer from URLs", () => {
    const route = urlToRoute("/?tab=overview&memory=wm-001");

    expect(route).toEqual({ tab: "memories", drawer: { type: "memory", id: "wm-001" } });
  });

  test("parses hash tab routes", () => {
    expect(urlToRoute("/#/memories")).toEqual({ tab: "memories" });
    expect(urlToRoute("/#/graph")).toEqual({ tab: "graph" });
  });

  test("parses hash memory deep links", () => {
    expect(urlToRoute("/#/memory/wm-001")).toEqual({ tab: "memories", drawer: { type: "memory", id: "wm-001" } });
  });

  test("parses hash session deep links", () => {
    expect(urlToRoute("/#/session/s1")).toEqual({ tab: "timelineView", drawer: { type: "session", id: "s1" } });
  });

  test("parses memory route filter params", () => {
    expect(urlToRoute("/#/memories?q=whoop&status=active&source=chat&scope=global")).toEqual({
      tab: "memories",
      filters: {
        q: "whoop",
        status: "active",
        source: "chat",
        scope: "global",
      },
    });
  });

  test("parses session drawer and default session route", () => {
    const route = urlToRoute("/?session=s1");

    expect(route).toEqual({ tab: "timelineView", drawer: { type: "session", id: "s1" } });
  });

  test("serializes routes while preserving unrelated query params", () => {
    const url = routeToUrl(
      { tab: "memories", drawer: { type: "memory", id: "wm-001" } },
      "/dashboard?theme=dark&tab=overview&session=old",
    );

    expect(url).toBe("/dashboard?theme=dark#/memory/wm-001");
  });

  test("serializes tab routes to hash URLs", () => {
    expect(routeToUrl({ tab: "graph" }, "/dashboard?theme=dark")).toBe("/dashboard?theme=dark#/graph");
  });

  test("serializes memory deep links to hash URLs", () => {
    expect(routeToUrl({ tab: "memories", drawer: { type: "memory", id: "wm-001" } }, "/dashboard")).toBe("/dashboard#/memory/wm-001");
  });

  test("serializes memory filter params to hash URLs", () => {
    expect(routeToUrl({ tab: "memories", filters: { q: "whoop", status: "active" } }, "/dashboard")).toBe(
      "/dashboard#/memories?q=whoop&status=active",
    );
  });
});
