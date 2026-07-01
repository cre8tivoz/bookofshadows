import { beforeEach, describe, expect, test } from "vitest";

import {
  actionSummary,
  keyboardActionForEvent,
  renderToast,
  setButtonPending,
  skeletonHtml,
} from "../../static/src/ui/feedback.js";

describe("feedback helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("renders escaped toast messages with tone and action text", () => {
    const html = renderToast({
      tone: "success",
      title: "Saved <auth>",
      body: "Restart <later>",
      actionLabel: "Undo",
    });

    expect(html).toContain("toast-success");
    expect(html).toContain("Saved &lt;auth&gt;");
    expect(html).toContain("Restart &lt;later&gt;");
    expect(html).toContain("Undo");
  });

  test("summarises successful and failed bulk actions", () => {
    expect(actionSummary("Expired", { count: 3 })).toBe("Expired 3 items.");
    expect(actionSummary("Updated", { count: 4, failed: 1 })).toBe("Updated 3 of 4 items. 1 failed.");
  });

  test("toggles pending button state while preserving the original label", () => {
    document.body.innerHTML = '<button id="save">Save auth settings</button>';
    const button = document.getElementById("save");

    setButtonPending(button, true, "Saving...");

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.textContent).toBe("Saving...");

    setButtonPending(button, false);

    expect(button.disabled).toBe(false);
    expect(button.hasAttribute("aria-busy")).toBe(false);
    expect(button.textContent).toBe("Save auth settings");
  });

  test("maps keyboard shortcuts and ignores text inputs", () => {
    expect(keyboardActionForEvent({ key: "/", target: document.body })).toBe("focus-search");
    expect(keyboardActionForEvent({ key: "?", target: document.body })).toBe("show-shortcuts");
    expect(keyboardActionForEvent({ key: "Escape", target: document.body })).toBe("close-overlay");
    expect(keyboardActionForEvent({ key: "m", target: document.body }, "g")).toBe("go-memories");

    document.body.innerHTML = "<input id='q' />";
    expect(keyboardActionForEvent({ key: "/", target: document.getElementById("q") })).toBe("");
  });

  test("renders skeleton rows for loading states", () => {
    const html = skeletonHtml("Loading memories", 2);
    document.body.innerHTML = html;

    expect(html).toContain("state-skeleton");
    expect(html).toContain("Loading memories");
    expect(document.querySelectorAll(".skeleton-line")).toHaveLength(2);
  });
});
