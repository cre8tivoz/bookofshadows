import { describe, expect, test } from "vitest";

import {
  lifecycleQueueHtml,
  reviewActionableIds,
  reviewFilterParams,
  reviewQueueHtml,
  reviewReasonBadges,
} from "../../static/src/features/review.js";

describe("review queue helpers", () => {
  const activeItem = {
    id: "m-1",
    content: "[ASSISTANT] Remember <this>",
    status: "active",
    veracity: "inferred",
    importance: 0.8,
    degradation_tier: 2,
  };

  test("renders unique escaped review reasons", () => {
    expect(reviewReasonBadges("important_contaminated", activeItem)).toBe(
      "<span>Needs review</span><span>High importance</span><span>Degraded</span>",
    );
  });

  test("renders triage queues with selectable memory cards from an injected selection", () => {
    const html = reviewQueueHtml(
      "contaminated",
      { title: "Needs Review", description: "Check truthiness", items: [activeItem] },
      { triage: true, selectedSet: new Set(["m-1"]) },
    );

    expect(html).toContain('data-review-key="contaminated"');
    expect(html).toContain("Needs Review");
    expect(html).toContain("1 listed");
    expect(html).toContain("review-select-visible");
    expect(html).toContain('class="review-check"');
    expect(html).toContain("checked");
    expect(html).toContain("&lt;this&gt;");
  });

  test("renders lifecycle queues with lifecycle styling and action copy", () => {
    const html = lifecycleQueueHtml("due_degradation", { items: [] });

    expect(html).toContain("review-queue lifecycle-queue glass");
    expect(html).toContain("Open lifecycle filter");
  });

  test("deduplicates selected active review ids for admin actions", () => {
    const ids = reviewActionableIds(
      [
        activeItem,
        { id: "m-2", status: "expired" },
        { id: "m-1", status: "active" },
      ],
      new Set(["m-1", "m-2"]),
    );

    expect(ids).toEqual(["m-1"]);
  });

  test("builds review query parameters from pagination and filters", () => {
    const params = reviewFilterParams({
      queue: "contaminated",
      limit: 40,
      offset: 80,
      q: "  shadow pact  ",
      minImportance: "0.75",
    });

    expect(params.toString()).toBe("queue=contaminated&limit=40&offset=80&q=shadow+pact&min_importance=0.75");
  });
});
