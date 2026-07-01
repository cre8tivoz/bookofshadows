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
  return [xValues, ...AUDIT_ACTION_ORDER.map((action) => byAction[action] || days.map(() => 0))];
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
