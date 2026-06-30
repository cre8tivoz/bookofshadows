import { describe, expect, test } from "vitest";

import { isMutableMemory, liveEventMeta, memoryItem, meta } from "../../static/src/features/memories.js";

describe("memory rendering", () => {
  const item = {
    id: "wm-001",
    content: "[USER] <keep this safe>",
    memory_kind: "working",
    source: "chat",
    timestamp: "2026-05-04T08:15:00Z",
    session_id: "session_abcdef123456",
    importance: 0.92,
    veracity: "stated",
    trust_weight: 1,
    degradation_label: "hot",
    degradation_tier: 1,
    degradation_weight: 1,
    status: "active",
  };

  test("renders escaped meta chips for memory attributes", () => {
    const html = meta(item, {
      formatter: new Intl.DateTimeFormat("en-AU", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    });

    expect(html).toContain("working");
    expect(html).toContain("stated");
    expect(html).toContain("hot · T1");
    expect(html).toContain("0.92");
    expect(html).toContain("session_…123456");
  });

  test("renders memory cards with role badges, escaped content, and selectable state", () => {
    const selected = new Set(["wm-001"]);
    const html = memoryItem(item, { selectable: true, selectedSet: selected, checkClass: "review-check" });

    expect(html).toContain('data-id="wm-001"');
    expect(html).toContain("chip-role-user");
    expect(html).toContain("&lt;keep this safe&gt;");
    expect(html).not.toContain("[USER]");
    expect(html).toContain('class="review-check"');
    expect(html).toContain("checked");
  });

  test("maps live event badges", () => {
    expect(liveEventMeta({ event_type: "MEMORY_ADDED" })).toEqual(["new", "new", "live-badge-new"]);
    expect(liveEventMeta({ event_type: "UNKNOWN" })).toEqual(["", ""]);
  });

  test("treats only active memories as mutable", () => {
    expect(isMutableMemory({ status: "active" })).toBe(true);
    expect(isMutableMemory({ status: "expired" })).toBe(false);
    expect(isMutableMemory({ status: "superseded" })).toBe(false);
  });
});
