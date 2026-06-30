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

  test("formats singular and plural count labels", () => {
    expect(countLabel(1, "memory")).toBe("1 memory");
    expect(countLabel(1200, "memory")).toBe("1,200 memories");
  });
});
