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

  test("parses session drawer and default session route", () => {
    const route = urlToRoute("/?session=s1");

    expect(route).toEqual({ tab: "timelineView", drawer: { type: "session", id: "s1" } });
  });

  test("serializes routes while preserving unrelated query params", () => {
    const url = routeToUrl(
      { tab: "memories", drawer: { type: "memory", id: "wm-001" } },
      "/dashboard?theme=dark&tab=overview&session=old",
    );

    expect(url).toBe("/dashboard?theme=dark&tab=memories&memory=wm-001");
  });
});
