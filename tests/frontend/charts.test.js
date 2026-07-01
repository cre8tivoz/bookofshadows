import { describe, expect, test } from "vitest";

import {
  AUDIT_ACTION_ORDER,
  buildAuditActivityChartData,
  buildGrowthChartData,
  buildLifecycleTransitionChartData,
  buildNamedSeriesChartData,
  buildReviewBacklogChartData,
  buildVeracityMixChartData,
  heatmapCells,
  isoDayToUnixSeconds,
  rankedBars,
  recallDistributionBars,
  VERACITY_ORDER,
} from "../../static/src/utils/charts.js";

describe("isoDayToUnixSeconds", () => {
  test("converts an ISO day string to UTC midnight unix seconds", () => {
    expect(isoDayToUnixSeconds("2026-07-01")).toBe(Date.UTC(2026, 6, 1) / 1000);
  });
});

describe("buildGrowthChartData", () => {
  test("shapes a memory-growth series into uPlot's [x, ...series] format", () => {
    const series = { days: ["2026-06-30", "2026-07-01"], working: [2, 5], episodic: [1, 0] };

    const data = buildGrowthChartData(series);

    expect(data).toHaveLength(3);
    expect(data[0]).toEqual([isoDayToUnixSeconds("2026-06-30"), isoDayToUnixSeconds("2026-07-01")]);
    expect(data[1]).toEqual([2, 5]);
    expect(data[2]).toEqual([1, 0]);
  });

  test("falls back to zero-filled series when fields are missing", () => {
    const data = buildGrowthChartData({ days: ["2026-07-01"] });

    expect(data[1]).toEqual([0]);
    expect(data[2]).toEqual([0]);
  });
});

describe("buildAuditActivityChartData", () => {
  test("orders series by the stable AUDIT_ACTION_ORDER", () => {
    const series = {
      days: ["2026-07-01"],
      by_action: { supersede: [1], invalidate: [3], veracity: [2], expiry: [0], importance: [4] },
    };

    const data = buildAuditActivityChartData(series);

    expect(data[0]).toEqual([isoDayToUnixSeconds("2026-07-01")]);
    AUDIT_ACTION_ORDER.forEach((action, i) => {
      expect(data[i + 1]).toEqual(series.by_action[action]);
    });
  });

  test("zero-fills an action missing from by_action", () => {
    const data = buildAuditActivityChartData({ days: ["2026-07-01", "2026-07-02"], by_action: {} });

    data.slice(1).forEach((series) => expect(series).toEqual([0, 0]));
  });
});

describe("Release 11A chart data helpers", () => {
  test("orders veracity series by the stable veracity order", () => {
    const data = buildVeracityMixChartData({
      days: ["2026-07-01"],
      by_veracity: { tool: [2], stated: [1], unknown: [0], inferred: [3], imported: [4] },
    });

    expect(data[0]).toEqual([isoDayToUnixSeconds("2026-07-01")]);
    VERACITY_ORDER.forEach((name, i) => {
      expect(data[i + 1]).toHaveLength(1);
    });
    expect(data[1]).toEqual([1]);
  });

  test("builds named source chart data from dynamic series names", () => {
    const result = buildNamedSeriesChartData({
      days: ["2026-07-01", "2026-07-02"],
      sources: ["task", "preference"],
      by_source: { task: [1, 2], preference: [0, 3] },
    }, "sources", "by_source");

    expect(result.names).toEqual(["task", "preference"]);
    expect(result.data[1]).toEqual([1, 2]);
    expect(result.data[2]).toEqual([0, 3]);
  });

  test("builds review backlog chart data with friendly label order", () => {
    const result = buildReviewBacklogChartData({
      days: ["2026-07-01"],
      by_queue: { degraded: [2], needs_review: [5], high_value: [1] },
    });

    expect(result.labels).toEqual(["Needs review", "High value", "Degraded"]);
    expect(result.data.slice(1)).toEqual([[5], [1], [2]]);
  });

  test("builds lifecycle transition chart data in hot warm cold order", () => {
    const result = buildLifecycleTransitionChartData({
      days: ["2026-07-01"],
      by_tier: { cold: [1], hot: [3], warm: [2] },
    });

    expect(result.labels).toEqual(["Hot", "Warm", "Cold"]);
    expect(result.data.slice(1)).toEqual([[3], [2], [1]]);
  });

  test("computes ranked bars with visible non-zero minimums", () => {
    const bars = rankedBars([{ label: "Agent memory", count: 1 }, { label: "Privacy", count: 50 }]);

    expect(bars[0].percent).toBeGreaterThanOrEqual(4);
    expect(bars[1].percent).toBe(100);
  });

  test("converts heatmap matrix values to intensity cells", () => {
    const rows = heatmapCells({ weekdays: ["Mon"], hours: [0, 1], matrix: [[0, 4]] });

    expect(rows[0].cells[0]).toMatchObject({ hour: 0, count: 0, intensity: 0 });
    expect(rows[0].cells[1]).toMatchObject({ hour: 1, count: 4, intensity: 1 });
  });
});

describe("recallDistributionBars", () => {
  test("computes bar width percentages relative to the largest bucket", () => {
    const bars = recallDistributionBars([
      { bucket: "0", count: 1 },
      { bucket: "1-2", count: 2 },
      { bucket: "3-5", count: 10 },
      { bucket: "10+", count: 0 },
    ]);

    expect(bars.find((b) => b.bucket === "3-5").percent).toBe(100);
    expect(bars.find((b) => b.bucket === "0").percent).toBe(10);
    expect(bars.find((b) => b.bucket === "10+").percent).toBe(0);
  });

  test("gives a small visible minimum to non-zero counts that would otherwise round to 0%", () => {
    const bars = recallDistributionBars([
      { bucket: "0", count: 1 },
      { bucket: "10+", count: 500 },
    ]);

    expect(bars.find((b) => b.bucket === "0").percent).toBeGreaterThanOrEqual(4);
  });
});
