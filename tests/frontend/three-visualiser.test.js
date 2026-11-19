import { describe, expect, test } from "vitest";

import { threeNodeDirectOpenMemoryId } from "../../static/src/visualisers/three-visualiser.js";

describe("three visualiser direct-open decision", () => {
  test("returns the memory id for a memory node so the drawer opens on selection", () => {
    expect(
      threeNodeDirectOpenMemoryId({ id: "m1", kind: "memory", memory_id: "mem-123" })
    ).toBe("mem-123");
  });

  test("returns null for an entity/topic node so it keeps the Search this behaviour", () => {
    expect(
      threeNodeDirectOpenMemoryId({ id: "e1", kind: "entity", label: "Sydney" })
    ).toBeNull();
  });

  test("returns null for missing or empty memory ids", () => {
    expect(threeNodeDirectOpenMemoryId({ id: "m2", memory_id: "" })).toBeNull();
    expect(threeNodeDirectOpenMemoryId({ id: "x" })).toBeNull();
    expect(threeNodeDirectOpenMemoryId(null)).toBeNull();
  });
});
