import { esc, shortId } from './utils/escape.js';
import { prettyTime } from './utils/format.js';
import { $, $$, bindActivatable, closeMobileMenu, closeMobileMenuForViewportChange, fillSelect, showPanel } from './ui/dom.js';
import { breakdown, countLabel, optionsFrom, stateHtml } from './ui/render.js';
import { actionSummary, keyboardActionForEvent, renderToast, setButtonPending, skeletonHtml } from './ui/feedback.js';
import { createApiClient } from './api/client.js';
import { endpoints } from './api/endpoints.js';
import { canonicalTab, routeTabState, routeToUrl, urlToRoute } from './state/routing.js';
import { bulkSelectionState, isMutableMemory, liveEventMeta, MEMORY_FILTER_PRESETS, MEMORY_PAGE_SIZE, memoryFilterParams, memoryItem, memoryPresetByKey, mergeMemoryPage, meta, selectedMutableIds, sortByExpiringSoon } from './features/memories.js';
import { lifecycleQueueHtml } from './features/review.js';
import { createReviewController } from './features/review-controller.js';
import { createDetailDrawerController } from './features/detail-drawer.js';
import { createSettingsController } from './features/settings-controller.js';
import { createGraphFeature } from './features/graph.js';
import { createChartsFeature } from './features/charts.js';
import { createVisualiserChrome } from './visualisers/chrome.js';
import { createCanvasConstellationVisualiser } from './visualisers/constellation.js';
import { createThreeVisualiser } from './visualisers/three-visualiser.js';
import { createMemoryPalaceVisualiser } from './visualisers/memory-palace.js';
import { trapFocus } from './utils/a11y.js';
import { prefersReducedMotion } from './utils/motion.js';

const THEME_KEY = 'mnemosyne-dashboard-theme';
let consolidationState = [];
let realtimeState = { paused: false, source: null, events: [], status: null };
const LIVE_MEMORY_PAGE_SIZE = 25;
let liveMemoryItems = [];
let liveMemoryOffset = 0;
let liveMemoryHasMore = true;
let liveMemoryLoading = false;
let liveMemoryObserver = null;
let currentRoute = { tab: 'overview' };
let applyingHistory = false;
let lastBootError = null;
let bulkSelection = new Set();
let latestMemoryItems = [];
let memoryOffset = 0;
let memoryHasMore = true;
let memoryTotal = null;
let memoryListIsPreset = false;
let goChordUntil = 0;
let toastTimer = 0;

function setTheme(theme){
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  $$('.theme-icon').forEach(icon => { icon.textContent = theme === 'light' ? '☀' : '☾'; });
  $$('.theme-label').forEach(label => { label.textContent = theme === 'light' ? 'Light' : 'Dark'; });
}
function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  setTheme(saved || preferred);
}
let settingsController;
const { api, postJson, setCsrfToken } = createApiClient({
  onUnauthorized: () => settingsController?.showLogin(),
  devTiming: localStorage.getItem('mnemosyne-debug-api') === '1',
  onTiming: info => console.debug('[api]', info),
});
settingsController = createSettingsController({
  $,
  api,
  postJson,
  setCsrfToken,
  confirmAction,
  runButtonAction,
  showDetail,
  showSelectableCopy,
  loadStats,
});
function showLogin(){ settingsController.showLogin(); }
function hideLogin(){ settingsController.hideLogin(); }
function refreshAuthState(){ return settingsController.refreshAuthState(); }
function loadAuthStatus(){ return settingsController.loadAuthStatus(); }
function loadDiagnostics(){ return settingsController.loadDiagnostics(); }
function loadRuntimeDiagnostics(){ return settingsController.loadRuntimeDiagnostics(); }
const detailDrawer = createDetailDrawerController({
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
  getCurrentRoute: () => currentRoute,
  memoryRouteState,
  switchTab,
});
const { loadGraph, resetGraphView } = createGraphFeature({ $, $$, api, showDetail, switchTab });
const { loadInsights, disposeInsightsCharts } = createChartsFeature({ $, api, switchTab, loadMemories });
const visualiserChrome = createVisualiserChrome({
  $,
  redrawCanvas: redrawConstellation,
  resizeThree,
  resizeMemoryPalace,
});
const reviewController = createReviewController({
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
  openMemoryFilter: applyReviewFilter,
});
function isCancelledRequest(error){ return error?.name === 'ApiError' && error.status === 0 && !error.retryable; }
function bootErrorPayload(){
  return lastBootError ? JSON.stringify(lastBootError, null, 2) : '';
}
function renderBootErrorStatus(){
  const status = $('#bootErrorStatus');
  const stack = $('#bootErrorStack');
  const copy = $('#copyBootError');
  if(!status || !stack) return;
  if(!lastBootError){
    status.textContent = 'No frontend boot errors recorded in this page session.';
    stack.textContent = '';
    stack.classList.add('hidden');
    if(copy) copy.disabled = true;
    return;
  }
  status.textContent = `${lastBootError.time} · ${lastBootError.message}`;
  stack.textContent = lastBootError.stack || lastBootError.message;
  stack.classList.remove('hidden');
  if(copy) copy.disabled = false;
}
function setBootError(title, body=''){
  const el = $('#bootError');
  if(!el) return;
  el.innerHTML = `<strong>${esc(title)}</strong>${body ? `<p>${esc(body)}</p>` : ''}<div class="item-actions"><button id="bootErrorRetry" class="primary">Retry load</button><button id="bootErrorCopy">Copy error details</button></div>`;
  el.classList.remove('hidden');
  $('#bootErrorRetry')?.addEventListener('click', () => bootstrapDashboard());
  $('#bootErrorCopy')?.addEventListener('click', () => copyBootErrorDetails());
}
function clearBootError(){
  const el = $('#bootError');
  if(!el) return;
  el.innerHTML = '';
  el.classList.add('hidden');
}
function copyBootErrorDetails(){
  if(!lastBootError) return;
  showSelectableCopy('Boot error details', bootErrorPayload());
}
async function handleInitError(error){
  console.error('Dashboard bootstrap failed', error);
  lastBootError = {
    time: new Date().toISOString(),
    message: error?.message || String(error || 'Unknown startup error'),
    stack: error?.stack || '',
  };
  let status = null;
  try {
    const r = await fetch('/api/auth/status', { cache: 'no-store' });
    status = await r.json();
    if(r.ok) settingsController.setAuthState(status);
  } catch {}
  const authRequired = !!(status && status.auth_enabled && !status.authenticated);
  if(authRequired){
    clearBootError();
    renderBootErrorStatus();
    showLogin();
    return;
  }
  hideLogin();
  setBootError('Dashboard failed to finish loading.', lastBootError.message);
  renderBootErrorStatus();
}
async function bootstrapDashboard(){
  clearBootError();
  const route = urlToRoute();
  if(route.tab !== 'overview' || route.drawer) switchTab(route.tab || 'overview', { push:false });
  const s = await refreshAuthState();
  if(s.auth_enabled && !s.authenticated){
    renderBootErrorStatus();
    showLogin();
    return;
  }
  hideLogin();
  await loadStats();
  await initRealtime();
  if(route.tab !== 'overview' || route.drawer) await applyRoute(route);
  renderBootErrorStatus();
}
function pushRoute(state, replace=false){
  if(applyingHistory) return;
  currentRoute = { ...state };
  const fn = replace ? 'replaceState' : 'pushState';
  history[fn](currentRoute, '', routeToUrl(currentRoute));
}
function currentMemoryFilters(){
  return {
    kind: $('#memoryKind')?.value || '',
    q: $('#memoryQuery')?.value.trim() || '',
    source: $('#memorySource')?.value || '',
    scope: $('#memoryScope')?.value || '',
    session_id: $('#memorySession')?.value || '',
    veracity: $('#memoryVeracity')?.value || '',
    degradation_tier: $('#memoryDegradation')?.value || '',
    trust: $('#memoryTrustPreset')?.value || '',
    status: $('#memoryStatus')?.value || '',
    sort: $('#memorySort')?.value || '',
  };
}
function memoryRouteState(){
  const filters = Object.fromEntries(Object.entries(currentMemoryFilters()).filter(([,value]) => value));
  return routeTabState('memories', Object.keys(filters).length ? {filters} : {});
}
function applyMemoryRouteFilters(filters={}){
  if('kind' in filters) $('#memoryKind').value = filters.kind || 'all';
  if('q' in filters) $('#memoryQuery').value = filters.q || '';
  if('source' in filters) $('#memorySource').value = filters.source || '';
  if('scope' in filters) $('#memoryScope').value = filters.scope || '';
  if('session_id' in filters) $('#memorySession').value = filters.session_id || '';
  if('veracity' in filters) $('#memoryVeracity').value = filters.veracity || '';
  if('degradation_tier' in filters) $('#memoryDegradation').value = filters.degradation_tier || '';
  if('trust' in filters) $('#memoryTrustPreset').value = filters.trust || '';
  if('status' in filters) $('#memoryStatus').value = filters.status || 'active';
  if('sort' in filters) $('#memorySort').value = filters.sort || 'recent';
}
function resetMemoryFilterControls(){
  ['memoryQuery','memorySource','memoryScope','memorySession','memoryVeracity','memoryDegradation','memoryTrustPreset'].forEach(id => $('#'+id).value = '');
  $('#memoryKind').value = 'all';
  $('#memoryStatus').value = 'active';
  $('#memorySort').value = 'recent';
}
function closeDetail(opts={}){
  detailDrawer.closeDetail(opts);
}
async function applyRoute(state){
  applyingHistory = true;
  try {
    const route = state || urlToRoute();
    if(route.tab === 'memories' && route.filters) applyMemoryRouteFilters(route.filters);
    switchTab(route.tab || 'overview', { push:false });
    if(route.drawer?.type === 'memory') await openMemoryDetail(route.drawer.id, { push:false });
    else if(route.drawer?.type === 'session') await openSessionDetail(route.drawer.id, { push:false });
    else closeDetail({ push:false });
    currentRoute = route;
    const canonicalUrl = routeToUrl(route);
    if(location.pathname + location.search + location.hash !== canonicalUrl) history.replaceState(route, '', canonicalUrl);
  } finally {
    applyingHistory = false;
  }
}
function showSelectableCopy(label, value){
  detailDrawer.showSelectableCopy(label, value);
}
function showDetail(obj, title='Detail', opts={}){
  detailDrawer.showDetail(obj, title, opts);
}
function showHtmlDetail(html, title='Detail'){
  detailDrawer.showHtmlDetail(html, title);
}

function modalTemplate(){
  let modal = $('#actionModal');
  if(modal) return modal;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="actionModal" class="action-modal hidden" role="dialog" aria-modal="true" aria-labelledby="actionModalTitle" aria-describedby="actionModalDescription">
      <div class="action-modal-card glass">
        <button id="actionModalClose" class="modal-close" aria-label="Close dialog">×</button>
        <div id="actionModalKicker" class="modal-kicker">Memory maintenance</div>
        <h2 id="actionModalTitle">Confirm action</h2>
        <p id="actionModalDescription" class="muted"></p>
        <div id="actionModalBody"></div>
        <p id="actionModalError" class="modal-error"></p>
        <div class="modal-actions">
          <button id="actionModalCancel">Cancel</button>
          <button id="actionModalConfirm" class="primary">Confirm</button>
        </div>
      </div>
    </div>`);
  return $('#actionModal');
}
function openActionModal({title, description='', kicker='Memory maintenance', confirmText='Confirm', tone='', bodyHtml='', readValue=()=>true, validate=()=>''}){
  return new Promise(resolve => {
    const modal = modalTemplate();
    $('#actionModalKicker').textContent = kicker;
    $('#actionModalTitle').textContent = title;
    $('#actionModalDescription').textContent = description;
    $('#actionModalBody').innerHTML = bodyHtml;
    $('#actionModalConfirm').textContent = confirmText;
    $('#actionModalConfirm').className = `primary ${tone}`.trim();
    $('#actionModalError').textContent = '';
    let releaseFocusTrap = () => {};
    const close = (value) => { modal.classList.add('hidden'); document.removeEventListener('keydown', onKey); releaseFocusTrap(); resolve(value); };
    const onKey = (e) => { if(e.key === 'Escape') close(null); if(e.key === 'Enter' && !e.target.matches('textarea')) $('#actionModalConfirm').click(); };
    $('#actionModalClose').onclick = () => close(null);
    $('#actionModalCancel').onclick = () => close(null);
    modal.onclick = (e) => { if(e.target === modal) close(null); };
    $('#actionModalConfirm').onclick = () => {
      const value = readValue(modal);
      const error = validate(value);
      if(error){ $('#actionModalError').textContent = error; return; }
      close(value);
    };
    modal.classList.remove('hidden');
    document.addEventListener('keydown', onKey);
    releaseFocusTrap = trapFocus(modal);
    const first = modal.querySelector('textarea,input,button.primary');
    setTimeout(() => first?.focus(), 30);
  });
}
function confirmAction(opts){ return openActionModal(opts); }
function toastHost(){
  let host = $('#toastHost');
  if(host) return host;
  document.body.insertAdjacentHTML('beforeend', '<div id="toastHost" class="toast-host" aria-live="polite" aria-atomic="false"></div>');
  return $('#toastHost');
}
function showToast(opts={}){
  const host = toastHost();
  host.innerHTML = renderToast(opts);
  const action = host.querySelector('.toast-action');
  if(action && typeof opts.action === 'function') action.onclick = opts.action;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { host.innerHTML = ''; }, opts.timeout || 5200);
}
async function runButtonAction(button, pendingLabel, action, success){
  setButtonPending(button, true, pendingLabel);
  try {
    const result = await action();
    if(success) showToast(typeof success === 'function' ? success(result) : success);
    return result;
  } catch(e) {
    showToast({tone:'error', title:'Action failed', body:e.message || 'Try again.'});
    throw e;
  } finally {
    setButtonPending(button, false);
  }
}
async function runBulkMutation(ids, mutate, verb){
  let failed = 0;
  for(const id of ids){
    try { await mutate(id); }
    catch(e){ failed += 1; console.warn('[bulk mutation]', id, e); }
  }
  const summary = actionSummary(verb, {count:ids.length, failed});
  showToast({tone: failed ? 'warning' : 'success', title:summary, body: failed ? 'The failed items were left selected for retry.' : 'The list has been refreshed.'});
  return {failed};
}
async function openCommandSearch(){
  const query = await openActionModal({
    title: 'Command search',
    description: 'Search memories, facts, and consolidations from anywhere.',
    kicker: 'Global command',
    confirmText: 'Search',
    bodyHtml: '<label class="modal-field"><span>Search query</span><input id="modalCommandSearch" type="search" placeholder="whoop, project, session, person..." /></label>',
    readValue: () => $('#modalCommandSearch').value.trim(),
    validate: (v) => v ? '' : 'Type a search query.'
  });
  if(query === null) return;
  $('#globalSearchQuery').value = query;
  switchTab('search');
  await loadGlobalSearch();
}
function openShortcutHelp(){
  openActionModal({
    title: 'Keyboard shortcuts',
    description: 'Fast paths for the dashboard.',
    kicker: 'Command map',
    confirmText: 'Done',
    bodyHtml: `<div class="shortcut-grid">
      <span>/</span><strong>Focus search</strong>
      <span>⌘K / Ctrl K</span><strong>Open command search</strong>
      <span>Esc</span><strong>Close drawer or dialog</strong>
      <span>g o</span><strong>Go to Overview</strong>
      <span>g m</span><strong>Go to Memories</strong>
      <span>g r</span><strong>Go to Review</strong>
      <span>g k</span><strong>Go to Knowledge Graph</strong>
      <span>Canvas arrows</span><strong>Move between visible visualiser nodes</strong>
      <span>Canvas Enter</span><strong>Open selected visualiser node</strong>
      <span>Canvas R / P</span><strong>Reset or pause the canvas visualiser</strong>
      <span>3D arrows</span><strong>Rotate or pan the 3D visualiser</strong>
      <span>3D +/-</span><strong>Zoom the 3D visualiser</strong>
      <span>Labyrinth WASD</span><strong>Move through the Memory Palace</strong>
    </div>`
  });
}
function focusPrimarySearch(){
  const target = sectionFor(currentRoute.tab) === 'explore' ? $('#memoryQuery') : $('#menuSearchQuery') || $('#globalSearchQuery');
  target?.focus();
  target?.select?.();
}
function handleGlobalKeyboard(e){
  const chord = performance.now() < goChordUntil ? 'g' : '';
  const action = keyboardActionForEvent(e, chord);
  if(!action) return;
  if(action === 'start-go-chord'){
    goChordUntil = performance.now() + 1100;
    return;
  }
  goChordUntil = 0;
  e.preventDefault();
  if(action === 'focus-search') focusPrimarySearch();
  else if(action === 'show-shortcuts') openShortcutHelp();
  else if(action === 'close-overlay') closeDetail();
  else if(action === 'open-command') openCommandSearch();
  else if(action === 'go-overview') switchTab('overview');
  else if(action === 'go-memories') switchTab('memories');
  else if(action === 'go-review') switchTab('review');
  else if(action === 'go-graph') switchTab('graph');
}
function askImportance(current){
  return openActionModal({
    title: 'Edit importance',
    description: 'Set a value from 0.00 to 1.00. Higher importance makes this memory more likely to surface.',
    confirmText: 'Save importance',
    bodyHtml: `<label class="modal-field"><span>Importance</span><input id="modalImportance" type="number" min="0" max="1" step="0.01" value="${esc(Number(current ?? 0.5).toFixed(2))}" /></label>`,
    readValue: () => Number($('#modalImportance').value),
    validate: (v) => Number.isFinite(v) && v >= 0 && v <= 1 ? '' : 'Enter a number between 0.00 and 1.00.'
  });
}
function askReplacement(content){
  return openActionModal({
    title: 'Supersede memory',
    description: 'Create a corrected replacement memory and expire the old one. The original stays in history.',
    confirmText: 'Create replacement',
    tone: 'dangerish',
    bodyHtml: `<label class="modal-field"><span>Replacement memory content</span><textarea id="modalReplacement" rows="9">${esc(content || '')}</textarea></label>`,
    readValue: () => $('#modalReplacement').value.trim(),
    validate: (v) => v ? '' : 'Replacement content cannot be empty.'
  });
}
function askVeracity(current){
  const value = String(current || 'unknown').toLowerCase();
  return openActionModal({
    title: 'Set trust / veracity',
    description: 'Use this only after human review. Lifecycle hot/warm/cold stays automatic.',
    confirmText: 'Save trust',
    bodyHtml: `<label class="modal-field"><span>Trust / veracity</span><select id="modalVeracity">
      ${['stated','inferred','tool','imported','unknown'].map(v => `<option value="${v}"${v === value ? ' selected' : ''}>${v}</option>`).join('')}
    </select></label>`,
    readValue: () => $('#modalVeracity').value,
    validate: (v) => ['stated','inferred','tool','imported','unknown'].includes(v) ? '' : 'Choose a valid trust value.'
  });
}
function askExpiry(current){
  return openActionModal({
    title: 'Set expiry',
    description: 'Set valid_until as an ISO timestamp, or leave blank to clear expiry. Expire now remains the safer one-click option for wrong memories.',
    confirmText: 'Save expiry',
    bodyHtml: `<label class="modal-field"><span>Valid until</span><input id="modalExpiry" type="text" placeholder="2026-06-01T00:00:00" value="${esc(current || '')}" /></label><p class="muted">Blank means no scheduled expiry.</p>`,
    readValue: () => $('#modalExpiry').value.trim(),
    validate: (v) => {
      if(!v) return '';
      const d = Date.parse(v);
      return Number.isFinite(d) ? '' : 'Enter an ISO timestamp like 2026-06-01T00:00:00, or leave blank.';
    }
  });
}

function sectionFor(name){
  return ({ visualiser:'visualiser3d', palace:'memoryPalace', visualiserlegacy:'constellation', constellation:'constellation', recall:'explore', memories:'explore', history:'activity', timelineView:'activity', consolidations:'activity', triples:'graph', todayAdded:'today', todayRecalled:'today', todayTriples:'today', todayConsolidations:'today' })[name] || name;
}
function defaultPanelFor(section){
  return ({ explore:'exploreMemories', activity:'activityTimeline', graph:'graphGraph', today:'todayAdded' })[section];
}
function panelFor(name){
  return ({ memories:'exploreMemories', recall:'exploreRecall', history:'activityTimeline', timelineView:'activityTimeline', consolidations:'activityConsolidations', graph:'graphGraph', triples:'graphTriples', today:'todayAdded', todayAdded:'todayAdded', todayRecalled:'todayRecalled', todayTriples:'todayTriples', todayConsolidations:'todayConsolidations' })[name] || defaultPanelFor(name);
}
function visualiserResponsiveFill(width, height){
  return visualiserChrome.responsiveFill(width, height);
}
async function toggleVisualiserFullscreen(selector){
  await visualiserChrome.toggleFullscreen(selector);
}
async function exitVisualiserFullscreen(event){
  await visualiserChrome.exitFullscreen(event);
}
function updateVisualiserFullscreenButtons(){
  visualiserChrome.updateFullscreenButtons();
}
function switchTab(name, opts={}){
  const section = sectionFor(name);
  if(section !== 'constellation') stopCanvasVisualiserLoop();
  if(section !== 'visualiser3d' && isThreeVisualiserRendering()) clearThreeScene();
  if(section !== 'memoryPalace' && isMemoryPalaceRendering()) clearPalaceScene();
  if(section !== 'insights') disposeInsightsCharts();
  document.body.classList.toggle('compact-page', section !== 'overview');
  $$('.tab').forEach(x=>x.classList.remove('active'));
  $$('nav button').forEach(x=>{ x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
  $(`#${section}`).classList.add('active');
  const nav = document.querySelector(`nav button[data-tab="${canonicalTab(name)}"]`) || document.querySelector(`nav button[data-tab="${section}"]`);
  if(nav){ nav.classList.add('active'); nav.setAttribute('aria-selected', 'true'); }
  showPanel(section, panelFor(name));
  closeDetail({ push:false });
  closeMobileMenu();
  currentRoute = section === 'explore' && panelFor(name) === 'exploreMemories' ? memoryRouteState() : routeTabState(name);
  if(opts.push !== false) pushRoute(currentRoute);
  if(name==='graph' || section==='graph') loadGraph();
  if(name==='triples') loadTriples();
  if(name==='consolidations') loadConsolidations();
  if(name==='memories') loadMemories();
  if(name==='search') loadGlobalSearch();
  if(name==='recall') loadRecallDebug();
  if(name==='timelineView' || section==='activity') loadTimeline();
  if(section==='today') loadTodayDigest();
  if(section==='profile') loadProfile();
  if(section==='review') loadReview();
  if(section==='lifecycle') loadLifecycle();
  if(section==='constellation') loadConstellation();
  if(section==='visualiser3d') loadThreeVisualiser();
  if(section==='memoryPalace') loadMemoryPalace();
  if(section==='settings') { loadAuthStatus(); loadDiagnostics(); loadRuntimeDiagnostics(); loadRealtimePanel(); }
  if(section==='memoria') loadMemoria();
  if(section==='insights') loadInsights();
}

async function loadStats(){
  const s = await api(endpoints.stats());
  $('#dbPath').textContent = s.db_path;
  $('#dbPath').title = s.db_path;
  const cards = [
    ['Working', s.counts.working_memory], ['Episodic', s.counts.episodic_memory], ['Needs review', s.contamination?.total || 0], ['Degraded', s.degradation?.degraded || 0], ['Triples', s.counts.triples], ['Consolidations', s.counts.consolidation_log]
  ];
  $('#cards').innerHTML = cards.map(([label,num]) => `<div class="card"><div class="num">${Number(num).toLocaleString()}</div><div class="label">${label}</div></div>`).join('');
  $('#sourceBreakdown').innerHTML = breakdown(s.by_source, 'source');
  $('#scopeBreakdown').innerHTML = breakdown(s.by_scope, 'scope');
  $('#sessionBreakdown').innerHTML = breakdown(s.by_session, 'session_id', 6);
  $('#veracityBreakdown').innerHTML = breakdown(s.by_veracity || [], 'veracity', 8);
  $('#degradationBreakdown').innerHTML = breakdown(s.by_degradation || [], 'degradation_label', 8);
  fillSelect($('#memorySource'), optionsFrom(s.by_source, 'source'), 'all sources');
  fillSelect($('#memoryScope'), optionsFrom(s.by_scope, 'scope'), 'all scopes');
  fillSelect($('#memorySession'), optionsFrom(s.by_session, 'session_id'), 'all sessions');
  bindBreakdownClicks();
  loadLiveMemoryStream(false);
}
function renderRealtimeStatus(){
  // Realtime diagnostics belong in Settings, not the Overview hero.
}
function sortRealtimeEventsNewestFirst(events){
  return [...events].sort((a,b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0));
}
function renderLiveMemoryStream(){
  const list = $('#liveMemoryStream');
  if(!list) return;
  list.innerHTML = liveMemoryItems.length ? liveMemoryItems.map(memoryItem).join('') : stateHtml('empty', 'No memories found.', 'The memory stream will appear here once memories exist.');
  bindMemoryClicks($('#liveMemoryStream'));
  const status = $('#liveMemoryStatus');
  if(status){
    status.textContent = liveMemoryLoading ? 'Loading older memories…' : liveMemoryHasMore ? 'Scroll to load older memories.' : 'End of memory stream.';
  }
}
async function loadLiveMemoryStream(append=false){
  if(liveMemoryLoading) return;
  if(append && !liveMemoryHasMore) return;
  liveMemoryLoading = true;
  renderLiveMemoryStream();
  if(!append){ liveMemoryItems = []; liveMemoryOffset = 0; liveMemoryHasMore = true; }
  const params = new URLSearchParams({
    kind: 'all',
    status: 'active',
    sort: 'recent',
    limit: String(LIVE_MEMORY_PAGE_SIZE),
    offset: String(liveMemoryOffset),
  });
  try {
    const data = await api(`/api/memories?${params.toString()}`);
    const items = data.items || [];
    const seen = new Set(liveMemoryItems.map(item => item.id));
    liveMemoryItems = append ? [...liveMemoryItems, ...items.filter(item => !seen.has(item.id))] : items;
    liveMemoryOffset += items.length;
    liveMemoryHasMore = items.length === LIVE_MEMORY_PAGE_SIZE;
  } finally {
    liveMemoryLoading = false;
    renderLiveMemoryStream();
  }
}
function initLiveMemoryInfiniteScroll(){
  const sentinel = $('#liveMemorySentinel');
  if(!sentinel) return;
  if(liveMemoryObserver) liveMemoryObserver.disconnect();
  if(!('IntersectionObserver' in window)){
    window.addEventListener('scroll', () => {
      if(liveMemoryHasMore && !liveMemoryLoading && window.innerHeight + window.scrollY >= document.body.offsetHeight - 700) loadLiveMemoryStream(true);
    }, {passive:true});
    return;
  }
  liveMemoryObserver = new IntersectionObserver(entries => {
    if(entries.some(entry => entry.isIntersecting)) loadLiveMemoryStream(true);
  }, {rootMargin:'700px 0px'});
  liveMemoryObserver.observe(sentinel);
}
function addLiveMemoryEvent(event){
  if(!event || !event.memory_id) return;
  const existing = liveMemoryItems.find(item => item.id === event.memory_id);
  if(existing && event.event_type === 'MEMORY_SNAPSHOT') return;
  const item = {
    ...(existing || {}),
    id: event.memory_id,
    content: event.content || existing?.content || '',
    source: event.source || existing?.source || '',
    timestamp: event.timestamp || existing?.timestamp || '',
    created_at: event.timestamp || existing?.created_at || '',
    importance: event.importance ?? existing?.importance ?? 0,
    veracity: event.veracity || existing?.veracity || 'unknown',
    memory_kind: event.memory_kind || existing?.memory_kind || 'memory',
    status: event.status || existing?.status || 'active',
    live_event_type: event.event_type || 'MEMORY_ADDED',
  };
  if(event.event_type === 'MEMORY_INVALIDATED'){
    liveMemoryItems = liveMemoryItems.map(existingItem => existingItem.id === item.id ? item : existingItem);
  } else {
    liveMemoryItems = [item, ...liveMemoryItems.filter(existingItem => existingItem.id !== item.id)];
  }
  renderLiveMemoryStream();
}
function renderRealtimeEvents(){
  const feeds = ['#liveEventFeed', '#realtimeEventFeed'].map(sel => $(sel)).filter(Boolean);
  if(!feeds.length) return;
  const orderedEvents = sortRealtimeEventsNewestFirst(realtimeState.events);
  const html = orderedEvents.length ? orderedEvents.slice(0, 20).map(ev => {
    const kind = ev.memory_kind || 'memory';
    const label = ev.event_type || 'MEMORY_EVENT';
    const when = ev.timestamp ? prettyTime(ev.timestamp) : 'just now';
    const source = ev.source ? `<span class="badge">${esc(ev.source)}</span>` : '';
    return `<div class="realtime-event" data-memory-id="${esc(ev.memory_id || '')}"><div><strong>${esc(label)}</strong> <span class="muted">${esc(kind)}</span></div><div class="meta"><span class="badge">${esc(shortId(ev.memory_id || 'unknown'))}</span><span class="badge trust-${esc(ev.veracity || 'unknown')}">${esc(ev.veracity || 'unknown')}</span>${source}<span class="meta-time">${esc(when)}</span></div><div class="content realtime-content">${esc(ev.content || '')}</div></div>`;
  }).join('') : '<div class="state-empty">Waiting for memory events…</div>';
  feeds.forEach(feed => {
    feed.innerHTML = html;
    feed.querySelectorAll('.realtime-event').forEach(row => bindActivatable(row, () => openMemoryDetail(row.dataset.memoryId || '')));
  });
}
function renderRealtimePanel(){
  const status = realtimeState.status || {};
  const cards = [
    ['Streaming', status.streaming_supported ? 'Ready' : 'Unavailable'],
    ['DeltaSync', status.deltasync_supported ? 'Ready' : 'Unavailable'],
    ['Installed package', status.mnemosyne_version || 'unknown'],
    ['Realtime API', status.realtime_generation || 'unknown'],
    ['Events', status.snapshot_event_count || 0],
  ];
  const delta = $('#settingsDeltaSync');
  if(delta) delta.innerHTML = cards.map(([label,num]) => `<div class="realtime-kv"><strong>${esc(label)}</strong><span>${esc(num)}</span></div>`).join('') + `<div class="realtime-kv"><strong>Transport</strong><span>${esc(status.transport || 'sse')}</span></div><div class="realtime-kv"><strong>Tables</strong><span>${esc((status.deltasync_tables || []).join(', ') || 'none')}</span></div><div class="realtime-kv"><strong>DeltaSync methods</strong><span>${esc((status.deltasync_methods || []).join(', ') || 'none')}</span></div><div class="realtime-kv"><strong>Event types</strong><span>${esc((status.event_types || []).join(', ') || 'none')}</span></div><div class="realtime-kv"><strong>Payload policy</strong><span>${esc(status.payload_policy || 'private dashboard payload')}</span></div><div class="realtime-kv"><strong>DB modified</strong><span>${esc(status.db_modified_at || '')}</span></div>`;
}
async function loadRealtimePanel(){
  try {
    realtimeState.status = await api(endpoints.realtimeStatus());
    renderRealtimeStatus();
    renderRealtimePanel();
  } catch(e) {
    const delta = $('#settingsDeltaSync');
    if(delta) delta.innerHTML = `<div class="state-card state-error"><strong>Sync diagnostics unavailable</strong><p>${esc(e.message)}</p></div>`;
  }
}
function addRealtimeEvent(event){
  if(realtimeState.paused) return;
  if(!event || !event.memory_id) return;
  realtimeState.events = sortRealtimeEventsNewestFirst([event, ...realtimeState.events.filter(e => `${e.event_type}:${e.memory_id}:${e.timestamp}` !== `${event.event_type}:${event.memory_id}:${event.timestamp}`)]).slice(0, 50);
  renderRealtimeEvents();
  addLiveMemoryEvent(event);
}
function toggleLiveUpdates(){
  realtimeState.paused = !realtimeState.paused;
  renderRealtimeStatus();
  renderRealtimePanel();
}
async function initRealtime(){
  try {
    realtimeState.status = await api(endpoints.realtimeStatus());
    renderRealtimeStatus();
    renderRealtimeEvents();
  } catch(e) {
    return;
  }
  if(!('EventSource' in window)) return;
  if(realtimeState.source) realtimeState.source.close();
  const source = new EventSource('/api/realtime/events?limit=25');
  realtimeState.source = source;
  source.addEventListener('status', e => { realtimeState.status = JSON.parse(e.data); renderRealtimeStatus(); });
  source.addEventListener('memory', e => addRealtimeEvent(JSON.parse(e.data)));
}
function bindBreakdownClicks(){
  $$('#sourceBreakdown .break-row').forEach(row => bindActivatable(row, () => { $('#memorySource').value = row.dataset.filter || ''; switchTab('memories'); }));
  $$('#scopeBreakdown .break-row').forEach(row => bindActivatable(row, () => { $('#memoryScope').value = row.dataset.filter || ''; switchTab('memories'); }));
  $$('#veracityBreakdown .break-row').forEach(row => bindActivatable(row, () => { $('#memoryVeracity').value = row.dataset.filter || ''; switchTab('memories'); }));
  $$('#degradationBreakdown .break-row').forEach(row => bindActivatable(row, () => { const map={hot:'1',warm:'2',cold:'3'}; $('#memoryDegradation').value = map[row.dataset.filter] || ''; switchTab('memories'); }));
  $$('#sessionBreakdown .break-row').forEach(row => bindActivatable(row, () => openSessionDetail(row.dataset.filter || '')));
}
function currentMemoryFilterValues(){
  return {
    kind: $('#memoryKind').value,
    q: $('#memoryQuery').value,
    source: $('#memorySource').value,
    scope: $('#memoryScope').value,
    sessionId: $('#memorySession').value,
    veracity: $('#memoryVeracity').value,
    degradationTier: $('#memoryDegradation').value,
    trustPreset: $('#memoryTrustPreset').value,
    status: $('#memoryStatus').value,
    sort: $('#memorySort').value
  };
}
function updateMemoryListMeta(){
  const countEl = $('#memoryListCount');
  if(countEl){
    const loaded = latestMemoryItems.length.toLocaleString();
    countEl.textContent = Number.isFinite(memoryTotal) ? `${loaded} loaded · ${memoryTotal.toLocaleString()} total` : `${loaded} loaded`;
  }
  const loadBar = $('#memoryLoadBar');
  if(loadBar) loadBar.classList.toggle('hidden', memoryListIsPreset || !memoryHasMore);
}
async function loadMemories(){
  memoryListIsPreset = false;
  memoryOffset = 0;
  memoryTotal = null;
  $('#memoryList').innerHTML = skeletonHtml('Loading memories', 4);
  try {
    const params = memoryFilterParams(currentMemoryFilterValues(), MEMORY_PAGE_SIZE, memoryOffset);
    const data = await api(endpoints.memories(params), {requestKey:'memories'});
    const items = data.items || [];
    latestMemoryItems = mergeMemoryPage([], items);
    memoryTotal = Number.isFinite(Number(data.total)) ? Number(data.total) : null;
    memoryOffset = Number.isFinite(Number(data.next_offset)) ? Number(data.next_offset) : items.length;
    memoryHasMore = typeof data.has_more === 'boolean' ? data.has_more : items.length === MEMORY_PAGE_SIZE;
    $('#memoryList').innerHTML = latestMemoryItems.map(item => memoryItem(item, {selectable:true, selectedSet:bulkSelection})).join('') || stateHtml('empty', 'No memories found.', 'Try clearing filters or broadening the memory content search.');
    bindMemoryClicks($('#memoryList'));
    bindBulkMemoryControls();
    updateBulkBar();
    updateMemoryListMeta();
  } catch(e) {
    if(isCancelledRequest(e)) return;
    $('#memoryList').innerHTML = stateHtml('error', 'Could not load memories.', e.message || 'Try again.');
    memoryHasMore = false;
    updateMemoryListMeta();
  }
}
async function loadMoreMemories(){
  if(memoryListIsPreset || !memoryHasMore) return;
  await runButtonAction($('#memoryLoadMore'), 'Loading...', async () => {
    const params = memoryFilterParams(currentMemoryFilterValues(), MEMORY_PAGE_SIZE, memoryOffset);
    const data = await api(endpoints.memories(params), {requestKey:'memories-more'});
    const items = data.items || [];
    const seen = new Set(latestMemoryItems.map(item => item.id));
    const newItems = items.filter(item => !seen.has(item.id));
    latestMemoryItems = mergeMemoryPage(latestMemoryItems, items, {append:true});
    memoryTotal = Number.isFinite(Number(data.total)) ? Number(data.total) : memoryTotal;
    memoryOffset = Number.isFinite(Number(data.next_offset)) ? Number(data.next_offset) : memoryOffset + items.length;
    memoryHasMore = typeof data.has_more === 'boolean' ? data.has_more : items.length === MEMORY_PAGE_SIZE;
    const newHtml = newItems.map(item => memoryItem(item, {selectable:true, selectedSet:bulkSelection})).join('');
    if(newHtml) $('#memoryList').insertAdjacentHTML('beforeend', newHtml);
    bindMemoryClicks($('#memoryList'));
    bindBulkMemoryControls();
    updateBulkBar();
    updateMemoryListMeta();
  });
}
async function loadExpiringSoonPreset(){
  memoryListIsPreset = true;
  memoryTotal = null;
  $('#memoryList').innerHTML = skeletonHtml('Loading memories', 4);
  try {
    const params = memoryFilterParams({kind:'all', status:'active', sort:'recent'}, 500, 0);
    const data = await api(endpoints.memories(params), {requestKey:'memories'});
    latestMemoryItems = sortByExpiringSoon(data.items || []).slice(0, 100);
    memoryTotal = latestMemoryItems.length;
    memoryHasMore = false;
    $('#memoryList').innerHTML = latestMemoryItems.map(item => memoryItem(item, {selectable:true, selectedSet:bulkSelection})).join('') || stateHtml('empty', 'No memories with a scheduled expiry found.', 'Expiring soon only lists active memories with an explicit expiry date set.');
    bindMemoryClicks($('#memoryList'));
    bindBulkMemoryControls();
    updateBulkBar();
    updateMemoryListMeta();
  } catch(e) {
    if(isCancelledRequest(e)) return;
    $('#memoryList').innerHTML = stateHtml('error', 'Could not load memories.', e.message || 'Try again.');
  }
}
function applyMemoryPreset(key){
  const preset = memoryPresetByKey(key);
  if(!preset) return;
  resetMemoryFilterControls();
  applyMemoryRouteFilters(preset.filters);
  if(preset.special === 'expiring-soon'){
    loadExpiringSoonPreset().then(() => pushRoute(memoryRouteState(), true));
    return;
  }
  refreshMemoriesRouteAndLoad();
}
function refreshMemoriesRouteAndLoad(){
  pushRoute(memoryRouteState(), true);
  loadMemories();
}
function updateBulkBar(){
  const bar = $('#bulkMemoryBar');
  if(!bar) return;
  const state = bulkSelectionState(latestMemoryItems, bulkSelection, canAdmin());
  bar.classList.toggle('hidden', !state.hasItems);
  $('#bulkSelectionStatus').textContent = state.statusLabel;
  $('#bulkExpire').disabled = state.actionsDisabled;
  $('#bulkVeracity').disabled = state.actionsDisabled;
  $('#bulkExpiry').disabled = state.actionsDisabled;
  $('#bulkImportance').disabled = state.actionsDisabled;
  $('#bulkSelectAll').checked = state.selectAllChecked;
  $('#bulkSelectAll').disabled = state.selectAllDisabled;
}
function bindBulkMemoryControls(){
  $$('#memoryList .memory-check').forEach(chk => chk.onchange = e => { e.stopPropagation(); chk.checked ? bulkSelection.add(chk.dataset.id) : bulkSelection.delete(chk.dataset.id); updateBulkBar(); });
}
async function expireSelectedMemories(button){
  const ids = selectedMutableIds(latestMemoryItems, bulkSelection);
  if(!ids.length) return;
  const ok = await confirmAction({title:'Expire selected memories?', description:`Expire ${ids.length} selected active memories. Backups and audit entries will be created.`, confirmText:'Expire selected', tone:'warn'});
  if(!ok) return;
  await runButtonAction(button, 'Expiring...', async () => {
    const result = await runBulkMutation(ids, id => postJson('/api/admin/memory/invalidate', {memory_id:id, backup: $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true}), 'Expired');
    if(!result.failed) bulkSelection.clear();
    await loadStats(); await loadMemories();
  });
}
async function setSelectedImportance(button){
  const ids = selectedMutableIds(latestMemoryItems, bulkSelection);
  if(!ids.length) return;
  const v = await askImportance(0.5);
  if(v === null) return;
  await runButtonAction(button, 'Saving...', async () => {
    const result = await runBulkMutation(ids, id => postJson('/api/admin/memory/importance', {memory_id:id, importance:Number(v), backup: $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true}), 'Updated');
    if(!result.failed) bulkSelection.clear();
    await loadStats(); await loadMemories();
  });
}
async function setSelectedVeracity(button){
  const ids = selectedMutableIds(latestMemoryItems, bulkSelection);
  if(!ids.length) return;
  const v = await askVeracity('stated');
  if(v === null) return;
  await runButtonAction(button, 'Saving...', async () => {
    const result = await runBulkMutation(ids, id => postJson('/api/admin/memory/veracity', {memory_id:id, veracity:v, backup: $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true}), 'Updated');
    if(!result.failed) bulkSelection.clear();
    await loadStats(); await loadMemories();
  });
}
async function setSelectedExpiry(button){
  const ids = selectedMutableIds(latestMemoryItems, bulkSelection);
  if(!ids.length) return;
  const v = await askExpiry('');
  if(v === null) return;
  await runButtonAction(button, 'Saving...', async () => {
    const result = await runBulkMutation(ids, id => postJson('/api/admin/memory/expiry', {memory_id:id, valid_until:v, backup: $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true}), 'Updated');
    if(!result.failed) bulkSelection.clear();
    await loadStats(); await loadMemories();
  });
}
function bindMemoryClicks(root){
  detailDrawer.bindMemoryClicks(root);
}
function canAdmin(){ return settingsController.canAdmin(); }
async function openMemoryDetail(memoryId, opts={}){
  await detailDrawer.openMemoryDetail(memoryId, opts);
}
async function openSessionDetail(sessionId, opts={}){
  await detailDrawer.openSessionDetail(sessionId, opts);
}
async function loadTriples(){
  const q = $('#tripleQuery').value.trim();
  try {
    const data = await api(`/api/triples?q=${encodeURIComponent(q)}&limit=300`, {requestKey:'triples'});
    $('#tripleRows').innerHTML = data.items.map(t => `<tr class="triple-row" data-triple='${esc(JSON.stringify(t))}'><td>${esc(t.subject)}</td><td>${esc(t.predicate)}</td><td>${esc(t.object)}</td><td>${esc(t.confidence ?? '')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-cell">No triples found.</td></tr>';
    $$('#tripleRows .triple-row').forEach(row => bindActivatable(row, () => showDetail(JSON.parse(row.dataset.triple), 'Triple detail')));
  } catch(e) {
    if(isCancelledRequest(e)) return;
    $('#tripleRows').innerHTML = `<tr><td colspan="4" class="empty-cell">Could not load triples: ${esc(e.message || 'Try again.')}</td></tr>`;
  }
}

function consolidationItem(c){
  return `<div class="item consolidation-item" data-consolidation='${esc(JSON.stringify(c))}'>
    <div class="meta"><span class="badge">${esc(c.session_id || 'unknown session')}</span><span class="badge">${esc(c.items_consolidated)} items</span><span>${esc(c.created_at)}</span></div>
    <div class="content">${esc(c.summary_preview)}</div>
    <div class="item-actions"><button class="tiny inspect-consolidation">Inspect</button><button class="tiny view-session" data-session="${esc(c.session_id || '')}">View session memories</button></div>
  </div>`;
}
function renderConsolidations(){
  const q = ($('#consolidationQuery')?.value || '').trim().toLowerCase();
  const rows = q ? consolidationState.filter(c => `${c.session_id || ''} ${c.summary_preview || ''} ${c.created_at || ''}`.toLowerCase().includes(q)) : consolidationState;
  $('#consolidationList').innerHTML = rows.map(consolidationItem).join('') || '<p class="muted">No consolidations found.</p>';
  $$('#consolidationList .consolidation-item').forEach(el => {
    const data = JSON.parse(el.dataset.consolidation);
    bindActivatable(el, (e) => { if(e.target.closest('button')) return; showDetail(data, 'Consolidation detail'); });
    el.querySelector('.inspect-consolidation').onclick = () => showDetail(data, 'Consolidation detail');
    el.querySelector('.view-session').onclick = () => openSessionDetail(data.session_id || '');
  });
}
async function loadConsolidations(){
  const data = await api('/api/consolidations?limit=200');
  consolidationState = data.items;
  renderConsolidations();
}

function searchMemoryCard(m){ return memoryItem(m); }
function tripleCard(t){ return `<div class="item" data-json='${esc(JSON.stringify(t))}'><div class="meta"><span class="badge">fact</span><span>${esc(t.created_at || t.valid_from || '')}</span></div><div class="content"><strong>${esc(t.subject)}</strong> — ${esc(t.predicate)} → <strong>${esc(t.object)}</strong></div></div>`; }
function consolidationCard(c){ return `<div class="item" data-json='${esc(JSON.stringify(c))}'><div class="meta"><span class="badge">consolidation</span><span class="badge">${esc(c.items_consolidated)} items</span><span>${esc(c.created_at)}</span></div><div class="content">${esc(c.session_id || '')}: ${esc(c.summary_preview || '')}</div></div>`; }
function bindJsonCards(root, title){ detailDrawer.bindJsonCards(root, title); }
async function runSearchFromInput(inputId){
  const q = $(inputId)?.value.trim() || '';
  if(!q) return;
  $('#globalSearchQuery').value = q;
  switchTab('search');
  await loadGlobalSearch();
}
async function menuSearch(){ await runSearchFromInput('#menuSearchQuery'); }
async function loadGlobalSearch(){
  const q = $('#globalSearchQuery')?.value.trim() || '';
  if(!q){ $('#globalSearchResults').innerHTML = stateHtml('empty', 'Search from the sidebar or type a query above.', 'Search looks across memories, facts, and consolidations.'); return; }
  $('#globalSearchResults').innerHTML = skeletonHtml(`Searching for "${q}"`, 3);
  try{
    const data = await api(endpoints.search(q, 30), {requestKey:'global-search'});
    const memories = data.memories || [];
    const triples = data.triples || [];
    const consolidations = data.consolidations || [];
    const total = memories.length + triples.length + consolidations.length;
    $('#globalSearchResults').innerHTML = `
      <div class="search-summary glass"><h3>Search results for “${esc(q)}”</h3><p>${countLabel(total, 'result')} · ${countLabel(memories.length, 'memory')} · ${countLabel(triples.length, 'fact')} · ${countLabel(consolidations.length, 'consolidation')}</p></div>
      ${total ? '' : stateHtml('empty', 'No results found.', 'Try broader terms, a person/project name, or search inside Memories for record-only filters.')}
      <div class="result-section"><h3>Memories <span>${memories.length}</span></h3><div class="memory-grid">${memories.map(searchMemoryCard).join('') || stateHtml('empty', 'No memory records matched.')}</div></div>
      <div class="result-section"><h3>Facts <span>${triples.length}</span></h3><div class="memory-grid">${triples.map(tripleCard).join('') || stateHtml('empty', 'No graph facts matched.')}</div></div>
      <div class="result-section"><h3>Consolidations <span>${consolidations.length}</span></h3><div class="memory-grid">${consolidations.map(consolidationCard).join('') || stateHtml('empty', 'No consolidation summaries matched.')}</div></div>`;
    bindMemoryClicks($('#globalSearchResults'));
    bindJsonCards($('#globalSearchResults'), 'Search result detail');
  }catch(e){
    if(isCancelledRequest(e)) return;
    $('#globalSearchResults').innerHTML = stateHtml('error', 'Search failed.', e.message || 'The dashboard could not load search results.');
  }
}
function recallItem(x){
  const m = x.memory;
  return `<div class="item" data-id="${esc(m.id)}"><div class="meta"><span class="badge">score ${esc(x.approx_score)}</span></div>${meta(m)}<div class="content">${esc(m.content)}</div><div class="reasons">${x.reasons.map(r=>`<span>${esc(r)}</span>`).join('')}</div></div>`;
}
async function loadRecallDebug(){
  const q = $('#recallQuery')?.value.trim() || '';
  if(!q){ $('#recallNote').textContent = 'Type a query to explain approximate recall ranking.'; $('#recallResults').innerHTML = ''; return; }
  $('#recallResults').innerHTML = skeletonHtml('Explaining recall ranking', 3);
  try {
    const data = await api(`/api/recall-debug?q=${encodeURIComponent(q)}&limit=30`, {requestKey:'recall-debug'});
    $('#recallNote').textContent = data.note;
    $('#recallResults').innerHTML = data.items.map(recallItem).join('') || '<p class="muted">No matching memories.</p>';
    bindMemoryClicks($('#recallResults'));
  } catch(e) {
    if(isCancelledRequest(e)) return;
    $('#recallNote').textContent = 'Recall debug failed.';
    $('#recallResults').innerHTML = stateHtml('error', 'Could not explain recall ranking.', e.message || 'Try again.');
  }
}
function timelineEvent(e){ return `<div class="timeline-event item" data-json='${esc(JSON.stringify(e.item))}'><div class="meta"><span class="badge">${esc(e.type)}</span><button class="session-chip" data-session="${esc(e.session_id || '')}">${esc(e.session_id || 'no session')}</button><span>${esc(e.timestamp)}</span></div><div class="content"><strong>${esc(e.title)}</strong><br>${esc(e.preview)}</div></div>`; }
async function loadTimeline(){
  const q = $('#timelineQuery')?.value.trim() || '';
  const group = $('#timelineGroup')?.value || 'day';
  $('#timelineResults').innerHTML = skeletonHtml('Loading timeline', 4);
  try {
    const data = await api(`/api/timeline?q=${encodeURIComponent(q)}&group=${encodeURIComponent(group)}&limit=300`, {requestKey:'timeline'});
    $('#timelineResults').innerHTML = data.groups.map(g => `<div class="timeline-group"><div class="section-head mini"><h2>${esc(g.key)}</h2><span>${g.count} events</span>${group === 'session' && g.key !== 'no session' ? `<button class="tiny open-session" data-session="${esc(g.key)}">Open session</button>` : ''}</div><div class="timeline">${g.events.map(timelineEvent).join('')}</div></div>`).join('') || '<p class="muted">No timeline events.</p>';
    bindJsonCards($('#timelineResults'), 'Timeline event detail');
    $$('#timelineResults .session-chip').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); openSessionDetail(btn.dataset.session || ''); });
    $$('#timelineResults .open-session').forEach(btn => btn.onclick = () => openSessionDetail(btn.dataset.session || ''));
  } catch(e) {
    if(isCancelledRequest(e)) return;
    $('#timelineResults').innerHTML = stateHtml('error', 'Could not load timeline.', e.message || 'Try again.');
  }
}
function tinyRows(rows, key='label'){ return (rows || []).map(r => `<div class="break-row"><span>${esc(r[key] || r.label || 'unknown')}</span><strong>${Number(r.count || 0).toLocaleString()}</strong></div>`).join('') || '<p class="muted">No data</p>'; }
function tripleItem(t){ return `<div class="item" data-json='${esc(JSON.stringify(t))}'><div class="meta"><span class="badge">fact</span><span>${esc(t.created_at || t.valid_from || '')}</span></div><div class="content"><strong>${esc(t.subject)}</strong> — ${esc(t.predicate)} → <strong>${esc(t.object)}</strong></div></div>`; }
async function loadTodayDigest(day=''){
  const suffix = day ? `&day=${encodeURIComponent(day)}` : '';
  const data = await api(`/api/digest/today?limit=80${suffix}`);
  const c = data.counts || {};
  $('#todayCards').innerHTML = [['Added', c.memories_added], ['Retrieved', c.memories_recalled], ['Needs review', c.contaminated_added], ['Lifecycle changes', c.degraded_added], ['Facts', c.triples_added], ['Consolidations', c.consolidations]].map(([label,num]) => `<div class="card"><div class="num">${Number(num || 0).toLocaleString()}</div><div class="label">${label}</div></div>`).join('');
  $('#todayEntities').innerHTML = tinyRows(data.breakdowns?.entities || []);
  $('#todayVeracity').innerHTML = tinyRows(data.breakdowns?.veracity || []);
  $('#todayDegradation').innerHTML = tinyRows(data.breakdowns?.degradation || []);
  $('#todaySources').innerHTML = tinyRows(data.breakdowns?.sources || []);
  $('#todaySessions').innerHTML = tinyRows(data.breakdowns?.sessions || []);
  $('#todayAdded .memory-grid').innerHTML = (data.memories_added || []).map(memoryItem).join('') || '<p class="muted">No memories added today.</p>';
  $('#todayRecalled .memory-grid').innerHTML = (data.memories_recalled || []).map(memoryItem).join('') || '<p class="muted">No memories recalled today.</p>';
  $('#todayTriples .memory-grid').innerHTML = (data.triples_added || []).map(tripleItem).join('') || stateHtml('empty', 'No facts added today.');
  $('#todayConsolidations .memory-grid').innerHTML = (data.consolidations || []).map(consolidationCard).join('') || '<p class="muted">No consolidations today.</p>';
  ['todayAdded','todayRecalled'].forEach(id => bindMemoryClicks($(`#${id}`)));
  bindJsonCards($('#todayTriples'), 'Triple detail');
  bindJsonCards($('#todayConsolidations'), 'Consolidation detail');
}
function contextLabel(label){
  return ({'Temporary context':'Short-term notes','Project context':'Project notes'})[label] || label;
}
function contextSummary(data){
  const s = data.summary || {};
  const typeChips = (s.types || []).map(t => `<span class="context-type-chip">${esc(contextLabel(t.label))} <strong>${Number(t.count || 0).toLocaleString()}</strong></span>`).join('');
  return `<div class="context-summary glass">
    <div><span>Indexed signals</span><strong>${Number(s.indexed_signals || s.active_items || 0).toLocaleString()}</strong></div>
    <div><span>Needs review</span><strong>${Number(s.needs_review || 0).toLocaleString()}</strong></div>
    <div><span>Sensitive</span><strong>${Number(s.sensitive || 0).toLocaleString()}</strong></div>
    <div><span>Sections</span><strong>${Number(s.sections || 0).toLocaleString()}</strong></div>
    ${typeChips ? `<div class="context-types">${typeChips}</div>` : ''}
  </div>`;
}
function profileItem(row){
  const item = row.item || {};
  const attrs = row.kind === 'memory' ? `data-id="${esc(item.id || '')}"` : `data-json='${esc(JSON.stringify(item))}'`;
  const confidence = row.confidence_label || 'Confidence unknown';
  const pct = Number(row.confidence_pct || row.importance * 100 || 0);
  const extracted = (row.extracted || []).slice(0,3).map(m => `<span title="${esc(m.value)}">${esc(m.label)}: ${esc(m.value)}</span>`).join('');
  const provenance = [row.category, row.tier || row.kind, row.source, row.scope, row.status].filter(Boolean).slice(0,5).map(x => `<span>${esc(x)}</span>`).join('');
  return `<div class="profile-item context-card ${esc(row.type_tone || '')}" ${attrs}>
    <div class="context-card-head"><span class="badge">${esc(contextLabel(row.context_type || row.kind))}</span><span class="confidence ${pct < 70 ? 'warn' : ''}">${esc(confidence)} · ${Math.round(pct)}%</span></div>
    <p>${esc(row.label || '')}</p>
    ${extracted ? `<div class="context-meta extracted">${extracted}</div>` : ''}
    <div class="context-meta"><span>${esc(prettyTime(row.timestamp) || row.timestamp || '')}</span>${provenance}</div>
  </div>`;
}
function patternSummary(data={}){
  const s = data.summary || {};
  const items = [
    ['Memories scanned', s.indexed_memories || 0],
    ['Triples scanned', s.indexed_triples || 0],
    ['Patterns found', s.patterns_found || data.mnemosyne_summary?.patterns_found || 0],
    ['Provider', data.provider ? 'Mnemosyne' : 'Dashboard'],
  ];
  return items.map(([label,value]) => `<div><span>${esc(label)}</span><strong>${typeof value === 'number' ? Number(value || 0).toLocaleString() : esc(value || '')}</strong></div>`).join('');
}
function renderPatternBars(items=[], kind='pattern'){
  if(!items.length) return '<span class="muted">No patterns yet.</span>';
  const max = Math.max(...items.map(item => Number(item.count || 0)), 1);
  return items.map(item => {
    const count = Number(item.count || 0);
    const pct = Math.max(5, Math.round((count / max) * 100));
    const query = item.query ?? item.label ?? '';
    return `<button class="pattern-bar" data-pattern-kind="${esc(kind)}" data-pattern-query="${esc(query)}" title="Filter memories for ${esc(item.label || '')}"><span class="pattern-bar-fill" style="width:${pct}%"></span><span class="pattern-bar-label">${esc(item.label || '')}</span><strong>${count.toLocaleString()}</strong></button>`;
  }).join('');
}
function renderPatternChips(items=[]){ return renderPatternBars(items); }
function applyPatternFilter(kind='', query=''){
  switchTab('memories');
  $('#memoryKind').value = 'all';
  $('#memoryStatus').value = 'active';
  $('#memorySort').value = 'importance';
  $('#memorySource').value = '';
  $('#memoryScope').value = '';
  $('#memorySession').value = '';
  $('#memoryVeracity').value = '';
  $('#memoryDegradation').value = '';
  $('#memoryTrustPreset').value = '';
  $('#memoryQuery').value = query || '';
  loadMemories();
}
async function loadPatternInsights(){
  const data = await api(endpoints.patterns(10));
  $('#patternSummary').innerHTML = patternSummary(data);
  $('#patternContent').innerHTML = renderPatternBars(data.content_patterns || [], 'content-pattern');
  $('#patternTemporal').innerHTML = renderPatternBars(data.temporal_patterns || [], 'temporal-pattern');
  $('#patternSequence').innerHTML = renderPatternBars(data.sequence_patterns || [], 'sequence-pattern');
  $('#contextDomainBars').innerHTML = renderPatternBars(data.context_domains || [], 'context-domain');
  $('#patternOrigins').innerHTML = renderPatternBars(data.origins || data.sources || [], 'origin');
  $('#patternTypes').innerHTML = renderPatternBars(data.memory_types || [], 'type');
  $$('#patternInsights .pattern-bar,#contextDomains .pattern-bar').forEach(el => el.onclick = () => applyPatternFilter(el.dataset.patternKind || '', el.dataset.patternQuery || ''));
}
async function loadProfile(){
  const [data] = await Promise.all([api(endpoints.profile(10)), loadPatternInsights()]);
  $('#profileGrid').innerHTML = `${contextSummary(data)}${(data.sections || []).map(s => `<section class="profile-section glass"><div class="section-head mini"><h2>${esc(contextLabel(s.name))}</h2><span>${esc(s.count)} active item${Number(s.count) === 1 ? '' : 's'}</span></div>${(s.items || []).map(profileItem).join('')}</section>`).join('') || '<p class="muted">No inferred profile data found.</p>'}`;
  $$('#profileGrid .profile-item[data-id]').forEach(el => bindActivatable(el, () => openMemoryDetail(el.dataset.id)));
  $$('#profileGrid .profile-item[data-json]').forEach(el => bindActivatable(el, () => showDetail(JSON.parse(el.dataset.json), 'Profile source detail')));
}
function applyReviewFilter(filter={}){
  $('#memoryKind').value = filter.kind || 'all';
  $('#memoryQuery').value = '';
  $('#memorySource').value = '';
  $('#memoryScope').value = '';
  $('#memorySession').value = '';
  $('#memoryVeracity').value = filter.veracity || '';
  $('#memoryDegradation').value = filter.degradation_tier || '';
  $('#memoryTrustPreset').value = filter.contaminated_only ? 'contaminated' : filter.degraded_only ? 'degraded' : filter.due_for_degradation ? 'due' : '';
  $('#memoryStatus').value = filter.status || 'active';
  $('#memorySort').value = filter.sort || 'importance';
  switchTab('memories');
}
async function loadReview(){
  await reviewController.loadReview();
}
async function loadLifecycle(){
  const data = await api(endpoints.lifecycle(80));
  const queues = data.queues || {};
  const t = data.thresholds || {};
  const weights = t.weights || {};
  $('#lifecycleThresholds').innerHTML = [
    `Tier 2 after ${Number(t.tier2_days || 30).toLocaleString()} days`,
    `Tier 3 after ${Number(t.tier3_days || 180).toLocaleString()} days`,
    `Weights: hot ×${Number(weights['1'] || 1).toFixed(2)} · warm ×${Number(weights['2'] || .5).toFixed(2)} · cold ×${Number(weights['3'] || .25).toFixed(2)}`,
    'Read-only: no degradation is triggered from this page'
  ].map(x => `<span>${esc(x)}</span>`).join('');
  $('#lifecycleCards').innerHTML = (data.cards || []).map(card => `<button class="card review-card lifecycle-card" data-lifecycle-key="${esc(card.key)}"><div class="num">${Number(card.count || 0).toLocaleString()}</div><div class="label">${esc(card.title)}</div><p>${esc(card.description || '')}</p></button>`).join('');
  $('#lifecycleQueues').innerHTML = Object.entries(queues).map(([key, queue]) => lifecycleQueueHtml(key, queue)).join('') || '<p class="muted">No lifecycle queues available.</p>';
  bindMemoryClicks($('#lifecycle'));
  $$('#lifecycle [data-lifecycle-key]').forEach(el => el.onclick = e => { e.stopPropagation(); applyReviewFilter(queues[el.dataset.lifecycleKey]?.filter || {}); });
  $$('#lifecycle .review-filter').forEach(el => el.onclick = e => { e.stopPropagation(); const key = el.closest('[data-review-key]')?.dataset.reviewKey; applyReviewFilter(queues[key]?.filter || {}); });
}

const canvasConstellationVisualiser = createCanvasConstellationVisualiser({
  $,
  $$,
  api,
  esc,
  openMemoryDetail,
  switchTab,
  visualiserResponsiveFill,
  prefersReducedMotion,
  isActive: () => $('#constellation')?.classList.contains('active'),
});
function stopCanvasVisualiserLoop(){ return canvasConstellationVisualiser.stop(); }
function isCanvasVisualiserActive(){ return canvasConstellationVisualiser.isActive(); }
function redrawConstellation(){ return canvasConstellationVisualiser.redraw(); }
function resumeCanvasVisualiser(){ return canvasConstellationVisualiser.resume(); }
function constellationColors(){ return canvasConstellationVisualiser.constellationColors(); }
function neuralColors(){ return canvasConstellationVisualiser.neuralColors(); }
function loadConstellation(){ return canvasConstellationVisualiser.loadConstellation(); }
function resetConstellationView(){ return canvasConstellationVisualiser.resetConstellationView(); }
function toggleConstellationPanMode(){ return canvasConstellationVisualiser.toggleConstellationPanMode(); }
function toggleConstellationPause(){ return canvasConstellationVisualiser.toggleConstellationPause(); }
function switchVisualiserMode(mode){ return canvasConstellationVisualiser.switchVisualiserMode(mode); }
function updateVisualiserModeUI(){ return canvasConstellationVisualiser.updateVisualiserModeUI(); }
function updateConstellationPauseButton(){ return canvasConstellationVisualiser.updateConstellationPauseButton(); }
function updateConstellationPanButton(){ return canvasConstellationVisualiser.updateConstellationPanButton(); }

let threeModulePromise = null;
function loadThreeModule(){
  if(!threeModulePromise) threeModulePromise = import('/static/vendor/three.module.min.js');
  return threeModulePromise;
}
function cssHexToInt(hex){
  const m = String(hex || '').match(/^#([0-9a-f]{6})$/i);
  return m ? parseInt(m[1], 16) : 0xffffff;
}

const threeVisualiser = createThreeVisualiser({
  $,
  $$,
  api,
  esc,
  openMemoryDetail,
  switchTab,
  loadThreeModule,
  constellationColors,
  neuralColors,
  visualiserResponsiveFill,
  prefersReducedMotion,
  isCancelledRequest,
});
function loadThreeVisualiser(){ return threeVisualiser.loadThreeVisualiser(); }
function resetThreeCamera(){ return threeVisualiser.resetThreeCamera(); }
function threeInspectorDefault(){ return threeVisualiser.threeInspectorDefault(); }
function clearThreeScene(){ return threeVisualiser.clearThreeScene(); }
function resizeThree(){ return threeVisualiser.resizeThree(); }
function switchThreeMode(mode){ return threeVisualiser.switchThreeMode(mode); }
function updateThreeUI(){ return threeVisualiser.updateThreeUI(); }
function toggleThreePanMode(){ return threeVisualiser.togglePanMode(); }
function toggleThreePause(){ return threeVisualiser.togglePause(); }
function isThreeVisualiserRendering(){ return threeVisualiser.isRendering(); }
function resumeThreeVisualiser(){ return threeVisualiser.resume(); }


const memoryPalaceVisualiser = createMemoryPalaceVisualiser({
  $,
  $$,
  api,
  esc,
  openMemoryDetail,
  loadThreeModule,
  cssHexToInt,
  constellationColors,
  prefersReducedMotion,
  isCancelledRequest,
  isActive: () => sectionFor(currentRoute.tab) === 'memoryPalace',
});
function loadMemoryPalace(){ return memoryPalaceVisualiser.loadMemoryPalace(); }
function resetMemoryPalaceDiver(){ return memoryPalaceVisualiser.resetMemoryPalaceDiver(); }
function palaceSearchBeacon(){ return memoryPalaceVisualiser.palaceSearchBeacon(); }
function clearPalaceScene(){ return memoryPalaceVisualiser.clearPalaceScene(); }
function resizeMemoryPalace(){ return memoryPalaceVisualiser.resizeMemoryPalace(); }
function animateMemoryPalace(t=0){ return memoryPalaceVisualiser.animateMemoryPalace(t); }
function isMemoryPalaceRendering(){ return memoryPalaceVisualiser.isRendering(); }
function resumeMemoryPalace(){ return memoryPalaceVisualiser.resume(); }

// ── Memoria Tab ──────────────────────────────────────────────────────

async function loadMemoria(){
  const nameMap = {facts:'Facts', timelines:'Timelines', instructions:'Instructions', kg:'KG', preferences:'Preferences'};
  const stats = await api('/api/memoria/stats');
  $('#memoriaCards').innerHTML = Object.entries(stats.tables || {}).map(([tbl, info]) =>
    `<div class="card"><div class="num">${Number(info.count).toLocaleString()}</div><div class="label">${nameMap[tbl.replace('memoria_','')]||tbl.replace('memoria_','')}</div></div>`
  ).join('');
  $('#memoriaCounts').innerHTML = Object.entries(stats.tables || {}).map(([tbl, info]) =>
    `<div class="break-row"><span>${nameMap[tbl.replace('memoria_','')]||tbl.replace('memoria_','')}</span><strong>${Number(info.count).toLocaleString()}</strong></div>`
  ).join('');
  const sessionEl = $('#memoriaSessions');
  sessionEl.innerHTML = (stats.top_sessions || []).map(s =>
    `<div class="break-row"><span>${esc(s.session_id.slice(0,24))}</span><strong>${s.count}</strong></div>`
  ).join('') || '<span class="muted">no data</span>';
  // Load initial data for each subpanel
  loadMemoriaTable('memoriaFacts', '/api/memoria/facts', 'memoriaFactsList', 'memoriaFactsCount');
  loadMemoriaTable('memoriaTimelines', '/api/memoria/timelines', 'memoriaTimelinesList', 'memoriaTimelinesCount');
  loadMemoriaTable('memoriaInstructions', '/api/memoria/instructions', 'memoriaInstructionsList', 'memoriaInstructionsCount');
  loadMemoriaKg();
  loadMemoriaTable('memoriaPreferences', '/api/memoria/preferences', 'memoriaPreferencesList', 'memoriaPreferencesCount');
}

async function loadMemoriaTable(inputId, apiPath, listId, countId){
  const q = $(`#${inputId}Query`)?.value?.trim() || '';
  const list = $(`#${listId}`);
  if(!list) return;
  list.innerHTML = skeletonHtml('Loading MEMORIA entries', 3);
  try {
    const r = await api(`${apiPath}?q=${encodeURIComponent(q)}&limit=200`, {requestKey:`memoria:${apiPath}`});
    const items = r.items || [];
    if(countId) $(`#${countId}`).textContent = `${items.length} entries`;
    if(!items.length){
      list.innerHTML = '<div class="muted" style="padding:2rem;text-align:center">No entries found.</div>';
      return;
    }
    const renderer = memoriaRenderer(apiPath);
    list.innerHTML = items.map(item => renderer(item)).join('');
  } catch(e) {
    if(isCancelledRequest(e)) return;
    list.innerHTML = stateHtml('error', 'Could not load MEMORIA entries.', e.message || 'Try again.');
  }
}

function memoriaRenderer(apiPath){
  // Common hidden/internal fields — never shown
  const hidden = new Set(['id', 'message_idx', 'updated_msg_idx', 'valid_from_msg_idx', 'valid_to_msg_idx', 'version_id', 'previous_value']);
  if(apiPath.includes('/facts')){
    return function(item){
      const key = esc(item.key || '');
      const value = esc(item.value || '');
      const ctx = item.context_snippet ? esc(item.context_snippet) : '';
      const meta = [
        item.fact_type ? `<span class="badge">${esc(item.fact_type)}</span>` : '',
        item.importance ? `<span class="badge">imp ${Number(item.importance).toFixed(2)}</span>` : '',
        item.session_id && item.session_id !== 'default' ? `<span class="badge">${esc(item.session_id.slice(0,19))}</span>` : '',
      ].filter(Boolean).join('');
      return `<div class="item"><div class="meta">${meta}</div><div class="content"><strong>${key}</strong>${value ? ': ' + value : ''}</div>${ctx ? `<div class="content" style="font-size:.85em;opacity:.7;word-break:break-word">${ctx}</div>` : ''}</div>`;
    };
  }
  if(apiPath.includes('/timelines')){
    return function(item){
      const desc = esc(String(item.description || ''));
      const date = item.date ? esc(item.date) : '';
      const meta = [
        date ? `<span class="badge">${date}</span>` : '',
        item.source ? `<span class="badge">${esc(item.source)}</span>` : '',
        item.session_id && item.session_id !== 'default' ? `<span class="badge">${esc(item.session_id.slice(0,19))}</span>` : '',
      ].filter(Boolean).join('');
      return `<div class="item"><div class="meta">${meta}</div><div class="content">${desc}</div></div>`;
    };
  }
  if(apiPath.includes('/instructions')){
    return function(item){
      const instr = esc(item.instruction || '');
      const topic = item.topic ? esc(item.topic) : '';
      const ctx = item.context_snippet ? esc(item.context_snippet) : '';
      const meta = [
        topic ? `<span class="badge">${topic}</span>` : '',
        item.active == 1 ? '<span class="badge status-active">active</span>' : '<span class="badge status-expired">inactive</span>',
        item.session_id && item.session_id !== 'default' ? `<span class="badge">${esc(item.session_id.slice(0,19))}</span>` : '',
      ].filter(Boolean).join('');
      return `<div class="item"><div class="meta">${meta}</div><div class="content">${instr}</div>${ctx ? `<div class="content" style="font-size:.85em;opacity:.7;word-break:break-word">${ctx}</div>` : ''}</div>`;
    };
  }
  // Generic renderer for preferences etc.
  return function(item){
    const content = item.preference || item.instruction || item.description || item.value || JSON.stringify(item);
    const meta = Object.entries(item).filter(([k,v]) => !hidden.has(k) && v !== null && v !== undefined && v !== '' && !['preference','instruction','description','value','context_snippet','key'].includes(k))
      .map(([k,v]) => `<span class="badge">${esc(k)}: ${esc(String(v).slice(0,40))}</span>`).join('');
    return `<div class="item"><div class="meta">${meta}</div><div class="content">${esc(String(content).slice(0,500))}</div></div>`;
  };
}

async function loadMemoriaKg(){
  const q = $('#memoriaKgQuery')?.value?.trim() || '';
  const tbody = $('#memoriaKgRows');
  if(!tbody) return;
  let items = [];
  tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">Loading MEMORIA graph entries...</td></tr>';
  try {
    const r = await api(`/api/memoria/kg?q=${encodeURIComponent(q)}&limit=200`, {requestKey:'memoria:kg'});
    items = r.items || [];
    $('#memoriaKgCount').textContent = `${items.length} entries`;
  } catch(e) {
    if(isCancelledRequest(e)) return;
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">Could not load MEMORIA KG: ${esc(e.message || 'Try again.')}</td></tr>`;
    return;
  }
  if(!items.length){
    tbody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center">No triples found.</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(item => {
    const confidence = item.confidence !== null && item.confidence !== undefined ? Number(item.confidence).toFixed(2) : '—';
    return `<tr><td>${esc(item.subject||'')}</td><td>${esc(item.predicate||'')}</td><td>${esc(item.object||'')}</td><td>${confidence}</td></tr>`;
  }).join('');
}

$$('nav button').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
$$('.section-tabs button').forEach(b => b.onclick = () => {
  const panelRoute = ({ exploreMemories:'memories', exploreRecall:'recall', activityTimeline:'timelineView', activityConsolidations:'consolidations', graphGraph:'graph', graphTriples:'triples', todayAdded:'todayAdded', todayRecalled:'todayRecalled', todayTriples:'todayTriples', todayConsolidations:'todayConsolidations' })[b.dataset.panel];
  if(panelRoute) { switchTab(panelRoute); return; }
  const section = b.closest('.tab')?.id;
  showPanel(section, b.dataset.panel);
});
$$('[data-jump]').forEach(b => b.onclick = () => switchTab(b.dataset.jump));
$('#mobileMenuToggle').onclick = () => {
  document.body.classList.toggle('mobile-menu-open');
  const isOpen = document.body.classList.contains('mobile-menu-open');
  $('#mobileMenuToggle').textContent = isOpen ? '×' : '☰';
  $('#mobileMenuToggle').setAttribute('aria-expanded', String(isOpen));
};
window.addEventListener('resize', closeMobileMenuForViewportChange, { passive: true });
window.addEventListener('orientationchange', closeMobileMenuForViewportChange, { passive: true });
document.addEventListener('fullscreenchange', updateVisualiserFullscreenButtons);
$('#memorySearch').onclick = refreshMemoriesRouteAndLoad;
$('#bulkSelectAll').onchange = () => { latestMemoryItems.forEach(x => $('#bulkSelectAll').checked ? bulkSelection.add(x.id) : bulkSelection.delete(x.id)); loadMemories(); };
$('#bulkClear').onclick = () => {
  const previous = new Set(bulkSelection);
  bulkSelection.clear(); loadMemories();
  showToast({tone:'info', title:'Selection cleared', body:`Cleared ${previous.size} selected memories.`, actionLabel:'Undo', action:() => { bulkSelection = previous; loadMemories(); }});
};
$('#bulkExpire').onclick = () => expireSelectedMemories($('#bulkExpire'));
$('#bulkVeracity').onclick = () => setSelectedVeracity($('#bulkVeracity'));
$('#bulkExpiry').onclick = () => setSelectedExpiry($('#bulkExpiry'));
$('#bulkImportance').onclick = () => setSelectedImportance($('#bulkImportance')); $('#memoryQuery').onkeydown = e => { if(e.key==='Enter') refreshMemoriesRouteAndLoad(); };
reviewController.bindGlobalControls();
$('#globalSearchButton').onclick = () => runButtonAction($('#globalSearchButton'), 'Searching...', loadGlobalSearch); $('#globalSearchQuery').onkeydown = e => { if(e.key==='Enter') $('#globalSearchButton').click(); };
$('#menuSearchButton').onclick = () => runButtonAction($('#menuSearchButton'), 'Searching...', menuSearch); $('#menuSearchQuery').onkeydown = e => { if(e.key==='Enter') $('#menuSearchButton').click(); };
$('#recallButton').onclick = () => runButtonAction($('#recallButton'), 'Explaining...', loadRecallDebug); $('#recallQuery').onkeydown = e => { if(e.key==='Enter') $('#recallButton').click(); };
$('#timelineButton').onclick = () => runButtonAction($('#timelineButton'), 'Loading...', loadTimeline); $('#timelineQuery').onkeydown = e => { if(e.key==='Enter') $('#timelineButton').click(); }; $('#timelineGroup').onchange = loadTimeline;
$('#memoryClear').onclick = () => { resetMemoryFilterControls(); refreshMemoriesRouteAndLoad(); };
['memoryKind','memorySource','memoryScope','memorySession','memoryVeracity','memoryDegradation','memoryTrustPreset','memoryStatus','memorySort'].forEach(id => $('#'+id).onchange = refreshMemoriesRouteAndLoad);
$('#memoryLoadMore').onclick = loadMoreMemories;
$$('#memoryPresetBar [data-memory-preset]').forEach(btn => btn.onclick = () => applyMemoryPreset(btn.dataset.memoryPreset));
$('#tripleSearch').onclick = loadTriples; $('#tripleQuery').onkeydown = e => { if(e.key==='Enter') loadTriples(); };
$('#graphRefresh').onclick = loadGraph; $('#graphQuery').onkeydown = e => { if(e.key==='Enter') loadGraph(); };
$('#graphClear').onclick = () => { $('#graphQuery').value = ''; loadGraph(); };
$('#graphResetView').onclick = resetGraphView;
$('#insightsRefresh').onclick = loadInsights; $('#insightsDays').onchange = loadInsights;
$('#constellationRefresh').onclick = loadConstellation;
$('#constellationReset').onclick = resetConstellationView;
$('#constellationPanMode').onclick = toggleConstellationPanMode;
$('#constellationPause').onclick = toggleConstellationPause;
$('#constellationFullscreen').onclick = () => toggleVisualiserFullscreen('.constellation-wrap');
$('#constellationExitFullscreen').onclick = exitVisualiserFullscreen;
$$('.visualiser-tabs button[data-visualiser]').forEach(b => b.onclick = () => switchVisualiserMode(b.dataset.visualiser));
$('#threeRefresh').onclick = loadThreeVisualiser;
$('#threeReset').onclick = () => { resetThreeCamera(); threeInspectorDefault(); };
$('#threePanMode').onclick = toggleThreePanMode;
$('#threePause').onclick = toggleThreePause;
$('#threeFullscreen').onclick = () => toggleVisualiserFullscreen('#threeViewport');
$('#threeExitFullscreen').onclick = exitVisualiserFullscreen;
$('#palaceRefresh').onclick = loadMemoryPalace;
$('#palaceReset').onclick = resetMemoryPalaceDiver;
$('#palaceSearchButton').onclick = palaceSearchBeacon;
$('#palaceSearchQuery').onkeydown = e => { if(e.key === 'Enter') palaceSearchBeacon(); };
$('#palaceFullscreen').onclick = () => toggleVisualiserFullscreen('#palaceViewport');
$('#palaceExitFullscreen').onclick = exitVisualiserFullscreen;
$$('.visualiser-tabs button[data-three-mode]').forEach(b => b.onclick = () => switchThreeMode(b.dataset.threeMode));
updateVisualiserModeUI();
updateConstellationPauseButton();
updateConstellationPanButton();
$('#consolidationQuery').oninput = renderConsolidations;
$('#consolidationClear').onclick = () => { $('#consolidationQuery').value = ''; renderConsolidations(); };
// Memoria search handlers
$('#memoriaFactsSearch').onclick = () => loadMemoriaTable('memoriaFacts', '/api/memoria/facts', 'memoriaFactsList', 'memoriaFactsCount');
$('#memoriaFactsQuery').onkeydown = e => { if(e.key==='Enter') $('#memoriaFactsSearch').click(); };
$('#memoriaTimelinesSearch').onclick = () => loadMemoriaTable('memoriaTimelines', '/api/memoria/timelines', 'memoriaTimelinesList', 'memoriaTimelinesCount');
$('#memoriaTimelinesQuery').onkeydown = e => { if(e.key==='Enter') $('#memoriaTimelinesSearch').click(); };
$('#memoriaInstructionsSearch').onclick = () => loadMemoriaTable('memoriaInstructions', '/api/memoria/instructions', 'memoriaInstructionsList', 'memoriaInstructionsCount');
$('#memoriaInstructionsQuery').onkeydown = e => { if(e.key==='Enter') $('#memoriaInstructionsSearch').click(); };
$('#memoriaKgSearch').onclick = loadMemoriaKg;
$('#memoriaKgQuery').onkeydown = e => { if(e.key==='Enter') loadMemoriaKg(); };
$('#memoriaPreferencesSearch').onclick = () => loadMemoriaTable('memoriaPreferences', '/api/memoria/preferences', 'memoriaPreferencesList', 'memoriaPreferencesCount');
$('#memoriaPreferencesQuery').onkeydown = e => { if(e.key==='Enter') $('#memoriaPreferencesSearch').click(); };
$('#closeDetail').onclick = () => closeDetail();
settingsController.bindControls();
$('#retryBootstrap').onclick = () => bootstrapDashboard().catch(handleInitError);
$('#copyBootError').onclick = copyBootErrorDetails;
function toggleTheme(){ setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); }
$('#themeToggle').onclick = toggleTheme;
$('#mobileThemeToggle').onclick = toggleTheme;
initLiveMemoryInfiniteScroll();
window.addEventListener('popstate', e => applyRoute(e.state || urlToRoute()));
window.addEventListener('hashchange', () => applyRoute(urlToRoute()));
window.addEventListener('keydown', handleGlobalKeyboard);
document.addEventListener('visibilitychange', () => {
  if(document.hidden) return;
  resumeThreeVisualiser();
  resumeMemoryPalace();
  resumeCanvasVisualiser();
});
initTheme();
const initialRoute = urlToRoute();
pushRoute(initialRoute, true);
renderBootErrorStatus();
bootstrapDashboard().catch(handleInitError);
