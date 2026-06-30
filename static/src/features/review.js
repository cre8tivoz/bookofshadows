import { selectedMutableIds, memoryItem } from './memories.js';
import { stateHtml } from '../ui/render.js';
import { esc } from '../utils/escape.js';

export function reviewReasonBadges(key, item = {}) {
  const reasons = [];
  if (key === 'contaminated' || (item.veracity && item.veracity !== 'stated')) reasons.push('Needs review');
  if (key === 'important_contaminated' || Number(item.importance || 0) >= 0.75) reasons.push('High importance');
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

export function reviewActionableIds(items, selectedSet) {
  return [...new Set(selectedMutableIds(items, selectedSet))];
}

export function reviewFilterParams(filters = {}) {
  const params = new URLSearchParams(`queue=${encodeURIComponent(filters.queue || '')}&limit=${Number(filters.limit || 0)}&offset=${Number(filters.offset || 0)}`);
  const q = String(filters.q || '').trim();
  const minImportance = String(filters.minImportance || '').trim();
  if (q) params.set('q', q);
  if (minImportance && Number(minImportance) > 0) params.set('min_importance', minImportance);
  return params;
}
