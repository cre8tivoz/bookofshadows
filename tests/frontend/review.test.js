import { describe, expect, test } from "vitest";

import {
  DEFAULT_LIFECYCLE_QUEUE,
  lifecycleQueueHtml,
  lifecycleQueueSelection,
  mergeReviewItems,
  newReviewItems,
  reviewActionableIds,
  reviewFilterParams,
  reviewQueueHtml,
  reviewReasonBadges,
  reviewVeracityReason,
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

  test("renders unique escaped review reasons with the actual veracity label", () => {
    expect(reviewReasonBadges("important_contaminated", activeItem)).toBe(
      "<span>inferred</span><span>High importance</span><span>Degraded</span>",
    );
  });

  test("explains a flag with the veracity label and source when present", () => {
    expect(reviewVeracityReason({ veracity: "inferred", source: "preference" })).toBe("inferred · preference");
    expect(reviewVeracityReason({ veracity: "tool", source: "  " })).toBe("tool");
    expect(reviewVeracityReason({})).toBe("unknown");
    expect(reviewReasonBadges("contaminated", { veracity: "imported", source: "onboarding" })).toBe(
      "<span>imported · onboarding</span>",
    );
  });

  test("escapes veracity and source text in flag reasons", () => {
    expect(reviewReasonBadges("contaminated", { veracity: "<tool>", source: "<script>" })).toBe(
      "<span>&lt;tool&gt; · &lt;script&gt;</span>",
    );
  });

  test("does not flag memories stated by the user", () => {
    expect(reviewReasonBadges("degraded", { veracity: "stated", degradation_tier: 3 })).toBe("<span>Degraded</span>");
  });

  test("high-importance chip matches the queue threshold (> 0.5)", () => {
    expect(reviewReasonBadges("contaminated", { veracity: "inferred", importance: 0.5 })).toBe("<span>inferred</span>");
    expect(reviewReasonBadges("contaminated", { veracity: "inferred", importance: 0.6 })).toBe("<span>inferred</span><span>High importance</span>");
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

  test("selects exactly one lifecycle queue, defaulting to recently degraded", () => {
    const queues = {
      hot: { title: "Hot memories", items: [] },
      recently_degraded: { title: "Recently degraded", items: [] },
      cold: { title: "Cold memories", items: [] },
    };

    expect(DEFAULT_LIFECYCLE_QUEUE).toBe("recently_degraded");

    const selected = lifecycleQueueSelection(queues, "cold");
    expect(selected.key).toBe("cold");
    expect(selected.html).toContain("Cold memories");
    expect(selected.html).not.toContain("Hot memories");
    expect(selected.html).not.toContain("Recently degraded");

    const fallback = lifecycleQueueSelection(queues, "missing");
    expect(fallback.key).toBe("hot");
    expect(lifecycleQueueSelection(queues).key).toBe("recently_degraded");
    expect(lifecycleQueueSelection({}).html).toContain("No lifecycle queues available.");
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

  test("merges review pages while exposing only newly appended items", () => {
    const existing = [
      { id: "m-1", content: "First copy", status: "active" },
      { id: "m-2", content: "Second", status: "active" },
    ];
    const incoming = [
      { id: "m-2", content: "Second updated", status: "active" },
      { id: "m-3", content: "Third", status: "active" },
    ];

    expect(newReviewItems(existing, incoming).map((item) => item.id)).toEqual(["m-3"]);
    expect(mergeReviewItems(existing, incoming)).toEqual([
      { id: "m-1", content: "First copy", status: "active" },
      { id: "m-2", content: "Second updated", status: "active" },
      { id: "m-3", content: "Third", status: "active" },
    ]);
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
