import { esc } from '../utils/escape.js';

export function optionsFrom(rows, key, labelKey = key) {
  const seen = new Set();
  return rows
    .map((r) => ({ value: r[key] || "", label: r[labelKey] || r[key] || "unknown", count: r.count || 0 }))
    .filter((o) => o.value && !seen.has(o.value) && seen.add(o.value));
}

export function breakdown(rows, labelKey, max = 8) {
  return rows
    .slice(0, max)
    .map((r) => `<div class="break-row" data-filter="${esc(r[labelKey] || "")}"><span>${esc(r[labelKey] || "unknown")}</span><strong>${Number(r.count).toLocaleString()}</strong></div>`)
    .join("") || '<p class="muted">No data</p>';
}

export function stateHtml(kind, title, body = "") {
  return `<div class="state-card state-${esc(kind)}"><strong>${esc(title)}</strong>${body ? `<p>${esc(body)}</p>` : ""}</div>`;
}

export function countLabel(n, noun) {
  const count = Number(n || 0);
  const plural = noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`;
  return `${count.toLocaleString()} ${count === 1 ? noun : plural}`;
}
