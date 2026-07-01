import { routeTabState } from '../state/routing.js';
import { esc } from '../utils/escape.js';
import { prettyTime } from '../utils/format.js';
import { trapFocus } from '../utils/a11y.js';
import { isMutableMemory, meta } from './memories.js';

export function createDetailDrawerController({
  $,
  $$,
  api,
  postJson,
  bindActivatable,
  canAdmin,
  confirmAction,
  askImportance,
  askReplacement,
  askVeracity,
  askExpiry,
  runButtonAction,
  refreshAuthState,
  loadStats,
  loadMemories,
  openActionModal,
  pushRoute,
  getCurrentRoute,
  memoryRouteState,
  switchTab,
}) {
  let focusRelease = null;

  function closeDetail(opts = {}) {
    $('#detail').classList.add('hidden');
    focusRelease?.();
    focusRelease = null;
    if (opts.push !== false) {
      const currentRoute = getCurrentRoute();
      pushRoute(currentRoute?.tab === 'memories' ? memoryRouteState() : routeTabState(currentRoute?.tab || 'overview'));
    }
  }

  function activateDrawerFocusTrap() {
    const drawer = $('#detail');
    const wasHidden = drawer.classList.contains('hidden');
    drawer.classList.remove('hidden');
    if (wasHidden) {
      focusRelease = trapFocus(drawer);
      ($('#closeDetail') || drawer).focus();
    }
  }

  function showSelectableCopy(label, value) {
    openActionModal({
      title: label,
      description: 'Select the text below and press Cmd/Ctrl+C to copy. This works on non-HTTPS local dashboards.',
      kicker: 'Copy',
      confirmText: 'Done',
      bodyHtml: `<label class="modal-field"><span>${esc(label)}</span><textarea id="manualCopyValue" class="copy-value" rows="4" readonly>${esc(value || '')}</textarea></label>`,
      readValue: () => true,
    });
    setTimeout(() => {
      const el = $('#manualCopyValue');
      el?.focus();
      el?.select();
    }, 60);
  }

  function showDetail(obj, title = 'Detail', opts = {}) {
    const titleEl = document.querySelector('.drawer-title');
    if (titleEl) titleEl.textContent = title;
    $('#detailBody').classList.remove('html-detail');
    $('#detailBody').textContent = JSON.stringify(obj, null, 2);
    activateDrawerFocusTrap();
    if (opts.push !== false) pushRoute(getCurrentRoute() || routeTabState());
  }

  function showHtmlDetail(html, title = 'Detail') {
    const titleEl = document.querySelector('.drawer-title');
    if (titleEl) titleEl.textContent = title;
    $('#detailBody').classList.add('html-detail');
    $('#detailBody').innerHTML = html;
    activateDrawerFocusTrap();
  }

  function whyMemoryHtml(item) {
    const reasons = [];
    const q = $('#memoryQuery')?.value.trim();
    const source = $('#memorySource')?.value;
    const scope = $('#memoryScope')?.value;
    const session = $('#memorySession')?.value;
    const veracity = $('#memoryVeracity')?.value;
    const degradation = $('#memoryDegradation')?.value;
    const trustPreset = $('#memoryTrustPreset')?.value;
    const sort = $('#memorySort')?.value;
    if (q) reasons.push(`matches browser query “${q}” across content, id, session, source, or scope`);
    if (source && item.source === source) reasons.push(`source filter matched ${source}`);
    if (scope && item.scope === scope) reasons.push(`scope filter matched ${scope}`);
    if (session && item.session_id === session) reasons.push(`session filter matched ${session}`);
    if (veracity && item.veracity === veracity) reasons.push(`trust filter matched ${veracity}`);
    if (degradation && String(item.degradation_tier || '') === String(degradation)) reasons.push(`lifecycle filter matched tier ${degradation}`);
    if (trustPreset === 'contaminated' && item.contaminated) reasons.push('needs-review filter matched');
    if (trustPreset === 'degraded' && item.degraded_at) reasons.push('degraded-only filter matched');
    if (!reasons.length) reasons.push('shown from the current list/search context');
    return `<div class="result-section why-panel"><h3>Why shown <span>${esc(item.status || 'active')}</span></h3><div class="diag-grid compact">
    <div class="diag-row"><span>Reason</span><strong>${esc(reasons.join(' · '))}</strong></div>
    <div class="diag-row"><span>Ranking</span><strong>${esc(sort || 'recent')} · importance ${Number(item.importance ?? 0).toFixed(2)} · recalled ${Number(item.recall_count || 0).toLocaleString()}×</strong></div>
    <div class="diag-row"><span>Freshness</span><strong>created ${esc(prettyTime(item.created_at) || item.created_at || 'unknown')} · last recalled ${esc(prettyTime(item.last_recalled) || item.last_recalled || 'never')}</strong></div>
    <div class="diag-row"><span>Origin</span><strong>${esc(item.memory_kind || item.tier || 'memory')} · ${esc(item.source || 'unknown source')} · ${esc(item.scope || 'unknown scope')}</strong></div>
  </div></div>`;
  }

  function memoryDetailHtml(item) {
    const admin = canAdmin();
    const mutable = isMutableMemory(item);
    const adminActions = admin && mutable ? '<button id="expireMemory" class="drawer-action warn">Expire now</button><button id="editVeracity" class="drawer-action">Set trust</button><button id="editExpiry" class="drawer-action">Set expiry</button><button id="editImportance" class="drawer-action">Edit importance</button><button id="supersedeMemory" class="drawer-action primary">Supersede</button>' : '';
    const actionNote = admin ? (mutable ? '' : `<span class="muted">This memory is ${esc(item.status || 'not active')}; mutation actions are disabled.</span>`) : '<span class="muted">Enable Settings → Memory maintenance to modify memories.</span>';
    const trust = String(item.veracity || 'unknown').toLowerCase();
    const lifecycle = item.degradation_label ? `${item.degradation_label} · tier ${item.degradation_tier}` : 'not degraded';
    return `
    <div class="memory-detail">
      ${meta(item, { sessionLink: false })}
      <div class="content detail-content">${esc(item.content)}</div>
      <div class="trust-strip">
        <span class="trust-chip trust-${esc(trust)}">${esc(trust)} trust · ×${Number(item.trust_weight ?? 0).toFixed(2)}</span>
        <span class="trust-chip lifecycle-${esc(item.degradation_label || 'none')}">${esc(lifecycle)}${item.degradation_weight != null ? ` · ×${Number(item.degradation_weight).toFixed(2)}` : ''}</span>
        <span class="trust-chip">effective ×${Number(item.effective_memory_weight ?? 0).toFixed(2)}</span>
        ${item.contaminated ? '<span class="trust-chip review">needs review</span>' : ''}
      </div>
      ${whyMemoryHtml(item)}
      <div class="diag-grid compact">
        <div class="diag-row"><span>ID</span><strong>${esc(item.id)}</strong></div>
        <div class="diag-row"><span>Session</span>${item.session_id && item.session_id !== 'default' ? `<button id="memorySessionLink" class="diag-link" title="Open session: ${esc(item.session_id)}">${esc(item.session_id)}</button>` : `<strong>${esc(item.session_id || 'default')}</strong>`}</div>
        <div class="diag-row"><span>Source</span><strong>${esc(item.source || 'unknown')}</strong></div>
        <div class="diag-row"><span>Trust</span><strong>${esc(trust)} · recall weight ×${Number(item.trust_weight ?? 0).toFixed(2)}${item.contaminated ? ' · review recommended' : ''}</strong></div>
        <div class="diag-row"><span>Lifecycle</span><strong>${esc(lifecycle)} · degraded ${esc(item.degraded_at || 'never')} · recall weight ×${Number(item.degradation_weight ?? 1).toFixed(2)}</strong></div>
        <div class="diag-row"><span>Effective weight</span><strong>×${Number(item.effective_memory_weight ?? 0).toFixed(2)}</strong></div>
        <div class="diag-row"><span>Valid until</span><strong>${esc(item.valid_until || 'none')}</strong></div>
        <div class="diag-row"><span>Superseded by</span><strong>${esc(item.superseded_by || 'none')}</strong></div>
      </div>
      <div class="drawer-actions memory-actions">
        <button id="copyMemoryId" class="drawer-action">Copy ID</button>
        ${adminActions}${actionNote}
      </div>
      <p id="memoryActionStatus" class="muted"></p>
    </div>`;
  }

  async function openMemoryDetail(memoryId, opts = {}) {
    await refreshAuthState();
    const item = (await api('/api/memory?id=' + encodeURIComponent(memoryId))).item;
    showHtmlDetail(memoryDetailHtml(item), 'Memory detail');
    if (opts.push !== false) pushRoute({ tab: 'memories', drawer: { type: 'memory', id: memoryId } });
    const sessionLink = $('#memorySessionLink');
    if (sessionLink) sessionLink.onclick = () => openSessionDetail(item.session_id || '');
    $('#copyMemoryId').onclick = () => showSelectableCopy('Memory ID', item.id);
    if (!canAdmin() || !isMutableMemory(item)) return;
    const backup = () => $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true;
    $('#expireMemory').onclick = async () => {
      const ok = await confirmAction({
        title: 'Expire this memory?',
        description: 'It will disappear from active recall, but the original record stays available for history and audit.',
        confirmText: 'Expire memory',
        tone: 'warn',
      });
      if (!ok) return;
      try {
        const result = await runButtonAction($('#expireMemory'), 'Expiring...', () => postJson('/api/admin/memory/invalidate', { memory_id: item.id, backup: backup() }), () => ({ tone: 'success', title: 'Memory expired', body: 'The original remains in history and audit.' }));
        $('#memoryActionStatus').textContent = `Expired. Backup: ${result.backup?.path || 'not created'}`;
        await loadMemories();
        await openMemoryDetail(item.id);
      } catch (error) { $('#memoryActionStatus').textContent = error.message; }
    };
    $('#editImportance').onclick = async () => {
      const importance = await askImportance(item.importance ?? 0.5);
      if (importance === null) return;
      try {
        const result = await runButtonAction($('#editImportance'), 'Saving...', () => postJson('/api/admin/memory/importance', { memory_id: item.id, importance: Number(importance), backup: backup() }), () => ({ tone: 'success', title: 'Importance updated', body: `New value: ${Number(importance).toFixed(2)}` }));
        $('#memoryActionStatus').textContent = `Importance updated to ${result.importance}.`;
        await loadStats();
        await loadMemories();
        await openMemoryDetail(item.id);
      } catch (error) { $('#memoryActionStatus').textContent = error.message; }
    };
    $('#editVeracity').onclick = async () => {
      const veracity = await askVeracity(item.veracity || 'unknown');
      if (veracity === null) return;
      try {
        const result = await runButtonAction($('#editVeracity'), 'Saving...', () => postJson('/api/admin/memory/veracity', { memory_id: item.id, veracity, backup: backup() }), () => ({ tone: 'success', title: 'Trust updated', body: `Trust is now ${veracity}.` }));
        $('#memoryActionStatus').textContent = `Trust updated to ${result.veracity}.`;
        await loadStats();
        await loadMemories();
        await openMemoryDetail(item.id);
      } catch (error) { $('#memoryActionStatus').textContent = error.message; }
    };
    $('#editExpiry').onclick = async () => {
      const validUntil = await askExpiry(item.valid_until || '');
      if (validUntil === null) return;
      try {
        const result = await runButtonAction($('#editExpiry'), 'Saving...', () => postJson('/api/admin/memory/expiry', { memory_id: item.id, valid_until: validUntil, backup: backup() }), () => ({ tone: 'success', title: 'Expiry updated', body: validUntil ? `Valid until ${validUntil}` : 'Scheduled expiry cleared.' }));
        $('#memoryActionStatus').textContent = `Expiry ${result.valid_until ? `set to ${result.valid_until}` : 'cleared'}.`;
        await loadStats();
        await loadMemories();
        await openMemoryDetail(item.id);
      } catch (error) { $('#memoryActionStatus').textContent = error.message; }
    };
    $('#supersedeMemory').onclick = async () => {
      const replacement = await askReplacement(item.content || '');
      if (replacement === null) return;
      try {
        const result = await runButtonAction($('#supersedeMemory'), 'Creating...', () => postJson('/api/admin/memory/supersede', { memory_id: item.id, content: replacement, importance: Number(item.importance ?? 0.5), backup: backup() }), () => ({ tone: 'success', title: 'Memory superseded', body: 'Opened the replacement memory.' }));
        $('#memoryActionStatus').textContent = `Superseded by ${result.replacement_id}.`;
        $('#memoryStatus').value = 'all';
        await loadStats();
        await loadMemories();
        await openMemoryDetail(result.replacement_id);
      } catch (error) { $('#memoryActionStatus').textContent = error.message; }
    };
  }

  function sessionEvent(event) {
    return `<div class="session-event" data-json='${esc(JSON.stringify(event.item))}'><div class="meta"><span class="badge">${esc(event.type)}</span><span>${esc(event.timestamp || '')}</span></div><div class="content"><strong>${esc(event.title)}</strong><br>${esc(event.preview || '')}</div></div>`;
  }

  async function openSessionDetail(sessionId, opts = {}) {
    if (!sessionId || sessionId === 'unknown') return;
    const data = await api(`/api/session?id=${encodeURIComponent(sessionId)}&limit=200`);
    const counts = data.counts || {};
    showHtmlDetail(`
    <div class="session-summary">
      <div class="diag-pill"><strong>${esc(counts.memories || 0)}</strong><span>memories</span></div>
      <div class="diag-pill"><strong>${esc(counts.triples || 0)}</strong><span>triples</span></div>
      <div class="diag-pill"><strong>${esc(counts.consolidations || 0)}</strong><span>consolidations</span></div>
    </div>
    <div class="drawer-actions session-actions"><button id="sessionBrowseMemories" class="drawer-action primary">Browse memories</button><button id="sessionTimeline" class="drawer-action">Timeline by session</button><button id="sessionCopy" class="drawer-action">Copy session ID</button></div>
    <div class="result-section"><h3>Timeline <span>${esc(counts.events || 0)}</span></h3><div class="timeline">${(data.events || []).map(sessionEvent).join('') || '<p class="muted">No events for this session.</p>'}</div></div>
  `, `Session ${sessionId}`);
    if (opts.push !== false) pushRoute({ tab: 'timelineView', drawer: { type: 'session', id: sessionId } });
    $('#sessionBrowseMemories').onclick = () => {
      $('#memorySession').value = sessionId;
      $('#memoryKind').value = 'all';
      $('#memoryQuery').value = '';
      switchTab('memories');
      closeDetail({ push: false });
    };
    $('#sessionTimeline').onclick = () => {
      $('#timelineGroup').value = 'session';
      $('#timelineQuery').value = sessionId;
      switchTab('timelineView');
      closeDetail({ push: false });
    };
    $('#sessionCopy').onclick = () => showSelectableCopy('Session ID', sessionId);
    $$('#detailBody .session-event').forEach((el) => bindActivatable(el, () => showDetail(JSON.parse(el.dataset.json), 'Session event detail')));
  }

  function bindMemoryClicks(root) {
    root.querySelectorAll('.session-link').forEach((btn) => {
      btn.onclick = (event) => {
        event.stopPropagation();
        openSessionDetail(btn.dataset.session || '');
      };
    });
    root.querySelectorAll('.item[data-id]').forEach((el) => bindActivatable(el, (event) => {
      if (event.target.closest('.session-link,button,a,label,input')) return;
      openMemoryDetail(el.dataset.id);
    }));
  }

  function bindJsonCards(root, title) {
    root.querySelectorAll('[data-json]').forEach((el) => bindActivatable(el, () => showDetail(JSON.parse(el.dataset.json), title)));
  }

  return {
    bindJsonCards,
    bindMemoryClicks,
    closeDetail,
    openMemoryDetail,
    openSessionDetail,
    showDetail,
    showHtmlDetail,
    showSelectableCopy,
  };
}
