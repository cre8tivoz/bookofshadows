import { cleanContent, esc, roleOf, shortId } from '../utils/escape.js';
import { prettyTime } from '../utils/format.js';

export function meta(item, opts = {}) {
  const status = String(item.status || "active").toLowerCase();
  const scope = String(item.scope || "").trim();
  const session = String(item.session_id || "").trim();
  const rawTime = item.timestamp || item.created_at || "";
  const timeLabel = prettyTime(rawTime, opts.formatter);
  const kind = item.memory_kind || item.tier || item.source || "memory";
  const veracity = String(item.veracity || "unknown").toLowerCase();
  const lifecycle = item.degradation_label ? `${item.degradation_label}${item.degradation_tier ? ` · T${item.degradation_tier}` : ""}` : "";
  const importance = Number(item.importance ?? 0);
  const pills = [`<span class="chip chip-kind" title="memory type: ${esc(kind)}">${esc(kind)}</span>`];
  if (status && status !== "active") pills.push(`<span class="chip chip-status-${esc(status)}" title="status: ${esc(status)}">${esc(status)}</span>`);
  if (veracity && veracity !== "unknown") pills.push(`<span class="chip chip-trust-${esc(veracity)}" title="veracity: ${esc(veracity)} · recall weight ${Number(item.trust_weight ?? 0).toFixed(2)}">${esc(veracity)}</span>`);
  if (lifecycle) pills.push(`<span class="chip chip-lifecycle-${esc(item.degradation_label)}" title="degradation tier: ${esc(item.degradation_tier)} · recall weight ${Number(item.degradation_weight ?? 1).toFixed(2)}">${esc(lifecycle)}</span>`);
  if (importance > 0) pills.push(`<span class="chip chip-importance" title="importance: ${importance.toFixed(2)}">${importance.toFixed(2)}</span>`);
  if (scope && scope !== "session") pills.push(`<span class="chip chip-neutral" title="scope: ${esc(scope)}">${esc(scope)}</span>`);
  if (opts.sessionLink !== false && session && session !== "default") pills.push(`<button type="button" class="chip chip-session" data-session="${esc(session)}" title="Open session: ${esc(session)}">${esc(shortId(session))}</button>`);
  if (timeLabel) pills.push(`<span class="meta-time" title="${esc(rawTime)}">${esc(timeLabel)}</span>`);
  return `<div class="meta">${pills.join("")}</div>`;
}

export function liveEventMeta(item) {
  const eventType = String(item.live_event_type || item.event_type || "").toUpperCase();
  const map = {
    MEMORY_ADDED: ["new", "new", "live-badge-new"],
    MEMORY_UPDATED: ["updated", "updated", "live-badge-updated"],
    MEMORY_RECALLED: ["recalled", "recalled", "live-badge-recalled"],
    MEMORY_INVALIDATED: ["invalidated", "invalidated", "live-badge-invalidated"],
    MEMORY_CONSOLIDATED: ["consolidated", "consolidated", "live-badge-consolidated"],
  };
  return map[eventType] || ["", ""];
}

export function memoryItem(item, opts = {}) {
  const role = roleOf(item.content);
  const roleBadge = role ? `<span class="chip chip-role-${role}">${role}</span>` : "";
  const selectedSet = opts.selectedSet || new Set();
  const checkClass = opts.checkClass || "memory-check";
  const selectable = opts.selectable ? `<label class="memory-select" title="Select memory"><input type="checkbox" class="${esc(checkClass)}" data-id="${esc(item.id)}" ${selectedSet.has(item.id) ? "checked" : ""} /></label>` : "";
  const [liveClass, liveLabel] = liveEventMeta(item);
  const liveBadge = liveLabel ? `<span class="chip chip-live-${esc(liveClass)}">${esc(liveLabel)}</span>` : "";
  const displayContent = cleanContent(item.content);
  return `<div class="item memory-card ${role ? "has-role" : ""} ${opts.selectable ? "selectable" : ""} ${liveClass ? `live-${esc(liveClass)}` : ""}" data-id="${esc(item.id)}">${selectable}<div class="item-topline">${roleBadge}${liveBadge}</div>${meta(item, opts)}<div class="content">${esc(displayContent)}</div></div>`;
}

export function isMutableMemory(item) {
  return String(item?.status || "active").toLowerCase() === "active";
}
