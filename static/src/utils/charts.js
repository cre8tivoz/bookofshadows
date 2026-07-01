let uplotModulePromise = null;

export function loadUplotModule() {
  if (!uplotModulePromise) uplotModulePromise = import("/static/vendor/uplot.esm.min.js");
  return uplotModulePromise;
}

export function isoDayToUnixSeconds(day) {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000);
}

export function buildGrowthChartData(series) {
  const days = series?.days || [];
  const xValues = days.map(isoDayToUnixSeconds);
  return [xValues, series?.working || days.map(() => 0), series?.episodic || days.map(() => 0)];
}

function zeroes(days) {
  return days.map(() => 0);
}

export const AUDIT_ACTION_ORDER = ["invalidate", "veracity", "expiry", "importance", "supersede"];
export const AUDIT_ACTION_LABELS = {
  invalidate: "Expired",
  veracity: "Trust changed",
  expiry: "Expiry set",
  importance: "Importance changed",
  supersede: "Superseded",
};

export function buildAuditActivityChartData(series) {
  const days = series?.days || [];
  const xValues = days.map(isoDayToUnixSeconds);
  const byAction = series?.by_action || {};
  return [xValues, ...AUDIT_ACTION_ORDER.map((action) => byAction[action] || zeroes(days))];
}

export const VERACITY_ORDER = ["stated", "unknown", "inferred", "imported", "tool"];
export const VERACITY_LABELS = {
  stated: "Stated",
  unknown: "Unknown",
  inferred: "Inferred",
  imported: "Imported",
  tool: "Tool",
};

export function buildVeracityMixChartData(series) {
  const days = series?.days || [];
  const xValues = days.map(isoDayToUnixSeconds);
  const byVeracity = series?.by_veracity || {};
  return [xValues, ...VERACITY_ORDER.map((label) => byVeracity[label] || zeroes(days))];
}

export function buildNamedSeriesChartData(series, namesKey, valuesKey) {
  const days = series?.days || [];
  const xValues = days.map(isoDayToUnixSeconds);
  const names = series?.[namesKey] || Object.keys(series?.[valuesKey] || {});
  const values = series?.[valuesKey] || {};
  return { names, data: [xValues, ...names.map((name) => values[name] || zeroes(days))] };
}

export function buildReviewBacklogChartData(series) {
  const days = series?.days || [];
  const xValues = days.map(isoDayToUnixSeconds);
  const order = ["needs_review", "high_value", "degraded"];
  const labels = ["Needs review", "High value", "Degraded"];
  const values = series?.by_queue || {};
  return { labels, data: [xValues, ...order.map((name) => values[name] || zeroes(days))] };
}

export function buildLifecycleTransitionChartData(series) {
  const days = series?.days || [];
  const xValues = days.map(isoDayToUnixSeconds);
  const labels = ["hot", "warm", "cold"];
  const values = series?.by_tier || {};
  return { labels: ["Hot", "Warm", "Cold"], data: [xValues, ...labels.map((name) => values[name] || zeroes(days))] };
}

export function recallDistributionBars(items = []) {
  const counts = items.map((item) => Number(item.count || 0));
  const max = Math.max(1, ...counts);
  return items.map((item) => {
    const count = Number(item.count || 0);
    return {
      bucket: item.bucket,
      count,
      percent: count ? Math.max(4, Math.round((count / max) * 100)) : 0,
    };
  });
}

export function rankedBars(items = [], labelKey = "label") {
  const counts = items.map((item) => Number(item.count || 0));
  const max = Math.max(1, ...counts);
  return items.map((item) => {
    const count = Number(item.count || 0);
    return {
      label: item[labelKey] || item.label || "unknown",
      query: item.query || item[labelKey] || item.label || "",
      count,
      percent: count ? Math.max(4, Math.round((count / max) * 100)) : 0,
    };
  });
}

export function heatmapCells(payload = {}) {
  const matrix = payload.matrix || [];
  const max = Math.max(1, ...matrix.flat().map((value) => Number(value || 0)));
  return (payload.weekdays || []).map((day, rowIndex) => ({
    day,
    cells: (payload.hours || []).map((hour, colIndex) => {
      const count = Number(matrix[rowIndex]?.[colIndex] || 0);
      return { hour, count, intensity: count ? Math.max(0.12, count / max) : 0 };
    }),
  }));
}
