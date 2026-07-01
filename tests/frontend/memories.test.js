import { describe, expect, test } from "vitest";

import {
  bulkSelectionState,
  isMutableMemory,
  liveEventMeta,
  memoryFilterParams,
  memoryItem,
  memoryPresetByKey,
  mergeMemoryPage,
  meta,
  selectedMutableIds,
  sortByExpiringSoon,
} from "../../static/src/features/memories.js";

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

describe("memory browser state helpers", () => {
  test("builds memory query parameters from filters and trust presets", () => {
    const params = memoryFilterParams({
      kind: "working",
      q: "  oath ledger  ",
      source: "dashboard",
      scope: "global",
      sessionId: "session-7",
      veracity: "stated",
      degradationTier: "2",
      trustPreset: "due",
      status: "active",
      sort: "oldest",
    });

    expect(params.toString()).toBe(
      "kind=working&q=oath+ledger&source=dashboard&scope=global&session_id=session-7&veracity=stated&degradation_tier=2&contaminated_only=&degraded_only=&due_for_degradation=1&status=active&sort=oldest&limit=150&offset=0",
    );
  });

  test("carries an explicit page offset for pagination", () => {
    const params = memoryFilterParams({ kind: "all" }, 150, 300);

    expect(params.get("limit")).toBe("150");
    expect(params.get("offset")).toBe("300");
  });

  test("selects only active memories for bulk mutations", () => {
    const items = [
      { id: "m-1", status: "active" },
      { id: "m-2", status: "expired" },
      { id: "m-3" },
    ];

    expect(selectedMutableIds(items, new Set(["m-1", "m-2", "m-3", "missing"]))).toEqual(["m-1", "m-3"]);
  });

  test("derives bulk-selection UI state from current items and permissions", () => {
    const items = [
      { id: "m-1", status: "active" },
      { id: "m-2", status: "expired" },
    ];
    const state = bulkSelectionState(items, new Set(["m-1", "m-2", "stale"]), true);

    expect(state).toEqual({
      hasItems: true,
      selectedCount: 3,
      actionableCount: 1,
      statusLabel: "3 selected · 1 active",
      actionsDisabled: false,
      selectAllChecked: true,
      selectAllDisabled: false,
    });

    expect(bulkSelectionState(items, new Set(["m-1"]), false).actionsDisabled).toBe(true);
    expect(bulkSelectionState([], new Set(), true).selectAllDisabled).toBe(true);
  });

  test("merges a fresh page by replacing the existing items", () => {
    const existing = [{ id: "m-1" }, { id: "m-2" }];
    const page = [{ id: "m-3" }];

    expect(mergeMemoryPage(existing, page)).toEqual([{ id: "m-3" }]);
  });

  test("appends a page while deduplicating by id", () => {
    const existing = [{ id: "m-1", content: "old" }, { id: "m-2" }];
    const page = [{ id: "m-2", content: "refreshed" }, { id: "m-3" }];

    expect(mergeMemoryPage(existing, page, { append: true })).toEqual([
      { id: "m-1", content: "old" },
      { id: "m-2", content: "refreshed" },
      { id: "m-3" },
    ]);
  });
});

describe("saved memory filter presets", () => {
  test("resolves a known preset by key", () => {
    const preset = memoryPresetByKey("needs-review");

    expect(preset).toMatchObject({ label: "Needs review", filters: { trust: "contaminated" } });
  });

  test("returns null for an unknown preset key", () => {
    expect(memoryPresetByKey("not-a-real-preset")).toBeNull();
  });

  test("flags expiring-soon as a preset requiring client-side sorting", () => {
    const preset = memoryPresetByKey("expiring-soon");

    expect(preset.special).toBe("expiring-soon");
  });

  test("sorts items with a scheduled expiry ascending and drops items without one", () => {
    const items = [
      { id: "m-1", valid_until: "2026-08-01T00:00:00Z" },
      { id: "m-2", valid_until: null },
      { id: "m-3", valid_until: "2026-07-10T00:00:00Z" },
    ];

    expect(sortByExpiringSoon(items).map((item) => item.id)).toEqual(["m-3", "m-1"]);
  });
});
