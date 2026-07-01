import { esc } from '../utils/escape.js';

export function optionsFrom(rows, key, labelKey = key) {
  const seen = new Set();
  return rows
    .map((r) => ({ value: r[key] || "", label: r[labelKey] || r[key] || "unknown", count: r.count || 0 }))
    .filter((o) => o.value && !seen.has(o.value) && seen.add(o.value));
}

export function breakdown(rows, labelKey, max = 8) {
  const items = rows.slice(0, max);
  const total = items.reduce((sum, r) => sum + Number(r.count || 0), 0) || 1;
  return (
    items
      .map((r) => {
        const count = Number(r.count || 0);
        const pct = count ? Math.max(2, Math.round((count / total) * 100)) : 0;
        return `<div class="break-row" data-filter="${esc(r[labelKey] || "")}"><span class="break-row-fill" style="width:${pct}%"></span><span class="break-row-label">${esc(r[labelKey] || "unknown")}</span><strong>${count.toLocaleString()}</strong></div>`;
      })
      .join("") || '<p class="muted">No data</p>'
  );
}

export function stateHtml(kind, title, body = "") {
  return `<div class="state-card state-${esc(kind)}"><strong>${esc(title)}</strong>${body ? `<p>${esc(body)}</p>` : ""}</div>`;
}

export function countLabel(n, noun) {
  const count = Number(n || 0);
  const plural = noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`;
  return `${count.toLocaleString()} ${count === 1 ? noun : plural}`;
}
