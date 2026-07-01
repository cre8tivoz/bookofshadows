import { endpoints } from '../api/endpoints.js';
import { esc } from '../utils/escape.js';
import { skeletonHtml } from '../ui/feedback.js';
import { stateHtml } from '../ui/render.js';
import {
  mergeReviewItems,
  newReviewItems,
  reviewActionableIds,
  reviewFilterParams,
  reviewMemoryItem,
  reviewQueueHtml,
} from './review.js';

const REVIEW_PAGE_SIZE = 100;

export function createReviewController({
  $,
  $$,
  api,
  postJson,
  bindMemoryClicks,
  canAdmin,
  confirmAction,
  askVeracity,
  askExpiry,
  runButtonAction,
  runBulkMutation,
  loadStats,
  showToast,
  isCancelledRequest,
  openMemoryFilter,
}) {
  let reviewSelection = new Set();
  let selectedReviewQueue = 'contaminated';
  let reviewOffset = 0;
  let latestReviewData = null;
  let latestReviewItems = [];

  function updateBulkBar() {
    const bar = $('#reviewBulkBar');
    if (!bar) return;
    const admin = canAdmin();
    const visible = latestReviewItems.length;
    const actionable = reviewActionableIds(latestReviewItems, reviewSelection).length;
    bar.classList.toggle('hidden', !visible);
    $('#reviewSelectionStatus').textContent = `${reviewSelection.size} selected`;
    $('#reviewConfirm').disabled = !admin || !actionable;
    $('#reviewVeracity').disabled = !admin || !actionable;
    $('#reviewExpiry').disabled = !admin || !actionable;
    $('#reviewExpire').disabled = !admin || !actionable;
    $('#reviewSelectAll').checked = visible > 0 && latestReviewItems.every((item) => reviewSelection.has(item.id));
    $('#reviewSelectAll').disabled = !visible;
  }

  function bindQueueControls(queues) {
    $$('#review .review-check').forEach((chk) => {
      chk.onchange = (event) => {
        event.stopPropagation();
        chk.checked ? reviewSelection.add(chk.dataset.id) : reviewSelection.delete(chk.dataset.id);
        updateBulkBar();
      };
    });
    $$('#review .review-select-visible').forEach((el) => {
      el.onclick = (event) => {
        event.stopPropagation();
        latestReviewItems.forEach((item) => reviewSelection.add(item.id));
        $$('#review .review-check').forEach((chk) => { chk.checked = true; });
        updateBulkBar();
      };
    });
    $$('#review .review-filter').forEach((el) => {
      el.onclick = (event) => {
        event.stopPropagation();
        const key = el.dataset.reviewKey;
        openMemoryFilter(queues[key]?.filter || {});
      };
    });
  }

  function updateImportanceLabel() {
    const slider = $('#reviewMinImportance');
    const label = $('#reviewMinImportanceValue');
    if (!slider || !label) return;
    const value = Number(slider.value || 0);
    label.textContent = value > 0 ? `≥ ${value.toFixed(2)}` : 'any';
  }

  function renderSelectedQueue(data, append = false) {
    latestReviewData = data;
    const queues = data.queues || {};
    const cards = data.cards || [];
    const keys = cards.map((card) => card.key).filter((key) => queues[key]);
    if (!keys.length) {
      latestReviewItems = [];
      $('#reviewCards').innerHTML = '';
      $('#reviewQueueSelect').innerHTML = '';
      $('#reviewQueueCount').textContent = '0 listed';
      $('#reviewQueues').innerHTML = '<p class="muted">No review queues available.</p>';
      $('#reviewLoadMore').classList.add('hidden');
      updateBulkBar();
      return;
    }
    if (!queues[selectedReviewQueue]) selectedReviewQueue = data.queue || keys[0];
    const selectedCard = cards.find((card) => card.key === selectedReviewQueue) || { count: data.total || 0 };
    $('#reviewCards').innerHTML = '';
    $('#reviewQueueSelect').innerHTML = cards.map((card) => `<option value="${esc(card.key)}" ${card.key === selectedReviewQueue ? 'selected' : ''}>${esc(card.title)} (${Number(card.count || 0).toLocaleString()})</option>`).join('');
    const newItems = queues[selectedReviewQueue]?.items || [];
    const appendedItems = append ? newReviewItems(latestReviewItems, newItems) : newItems;
    latestReviewItems = append ? mergeReviewItems(latestReviewItems, newItems) : mergeReviewItems([], newItems);
    $('#reviewQueueCount').textContent = `${Number(data.total ?? selectedCard.count ?? 0).toLocaleString()} total · ${latestReviewItems.length.toLocaleString()} listed`;
    const renderedQueue = { ...queues[selectedReviewQueue], items: latestReviewItems };
    const existingQueue = $(`#reviewQueues .review-queue[data-review-key="${CSS.escape(selectedReviewQueue)}"]`);
    const existingList = existingQueue?.querySelector('.list.memory-grid');
    if (append && existingQueue && existingList) {
      const count = existingQueue.querySelector('.section-head.mini span');
      if (count) count.textContent = `${latestReviewItems.length.toLocaleString()} listed`;
      const newHtml = appendedItems.map((item) => reviewMemoryItem(selectedReviewQueue, item, { selectable: true, selectedSet: reviewSelection, checkClass: 'review-check' })).join('');
      if (newHtml) existingList.insertAdjacentHTML('beforeend', newHtml);
    } else {
      $('#reviewQueues').innerHTML = reviewQueueHtml(selectedReviewQueue, renderedQueue, { triage: true, selectedSet: reviewSelection });
    }
    bindMemoryClicks($('#review'));
    bindQueueControls(queues);
    updateBulkBar();
    $('#reviewQueueSelect').onchange = (event) => {
      selectedReviewQueue = event.target.value;
      reviewOffset = 0;
      reviewSelection.clear();
      loadReviewPage(false);
    };
    $('#reviewMinImportance').oninput = updateImportanceLabel;
    updateImportanceLabel();
    $('#reviewApplyFilters').onclick = () => {
      reviewOffset = 0;
      reviewSelection.clear();
      loadReviewPage(false);
    };
    $('#reviewClearFilters').onclick = () => {
      $('#reviewSearchQuery').value = '';
      $('#reviewMinImportance').value = '0';
      updateImportanceLabel();
      reviewOffset = 0;
      reviewSelection.clear();
      loadReviewPage(false);
    };
    $('#reviewLoadMore').onclick = () => {
      if (data.next_offset != null) {
        reviewOffset = data.next_offset;
        loadReviewPage(true);
      }
    };
    $('#reviewLoadMore').classList.toggle('hidden', !data.has_more);
  }

  async function loadReviewPage(append = false) {
    if (!append) $('#reviewQueues').innerHTML = skeletonHtml('Loading review queue', 4);
    try {
      const data = await api(endpoints.review(reviewFilterParams({
        queue: selectedReviewQueue,
        limit: REVIEW_PAGE_SIZE,
        offset: reviewOffset,
        q: $('#reviewSearchQuery')?.value || '',
        minImportance: $('#reviewMinImportance')?.value || '',
      })), { requestKey: 'review' });
      renderSelectedQueue(data, append);
    } catch (error) {
      if (isCancelledRequest(error)) return;
      $('#reviewQueues').innerHTML = stateHtml('error', 'Could not load review queue.', error.message || 'Try again.');
    }
  }

  async function loadReview() {
    reviewOffset = 0;
    reviewSelection.clear();
    await loadReviewPage(false);
  }

  async function confirmSelectedMemories(button) {
    const ids = reviewActionableIds(latestReviewItems, reviewSelection);
    if (!ids.length) return;
    const ok = await confirmAction({ title: 'Confirm selected memories?', description: `Mark ${ids.length} selected active memories as stated.`, confirmText: 'Confirm selected' });
    if (!ok) return;
    const backup = $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true;
    await runButtonAction(button, 'Confirming...', async () => {
      const result = await runBulkMutation(ids, (id) => postJson('/api/admin/memory/veracity', { memory_id: id, veracity: 'stated', backup }), 'Confirmed');
      if (!result.failed) reviewSelection.clear();
      await loadStats();
      await loadReview();
    });
  }

  async function setSelectedVeracity(button) {
    const ids = reviewActionableIds(latestReviewItems, reviewSelection);
    if (!ids.length) return;
    const veracity = await askVeracity('stated');
    if (veracity === null) return;
    const backup = $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true;
    await runButtonAction(button, 'Saving...', async () => {
      const result = await runBulkMutation(ids, (id) => postJson('/api/admin/memory/veracity', { memory_id: id, veracity, backup }), 'Updated');
      if (!result.failed) reviewSelection.clear();
      await loadStats();
      await loadReview();
    });
  }

  async function setSelectedExpiry(button) {
    const ids = reviewActionableIds(latestReviewItems, reviewSelection);
    if (!ids.length) return;
    const validUntil = await askExpiry('');
    if (validUntil === null) return;
    const backup = $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true;
    await runButtonAction(button, 'Saving...', async () => {
      const result = await runBulkMutation(ids, (id) => postJson('/api/admin/memory/expiry', { memory_id: id, valid_until: validUntil, backup }), 'Updated');
      if (!result.failed) reviewSelection.clear();
      await loadStats();
      await loadReview();
    });
  }

  async function expireSelectedMemories(button) {
    const ids = reviewActionableIds(latestReviewItems, reviewSelection);
    if (!ids.length) return;
    const ok = await confirmAction({ title: 'Expire selected memories?', description: `Expire ${ids.length} selected active memories. Backups and audit entries will be created.`, confirmText: 'Expire selected', tone: 'warn' });
    if (!ok) return;
    const backup = $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true;
    await runButtonAction(button, 'Expiring...', async () => {
      const result = await runBulkMutation(ids, (id) => postJson('/api/admin/memory/invalidate', { memory_id: id, backup }), 'Expired');
      if (!result.failed) reviewSelection.clear();
      await loadStats();
      await loadReview();
    });
  }

  function bindGlobalControls() {
    $('#reviewSelectAll').onchange = () => {
      const checked = $('#reviewSelectAll').checked;
      latestReviewItems.forEach((item) => checked ? reviewSelection.add(item.id) : reviewSelection.delete(item.id));
      $$('#review .review-check').forEach((chk) => { chk.checked = checked; });
      updateBulkBar();
    };
    $('#reviewClear').onclick = () => {
      const previous = new Set(reviewSelection);
      reviewSelection.clear();
      loadReview();
      showToast({
        tone: 'info',
        title: 'Review selection cleared',
        body: `Cleared ${previous.size} selected memories.`,
        actionLabel: 'Undo',
        action: () => {
          reviewSelection = previous;
          loadReviewPage(false);
        },
      });
    };
    $('#reviewConfirm').onclick = () => confirmSelectedMemories($('#reviewConfirm'));
    $('#reviewVeracity').onclick = () => setSelectedVeracity($('#reviewVeracity'));
    $('#reviewExpiry').onclick = () => setSelectedExpiry($('#reviewExpiry'));
    $('#reviewExpire').onclick = () => expireSelectedMemories($('#reviewExpire'));
  }

  return {
    bindGlobalControls,
    loadReview,
    loadReviewPage,
    latestData: () => latestReviewData,
    updateBulkBar,
  };
}
