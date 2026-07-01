import { describe, expect, test } from "vitest";

import { breakdown, countLabel, optionsFrom, stateHtml } from "../../static/src/ui/render.js";

describe("render helpers", () => {
  test("renders escaped state cards", () => {
    const html = stateHtml("error", "<No data>", "Try <again>");

    expect(html).toContain("state-error");
    expect(html).toContain("&lt;No data&gt;");
    expect(html).toContain("Try &lt;again&gt;");
  });

  test("builds unique select options from rows", () => {
    const options = optionsFrom(
      [
        { source: "chat", label: "Chat", count: 2 },
        { source: "chat", label: "Duplicate", count: 9 },
        { source: "", label: "Empty", count: 1 },
        { source: "tool", label: "Tool", count: 1 },
      ],
      "source",
      "label",
    );

    expect(options).toEqual([
      { value: "chat", label: "Chat", count: 2 },
      { value: "tool", label: "Tool", count: 1 },
    ]);
  });

  test("renders breakdown rows with escaped labels and counts", () => {
    const html = breakdown([{ source: "<chat>", count: 3 }], "source");

    expect(html).toContain('data-filter="&lt;chat&gt;"');
    expect(html).toContain("&lt;chat&gt;");
    expect(html).toContain("<strong>3</strong>");
  });

  test("renders empty breakdown text when no rows exist", () => {
    expect(breakdown([], "source")).toBe('<p class="muted">No data</p>');
  });

  test("sizes each row's fill bar to its share of the total, not the max row", () => {
    const html = breakdown(
      [
        { source: "chat", count: 6 },
        { source: "tool", count: 2 },
        { source: "api", count: 2 },
      ],
      "source",
    );

    expect(html).toContain('<span class="break-row-fill" style="width:60%"></span><span class="break-row-label">chat</span>');
    expect(html).toContain('<span class="break-row-fill" style="width:20%"></span><span class="break-row-label">tool</span>');
    expect(html).toContain('<span class="break-row-fill" style="width:20%"></span><span class="break-row-label">api</span>');
  });

  test("gives a small visible minimum fill to non-zero counts that would otherwise round to 0%", () => {
    const html = breakdown(
      [
        { source: "big", count: 500 },
        { source: "tiny", count: 1 },
      ],
      "source",
    );

    expect(html).toContain('<span class="break-row-fill" style="width:2%"></span><span class="break-row-label">tiny</span>');
  });

  test("formats singular and plural count labels", () => {
    expect(countLabel(1, "memory")).toBe("1 memory");
    expect(countLabel(1200, "memory")).toBe("1,200 memories");
  });
});
