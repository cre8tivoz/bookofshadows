import { selectedMutableIds, memoryItem } from './memories.js';
import { stateHtml } from '../ui/render.js';
import { esc } from '../utils/escape.js';

// Human-readable label for why a memory is flagged, e.g. "inferred · preference".
export function reviewVeracityReason(item = {}) {
  const veracity = String(item.veracity || 'unknown').toLowerCase();
  const label = veracity || 'unknown';
  const source = String(item.source || '').trim();
  return source ? `${label} · ${source}` : label;
}

export function reviewReasonBadges(key, item = {}) {
  const reasons = [];
  if (key === 'contaminated' || (item.veracity && item.veracity !== 'stated')) reasons.push(reviewVeracityReason(item));
  if (key === 'important_contaminated' || Number(item.importance || 0) > 0.5) reasons.push('High importance');
  if (key === 'degraded' || Number(item.degradation_tier || 1) > 1) reasons.push('Degraded');
  if (key === 'due_degradation') reasons.push('Due for degradation');
  return [...new Set(reasons)].map(reason => `<span>${esc(reason)}</span>`).join('');
}

export function reviewMemoryItem(key, item, opts = {}) {
  const reasons = reviewReasonBadges(key, item);
  return `<div class="review-memory-wrap">${memoryItem(item, opts)}${reasons ? `<div class="review-reasons" aria-label="Review reasons">${reasons}</div>` : ''}</div>`;
}

export function reviewQueueHtml(key, queue, opts = {}) {
  const items = queue.items || [];
  const selectAction = opts.triage ? `<button class="tiny review-select-visible" data-review-key="${esc(key)}">Select visible</button>` : '';
  const renderedItems = opts.triage
    ? items.map(item => reviewMemoryItem(key, item, {selectable:true, selectedSet:opts.selectedSet || new Set(), checkClass:'review-check'})).join('')
    : items.map(item => reviewMemoryItem(key, item)).join('');
  return `<section class="review-queue glass" data-review-key="${esc(key)}">
    <div class="section-head mini"><h2>${esc(queue.title || key)}</h2><span>${items.length} listed</span></div>
    <p class="muted">${esc(queue.description || '')}</p>
    <div class="review-actions"><button class="tiny primary review-filter" data-review-key="${esc(key)}">Open filtered browser</button>${selectAction}</div>
    <div class="list memory-grid">${renderedItems || stateHtml('empty', 'No items in this queue.', 'This queue is clear for now.')}</div>
  </section>`;
}

export function lifecycleQueueHtml(key, queue) {
  return reviewQueueHtml(key, queue)
    .replace('review-queue glass', 'review-queue lifecycle-queue glass')
    .replace('Open filtered browser', 'Open lifecycle filter');
}

export const DEFAULT_LIFECYCLE_QUEUE = 'recently_degraded';

// The lifecycle page shows one queue list at a time; cards select which one.
export function lifecycleQueueSelection(queues = {}, selectedKey = DEFAULT_LIFECYCLE_QUEUE) {
  const keys = Object.keys(queues || {});
  const key = keys.includes(selectedKey) ? selectedKey : (keys[0] || '');
  return {
    key,
    html: key
      ? lifecycleQueueHtml(key, queues[key])
      : '<p class="muted">No lifecycle queues available.</p>',
  };
}

export function reviewActionableIds(items, selectedSet) {
  return [...new Set(selectedMutableIds(items, selectedSet))];
}

export function mergeReviewItems(existingItems = [], newItems = []) {
  return [...new Map([...existingItems, ...newItems].map((item) => [item.id, item])).values()];
}

export function newReviewItems(existingItems = [], newItems = []) {
  const seen = new Set(existingItems.map((item) => item.id));
  return newItems.filter((item) => !seen.has(item.id));
}

export function reviewFilterParams(filters = {}) {
  const params = new URLSearchParams(`queue=${encodeURIComponent(filters.queue || '')}&limit=${Number(filters.limit || 0)}&offset=${Number(filters.offset || 0)}`);
  const q = String(filters.q || '').trim();
  const minImportance = String(filters.minImportance || '').trim();
  if (q) params.set('q', q);
  if (minImportance && Number(minImportance) > 0) params.set('min_importance', minImportance);
  return params;
}
