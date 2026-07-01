import { describe, expect, test } from "vitest";

import {
  AUDIT_ACTION_ORDER,
  buildAuditActivityChartData,
  buildGrowthChartData,
  isoDayToUnixSeconds,
  recallDistributionBars,
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
