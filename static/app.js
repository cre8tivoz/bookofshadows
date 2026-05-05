const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const THEME_KEY = 'mnemosyne-dashboard-theme';
const VISUALISER_MODE_KEY = 'mnemosyne-dashboard-visualiser-mode';
let graphState = { nodes: [], edges: [], byId: {} };
let consolidationState = [];
let authState = { config: {}, auth_enabled: false, authenticated: true };
let currentRoute = { tab: 'overview' };
let applyingHistory = false;
let bulkSelection = new Set();
let latestMemoryItems = [];
let graphView = { scale:1, x:0, y:0, dragging:false, sx:0, sy:0, ox:0, oy:0 };
const CONSTELLATION_MIN_ZOOM = .55;
const CONSTELLATION_MAX_ZOOM = 6;
const CONSTELLATION_DEFAULT_CAMERA = { rotation: 0.55, tilt: 0.78, zoom: 1, panX: 0, panY: 0 };
let constellationScene = { frame: 0, nodes: [], edges: [], byId: {}, stars: [], ...CONSTELLATION_DEFAULT_CAMERA, paused: false, mode: 'rotate', visualiserMode: localStorage.getItem(VISUALISER_MODE_KEY) || 'constellation', lastFrameTime: 0, lastInteraction: 0, hits: [], data: null, drag: null, pointers: new Map() };

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
async function api(path, options={}){
  const r = await fetch(path, options);
  const j = await r.json();
  if(r.status === 401){ showLogin(); throw new Error(j.error || 'auth required'); }
  if(!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
async function postJson(path, body){ return api(path, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body || {})}); }
function showLogin(){ $('#loginOverlay')?.classList.remove('hidden'); }
function hideLogin(){ $('#loginOverlay')?.classList.add('hidden'); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function shortId(value, head=8, tail=6){ const s = String(value || '').trim(); return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s; }
function prettyTime(value){
  if(!value) return '';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit'}).format(d);
}
function meta(item, opts={}){
  const status = item.status || 'active';
  const scope = String(item.scope || '').trim();
  const session = String(item.session_id || '').trim();
  const rawTime = item.timestamp || item.created_at || '';
  const timeLabel = prettyTime(rawTime);
  const scopeBadge = scope && scope !== 'session' ? `<span class="badge" title="scope: ${esc(scope)}">${esc(scope)}</span>` : '';
  const sessionBadge = opts.sessionLink !== false && session && session !== 'default' ? `<button type="button" class="badge session-link" data-session="${esc(session)}" title="Open session: ${esc(session)}">session ${esc(shortId(session))}</button>` : '';
  const timeBadge = timeLabel ? `<span class="meta-time" title="${esc(rawTime)}">${esc(timeLabel)}</span>` : '';
  return `<div class="meta"><span class="badge">${esc(item.tier || item.source || '')}</span><span class="badge status-${esc(status)}">${esc(status)}</span><span class="badge">importance ${Number(item.importance ?? 0).toFixed(2)}</span>${scopeBadge}${sessionBadge}${timeBadge}</div>`;
}
function roleOf(content){ const m = String(content || '').match(/^\[(USER|ASSISTANT|SYSTEM)\]/i); return m ? m[1].toLowerCase() : ''; }
function memoryItem(item, opts={}){ const role = roleOf(item.content); const roleBadge = role ? `<span class="role role-${role}">${role}</span>` : ''; const selectable = opts.selectable ? `<label class="memory-select" title="Select memory"><input type="checkbox" class="memory-check" data-id="${esc(item.id)}" ${bulkSelection.has(item.id) ? 'checked' : ''} /></label>` : ''; return `<div class="item ${role ? 'has-role' : ''} ${opts.selectable ? 'selectable' : ''}" data-id="${esc(item.id)}">${selectable}${meta(item)}${roleBadge}<div class="content">${esc(item.content)}</div></div>`; }
function canonicalTab(tab){ return tab === 'constellation' ? 'visualiser' : (tab || 'overview'); }
function routeTabState(tab=currentRoute.tab || 'overview'){ return { tab: canonicalTab(tab) }; }
function routeToUrl(state){
  const params = new URLSearchParams(location.search);
  ['tab','memory','session'].forEach(k => params.delete(k));
  params.set('tab', state.tab || 'overview');
  if(state.drawer?.type === 'memory') params.set('memory', state.drawer.id);
  if(state.drawer?.type === 'session') params.set('session', state.drawer.id);
  const qs = params.toString();
  return location.pathname + (qs ? `?${qs}` : '');
}
function urlToRoute(){
  const params = new URLSearchParams(location.search);
  const route = { tab: canonicalTab(params.get('tab') || 'overview') };
  if(params.get('memory')) route.drawer = { type:'memory', id:params.get('memory') };
  else if(params.get('session')) route.drawer = { type:'session', id:params.get('session') };
  if(route.drawer && (!params.get('tab') || route.tab === 'overview')) route.tab = route.drawer.type === 'memory' ? 'memories' : 'timelineView';
  return route;
}
function pushRoute(state, replace=false){
  if(applyingHistory) return;
  currentRoute = { ...state };
  const fn = replace ? 'replaceState' : 'pushState';
  history[fn](currentRoute, '', routeToUrl(currentRoute));
}
function closeDetail(opts={}){
  $('#detail').classList.add('hidden');
  if(opts.push !== false) pushRoute(routeTabState());
}
async function applyRoute(state){
  applyingHistory = true;
  try {
    const route = state || urlToRoute();
    switchTab(route.tab || 'overview', { push:false });
    if(route.drawer?.type === 'memory') await openMemoryDetail(route.drawer.id, { push:false });
    else if(route.drawer?.type === 'session') await openSessionDetail(route.drawer.id, { push:false });
    else closeDetail({ push:false });
    currentRoute = route;
    const canonicalUrl = routeToUrl(route);
    if(location.pathname + location.search !== canonicalUrl) history.replaceState(route, '', canonicalUrl);
  } finally {
    applyingHistory = false;
  }
}
function showSelectableCopy(label, value){
  openActionModal({
    title: label,
    description: 'Select the text below and press Cmd/Ctrl+C to copy. This works on non-HTTPS local dashboards.',
    kicker: 'Copy',
    confirmText: 'Done',
    bodyHtml: `<label class="modal-field"><span>${esc(label)}</span><textarea id="manualCopyValue" class="copy-value" rows="4" readonly>${esc(value || '')}</textarea></label>`,
    readValue: () => true
  });
  setTimeout(() => { const el = $('#manualCopyValue'); el?.focus(); el?.select(); }, 60);
}
function showDetail(obj, title='Detail', opts={}){
  const titleEl = document.querySelector('.drawer-title');
  if(titleEl) titleEl.textContent = title;
  $('#detailBody').classList.remove('html-detail');
  $('#detailBody').textContent = JSON.stringify(obj, null, 2);
  $('#detail').classList.remove('hidden');
  if(opts.push !== false) pushRoute({ ...routeTabState(), drawer:{ type:'json', title, value:obj } });
}
function showHtmlDetail(html, title='Detail'){
  const titleEl = document.querySelector('.drawer-title');
  if(titleEl) titleEl.textContent = title;
  $('#detailBody').classList.add('html-detail');
  $('#detailBody').innerHTML = html;
  $('#detail').classList.remove('hidden');
}

function modalTemplate(){
  let modal = $('#actionModal');
  if(modal) return modal;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="actionModal" class="action-modal hidden" role="dialog" aria-modal="true">
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
    const close = (value) => { modal.classList.add('hidden'); document.removeEventListener('keydown', onKey); resolve(value); };
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
    const first = modal.querySelector('textarea,input,button.primary');
    setTimeout(() => first?.focus(), 30);
  });
}
function confirmAction(opts){ return openActionModal(opts); }
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

function fmtBytes(n){
  n = Number(n || 0);
  if(!n) return '0 B';
  const units = ['B','KB','MB','GB'];
  let i = 0;
  while(n >= 1024 && i < units.length - 1){ n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}
function optionsFrom(rows, key, labelKey=key){
  const seen = new Set();
  return rows.map(r => ({value: r[key] || '', label: r[labelKey] || r[key] || 'unknown', count: r.count || 0}))
    .filter(o => o.value && !seen.has(o.value) && seen.add(o.value));
}
function fillSelect(sel, options, first){
  const current = sel.value;
  sel.innerHTML = `<option value="">${first}</option>` + options.map(o => `<option value="${esc(o.value)}">${esc(o.label)} (${o.count})</option>`).join('');
  if([...sel.options].some(o => o.value === current)) sel.value = current;
}
function breakdown(rows, labelKey, max=8){
  return rows.slice(0,max).map(r => `<div class="break-row" data-filter="${esc(r[labelKey] || '')}"><span>${esc(r[labelKey] || 'unknown')}</span><strong>${Number(r.count).toLocaleString()}</strong></div>`).join('') || '<p class="muted">No data</p>';
}
function closeMobileMenu(){
  document.body.classList.remove('mobile-menu-open');
  const menuToggle = $('#mobileMenuToggle');
  if(menuToggle) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.textContent = '☰';
  }
}
function showPanel(sectionId, panelId){
  const section = $(`#${sectionId}`);
  if(!section || !panelId) return;
  section.querySelectorAll('.subpanel').forEach(panel => panel.classList.toggle('active', panel.id === panelId));
  section.querySelectorAll('.section-tabs button').forEach(button => button.classList.toggle('active', button.dataset.panel === panelId));
}
function sectionFor(name){
  return ({ visualiser:'constellation', constellation:'constellation', search:'explore', recall:'explore', memories:'explore', timelineView:'activity', consolidations:'activity', triples:'graph', todayAdded:'today', todayRecalled:'today', todayTriples:'today', todayConsolidations:'today' })[name] || name;
}
function defaultPanelFor(section){
  return ({ explore:'exploreSearch', activity:'activityTimeline', graph:'graphGraph', today:'todayAdded' })[section];
}
function panelFor(name){
  return ({ search:'exploreSearch', memories:'exploreMemories', recall:'exploreRecall', timelineView:'activityTimeline', consolidations:'activityConsolidations', graph:'graphGraph', triples:'graphTriples', today:'todayAdded', todayAdded:'todayAdded', todayRecalled:'todayRecalled', todayTriples:'todayTriples', todayConsolidations:'todayConsolidations' })[name] || defaultPanelFor(name);
}
function switchTab(name, opts={}){
  const section = sectionFor(name);
  document.body.classList.toggle('compact-page', section !== 'overview');
  $$('.tab, nav button').forEach(x=>x.classList.remove('active'));
  $(`#${section}`).classList.add('active');
  const nav = document.querySelector(`nav button[data-tab="${canonicalTab(name)}"]`) || document.querySelector(`nav button[data-tab="${section}"]`);
  if(nav) nav.classList.add('active');
  showPanel(section, panelFor(name));
  closeDetail({ push:false });
  closeMobileMenu();
  currentRoute = routeTabState(name);
  if(opts.push !== false) pushRoute(currentRoute);
  if(name==='graph' || section==='graph') loadGraph();
  if(name==='triples') loadTriples();
  if(name==='consolidations') loadConsolidations();
  if(name==='memories') loadMemories();
  if(name==='search' || section==='explore') loadGlobalSearch();
  if(name==='recall') loadRecallDebug();
  if(name==='timelineView' || section==='activity') loadTimeline();
  if(section==='today') loadTodayDigest();
  if(section==='profile') loadProfile();
  if(section==='constellation') loadConstellation();
  if(section==='visualiser3d') loadThreeVisualiser();
  if(section==='settings') { loadAuthStatus(); loadDiagnostics(); }
}

async function loadStats(){
  const s = await api('/api/stats');
  $('#dbPath').textContent = s.db_path;
  $('#dbPath').title = s.db_path;
  const cards = [
    ['Working', s.counts.working_memory], ['Episodic', s.counts.episodic_memory], ['Triples', s.counts.triples], ['Consolidations', s.counts.consolidation_log]
  ];
  $('#cards').innerHTML = cards.map(([label,num]) => `<div class="card"><div class="num">${Number(num).toLocaleString()}</div><div class="label">${label}</div></div>`).join('');
  $('#sourceBreakdown').innerHTML = breakdown(s.by_source, 'source');
  $('#scopeBreakdown').innerHTML = breakdown(s.by_scope, 'scope');
  $('#sessionBreakdown').innerHTML = breakdown(s.by_session, 'session_id', 6);
  fillSelect($('#memorySource'), optionsFrom(s.by_source, 'source'), 'all sources');
  fillSelect($('#memoryScope'), optionsFrom(s.by_scope, 'scope'), 'all scopes');
  fillSelect($('#memorySession'), optionsFrom(s.by_session, 'session_id'), 'all sessions');
  $('#recent').innerHTML = s.recent.map(memoryItem).join('');
  bindMemoryClicks($('#recent'));
  bindBreakdownClicks();
}
function bindBreakdownClicks(){
  $$('#sourceBreakdown .break-row').forEach(row => row.onclick = () => { $('#memorySource').value = row.dataset.filter || ''; switchTab('memories'); });
  $$('#scopeBreakdown .break-row').forEach(row => row.onclick = () => { $('#memoryScope').value = row.dataset.filter || ''; switchTab('memories'); });
  $$('#sessionBreakdown .break-row').forEach(row => row.onclick = () => openSessionDetail(row.dataset.filter || ''));
}
async function loadMemories(){
  const params = new URLSearchParams({
    kind: $('#memoryKind').value,
    q: $('#memoryQuery').value.trim(),
    source: $('#memorySource').value,
    scope: $('#memoryScope').value,
    session_id: $('#memorySession').value,
    status: $('#memoryStatus').value,
    sort: $('#memorySort').value,
    limit: '150'
  });
  const data = await api(`/api/memories?${params.toString()}`);
  latestMemoryItems = data.items || [];
  $('#memoryList').innerHTML = latestMemoryItems.map(item => memoryItem(item, {selectable:true})).join('') || '<p class="muted">No memories found.</p>';
  bindMemoryClicks($('#memoryList'));
  bindBulkMemoryControls();
  updateBulkBar();
}
function updateBulkBar(){
  const bar = $('#bulkMemoryBar');
  if(!bar) return;
  const admin = canAdmin();
  bar.classList.toggle('hidden', !latestMemoryItems.length);
  const actionable = latestMemoryItems.filter(x => bulkSelection.has(x.id) && isMutableMemory(x)).length;
  $('#bulkSelectionStatus').textContent = `${bulkSelection.size} selected · ${actionable} active`;
  $('#bulkExpire').disabled = !admin || !actionable;
  $('#bulkImportance').disabled = !admin || !actionable;
  $('#bulkSelectAll').checked = latestMemoryItems.length > 0 && latestMemoryItems.every(x => bulkSelection.has(x.id));
  $('#bulkSelectAll').disabled = !latestMemoryItems.length;
}
function bindBulkMemoryControls(){
  $$('#memoryList .memory-check').forEach(chk => chk.onchange = e => { e.stopPropagation(); chk.checked ? bulkSelection.add(chk.dataset.id) : bulkSelection.delete(chk.dataset.id); updateBulkBar(); });
}
async function expireSelectedMemories(){
  const ids = latestMemoryItems.filter(x => bulkSelection.has(x.id) && isMutableMemory(x)).map(x => x.id);
  if(!ids.length) return;
  const ok = await confirmAction({title:'Expire selected memories?', description:`Expire ${ids.length} selected active memories. Backups and audit entries will be created.`, confirmText:'Expire selected', tone:'warn'});
  if(!ok) return;
  for(const id of ids) await postJson('/api/admin/memory/invalidate', {memory_id:id, backup: $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true});
  bulkSelection.clear(); await loadStats(); await loadMemories();
}
async function setSelectedImportance(){
  const ids = latestMemoryItems.filter(x => bulkSelection.has(x.id) && isMutableMemory(x)).map(x => x.id);
  if(!ids.length) return;
  const v = await askImportance(0.5);
  if(v === null) return;
  for(const id of ids) await postJson('/api/admin/memory/importance', {memory_id:id, importance:Number(v), backup: $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true});
  bulkSelection.clear(); await loadStats(); await loadMemories();
}
function bindMemoryClicks(root){
  root.querySelectorAll('.session-link').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); openSessionDetail(btn.dataset.session || ''); });
  root.querySelectorAll('.item[data-id]').forEach(el => el.onclick = (e) => { if(e.target.closest('.session-link,button,a,label,input')) return; openMemoryDetail(el.dataset.id); });
}
function canAdmin(){ const cfg = authState.config || {}; const localOnly = ['127.0.0.1','localhost','::1'].includes(cfg.host || '0.0.0.0'); return !!(cfg.memory_admin_enabled && (localOnly || (authState.auth_enabled && authState.authenticated))); }
function isMutableMemory(item){ return String(item?.status || 'active').toLowerCase() === 'active'; }
function whyMemoryHtml(item){
  const reasons = [];
  const q = $('#memoryQuery')?.value.trim();
  const source = $('#memorySource')?.value;
  const scope = $('#memoryScope')?.value;
  const session = $('#memorySession')?.value;
  const status = $('#memoryStatus')?.value;
  const sort = $('#memorySort')?.value;
  if(q) reasons.push(`matches browser query “${q}” across content, id, session, source, or scope`);
  if(source && item.source === source) reasons.push(`source filter matched ${source}`);
  if(scope && item.scope === scope) reasons.push(`scope filter matched ${scope}`);
  if(session && item.session_id === session) reasons.push(`session filter matched ${session}`);
  if(!reasons.length) reasons.push('shown from the current list/search context');
  return `<div class="result-section why-panel"><h3>Why shown <span>${esc(item.status || 'active')}</span></h3><div class="diag-grid compact">
    <div class="diag-row"><span>Reason</span><strong>${esc(reasons.join(' · '))}</strong></div>
    <div class="diag-row"><span>Ranking</span><strong>${esc(sort || 'recent')} · importance ${Number(item.importance ?? 0).toFixed(2)} · recalled ${Number(item.recall_count || 0).toLocaleString()}×</strong></div>
    <div class="diag-row"><span>Freshness</span><strong>created ${esc(prettyTime(item.created_at) || item.created_at || 'unknown')} · last recalled ${esc(prettyTime(item.last_recalled) || item.last_recalled || 'never')}</strong></div>
    <div class="diag-row"><span>Origin</span><strong>${esc(item.tier || 'memory')} · ${esc(item.source || 'unknown source')} · ${esc(item.scope || 'unknown scope')}</strong></div>
  </div></div>`;
}
function memoryDetailHtml(item){
  const admin = canAdmin();
  const mutable = isMutableMemory(item);
  const adminActions = admin && mutable ? '<button id="expireMemory" class="drawer-action warn">Expire now</button><button id="editImportance" class="drawer-action">Edit importance</button><button id="supersedeMemory" class="drawer-action primary">Supersede</button>' : '';
  const actionNote = admin ? (mutable ? '' : `<span class="muted">This memory is ${esc(item.status || 'not active')}; mutation actions are disabled.</span>`) : '<span class="muted">Enable Settings → Memory maintenance to modify memories.</span>';
  return `
    <div class="memory-detail">
      ${meta(item, {sessionLink:false})}
      <div class="content detail-content">${esc(item.content)}</div>
      ${whyMemoryHtml(item)}
      <div class="diag-grid compact">
        <div class="diag-row"><span>ID</span><strong>${esc(item.id)}</strong></div>
        <div class="diag-row"><span>Session</span>${item.session_id && item.session_id !== 'default' ? `<button id="memorySessionLink" class="diag-link" title="Open session: ${esc(item.session_id)}">${esc(item.session_id)}</button>` : `<strong>${esc(item.session_id || 'default')}</strong>`}</div>
        <div class="diag-row"><span>Source</span><strong>${esc(item.source || 'unknown')}</strong></div>
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
async function openMemoryDetail(memoryId, opts={}){
  await refreshAuthState();
  const item = (await api('/api/memory?id=' + encodeURIComponent(memoryId))).item;
  showHtmlDetail(memoryDetailHtml(item), 'Memory detail');
  if(opts.push !== false) pushRoute({ ...routeTabState(), drawer:{ type:'memory', id:memoryId } });
  const sessionLink = $('#memorySessionLink');
  if(sessionLink) sessionLink.onclick = () => openSessionDetail(item.session_id || '');
  $('#copyMemoryId').onclick = () => showSelectableCopy('Memory ID', item.id);
  if(!canAdmin() || !isMutableMemory(item)) return;
  const backup = () => $('#backupBeforeMutation') ? $('#backupBeforeMutation').checked : true;
  $('#expireMemory').onclick = async () => {
    const ok = await confirmAction({
      title: 'Expire this memory?',
      description: 'It will disappear from active recall, but the original record stays available for history and audit.',
      confirmText: 'Expire memory',
      tone: 'warn'
    });
    if(!ok) return;
    try { const r = await postJson('/api/admin/memory/invalidate', {memory_id:item.id, backup: backup()}); $('#memoryActionStatus').textContent = `Expired. Backup: ${r.backup?.path || 'not created'}`; await loadMemories(); await openMemoryDetail(item.id); }
    catch(e){ $('#memoryActionStatus').textContent = e.message; }
  };
  $('#editImportance').onclick = async () => {
    const v = await askImportance(item.importance ?? 0.5);
    if(v === null) return;
    try { const r = await postJson('/api/admin/memory/importance', {memory_id:item.id, importance:Number(v), backup: backup()}); $('#memoryActionStatus').textContent = `Importance updated to ${r.importance}.`; await loadStats(); await loadMemories(); await openMemoryDetail(item.id); }
    catch(e){ $('#memoryActionStatus').textContent = e.message; }
  };
  $('#supersedeMemory').onclick = async () => {
    const replacement = await askReplacement(item.content || '');
    if(replacement === null) return;
    try { const r = await postJson('/api/admin/memory/supersede', {memory_id:item.id, content:replacement, importance:Number(item.importance ?? 0.5), backup: backup()}); $('#memoryActionStatus').textContent = `Superseded by ${r.replacement_id}.`; $('#memoryStatus').value = 'all'; await loadStats(); await loadMemories(); await openMemoryDetail(r.replacement_id); }
    catch(e){ $('#memoryActionStatus').textContent = e.message; }
  };
}
function sessionEvent(e){ return `<div class="session-event" data-json='${esc(JSON.stringify(e.item))}'><div class="meta"><span class="badge">${esc(e.type)}</span><span>${esc(e.timestamp || '')}</span></div><div class="content"><strong>${esc(e.title)}</strong><br>${esc(e.preview || '')}</div></div>`; }
async function openSessionDetail(sessionId, opts={}){
  if(!sessionId || sessionId === 'unknown') return;
  const data = await api(`/api/session?id=${encodeURIComponent(sessionId)}&limit=200`);
  const c = data.counts || {};
  showHtmlDetail(`
    <div class="session-summary">
      <div class="diag-pill"><strong>${esc(c.memories || 0)}</strong><span>memories</span></div>
      <div class="diag-pill"><strong>${esc(c.triples || 0)}</strong><span>triples</span></div>
      <div class="diag-pill"><strong>${esc(c.consolidations || 0)}</strong><span>consolidations</span></div>
    </div>
    <div class="drawer-actions session-actions"><button id="sessionBrowseMemories" class="drawer-action primary">Browse memories</button><button id="sessionTimeline" class="drawer-action">Timeline by session</button><button id="sessionCopy" class="drawer-action">Copy session ID</button></div>
    <div class="result-section"><h3>Timeline <span>${esc(c.events || 0)}</span></h3><div class="timeline">${(data.events || []).map(sessionEvent).join('') || '<p class="muted">No events for this session.</p>'}</div></div>
  `, `Session ${sessionId}`);
  if(opts.push !== false) pushRoute({ ...routeTabState(), drawer:{ type:'session', id:sessionId } });
  $('#sessionBrowseMemories').onclick = () => { $('#memorySession').value = sessionId; $('#memoryKind').value = 'all'; $('#memoryQuery').value = ''; switchTab('memories'); closeDetail({ push:false }); };
  $('#sessionTimeline').onclick = () => { $('#timelineGroup').value = 'session'; $('#timelineQuery').value = sessionId; switchTab('timelineView'); closeDetail({ push:false }); };
  $('#sessionCopy').onclick = () => showSelectableCopy('Session ID', sessionId);
  $$('#detailBody .session-event').forEach(el => el.onclick = () => showDetail(JSON.parse(el.dataset.json), 'Session event detail'));
}
async function loadTriples(){
  const q = encodeURIComponent($('#tripleQuery').value.trim());
  const data = await api(`/api/triples?q=${q}&limit=300`);
  $('#tripleRows').innerHTML = data.items.map(t => `<tr class="triple-row" data-triple='${esc(JSON.stringify(t))}'><td>${esc(t.subject)}</td><td>${esc(t.predicate)}</td><td>${esc(t.object)}</td><td>${esc(t.confidence ?? '')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty-cell">No triples found.</td></tr>';
  $$('#tripleRows .triple-row').forEach(row => row.onclick = () => showDetail(JSON.parse(row.dataset.triple), 'Triple detail'));
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
    el.onclick = (e) => { if(e.target.closest('button')) return; showDetail(data, 'Consolidation detail'); };
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
function tripleCard(t){ return `<div class="item" data-json='${esc(JSON.stringify(t))}'><div class="meta"><span class="badge">triple</span><span>${esc(t.created_at || t.valid_from || '')}</span></div><div class="content"><strong>${esc(t.subject)}</strong> — ${esc(t.predicate)} → <strong>${esc(t.object)}</strong></div></div>`; }
function consolidationCard(c){ return `<div class="item" data-json='${esc(JSON.stringify(c))}'><div class="meta"><span class="badge">consolidation</span><span class="badge">${esc(c.items_consolidated)} items</span><span>${esc(c.created_at)}</span></div><div class="content">${esc(c.session_id || '')}: ${esc(c.summary_preview || '')}</div></div>`; }
function bindJsonCards(root, title){ root.querySelectorAll('[data-json]').forEach(el => el.onclick = () => showDetail(JSON.parse(el.dataset.json), title)); }
async function loadGlobalSearch(){
  const q = $('#globalSearchQuery')?.value.trim() || '';
  if(!q){ $('#globalSearchResults').innerHTML = '<p class="muted">Type a query to search memories, triples, and consolidations.</p>'; return; }
  const data = await api(`/api/search?q=${encodeURIComponent(q)}&limit=30`);
  $('#globalSearchResults').innerHTML = `
    <div class="result-section"><h3>Memories <span>${data.memories.length}</span></h3><div class="memory-grid">${data.memories.map(searchMemoryCard).join('') || '<p class="muted">No memories</p>'}</div></div>
    <div class="result-section"><h3>Triples <span>${data.triples.length}</span></h3><div class="memory-grid">${data.triples.map(tripleCard).join('') || '<p class="muted">No triples</p>'}</div></div>
    <div class="result-section"><h3>Consolidations <span>${data.consolidations.length}</span></h3><div class="memory-grid">${data.consolidations.map(consolidationCard).join('') || '<p class="muted">No consolidations</p>'}</div></div>`;
  bindMemoryClicks($('#globalSearchResults'));
  bindJsonCards($('#globalSearchResults'), 'Search result detail');
}
function recallItem(x){
  const m = x.memory;
  return `<div class="item" data-id="${esc(m.id)}"><div class="meta"><span class="badge">score ${esc(x.approx_score)}</span><span class="badge">${esc(m.tier)}</span><span class="badge">${esc(m.source || '')}</span><span>${esc(m.timestamp || m.created_at || '')}</span></div><div class="content">${esc(m.content)}</div><div class="reasons">${x.reasons.map(r=>`<span>${esc(r)}</span>`).join('')}</div></div>`;
}
async function loadRecallDebug(){
  const q = $('#recallQuery')?.value.trim() || '';
  if(!q){ $('#recallNote').textContent = 'Type a query to explain approximate recall ranking.'; $('#recallResults').innerHTML = ''; return; }
  const data = await api(`/api/recall-debug?q=${encodeURIComponent(q)}&limit=30`);
  $('#recallNote').textContent = data.note;
  $('#recallResults').innerHTML = data.items.map(recallItem).join('') || '<p class="muted">No matching memories.</p>';
  bindMemoryClicks($('#recallResults'));
}
function timelineEvent(e){ return `<div class="timeline-event item" data-json='${esc(JSON.stringify(e.item))}'><div class="meta"><span class="badge">${esc(e.type)}</span><button class="session-chip" data-session="${esc(e.session_id || '')}">${esc(e.session_id || 'no session')}</button><span>${esc(e.timestamp)}</span></div><div class="content"><strong>${esc(e.title)}</strong><br>${esc(e.preview)}</div></div>`; }
async function loadTimeline(){
  const q = $('#timelineQuery')?.value.trim() || '';
  const group = $('#timelineGroup')?.value || 'day';
  const data = await api(`/api/timeline?q=${encodeURIComponent(q)}&group=${encodeURIComponent(group)}&limit=300`);
  $('#timelineResults').innerHTML = data.groups.map(g => `<div class="timeline-group"><div class="section-head mini"><h2>${esc(g.key)}</h2><span>${g.count} events</span>${group === 'session' && g.key !== 'no session' ? `<button class="tiny open-session" data-session="${esc(g.key)}">Open session</button>` : ''}</div><div class="timeline">${g.events.map(timelineEvent).join('')}</div></div>`).join('') || '<p class="muted">No timeline events.</p>';
  bindJsonCards($('#timelineResults'), 'Timeline event detail');
  $$('#timelineResults .session-chip').forEach(btn => btn.onclick = (e) => { e.stopPropagation(); openSessionDetail(btn.dataset.session || ''); });
  $$('#timelineResults .open-session').forEach(btn => btn.onclick = () => openSessionDetail(btn.dataset.session || ''));
}
function tinyRows(rows, key='label'){ return (rows || []).map(r => `<div class="break-row"><span>${esc(r[key] || r.label || 'unknown')}</span><strong>${Number(r.count || 0).toLocaleString()}</strong></div>`).join('') || '<p class="muted">No data</p>'; }
function tripleItem(t){ return `<div class="item" data-json='${esc(JSON.stringify(t))}'><div class="meta"><span class="badge">triple</span><span>${esc(t.created_at || t.valid_from || '')}</span></div><div class="content"><strong>${esc(t.subject)}</strong> — ${esc(t.predicate)} → <strong>${esc(t.object)}</strong></div></div>`; }
async function loadTodayDigest(day=''){
  const suffix = day ? `&day=${encodeURIComponent(day)}` : '';
  const data = await api(`/api/digest/today?limit=80${suffix}`);
  const c = data.counts || {};
  $('#todayCards').innerHTML = [['Added', c.memories_added], ['Recalled', c.memories_recalled], ['Triples', c.triples_added], ['Consolidations', c.consolidations]].map(([label,num]) => `<div class="card"><div class="num">${Number(num || 0).toLocaleString()}</div><div class="label">${label}</div></div>`).join('');
  $('#todayEntities').innerHTML = tinyRows(data.breakdowns?.entities || []);
  $('#todaySources').innerHTML = tinyRows(data.breakdowns?.sources || []);
  $('#todaySessions').innerHTML = tinyRows(data.breakdowns?.sessions || []);
  $('#todayAdded .memory-grid').innerHTML = (data.memories_added || []).map(memoryItem).join('') || '<p class="muted">No memories added today.</p>';
  $('#todayRecalled .memory-grid').innerHTML = (data.memories_recalled || []).map(memoryItem).join('') || '<p class="muted">No memories recalled today.</p>';
  $('#todayTriples .memory-grid').innerHTML = (data.triples_added || []).map(tripleItem).join('') || '<p class="muted">No triples added today.</p>';
  $('#todayConsolidations .memory-grid').innerHTML = (data.consolidations || []).map(consolidationCard).join('') || '<p class="muted">No consolidations today.</p>';
  ['todayAdded','todayRecalled'].forEach(id => bindMemoryClicks($(`#${id}`)));
  bindJsonCards($('#todayTriples'), 'Triple detail');
  bindJsonCards($('#todayConsolidations'), 'Consolidation detail');
}
function contextSummary(data){
  const s = data.summary || {};
  const typeChips = (s.types || []).map(t => `<span class="context-type-chip">${esc(t.label)} <strong>${Number(t.count || 0).toLocaleString()}</strong></span>`).join('');
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
    <div class="context-card-head"><span class="badge">${esc(row.context_type || row.kind)}</span><span class="confidence ${pct < 70 ? 'warn' : ''}">${esc(confidence)} · ${Math.round(pct)}%</span></div>
    <p>${esc(row.label || '')}</p>
    ${extracted ? `<div class="context-meta extracted">${extracted}</div>` : ''}
    <div class="context-meta"><span>${esc(prettyTime(row.timestamp) || row.timestamp || '')}</span>${provenance}</div>
  </div>`;
}
async function loadProfile(){
  const data = await api('/api/profile/inferred?limit=10');
  $('#profileGrid').innerHTML = `${contextSummary(data)}${(data.sections || []).map(s => `<section class="profile-section glass"><div class="section-head mini"><h2>${esc(s.name)}</h2><span>${esc(s.count)} active item${Number(s.count) === 1 ? '' : 's'}</span></div>${(s.items || []).map(profileItem).join('')}</section>`).join('') || '<p class="muted">No inferred profile data found.</p>'}`;
  $$('#profileGrid .profile-item[data-id]').forEach(el => el.onclick = () => openMemoryDetail(el.dataset.id));
  $$('#profileGrid .profile-item[data-json]').forEach(el => el.onclick = () => showDetail(JSON.parse(el.dataset.json), 'Profile source detail'));
}
function constellationInspectorDefault(){
  const neural = constellationScene.visualiserMode === 'neural';
  $('#constellationInspector').innerHTML = neural
    ? `<div class="inspector-kicker">Neural inspector</div><h3>Nothing selected</h3><p class="muted">Pick a neuron hub, memory soma, or synapse to inspect the underlying read-only source.</p>`
    : `<div class="inspector-kicker">Constellation inspector</div><h3>Nothing selected</h3><p class="muted">Pick a star, memory, or link to inspect the underlying read-only source.</p>`;
}
function inspectConstellationNode(node){
  $('#constellationInspector').innerHTML = `<div class="inspector-kicker">${esc(node.kind || 'entity')}</div><h3>${esc(node.label)}</h3><p class="muted">${esc(node.category || 'Other')} · ${Number(node.count || 0).toLocaleString()} signal(s) · weight ${Number(node.weight || 0).toFixed(2)}</p>${node.preview ? `<p>${esc(node.preview)}</p>` : ''}<div class="inspector-actions">${node.memory_id ? '<button id="constellationMemory" class="primary tiny">Open memory</button>' : ''}<button id="constellationSearch" class="tiny">Search this</button></div>`;
  if(node.memory_id) $('#constellationMemory').onclick = () => openMemoryDetail(node.memory_id);
  $('#constellationSearch').onclick = () => { $('#memoryQuery').value = node.label.replace(/^memory:/,''); switchTab('memories'); };
}
function constellationColors(){
  const light = document.documentElement.dataset.theme === 'light';
  return light ? { light:true, bg:'#fbf8f3', nebula:'rgba(101,214,255,.11)', star:'#087fa6', memory:'#a9700a', text:'#2b2927', muted:'rgba(66,58,52,.62)', edge:'rgba(25,65,108,.50)', memoryEdge:'rgba(130,78,18,.48)' } : { light:false, bg:'#050711', nebula:'rgba(101,214,255,.14)', star:'#65d6ff', memory:'#ffd166', text:'#f7f8ff', muted:'rgba(213,219,239,.64)', edge:'rgba(198,224,255,.44)', memoryEdge:'rgba(255,209,102,.50)' };
}
function projectConstellationNode(n, w, h, t){
  const rot = constellationScene.rotation;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const x = n.x * cos - n.z * sin;
  const z0 = n.x * sin + n.z * cos;
  const tilt = constellationScene.tilt;
  const y = n.y * Math.cos(tilt) - z0 * Math.sin(tilt);
  const z = n.y * Math.sin(tilt) + z0 * Math.cos(tilt);
  const depth = 760;
  const scale = depth / (depth + z + 260);
  const fit = w < 620 ? Math.min(.72, Math.max(.58, (w - 36) / 680)) : Math.min(1.02, Math.max(.62, (w - 72) / 760));
  const cameraScale = fit * constellationScene.zoom;
  return { x:w/2 + constellationScene.panX + x*scale*cameraScale, y:h/2 + constellationScene.panY + y*scale*cameraScale, z, scale:scale*constellationScene.zoom, visible:scale > .35 };
}
function buildConstellationScene(data){
  const nodes = (data.nodes || []).slice(0,160);
  const categories = [...new Set(nodes.map(n => n.category || 'Other'))];
  const catIndex = Object.fromEntries(categories.map((c,i)=>[c,i]));
  nodes.forEach((n,i) => {
    const ci = catIndex[n.category || 'Other'] || 0;
    const angle = (i / Math.max(nodes.length,1)) * Math.PI * 2 + ci * .62;
    const band = n.kind === 'memory' ? 1.28 : .72 + (ci % 4) * .16;
    const radius = 250 * band + (i % 7) * 16;
    n.x = Math.cos(angle) * radius;
    n.y = Math.sin(angle * 1.23) * (100 + (ci % 5) * 24) + (((i * 53) % 131) - 65) * .82;
    n.z = Math.sin(angle) * radius * .82 + (((i * 97) % 181) - 90) * 1.55 + ((ci % 5) - 2) * 42;
    n.size = Math.min(22, 4 + Math.sqrt(Number(n.weight || n.count || 1))*3.4) * (n.kind === 'memory' ? 1.08 : 1);
    n.twinkle = (i % 17) / 17;
    const twinkleTier = i % 11 === 0 ? 2 : (i % 5 === 0 ? 1 : 0);
    n.twinkleFreq = twinkleTier === 2 ? .0062 + ((i * 29) % 70) / 100000 : (twinkleTier === 1 ? .0030 + ((i * 29) % 80) / 100000 : .00115 + ((i * 29) % 95) / 100000);
    n.twinkleAmp = twinkleTier === 2 ? .18 : (twinkleTier === 1 ? .12 : .075 + ((i * 31) % 55) / 1000);
  });
  constellationScene.nodes = nodes;
  constellationScene.edges = (data.edges || []).filter(e => nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target)).slice(0,300);
  constellationScene.byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
  constellationScene.regions = [];
  constellationScene.data = data;
  constellationScene.stars = Array.from({length:140}, (_,i) => {
    const fast = i % 13 === 0;
    const medium = !fast && i % 6 === 0;
    return { x:((i*73)%1000)/1000, y:((i*191)%680)/680, r:.35 + ((i*37)%100)/90, a:.18 + ((i*29)%100)/240, phase:(i*47)%628/100, freq:fast ? .0058 + ((i*41)%80)/100000 : (medium ? .0027 + ((i*41)%90)/100000 : .00048 + ((i*41)%95)/100000) };
  });
}
function buildNeuralMapScene(data){
  const nodes = (data.nodes || []).slice(0,170).map(n => ({...n}));
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = (data.edges || []).filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)).slice(0,340);
  const categories = [...new Set(nodes.map(n => n.category || 'Other'))];
  const catIndex = Object.fromEntries(categories.map((c,i)=>[c,i]));
  const regionCount = Math.max(1, categories.length);
  const regions = Object.fromEntries(categories.map((cat, i) => {
    // Place category regions inside a real 3D ellipsoid rather than on a flat ring.
    // Golden-angle distribution gives an organic brain-cloud feel while remaining deterministic.
    const t = regionCount === 1 ? 0 : (i / Math.max(1, regionCount - 1)) * 2 - 1;
    const angle = -Math.PI / 2 + i * 2.399963;
    const radial = Math.sqrt(Math.max(0, 1 - t * t));
    const side = i % 2 === 0 ? -1 : 1;
    return [cat, {
      label:cat,
      angle,
      cx:Math.cos(angle) * radial * 230,
      cy:t * 150 + Math.sin(angle * .7) * 24,
      cz:Math.sin(angle) * radial * 190 + side * 28,
      spread:78 + (i % 4) * 12
    }];
  }));
  const degree = new Map();
  edges.forEach(e => { degree.set(e.source, (degree.get(e.source) || 0) + 1); degree.set(e.target, (degree.get(e.target) || 0) + 1); });
  const hubsByCategory = {};
  nodes.filter(n => n.kind !== 'memory').sort((a,b)=>(Number(b.weight || b.count || 0)+ (degree.get(b.id)||0)) - (Number(a.weight || a.count || 0)+(degree.get(a.id)||0))).forEach(n => {
    const cat = n.category || 'Other';
    if(!hubsByCategory[cat]) hubsByCategory[cat] = [];
    hubsByCategory[cat].push(n);
  });
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  nodes.forEach((n,i) => {
    const cat = n.category || 'Other';
    const region = regions[cat] || regions.Other || { cx:0, cy:0, cz:0, angle:0, spread:80 };
    const ci = catIndex[cat] || 0;
    const weight = Math.max(1, Number(n.weight || n.count || 1));
    const d = degree.get(n.id) || 0;
    if(n.kind === 'memory'){
      const linked = edges.find(e => e.source === n.id || e.target === n.id);
      const parent = linked ? byId[linked.source === n.id ? linked.target : linked.source] : null;
      const parentX = parent && parent.kind !== 'memory' && Number.isFinite(parent.x) ? parent.x : region.cx;
      const parentY = parent && parent.kind !== 'memory' && Number.isFinite(parent.y) ? parent.y : region.cy;
      const parentZ = parent && parent.kind !== 'memory' && Number.isFinite(parent.z) ? parent.z : region.cz;
      const branch = ((i * 137.508 + ci * 19) % 360) * Math.PI / 180;
      const yUnit = ((((i * 43 + ci * 17) % 97) + .5) / 97) * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
      const dist = 46 + (i % 6) * 13 + Math.min(48, Math.sqrt(weight) * 10);
      n.x = parentX + Math.cos(branch) * radial * dist;
      n.y = parentY + yUnit * dist * .82;
      n.z = parentZ + Math.sin(branch) * radial * dist * .86;
    } else {
      const rank = Math.max(0, (hubsByCategory[cat] || []).indexOf(n));
      const orbit = rank === 0 ? 0 : 30 + Math.sqrt(rank) * 20;
      const angle = region.angle + rank * 2.399963 + (ci % 3) * .24;
      const yUnit = rank === 0 ? 0 : ((((rank * 37 + ci * 11) % 89) + .5) / 89) * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
      n.x = region.cx + Math.cos(angle) * radial * orbit;
      n.y = region.cy + yUnit * orbit * .86;
      n.z = region.cz + Math.sin(angle) * radial * orbit * .80;
    }
    n.size = Math.min(30, 8 + Math.sqrt(weight + d) * (n.kind === 'memory' ? 3.2 : 4.1));
    n.twinkle = (i % 17) / 17;
    n.twinkleFreq = .0017 + ((i * 31) % 80) / 100000;
    n.twinkleAmp = .08 + ((i * 19) % 40) / 1000;
    n.neuralRegion = cat;
  });
  constellationScene.nodes = nodes;
  constellationScene.edges = edges;
  constellationScene.byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
  constellationScene.regions = Object.values(regions);
  constellationScene.data = data;
  constellationScene.stars = Array.from({length:60}, (_,i) => ({ x:((i*89)%1000)/1000, y:((i*157)%680)/680, r:.25 + ((i*17)%100)/120, a:.10 + ((i*23)%100)/340, phase:(i*41)%628/100, freq:.00045 + ((i*29)%70)/100000 }));
}
function projectNeuralNode(n, w, h){
  const fit = w < 620 ? Math.min(.88, Math.max(.62, (w - 38) / 620)) : Math.min(1.10, Math.max(.76, (w - 80) / 720));
  const cameraScale = fit * constellationScene.zoom;
  const x = Number(n.x || 0), y = Number(n.y || 0), z = Number(n.z || 0);
  const cosR=Math.cos(constellationScene.rotation || 0), sinR=Math.sin(constellationScene.rotation || 0);
  const xr=x*cosR - z*sinR, zr=x*sinR + z*cosR;
  const cosT=Math.cos(constellationScene.tilt || 0), sinT=Math.sin(constellationScene.tilt || 0);
  const yr=y*cosT - zr*sinT, zt=y*sinT + zr*cosT;
  const cameraDistance = w < 620 ? 760 : 980;
  const perspective = Math.max(.48, Math.min(1.85, cameraDistance / Math.max(260, cameraDistance - zt)));
  const depthAlpha = Math.max(.36, Math.min(1, .58 + zt / 620));
  return {
    x:w/2 + constellationScene.panX + xr*cameraScale*perspective,
    y:h/2 + constellationScene.panY + yr*cameraScale*perspective,
    z:zt,
    scale:cameraScale*perspective,
    alpha:depthAlpha,
    visible:true
  };
}
function drawSynapse(ctx, a, b, e, c, t, compactCanvas, pulse=false){
  const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
  const dx=b.x-a.x, dy=b.y-a.y;
  const len=Math.max(1, Math.hypot(dx,dy));
  const curve=Math.min(compactCanvas ? 30 : 48, len*.16) * (((e.id || '').length % 2) ? 1 : -1);
  const cx=mx - dy/len*curve, cy=my + dx/len*curve;
  const depth=Math.min(1, Math.max(.42, ((a.alpha || 1) + (b.alpha || 1)) / 2));
  ctx.strokeStyle=e.kind === 'memory' ? c.memorySynapse : c.synapse;
  ctx.globalAlpha=(compactCanvas ? .24 : .30) * depth;
  ctx.lineWidth=compactCanvas ? .66 : .82;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.quadraticCurveTo(cx,cy,b.x,b.y); ctx.stroke();
  if(!pulse) return;
  const phase=((t*.00012 + ((e.id || '').length % 17)/17) % 1);
  const inv=1-phase;
  const qx=inv*inv*a.x + 2*inv*phase*cx + phase*phase*b.x;
  const qy=inv*inv*a.y + 2*inv*phase*cy + phase*phase*b.y;
  ctx.globalAlpha=(compactCanvas ? .36 : .54) * depth;
  ctx.fillStyle=e.kind === 'memory' ? c.memory : c.star;
  ctx.beginPath(); ctx.arc(qx,qy,compactCanvas ? 1.55 : 2.15,0,Math.PI*2); ctx.fill();
}
function drawNeuronSoma(ctx, n, p, c, t, compactCanvas, fast=false){
  const weight=Math.max(1, Number(n.weight || n.count || 1));
  const base=n.kind === 'memory' ? c.memory : c.star;
  const r=Math.min(compactCanvas ? 7.5 : 11, Math.max(compactCanvas ? 3.4 : 4.6, (2.8 + Math.sqrt(weight)*1.15) * p.scale));
  const pulse=1 + Math.sin(t*(n.twinkleFreq || .0017) + n.twinkle*6.28)*(n.twinkleAmp || .07);
  const somaR=r*pulse;
  const halo=somaR*(n.kind === 'memory' ? 2.0 : 2.4);
  const depthAlpha = p.alpha || 1;
  if(fast){
    ctx.globalAlpha=(c.light ? .34 : .48) * depthAlpha;
    ctx.fillStyle=base;
    ctx.beginPath(); ctx.arc(p.x,p.y,somaR*.92,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=.88 * depthAlpha;
    ctx.fillStyle='rgba(255,255,255,.82)';
    ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(.65,somaR*.30),0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    return { r:somaR, halo };
  }
  const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,halo);
  glow.addColorStop(0,'rgba(255,255,255,.82)');
  glow.addColorStop(.20,base);
  glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.globalAlpha=(c.light ? .20 : .30) * depthAlpha;
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(p.x,p.y,halo,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate((n.twinkle || 0)*Math.PI*2 + t*.00004);
  ctx.strokeStyle=base; ctx.lineCap='round'; ctx.shadowColor=base; ctx.shadowBlur=compactCanvas ? 5 : 8;
  const dendrites=n.kind === 'memory' ? 3 : 6;
  for(let i=0;i<dendrites;i++){
    const a=(i/dendrites)*Math.PI*2 + Math.sin(t*.00018+i)*.10;
    const length=somaR*(n.kind === 'memory' ? 1.55 : 2.15) + (i%3)*2.5;
    ctx.globalAlpha=(c.light ? .22 : .34) * depthAlpha;
    ctx.lineWidth=Math.max(.55,somaR*.10);
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*somaR*.72, Math.sin(a)*somaR*.72); ctx.lineTo(Math.cos(a)*length, Math.sin(a)*length); ctx.stroke();
    if(n.kind !== 'memory'){
      ctx.globalAlpha=(c.light ? .16 : .24) * depthAlpha;
      const fork=length*.72;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*fork, Math.sin(a)*fork); ctx.lineTo(Math.cos(a+.38)*length*.96, Math.sin(a+.38)*length*.96); ctx.stroke();
    }
  }
  ctx.globalAlpha=.96 * depthAlpha; ctx.fillStyle='rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(0,0,somaR*.88,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=.78 * depthAlpha; ctx.fillStyle=base; ctx.beginPath(); ctx.arc(0,0,somaR*.58,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=.72 * depthAlpha; ctx.fillStyle=c.bg; ctx.beginPath(); ctx.arc(-somaR*.16,-somaR*.18,somaR*.18,0,Math.PI*2); ctx.fill();
  ctx.restore();
  return { r:somaR, halo };
}

function neuralFastMode(t=performance.now()){
  return constellationScene.visualiserMode === 'neural' && (Boolean(constellationScene.drag) || t - (constellationScene.lastInteraction || 0) < 220);
}
function visualiserDpr(compactCanvas, mode){
  const raw = window.devicePixelRatio || 1;
  if(mode === 'neural') return Math.min(raw, compactCanvas ? 1.8 : 1.25);
  return Math.min(raw, compactCanvas ? 2 : 1.5);
}
function drawNeuralFrame(t=0){
  const canvas = $('#constellationCanvas');
  if(!canvas) return;
  const wrap = canvas.parentElement;
  const w = Math.max(320, wrap.clientWidth || canvas.clientWidth || 1000);
  const h = Math.max(430, wrap.clientHeight || canvas.clientHeight || 680);
  const compactCanvas = w < 620;
  const dpr = visualiserDpr(compactCanvas, 'neural');
  if(canvas.width !== Math.floor(w*dpr) || canvas.height !== Math.floor(h*dpr)){ canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr); }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const c = neuralColors();
  const fast = false;
  if(!constellationScene.paused && !constellationScene.drag && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const delta = constellationScene.lastFrameTime ? Math.min(48, t - constellationScene.lastFrameTime) : 16;
    constellationScene.rotation += delta * 0.000032;
  }
  constellationScene.lastFrameTime = t;
  clampConstellationCamera(w, h);
  ctx.clearRect(0,0,w,h);
  const bg = ctx.createRadialGradient(w*.48,h*.44,18,w*.48,h*.44,Math.max(w,h)*.78);
  bg.addColorStop(0, c.core);
  bg.addColorStop(.48, c.mid);
  bg.addColorStop(1, c.bg);
  ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
  constellationScene.stars.forEach((s)=>{ const pulse=.50 + Math.sin(t*s.freq + s.phase)*.30; ctx.globalAlpha=s.a*Math.max(.10, pulse)*(c.light ? .35 : .55); ctx.fillStyle=c.text; ctx.beginPath(); ctx.arc(s.x*w, s.y*h, s.r*(c.light ? .55 : .75), 0, Math.PI*2); ctx.fill(); });
  ctx.globalAlpha=1;
  const projected = new Map();
  constellationScene.nodes.forEach(n => projected.set(n.id, projectNeuralNode(n,w,h)));
  (constellationScene.regions || []).slice(0,10).forEach((region, i) => {
    const rp = projectNeuralNode({x:region.cx,y:region.cy,z:region.cz || 0},w,h);
    const rx = (region.spread || 82) * (compactCanvas ? 1.20 : 1.55) * rp.scale;
    const ry = (region.spread || 82) * (compactCanvas ? .76 : .98) * rp.scale;
    const hue = i % 3;
    const fill = c.light
      ? (hue === 0 ? 'rgba(76,171,158,.075)' : hue === 1 ? 'rgba(101,214,255,.065)' : 'rgba(255,209,102,.060)')
      : (hue === 0 ? 'rgba(76,171,158,.115)' : hue === 1 ? 'rgba(101,214,255,.092)' : 'rgba(255,209,102,.070)');
    ctx.save();
    ctx.translate(rp.x,rp.y);
    ctx.rotate(region.angle*.42);
    ctx.globalAlpha=1;
    ctx.fillStyle=fill;
    ctx.beginPath();
    ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
    ctx.fill();
    ctx.globalAlpha=c.light ? .14 : .18;
    ctx.strokeStyle=hue === 2 ? c.memorySynapse : c.synapseHot;
    ctx.lineWidth=.8;
    ctx.beginPath(); ctx.ellipse(0,0,rx*.72,ry*.72,0,0,Math.PI*2); ctx.stroke();
    if(!compactCanvas && region.label){
      ctx.globalAlpha=c.light ? .32 : .28;
      ctx.fillStyle=c.text;
      ctx.font='10px Inter, system-ui, sans-serif';
      ctx.fillText(region.label.slice(0,22), -rx*.42, -ry*.48);
    }
    ctx.restore();
  });
  const edgeDegree = new Map();
  let edgeDrawn = 0;
  const edgeLimit = fast ? (compactCanvas ? 48 : 112) : (compactCanvas ? 58 : 132);
  const degreeLimit = fast ? (compactCanvas ? 3 : 4) : (compactCanvas ? 3 : 5);
  for(const e of constellationScene.edges){
    const a=projected.get(e.source), b=projected.get(e.target);
    if(!a || !b) continue;
    if(edgeDrawn >= edgeLimit) break;
    const da=edgeDegree.get(e.source) || 0, db=edgeDegree.get(e.target) || 0;
    if(da >= degreeLimit || db >= degreeLimit) continue;
    edgeDegree.set(e.source, da+1); edgeDegree.set(e.target, db+1); edgeDrawn++;
    const pulseStride = compactCanvas ? 4 : 3;
    const pulseLimit = compactCanvas ? 24 : 72;
    const shouldPulse = edgeDrawn <= (fast ? Math.floor(pulseLimit * .75) : pulseLimit) && ((edgeDrawn + ((e.id || '').length % pulseStride)) % pulseStride === 0);
    drawSynapse(ctx,a,b,e,c,t,compactCanvas,shouldPulse);
  }
  ctx.globalAlpha=1; ctx.setLineDash([]);
  const hits=[];
  const labelBoxes=[];
  const nodeDegrees = new Map();
  constellationScene.edges.forEach(e => { nodeDegrees.set(e.source, (nodeDegrees.get(e.source) || 0) + 1); nodeDegrees.set(e.target, (nodeDegrees.get(e.target) || 0) + 1); });
  [...constellationScene.nodes].sort((a,b)=>(Number(a.z||0)-Number(b.z||0))).forEach(n => {
    const p=projected.get(n.id); if(!p) return;
    const drawn=drawNeuronSoma(ctx,n,p,c,t,compactCanvas,fast);
    const labelRaw=(n.label || '').replace(/^memory:/,'mem ');
    const compactRaw=labelRaw.trim();
    const alphaChars=(compactRaw.match(/[A-Za-z]/g) || []).length;
    const isHashLike=/^[a-f0-9]{10,}$/i.test(compactRaw) || /^mem\s+[a-f0-9]{6,}$/i.test(compactRaw);
    const isMachineToken=/^[A-Z0-9_:/.-]{14,}$/.test(compactRaw) && /[_:/.-]/.test(compactRaw);
    const degree=nodeDegrees.get(n.id) || 0;
    const weight=Math.max(1, Number(n.weight || n.count || 1));
    const showLabel = !isHashLike && !isMachineToken && alphaChars >= 4 && (compactCanvas ? (n.kind !== 'memory' && (weight > 7.2 || degree > 2)) : (degree > 1 || weight > 4.2 || n.kind !== 'memory'));
    if(showLabel){
      const label=/^[A-Z][A-Z_\s-]{2,}$/.test(labelRaw) ? labelRaw.toLowerCase().replace(/(^|[_\s-])([a-z])/g, (_m, sep, ch) => (sep === '_' ? ' ' : sep) + ch.toUpperCase()) : labelRaw;
      const short=label.length>22?label.slice(0,19)+'…':label;
      ctx.font=`${Math.round((compactCanvas ? 9 : 10) + Math.min(3,Math.sqrt(weight)))}px Inter, system-ui, sans-serif`;
      const lx=p.x+drawn.halo*.55+6, ly=p.y+4, tw=ctx.measureText(short).width;
      const box={x:lx-4,y:ly-14,w:tw+8,h:19};
      const onCanvas=box.x>=10 && box.x+box.w<=w-10 && box.y>=10 && box.y+box.h<=h-10;
      const collides=labelBoxes.some(b => !(box.x+box.w<b.x || b.x+b.w<box.x || box.y+box.h<b.y || b.y+b.h<box.y));
      if(onCanvas && !collides){ labelBoxes.push(box); ctx.lineWidth=5; ctx.strokeStyle=c.bg; ctx.fillStyle=c.text; ctx.globalAlpha=Math.min(.82,.40+p.scale*.32) * (p.alpha || 1); ctx.strokeText(short,lx,ly); ctx.fillText(short,lx,ly); ctx.globalAlpha=1; }
    }
    hits.push({x:p.x,y:p.y,r:Math.max(15,drawn.halo*.75),node:n});
  });
  constellationScene.hits=hits;
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) constellationScene.frame=requestAnimationFrame(drawVisualiserFrame);
}
function neuralColors(){
  const light = document.documentElement.dataset.theme === 'light';
  return light ? { light:true, bg:'#f7f0e7', core:'rgba(24,128,107,.18)', mid:'rgba(185,54,46,.12)', star:'#087f73', memory:'#c63e35', text:'#252220', synapse:'rgba(18,116,100,.34)', synapseHot:'rgba(8,126,106,.62)', memorySynapse:'rgba(190,54,46,.58)' } : { light:false, bg:'#06100f', core:'rgba(34,130,111,.28)', mid:'rgba(95,31,29,.40)', star:'#66e8c6', memory:'#ff5f57', text:'#f6fbf7', synapse:'rgba(82,214,181,.22)', synapseHot:'rgba(90,238,196,.52)', memorySynapse:'rgba(255,95,87,.58)' };
}
function updateVisualiserModeUI(){
  const mode = constellationScene.visualiserMode === 'neural' ? 'neural' : 'constellation';
  $$('.visualiser-tabs button').forEach(b => b.classList.toggle('active', b.dataset.visualiser === mode));
  const wrap = $('#constellationCanvas')?.parentElement;
  if(wrap) wrap.dataset.visualiser = mode;
  const legend = $('.constellation-legend');
  if(legend) legend.innerHTML = mode === 'neural'
    ? '<span><i class="legend-dot entity"></i>Neuron hub</span><span><i class="legend-dot memory"></i>Memory soma</span><span><i class="legend-line"></i>Synapse</span>'
    : '<span><i class="legend-dot entity"></i>Entity/topic</span><span><i class="legend-dot memory"></i>Memory</span><span><i class="legend-line"></i>Link</span>';
  const help = $('#visualiserHelp');
  if(help) help.textContent = mode === 'neural' ? (window.matchMedia('(max-width: 760px)').matches ? 'Drag to orbit · Pan mode to move · pinch to zoom · tap a neuron.' : 'Drag to orbit the neural cloud · Pan mode/Shift-drag to pan · wheel/pinch to zoom.') : 'Drag to rotate · Pan mode/Shift-drag to pan · wheel/pinch to zoom.';
  const pause = $('#constellationPause');
  if(pause){ pause.style.display = ''; pause.textContent = constellationScene.paused ? (mode === 'neural' ? 'Resume drift' : 'Resume rotation') : (mode === 'neural' ? 'Pause drift' : 'Pause rotation'); }
  const pan = $('#constellationPanMode');
  if(pan) pan.textContent = constellationScene.mode === 'pan' ? (mode === 'neural' ? 'Orbit mode' : 'Rotate mode') : 'Pan mode';
}
function switchVisualiserMode(mode){
  constellationScene.visualiserMode = mode === 'neural' ? 'neural' : 'constellation';
  localStorage.setItem(VISUALISER_MODE_KEY, constellationScene.visualiserMode);
  constellationScene.drag = null;
  constellationScene.pointers.clear();
  Object.assign(constellationScene, constellationScene.visualiserMode === 'neural' ? { rotation:.34, tilt:.38, zoom:1, panX:0, panY:0, mode:'rotate', lastFrameTime:0, renderLastTime:0 } : { ...CONSTELLATION_DEFAULT_CAMERA, mode:'rotate', lastFrameTime:0, renderLastTime:0 });
  updateVisualiserModeUI();
  if(constellationScene.data) drawConstellation(constellationScene.data);
}
function drawVisualiserFrame(t=0){
  const mode = constellationScene.visualiserMode === 'neural' ? 'neural' : 'constellation';
  const interval = 16;
  if(t && constellationScene.renderLastTime && t - constellationScene.renderLastTime < interval){
    constellationScene.frame = requestAnimationFrame(drawVisualiserFrame);
    return;
  }
  constellationScene.renderLastTime = t || 0;
  if(mode === 'neural') drawNeuralFrame(t);
  else drawConstellationFrame(t);
}
function drawConstellationFrame(t=0){
  const canvas = $('#constellationCanvas');
  if(!canvas) return;
  const wrap = canvas.parentElement;
  // Use content-box dimensions only. getBoundingClientRect() includes the
  // wrapper border; writing that value back to canvas.style.height creates a
  // per-frame growth loop on mobile.
  const w = Math.max(320, wrap.clientWidth || canvas.clientWidth || 1000);
  const h = Math.max(430, wrap.clientHeight || canvas.clientHeight || 680);
  const compactCanvas = w < 620;
  const dpr = visualiserDpr(compactCanvas, 'constellation');
  if(canvas.width !== Math.floor(w*dpr) || canvas.height !== Math.floor(h*dpr)){ canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr); }
  const ctx = canvas.getContext('2d');
  if(!constellationScene.paused && !constellationScene.drag){
    const delta = constellationScene.lastFrameTime ? Math.min(48, t - constellationScene.lastFrameTime) : 16;
    constellationScene.rotation += delta * 0.000065;
  }
  constellationScene.lastFrameTime = t;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const c = constellationColors();
  clampConstellationCamera(w, h);
  ctx.clearRect(0,0,w,h);
  const bg = ctx.createRadialGradient(w*.52,h*.44,20,w*.52,h*.44,Math.max(w,h)*.72);
  bg.addColorStop(0, compactCanvas ? 'rgba(101,214,255,.055)' : c.nebula); bg.addColorStop(.45, compactCanvas ? 'rgba(60,110,150,.018)' : 'rgba(72,130,160,.035)'); bg.addColorStop(1,c.bg);
  ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
  constellationScene.stars.forEach((s)=>{ const pulse=.42 + Math.sin(t*s.freq + s.phase)*.34 + Math.sin(t*s.freq*.37 + s.phase*1.9)*.18; ctx.globalAlpha=s.a*Math.max(.12, Math.min(1, pulse))*(c.light ? .48 : .78); ctx.fillStyle=c.text; ctx.beginPath(); ctx.arc(s.x*w, s.y*h, s.r*(c.light ? .72 : .9), 0, Math.PI*2); ctx.fill(); });
  ctx.globalAlpha=1;
  const projected = new Map();
  constellationScene.nodes.forEach(n => projected.set(n.id, projectConstellationNode(n,w,h,t)));
  const edgeDegree = new Map();
  let edgeDrawn = 0;
  const edgeLimit = compactCanvas ? 44 : 140;
  const degreeLimit = compactCanvas ? 2 : 4;
  for(const e of constellationScene.edges){
    const a=projected.get(e.source), b=projected.get(e.target);
    if(!a || !b || !a.visible || !b.visible) continue;
    if(edgeDrawn >= edgeLimit) break;
    const da=edgeDegree.get(e.source) || 0, db=edgeDegree.get(e.target) || 0;
    if(da >= degreeLimit || db >= degreeLimit) continue;
    edgeDegree.set(e.source, da+1); edgeDegree.set(e.target, db+1); edgeDrawn++;
    const depthAlpha = Math.min(c.light ? .58 : .58, Math.max(c.light ? .24 : .24, (a.scale+b.scale) / (c.light ? 5.4 : 5.2)));
    ctx.strokeStyle = e.kind === 'memory' ? c.memoryEdge : c.edge;
    ctx.globalAlpha = depthAlpha * (compactCanvas ? .74 : .92);
    ctx.lineWidth = (c.light ? .68 : .78) + Math.max(a.scale,b.scale) * (c.light ? .20 : .26);
    ctx.setLineDash(e.kind === 'memory' ? [5,7] : [4,8]);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.setLineDash([]);
  const hits=[];
  const labelBoxes=[];
  const compactLabels = compactCanvas;
  const nodeDegrees = new Map();
  constellationScene.edges.forEach(e => { nodeDegrees.set(e.source, (nodeDegrees.get(e.source) || 0) + 1); nodeDegrees.set(e.target, (nodeDegrees.get(e.target) || 0) + 1); });
  const labelCounts = new Map();
  const categoryCounts = new Map();
  constellationScene.nodes.forEach(n => {
    const key=(n.label || '').replace(/^memory:/,'mem ').trim().toLowerCase();
    if(key) labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
    const category=(n.category || '').trim().toLowerCase();
    if(category) categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  });
  [...constellationScene.nodes].sort((a,b)=>projected.get(a.id).z-projected.get(b.id).z).forEach(n => {
    const p=projected.get(n.id); if(!p?.visible) return;
    const base=n.kind === 'memory' ? c.memory : c.star;
    const pulse=1 + Math.sin(t*(n.twinkleFreq || .0017) + n.twinkle*6.28)*(n.twinkleAmp || .09) + Math.sin(t*(n.twinkleFreq || .0017)*.43 + n.twinkle*11.7)*((n.twinkleAmp || .09)*.48);
    const weight = Math.max(1, Number(n.weight || n.count || 1));
    const starR = Math.min(compactCanvas ? 3.2 : 4.6, Math.max(compactCanvas ? .85 : 1.05, (1 + Math.sqrt(weight)) * p.scale * (compactCanvas ? .42 : .54))) * pulse;
    const important = weight > 3.2 || n.kind === 'memory';
    const flare = Math.min(compactCanvas ? 8.5 : 12.5, starR * (important ? 2.45 : 1.65));
    const halo = Math.max(2.4, starR * (important ? 3.2 : 2.35));
    ctx.globalAlpha=Math.max(c.light ? .14 : .10, Math.min(compactCanvas ? .28 : .34, p.scale * (compactCanvas ? .18 : .24)));
    const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,halo);
    glow.addColorStop(0,'rgba(255,255,255,.92)'); glow.addColorStop(.18,base); glow.addColorStop(.62,base); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(p.x,p.y,halo,0,Math.PI*2); ctx.fill();
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate(t*.00012 + n.twinkle*Math.PI);
    ctx.shadowColor=base;
    ctx.shadowBlur=compactCanvas ? 3 : 5;
    ctx.strokeStyle=base;
    ctx.lineCap='round';
    const majorStar = weight > (compactCanvas ? 7.5 : 6.2) || (n.kind === 'memory' && weight > (compactCanvas ? 5.6 : 4.8));
    if(majorStar){
      ctx.globalAlpha=Math.max(.34, Math.min(.68, p.scale*.60));
      ctx.lineWidth=Math.max(.45, starR*.18);
      ctx.beginPath(); ctx.moveTo(-flare,0); ctx.lineTo(flare,0); ctx.moveTo(0,-flare); ctx.lineTo(0,flare); ctx.stroke();
      ctx.globalAlpha=Math.max(.16, Math.min(.36, p.scale*.32));
      ctx.lineWidth=Math.max(.35, starR*.13);
      const diag=flare*.45;
      ctx.beginPath(); ctx.moveTo(-diag,-diag); ctx.lineTo(diag,diag); ctx.moveTo(-diag,diag); ctx.lineTo(diag,-diag); ctx.stroke();
    }
    ctx.shadowBlur=compactCanvas ? 5 : 7;
    ctx.globalAlpha=.96;
    ctx.fillStyle='rgba(255,255,255,.98)';
    ctx.beginPath(); ctx.arc(0,0,Math.max(.62, starR*.52),0,Math.PI*2); ctx.fill();
    ctx.fillStyle=base;
    ctx.globalAlpha=.72;
    ctx.beginPath(); ctx.arc(0,0,Math.max(.28, starR*.20),0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    ctx.restore();
    const labelRaw=(n.label || '').replace(/^memory:/,'mem ');
    const labelKey=labelRaw.trim().toLowerCase();
    const compactRaw=labelRaw.trim();
    const alphaChars=(compactRaw.match(/[A-Za-z]/g) || []).length;
    const isHashLike=/^[a-f0-9]{10,}$/i.test(compactRaw) || /^mem\s+[a-f0-9]{6,}$/i.test(compactRaw);
    const isMachineToken=/^[A-Z0-9_:/.-]{14,}$/.test(compactRaw) && /[_:/.-]/.test(compactRaw);
    const isDateLike=/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(compactRaw);
    const lowInformation=alphaChars < 4;
    const technicalLabel=isHashLike || isMachineToken || isDateLike || lowInformation;
    const degree = nodeDegrees.get(n.id) || 0;
    const frequency = labelCounts.get(labelKey) || 1;
    const categoryFrequency = categoryCounts.get((n.category || '').trim().toLowerCase()) || 1;
    const dominantCategory = categoryFrequency > constellationScene.nodes.length * .35;
    const shoutingDominantToken = /^[A-Z]{4,}$/.test(compactRaw) && dominantCategory;
    const specificity = Math.max(.35, Math.min(1.15, 1 / Math.sqrt(frequency)));
    const categorySpecificity = Math.max(.05, Math.min(1.10, Math.log1p(constellationScene.nodes.length / categoryFrequency) / 2.4));
    const lengthQuality = Math.max(.25, Math.min(1.1, (alphaChars - 2) / 8));
    const labelScore = (p.scale * 2.05) + (Math.log1p(weight) * .52) + (Math.log1p(degree) * .38) + specificity + categorySpecificity + lengthQuality + (n.kind === 'memory' ? .15 : 0) - (shoutingDominantToken ? 1.25 : 0);
    const showLabel = !technicalLabel && (compactLabels ? labelScore > 4.15 : labelScore > 3.95);
    if(showLabel){
      const label=/^[A-Z][A-Z_\s-]{2,}$/.test(labelRaw) ? labelRaw.toLowerCase().replace(/(^|[_\s-])([a-z])/g, (_m, sep, ch) => (sep === '_' ? ' ' : sep) + ch.toUpperCase()) : labelRaw;
      const short=label.length>22?label.slice(0,19)+'…':label;
      ctx.font=`${Math.round((compactLabels ? 9 : 10) + p.scale*2.5)}px Inter, system-ui, sans-serif`;
      const lx=p.x+flare+6, ly=p.y+4, tw=ctx.measureText(short).width;
      const labelPad = compactLabels ? 4 : 4;
      const box={x:lx-labelPad,y:ly-(compactLabels ? 13 : 14),w:tw+labelPad*2,h:compactLabels ? 18 : 19};
      const onCanvas=box.x>=10 && box.x+box.w<=w-10 && box.y>=10 && box.y+box.h<=h-10;
      const collides=labelBoxes.some(b => !(box.x+box.w<b.x || b.x+b.w<box.x || box.y+box.h<b.y || b.y+b.h<box.y));
      if(onCanvas && !collides){ labelBoxes.push(box); ctx.lineWidth=5; ctx.strokeStyle=c.bg; ctx.fillStyle=c.text; ctx.globalAlpha=Math.min(.78,.30+p.scale*.42); ctx.strokeText(short,lx,ly); ctx.fillText(short,lx,ly); ctx.globalAlpha=1; }
    }
    hits.push({x:p.x,y:p.y,r:Math.max(14,flare+8),node:n});
  });
  constellationScene.hits=hits;
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) constellationScene.frame=requestAnimationFrame(drawVisualiserFrame);
}
function clampConstellationCamera(w, h){
  constellationScene.zoom = Math.max(CONSTELLATION_MIN_ZOOM, Math.min(CONSTELLATION_MAX_ZOOM, Number.isFinite(constellationScene.zoom) ? constellationScene.zoom : 1));
  constellationScene.rotation = Number.isFinite(constellationScene.rotation) ? constellationScene.rotation : 0;
  constellationScene.tilt = Math.max(-1.05, Math.min(1.05, Number.isFinite(constellationScene.tilt) ? constellationScene.tilt : .35));
  const panLimitX = Math.max(80, w * (.24 + constellationScene.zoom * .22));
  const panLimitY = Math.max(90, h * (.16 + constellationScene.zoom * .14));
  constellationScene.panX = Math.max(-panLimitX, Math.min(panLimitX, Number.isFinite(constellationScene.panX) ? constellationScene.panX : 0));
  constellationScene.panY = Math.max(-panLimitY, Math.min(panLimitY, Number.isFinite(constellationScene.panY) ? constellationScene.panY : 0));
}
function resetConstellationView(){
  Object.assign(constellationScene, constellationScene.visualiserMode === 'neural' ? { rotation:.34, tilt:.38, zoom:1, panX:0, panY:0, mode:'rotate', drag:null, lastFrameTime:0, renderLastTime:0 } : { ...CONSTELLATION_DEFAULT_CAMERA, mode:'rotate', drag:null, lastFrameTime:0, renderLastTime:0 });
  constellationScene.pointers.clear();
  updateConstellationPauseButton();
  updateConstellationPanButton();
  updateVisualiserModeUI();
}
function updateConstellationPauseButton(){
  const btn = $('#constellationPause');
  if(btn) btn.textContent = constellationScene.paused ? (constellationScene.visualiserMode === 'neural' ? 'Resume drift' : 'Resume rotation') : (constellationScene.visualiserMode === 'neural' ? 'Pause drift' : 'Pause rotation');
}
function updateConstellationPanButton(){
  const btn = $('#constellationPanMode');
  if(btn) btn.textContent = constellationScene.mode === 'pan' ? (constellationScene.visualiserMode === 'neural' ? 'Orbit mode' : 'Rotate mode') : 'Pan mode';
}
function toggleConstellationPanMode(){
  constellationScene.mode = constellationScene.mode === 'pan' ? 'rotate' : 'pan';
  updateConstellationPanButton();
}
function toggleConstellationPause(){
  constellationScene.paused = !constellationScene.paused;
  constellationScene.lastFrameTime = 0;
  updateConstellationPauseButton();
}
function zoomConstellation(factor, cx, cy){
  constellationScene.lastInteraction = performance.now();
  const canvas = $('#constellationCanvas');
  if(!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const oldZoom = constellationScene.zoom;
  const nextZoom = Math.max(CONSTELLATION_MIN_ZOOM, Math.min(CONSTELLATION_MAX_ZOOM, oldZoom * factor));
  if(Math.abs(nextZoom - oldZoom) < .001) return;
  const x = cx - rect.left - rect.width/2 - constellationScene.panX;
  const y = cy - rect.top - rect.height/2 - constellationScene.panY;
  const ratio = nextZoom / oldZoom;
  constellationScene.panX -= x * (ratio - 1);
  constellationScene.panY -= y * (ratio - 1);
  constellationScene.zoom = nextZoom;
  clampConstellationCamera(rect.width, rect.height);
}
function bindConstellationControls(canvas){
  if(canvas.dataset.controlsBound === 'true') return;
  canvas.dataset.controlsBound = 'true';
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoomConstellation(Math.exp(-e.deltaY * 0.0012), e.clientX, e.clientY);
  }, { passive:false });
  canvas.addEventListener('pointerdown', e => {
    constellationScene.lastInteraction = performance.now();
    if(e.cancelable) e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch(_err) {}
    constellationScene.pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(constellationScene.pointers.size === 2){
      const pts=[...constellationScene.pointers.values()];
      constellationScene.drag = { mode:'pinch', dist:Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y), midX:(pts[0].x+pts[1].x)/2, midY:(pts[0].y+pts[1].y)/2, zoom:constellationScene.zoom, panX:constellationScene.panX, panY:constellationScene.panY };
      return;
    }
    constellationScene.drag = { mode:(constellationScene.mode === 'pan' || e.shiftKey || e.button === 1 || e.button === 2) ? 'pan' : 'rotate', x:e.clientX, y:e.clientY, rotation:constellationScene.rotation, tilt:constellationScene.tilt, panX:constellationScene.panX, panY:constellationScene.panY, moved:false };
  });
  canvas.addEventListener('pointermove', e => {
    if(constellationScene.drag) constellationScene.lastInteraction = performance.now();
    if(constellationScene.drag && e.cancelable) e.preventDefault();
    if(constellationScene.pointers.has(e.pointerId)) constellationScene.pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
    const d = constellationScene.drag;
    if(!d) return;
    if(d.mode === 'pinch'){
      if(constellationScene.pointers.size < 2) return;
      const pts=[...constellationScene.pointers.values()];
      const dist=Math.max(1, Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y));
      const midX=(pts[0].x+pts[1].x)/2, midY=(pts[0].y+pts[1].y)/2;
      constellationScene.zoom = Math.max(CONSTELLATION_MIN_ZOOM, Math.min(CONSTELLATION_MAX_ZOOM, d.zoom * (dist / Math.max(1, d.dist))));
      constellationScene.panX = d.panX + (midX - d.midX);
      constellationScene.panY = d.panY + (midY - d.midY);
      clampConstellationCamera(canvas.clientWidth || canvas.getBoundingClientRect().width, canvas.clientHeight || canvas.getBoundingClientRect().height);
      return;
    }
    const dx=e.clientX-d.x, dy=e.clientY-d.y;
    if(Math.abs(dx)+Math.abs(dy) > 3) d.moved = true;
    if(d.mode === 'pan'){
      constellationScene.panX = d.panX + dx;
      constellationScene.panY = d.panY + dy;
      canvas.style.cursor = 'grabbing';
    } else {
      constellationScene.rotation = d.rotation + dx * 0.008;
      constellationScene.tilt = Math.max(-1.05, Math.min(1.05, d.tilt + dy * 0.006));
      canvas.style.cursor = 'grabbing';
    }
  });
  const endPointer = e => {
    constellationScene.pointers.delete(e.pointerId);
    if(constellationScene.pointers.size === 0){
      if(constellationScene.drag?.moved) canvas.dataset.suppressClick = 'true';
      constellationScene.drag = null;
      constellationScene.lastInteraction = performance.now();
      canvas.style.cursor = 'grab';
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
}
function drawConstellation(data){
  if(constellationScene.frame) cancelAnimationFrame(constellationScene.frame);
  constellationScene.frame = 0;
  constellationScene.renderLastTime = 0;
  if(constellationScene.visualiserMode === 'neural') buildNeuralMapScene(data); else buildConstellationScene(data);
  updateVisualiserModeUI();
  const canvas = $('#constellationCanvas');
  bindConstellationControls(canvas);
  canvas.onclick = e => { if(canvas.dataset.suppressClick === 'true'){ canvas.dataset.suppressClick = 'false'; return; } const rect=canvas.getBoundingClientRect(); const x=e.clientX-rect.left, y=e.clientY-rect.top; const hit=[...constellationScene.hits].reverse().find(h => Math.hypot(h.x-x,h.y-y) <= h.r); if(hit) inspectConstellationNode(hit.node); };
  canvas.onpointermove = e => { if(constellationScene.drag) return; const rect=canvas.getBoundingClientRect(); const x=e.clientX-rect.left, y=e.clientY-rect.top; canvas.style.cursor = constellationScene.hits.some(h => Math.hypot(h.x-x,h.y-y) <= h.r) ? 'pointer' : 'grab'; };
  $('#constellationClusters').innerHTML = (data.clusters || []).map(c => `<span class="cluster-pill">${esc(c.label)} <strong>${Number(c.count).toLocaleString()}</strong></span>`).join('');
  constellationInspectorDefault();
  drawVisualiserFrame(0);
}
async function loadConstellation(){ drawConstellation(await api('/api/constellation?limit=240')); }
async function loadDiagnostics(){
  const diag = await api('/api/diagnostics');
  const counts = diag.table_counts || {};
  const core = ['working_memory','episodic_memory','triples','consolidation_log'].filter(t => t in counts);
  $('#diagnosticsSummary').innerHTML = `
    <div class="diag-row"><span>Status</span><strong>${diag.ok ? 'OK' : 'Needs attention'}</strong></div>
    <div class="diag-row"><span>DB path</span><strong title="${esc(diag.db_path)}">${esc(diag.db_path)}</strong></div>
    <div class="diag-row"><span>Readable</span><strong>${diag.readable ? 'yes' : 'no'}</strong></div>
    <div class="diag-row"><span>Size</span><strong>${fmtBytes(diag.size_bytes)}</strong></div>
    <div class="diag-row"><span>Last modified</span><strong>${esc(diag.modified_at || 'n/a')}</strong></div>
    <div class="diag-row"><span>Tables</span><strong>${esc((diag.tables || []).length)}</strong></div>
    <div class="diag-row wide"><span>Core rows</span><strong>${core.map(t => `${t}: ${Number(counts[t] || 0).toLocaleString()}`).join(' · ') || 'none'}</strong></div>`;
  $('#diagnosticsStatus').textContent = diag.error || ((diag.missing_expected_tables || []).length ? `Missing expected tables: ${diag.missing_expected_tables.join(', ')}` : 'Database looks healthy.');
  window.lastDiagnostics = diag;
}
async function copyDiagnostics(){
  if(!window.lastDiagnostics) await loadDiagnostics();
  showSelectableCopy('Diagnostics JSON', JSON.stringify(window.lastDiagnostics, null, 2));
}
async function refreshAuthState(){
  authState = await api('/api/auth/status');
  return authState;
}
async function loadAuthStatus(){
  const data = await refreshAuthState();
  const cfg = data.config || {};
  $('#configHost').value = cfg.host || '';
  $('#configPort').value = cfg.port || '';
  $('#configDbPath').value = cfg.db_path || '';
  const urls = [`This Mac: ${cfg.local_url || ''}`];
  if (cfg.lan_url) urls.push(`LAN: ${cfg.lan_url}`);
  $('#configStatus').textContent = `Current access URLs — ${urls.join(' · ')}`;
  authState = data;
  $('#authEnabled').checked = !!data.auth_enabled;
  $('#authStatus').textContent = data.has_password ? 'Password is set.' : 'No password set.';
  $('#memoryAdminEnabled').checked = !!cfg.memory_admin_enabled;
  $('#memoryAdminStatus').textContent = cfg.memory_admin_enabled ? (['127.0.0.1','localhost','::1'].includes(cfg.host || '0.0.0.0') ? 'Local-only admin mode is enabled. Mutations are audited; password is only required for LAN/non-local hosts.' : 'Admin maintenance mode is enabled. LAN/non-local mutations require password auth and are audited.') : 'Admin maintenance mode is disabled; dashboard is read-only.';
}

function graphInspectorDefault(){
  $('#graphInspector').innerHTML = `<div class="inspector-kicker">Graph inspector</div><h3>Nothing selected</h3><p class="muted">Pick a node or edge to inspect connected triples, then jump into the Triples table.</p>`;
}
function inspectNode(node){
  const connected = graphState.edges.filter(e => e.source === node.id || e.target === node.id);
  $$('.node, .edge, .edgeLabel').forEach(x => x.classList.remove('selected','dim'));
  $$('.node').forEach(x => { if(x.dataset.id !== node.id) x.classList.add('dim'); });
  connected.forEach(e => {
    const edgeEl = document.querySelector(`.edge[data-id="${CSS.escape(e.id)}"]`);
    const labelEl = document.querySelector(`.edgeLabel[data-id="${CSS.escape(e.id)}"]`);
    if(edgeEl) edgeEl.classList.add('selected');
    if(labelEl) labelEl.classList.add('selected');
  });
  const rows = connected.slice(0,12).map(e => `<button class="inspector-row" data-edge="${esc(e.id)}"><strong>${esc(e.predicate)}</strong><span>${esc(e.subject)} → ${esc(e.object)}</span></button>`).join('');
  $('#graphInspector').innerHTML = `<div class="inspector-kicker">Selected node</div><h3>${esc(node.label)}</h3><p class="muted">${connected.length} connected triple${connected.length === 1 ? '' : 's'}.</p><div class="inspector-actions"><button id="graphFilterTriples" class="primary tiny">Show in Triples</button><button id="graphSearchMemories" class="tiny">Search memories</button></div><div class="inspector-list">${rows || '<p class="muted">No connected edges.</p>'}</div>`;
  $('#graphFilterTriples').onclick = () => { $('#tripleQuery').value = node.label; switchTab('triples'); };
  $('#graphSearchMemories').onclick = () => { $('#memoryQuery').value = node.label; switchTab('memories'); };
  $$('#graphInspector .inspector-row').forEach(btn => btn.onclick = () => inspectEdge(graphState.edges.find(e => e.id === btn.dataset.edge)));
}
function inspectEdge(edge){
  if(!edge) return;
  $$('.node, .edge, .edgeLabel').forEach(x => x.classList.remove('selected','dim'));
  $$('.edge').forEach(x => { if(x.dataset.id !== edge.id) x.classList.add('dim'); });
  const edgeEl = document.querySelector(`.edge[data-id="${CSS.escape(edge.id)}"]`);
  const labelEl = document.querySelector(`.edgeLabel[data-id="${CSS.escape(edge.id)}"]`);
  if(edgeEl) edgeEl.classList.add('selected');
  if(labelEl) labelEl.classList.add('selected');
  $('#graphInspector').innerHTML = `<div class="inspector-kicker">Selected triple</div><h3>${esc(edge.predicate)}</h3><p><strong>${esc(edge.subject)}</strong> → <strong>${esc(edge.object)}</strong></p><p class="muted">Confidence: ${esc(edge.confidence ?? 'n/a')} · ${esc(edge.created_at || edge.valid_from || '')}</p><div class="inspector-actions"><button id="edgeDetail" class="primary tiny">Inspect JSON</button><button id="edgeTriples" class="tiny">Show in Triples</button></div>`;
  $('#edgeDetail').onclick = () => showDetail(edge, 'Triple edge detail');
  $('#edgeTriples').onclick = () => { $('#tripleQuery').value = `${edge.subject} ${edge.predicate} ${edge.object}`; switchTab('triples'); };
}
function applyGraphView(){
  const vp = $('#graphViewport');
  if(vp) vp.setAttribute('transform', `translate(${graphView.x} ${graphView.y}) scale(${graphView.scale})`);
}
function resetGraphView(){ graphView = { scale:1, x:0, y:0, dragging:false, sx:0, sy:0, ox:0, oy:0 }; applyGraphView(); }
function bindGraphPanZoom(){
  const svg = $('#graphSvg');
  if(!svg || svg.dataset.panzoomBound) return;
  svg.dataset.panzoomBound = '1';
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width * 1000;
    const py = (e.clientY - rect.top) / rect.height * 650;
    const old = graphView.scale;
    const next = Math.max(0.35, Math.min(4, old * (e.deltaY < 0 ? 1.12 : 0.88)));
    graphView.x = px - (px - graphView.x) * (next / old);
    graphView.y = py - (py - graphView.y) * (next / old);
    graphView.scale = next;
    applyGraphView();
  }, { passive:false });
  svg.addEventListener('pointerdown', e => { if(e.target.closest('.node,.edge,.edgeLabel')) return; graphView.dragging = true; graphView.sx = e.clientX; graphView.sy = e.clientY; graphView.ox = graphView.x; graphView.oy = graphView.y; svg.setPointerCapture(e.pointerId); svg.classList.add('panning'); });
  svg.addEventListener('pointermove', e => { if(!graphView.dragging) return; graphView.x = graphView.ox + (e.clientX - graphView.sx); graphView.y = graphView.oy + (e.clientY - graphView.sy); applyGraphView(); });
  svg.addEventListener('pointerup', e => { graphView.dragging = false; svg.classList.remove('panning'); try{ svg.releasePointerCapture(e.pointerId); }catch{} });
  svg.addEventListener('pointerleave', () => { graphView.dragging = false; svg.classList.remove('panning'); });
}
function drawGraph(g){
  const svg = $('#graphSvg'); svg.innerHTML = '';
  graphState = { ...g, byId: Object.fromEntries(g.nodes.map(n => [n.id, n])) };
  svg.insertAdjacentHTML('afterbegin', `<defs><linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#65d6ff" stop-opacity=".25"/><stop offset="55%" stop-color="#7c7cff" stop-opacity=".78"/><stop offset="100%" stop-color="#ffd166" stop-opacity=".35"/></linearGradient></defs><g id="graphViewport"></g>`);
  const vp = $('#graphViewport');
  const w=1000,h=650,cx=w/2,cy=h/2,r=260;
  const nodes = g.nodes.slice(0,160).map((n,i,a)=>({...n,x:cx+Math.cos(i/a.length*Math.PI*2)*r*(.65+((i%5)/10)),y:cy+Math.sin(i/a.length*Math.PI*2)*r*(.65+((i%7)/14))}));
  const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
  graphState.nodes = nodes; graphState.byId = byId;
  const edges = g.edges.filter(e=>byId[e.source]&&byId[e.target]).slice(0,300);
  graphState.edges = edges;
  if(!nodes.length){ svg.insertAdjacentHTML('beforeend', '<text x="500" y="325" text-anchor="middle" class="nodeText">No triples match this graph filter.</text>'); graphInspectorDefault(); bindGraphPanZoom(); return; }
  for(const e of edges){ const s=byId[e.source], t=byId[e.target];
    const line = document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',s.x);line.setAttribute('y1',s.y);line.setAttribute('x2',t.x);line.setAttribute('y2',t.y);line.setAttribute('class','edge'); line.dataset.id = e.id; line.onclick = () => inspectEdge(e); vp.appendChild(line);
    const label = document.createElementNS('http://www.w3.org/2000/svg','text'); label.textContent=e.predicate; label.setAttribute('x',(s.x+t.x)/2);label.setAttribute('y',(s.y+t.y)/2);label.setAttribute('class','edgeLabel'); label.dataset.id = e.id; label.onclick = () => inspectEdge(e); vp.appendChild(label);
  }
  for(const n of nodes){
    const c=document.createElementNS('http://www.w3.org/2000/svg','circle'); c.setAttribute('cx',n.x);c.setAttribute('cy',n.y);c.setAttribute('r',Math.min(14, 6 + Math.sqrt(n.count || 1)));c.setAttribute('class','node'); c.dataset.id = n.id; c.onclick = () => inspectNode(n); vp.appendChild(c);
    const text=document.createElementNS('http://www.w3.org/2000/svg','text'); text.textContent=n.label.length>38?n.label.slice(0,35)+'…':n.label; text.setAttribute('x',n.x+12);text.setAttribute('y',n.y+4);text.setAttribute('class','nodeText'); text.dataset.id = n.id; text.onclick = () => inspectNode(n); vp.appendChild(text);
  }
  resetGraphView();
  bindGraphPanZoom();
  graphInspectorDefault();
  centerGraphOnMobile();
}
function centerGraphOnMobile(){
  const wrap = document.querySelector('.graph-wrap');
  if(!wrap || !window.matchMedia('(max-width: 760px)').matches) return;
  requestAnimationFrame(() => {
    wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2);
  });
}
async function loadGraph(){
  const q = encodeURIComponent($('#graphQuery')?.value.trim() || '');
  drawGraph(await api(`/api/graph?q=${q}&limit=300`));
}


let threeModulePromise = null;
let threeVis = {
  mode: 'constellation', data: null, renderer: null, scene: null, camera: null, group: null,
  nodes: [], edgePairs: [], labels: [], pulses: [], frame: 0, paused: false, panMode: false,
  drag: null, pointer: new Map(), yaw: 0, pitch: 0.32, cameraZ: 780, panX: 0, panY: 0, lastT: 0
};
function loadThreeModule(){
  if(!threeModulePromise) threeModulePromise = import('/static/vendor/three.module.min.js');
  return threeModulePromise;
}
function threeInspectorDefault(){
  const mode = threeVis.mode === 'neural' ? 'Neural Map 3D' : 'Constellation 3D';
  $('#threeInspector').innerHTML = `<div class="inspector-kicker">${mode} inspector</div><h3>Nothing selected</h3><p class="muted">Pick a GPU-rendered point or link to inspect the underlying read-only source.</p>`;
}
function inspectThreeNode(node){
  const mode = threeVis.mode === 'neural' ? 'Neural Map 3D' : 'Constellation 3D';
  $('#threeInspector').innerHTML = `<div class="inspector-kicker">${mode} · ${esc(node.kind || 'entity')}</div><h3>${esc(node.label)}</h3><p class="muted">${esc(node.category || 'Other')} · ${Number(node.count || 0).toLocaleString()} signal(s) · weight ${Number(node.weight || 0).toFixed(2)}</p>${node.preview ? `<p>${esc(node.preview)}</p>` : ''}<div class="inspector-actions">${node.memory_id ? '<button id="threeMemory" class="primary tiny">Open memory</button>' : ''}<button id="threeSearch" class="tiny">Search this</button></div>`;
  if(node.memory_id) $('#threeMemory').onclick = () => openMemoryDetail(node.memory_id);
  $('#threeSearch').onclick = () => { $('#memoryQuery').value = String(node.label || '').replace(/^memory:/,''); switchTab('memories'); };
}
function updateThreeUI(){
  $$('.visualiser-tabs button[data-three-mode]').forEach(b => b.classList.toggle('active', b.dataset.threeMode === threeVis.mode));
  const viewport = $('#threeViewport'); if(viewport) viewport.dataset.threeMode = threeVis.mode;
  const legend = $('#threeLegend');
  if(legend) legend.innerHTML = threeVis.mode === 'neural'
    ? '<span><i class="legend-dot entity"></i>Neuron hub</span><span><i class="legend-dot memory"></i>Memory soma</span><span><i class="legend-line"></i>Synapse</span>'
    : '<span><i class="legend-dot entity"></i>Entity/topic</span><span><i class="legend-dot memory"></i>Memory</span><span><i class="legend-line"></i>Link</span>';
  const help = $('#threeHelp'); if(help) help.textContent = threeVis.mode === 'neural' ? 'GPU/WebGL neural cloud · drag to orbit · wheel/pinch to zoom · click to inspect.' : 'GPU/WebGL star map · drag to orbit · wheel/pinch to zoom · click to inspect.';
  const pause = $('#threePause'); if(pause) pause.textContent = threeVis.paused ? 'Resume drift' : 'Pause drift';
  const pan = $('#threePanMode'); if(pan) pan.textContent = threeVis.panMode ? 'Orbit mode' : 'Pan mode';
}
function resetThreeCamera(){ Object.assign(threeVis, { yaw: threeVis.mode === 'neural' ? .12 : .55, pitch: threeVis.mode === 'neural' ? .10 : .78, cameraZ: threeVis.mode === 'neural' ? 600 : 840, panX:0, panY: threeVis.mode === 'neural' ? -10 : 0, lastT:0 }); }
function clearThreeScene(){
  if(threeVis.frame) cancelAnimationFrame(threeVis.frame);
  threeVis.frame = 0;
  if(threeVis.renderer){ threeVis.renderer.dispose(); threeVis.renderer.domElement.remove(); }
  $('#threeLabels').innerHTML = '';
  Object.assign(threeVis, { renderer:null, scene:null, camera:null, group:null, nodes:[], edgePairs:[], labels:[], pulses:[] });
}
function cssHexToInt(hex){
  const m = String(hex || '').match(/^#([0-9a-f]{6})$/i);
  return m ? parseInt(m[1], 16) : 0xffffff;
}
function colorForTheme(){
  const c = threeVis.mode === 'neural' ? neuralColors() : constellationColors();
  return {
    bg: cssHexToInt(c.bg),
    entity: cssHexToInt(c.star),
    memory: cssHexToInt(c.memory),
    link: cssHexToInt(threeVis.mode === 'neural' ? (c.light ? '#127464' : '#52d6b5') : (c.light ? '#19416c' : '#c6e0ff')),
    pulse: cssHexToInt(threeVis.mode === 'neural' ? (c.light ? '#6f6048' : '#fffaf0') : c.memory),
    text: c.text,
    light: c.light
  };
}
function makePointTexture(THREE, kind){
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const cx=64, cy=64;
  if(kind === 'star'){
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,60);
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(.28,'rgba(255,255,255,.92)');
    g.addColorStop(.58,'rgba(255,255,255,.38)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,60,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.72)'; ctx.lineWidth=1.3;
    ctx.beginPath(); ctx.moveTo(cx,14); ctx.lineTo(cx,114); ctx.moveTo(14,cy); ctx.lineTo(114,cy); ctx.stroke();
  } else if(kind === 'neuron') {
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,62);
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(.13,'rgba(255,255,255,.94)');
    g.addColorStop(.42,'rgba(255,255,255,.28)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,61,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.70)'; ctx.lineCap='round'; ctx.lineJoin='round';
    for(let i=0;i<9;i++){
      const a=(i/9)*Math.PI*2 + .13;
      const len=22 + (i%4)*4;
      const fork=len*.62;
      const sx=cx+Math.cos(a)*13, sy=cy+Math.sin(a)*13;
      const mx=cx+Math.cos(a+.10*Math.sin(i))*fork, my=cy+Math.sin(a+.10*Math.sin(i))*fork;
      const ex=cx+Math.cos(a)*len, ey=cy+Math.sin(a)*len;
      ctx.lineWidth=i%3===0?2.25:1.45;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.quadraticCurveTo(mx,my,ex,ey); ctx.stroke();
      ctx.lineWidth=.9;
      ctx.globalAlpha=.72;
      ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(cx+Math.cos(a+.38)*len*.66,cy+Math.sin(a+.38)*len*.66); ctx.stroke();
      if(i%3===0){ ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(cx+Math.cos(a-.34)*len*.60,cy+Math.sin(a-.34)*len*.60); ctx.stroke(); }
      ctx.globalAlpha=1;
    }
    ctx.fillStyle='rgba(255,255,255,.98)'; ctx.beginPath(); ctx.arc(cx,cy,34,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.54)'; ctx.beginPath(); ctx.arc(cx-8,cy-9,8,0,Math.PI*2); ctx.fill();
  } else if(kind === 'soma') {
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,62);
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(.18,'rgba(255,255,255,.96)');
    g.addColorStop(.42,'rgba(255,255,255,.34)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,62,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.68)'; ctx.lineCap='round'; ctx.lineWidth=1.55;
    for(let i=0;i<5;i++){
      const a=(i/5)*Math.PI*2+.22, len=21+(i%2)*4;
      ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*18,cy+Math.sin(a)*18); ctx.lineTo(cx+Math.cos(a)*len,cy+Math.sin(a)*len); ctx.stroke();
    }
    ctx.lineWidth=3.4; ctx.beginPath(); ctx.arc(cx,cy,40,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,1)'; ctx.beginPath(); ctx.arc(cx,cy,35,0,Math.PI*2); ctx.fill();
  } else {
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,60);
    g.addColorStop(0,'rgba(255,255,255,1)');
    g.addColorStop(.44,'rgba(255,255,255,.82)');
    g.addColorStop(.78,'rgba(255,255,255,.22)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,60,0,Math.PI*2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
function buildThreePositions(data){
  if(threeVis.mode === 'neural') return buildThreeNeuralPositions(data);
  const nodes = (data.nodes || []).slice(0,160).map(n => ({...n}));
  const categories = [...new Set(nodes.map(n => n.category || 'Other'))];
  const catIndex = Object.fromEntries(categories.map((c,i)=>[c,i]));
  nodes.forEach((n,i) => {
    const ci = catIndex[n.category || 'Other'] || 0;
    const angle = (i / Math.max(nodes.length,1)) * Math.PI * 2 + ci * .62;
    const band = n.kind === 'memory' ? 1.28 : .72 + (ci % 4) * .16;
    const radius = 250 * band + (i % 7) * 16;
    const weight = Math.max(1, Number(n.weight || n.count || 1));
    n.x = Math.cos(angle) * radius;
    n.y = Math.sin(angle * 1.23) * (100 + (ci % 5) * 24) + (((i * 53) % 131) - 65) * .82;
    n.z = Math.sin(angle) * radius * .82 + (((i * 97) % 181) - 90) * 1.55 + ((ci % 5) - 2) * 42;
    n.size = Math.min(22, 4 + Math.sqrt(weight)*3.4) * (n.kind === 'memory' ? 1.08 : 1);
    n._degree = 0; n._weight = weight;
  });
  return nodes;
}
function buildThreeNeuralPositions(data){
  const nodes = (data.nodes || []).slice(0,170).map(n => ({...n}));
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = (data.edges || []).filter(e => nodeIds.has(e.source) && nodeIds.has(e.target)).slice(0,340);
  const categories = [...new Set(nodes.map(n => n.category || 'Other'))];
  const catIndex = Object.fromEntries(categories.map((c,i)=>[c,i]));
  const regionCount = Math.max(1, categories.length);
  const regions = Object.fromEntries(categories.map((cat, i) => {
    const angle = -Math.PI / 2 + (i / regionCount) * Math.PI * 2;
    const radius = regionCount <= 2 ? 86 : (i === regionCount - 1 && regionCount > 5 ? 70 : 142 + (i % 2) * 18);
    const lap = Math.floor(i / Math.max(1, regionCount));
    return [cat, {
      label:cat,
      angle,
      cx:Math.cos(angle) * radius + lap * 18,
      cy:Math.sin(angle) * radius * .96,
      cz:((i * 41) % 89 - 44) * .72,
      spread:94 + (i % 4) * 10
    }];
  }));
  const degree = new Map();
  edges.forEach(e => { degree.set(e.source, (degree.get(e.source) || 0) + 1); degree.set(e.target, (degree.get(e.target) || 0) + 1); });
  const hubsByCategory = {};
  nodes.filter(n => n.kind !== 'memory').sort((a,b)=>(Number(b.weight || b.count || 0)+ (degree.get(b.id)||0)) - (Number(a.weight || a.count || 0)+(degree.get(a.id)||0))).forEach(n => {
    const cat = n.category || 'Other'; if(!hubsByCategory[cat]) hubsByCategory[cat] = []; hubsByCategory[cat].push(n);
  });
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  nodes.forEach((n,i) => {
    const cat = n.category || 'Other';
    const region = regions[cat] || regions.Other || { cx:0, cy:0, cz:0, angle:0, spread:80 };
    const ci = catIndex[cat] || 0;
    const weight = Math.max(1, Number(n.weight || n.count || 1));
    const d = degree.get(n.id) || 0;
    if(n.kind === 'memory'){
      const linked = edges.find(e => e.source === n.id || e.target === n.id);
      const parent = linked ? byId[linked.source === n.id ? linked.target : linked.source] : null;
      const parentX = parent && parent.kind !== 'memory' && Number.isFinite(parent.x) ? parent.x : region.cx;
      const parentY = parent && parent.kind !== 'memory' && Number.isFinite(parent.y) ? parent.y : region.cy;
      const parentZ = parent && parent.kind !== 'memory' && Number.isFinite(parent.z) ? parent.z : region.cz;
      const branch = ((i * 137.508 + ci * 19) % 360) * Math.PI / 180;
      const yUnit = ((((i * 43 + ci * 17) % 97) + .5) / 97) * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
      const dist = 46 + (i % 6) * 13 + Math.min(48, Math.sqrt(weight) * 10);
      n.x = parentX + Math.cos(branch) * radial * dist;
      n.y = parentY + yUnit * dist * .82;
      n.z = parentZ + Math.sin(branch) * radial * dist * .86;
    } else {
      const rank = Math.max(0, (hubsByCategory[cat] || []).indexOf(n));
      const orbit = rank === 0 ? 0 : 30 + Math.sqrt(rank) * 20;
      const angle = region.angle + rank * 2.399963 + (ci % 3) * .24;
      const yUnit = rank === 0 ? 0 : ((((rank * 37 + ci * 11) % 89) + .5) / 89) * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
      n.x = region.cx + Math.cos(angle) * radial * orbit;
      n.y = region.cy + yUnit * orbit * .86;
      n.z = region.cz + Math.sin(angle) * radial * orbit * .80;
    }
    n.size = Math.min(30, 8 + Math.sqrt(weight + d) * (n.kind === 'memory' ? 3.2 : 4.1));
    n._degree = d; n._weight = weight; n.neuralRegion = cat;
  });
  threeVis.neuralRegions = Object.values(regions);
  return nodes;
}
function limitedThreeEdges(data, byId){
  const degree = new Map(); const out=[];
  const limit = threeVis.mode === 'neural' ? 132 : 260;
  const degreeLimit = threeVis.mode === 'neural' ? 5 : 999;
  for(const e of (data.edges || [])){
    const a=byId.get(e.source), b=byId.get(e.target); if(!a || !b) continue;
    const da=degree.get(e.source)||0, db=degree.get(e.target)||0; if(da>=degreeLimit || db>=degreeLimit) continue;
    degree.set(e.source, da+1); degree.set(e.target, db+1); a._degree++; b._degree++; out.push({ ...e, a, b });
    if(out.length >= limit) break;
  }
  return out;
}
function neuralAuraOverlay(regions){
  if(threeVis.mode !== 'neural') return '';
  const regionList = (regions || []).slice(0,9);
  return `<div class="three-aura-layer">${regionList.map((r,i)=>`<span class="three-aura-oval" data-region="${esc(r.label || '')}" style="opacity:0;transform:translate(-50%,-50%) rotate(${(Number(r.angle || 0) * 28).toFixed(1)}deg)"></span>`).join('')}</div>`;
}
function makeAuraOvalTexture(THREE){
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
  const ctx = canvas.getContext('2d'); const cx=256, cy=160;
  const g = ctx.createRadialGradient(cx, cy, 12, cx, cy, 230);
  g.addColorStop(0, 'rgba(102,232,198,.24)');
  g.addColorStop(.52, 'rgba(102,232,198,.13)');
  g.addColorStop(1, 'rgba(102,232,198,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, 238, 142, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(102,232,198,.16)'; ctx.lineWidth=2;
  for(let i=0;i<3;i++){
    ctx.beginPath(); ctx.ellipse(cx, cy, 88+i*48, 46+i*28, 0, 0, Math.PI*2); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true; return tex;
}
function addNeuralAuraOvals(THREE, group, regions, colors){
  const texture = makeAuraOvalTexture(THREE);
  (regions || []).slice(0,10).forEach((region, i) => {
    const material = new THREE.SpriteMaterial({ map:texture, color:colors.entity, transparent:true, opacity:colors.light ? .13 : .18, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending, rotation:(region.angle || 0) * .42 });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(region.cx || 0, region.cy || 0, (region.cz || 0) - 18 - i*.8);
    const spread = region.spread || 86;
    sprite.scale.set(spread * (3.9 + (i%3)*.35), spread * (2.35 + (i%2)*.22), 1);
    sprite.renderOrder = -10 + i;
    group.add(sprite);
  });
}
function addHaloPoints(THREE, scene, nodes, kind, color, size){
  const selected = nodes.filter(n => (n.kind === 'memory') === (kind === 'memory'));
  const positions = new Float32Array(selected.length * 3);
  selected.forEach((n,i)=>{ positions[i*3]=n.x; positions[i*3+1]=n.y; positions[i*3+2]=n.z; });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const material = new THREE.PointsMaterial({ color, map:makePointTexture(THREE, 'orb'), alphaTest:.02, size, sizeAttenuation:true, transparent:true, opacity: kind === 'memory' ? (colorForTheme().light ? .16 : .28) : (colorForTheme().light ? .18 : .34), depthWrite:false, blending:colorForTheme().light ? THREE.NormalBlending : THREE.AdditiveBlending });
  const points = new THREE.Points(geometry, material); scene.add(points); return points;
}
function addNeuralDendrites(THREE, group, nodes, colors){
  const trunks=[]; const twigs=[]; const tips=[];
  nodes.slice(0,150).forEach((n,i)=>{
    const arms = n.kind === 'memory' ? 3 : 6;
    const base = n.kind === 'memory' ? 10 : 17;
    for(let a=0;a<arms;a++){
      const theta=(a/arms)*Math.PI*2 + (i%11)*.19;
      const phi=Math.sin(i*.37+a)*.58;
      const len=base + ((i+a*13)%9);
      const mid=[n.x+Math.cos(theta+.16)*Math.cos(phi)*len*.50, n.y+Math.sin(phi)*len*.36, n.z+Math.sin(theta+.16)*Math.cos(phi)*len*.50];
      const end=[n.x+Math.cos(theta)*Math.cos(phi)*len*.78, n.y+Math.sin(phi)*len*.54, n.z+Math.sin(theta)*Math.cos(phi)*len*.78];
      trunks.push(n.x,n.y,n.z, mid[0],mid[1],mid[2], mid[0],mid[1],mid[2], end[0],end[1],end[2]);
      if(n.kind !== 'memory' && a%2===0){
        const side=theta+(a%2?.44:-.40);
        const fork=[mid[0]+Math.cos(side)*len*.18, mid[1]+Math.sin(phi+.25)*len*.12, mid[2]+Math.sin(side)*len*.18];
        twigs.push(mid[0],mid[1],mid[2], fork[0],fork[1],fork[2]);
      }
      if(i%3===0 && a%2===0) tips.push(end[0],end[1],end[2]);
    }
  });
  const trunkGeom = new THREE.BufferGeometry(); trunkGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trunks),3));
  group.add(new THREE.LineSegments(trunkGeom, new THREE.LineBasicMaterial({ color:colors.entity, transparent:true, opacity:colors.light ? .34 : .36, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite:false })));
  const twigGeom = new THREE.BufferGeometry(); twigGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(twigs),3));
  group.add(new THREE.LineSegments(twigGeom, new THREE.LineBasicMaterial({ color:colors.link, transparent:true, opacity:colors.light ? .28 : .24, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite:false })));
  const tipGeom = new THREE.BufferGeometry(); tipGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tips),3));
  group.add(new THREE.Points(tipGeom, new THREE.PointsMaterial({ color:colors.entity, map:makePointTexture(THREE, 'orb'), alphaTest:.03, size:3.8, transparent:true, opacity:colors.light ? .54 : .72, depthWrite:false, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending })));
}
function addPoints(THREE, scene, nodes, kind, color, size){
  const selected = nodes.filter(n => (n.kind === 'memory') === (kind === 'memory'));
  const positions = new Float32Array(selected.length * 3);
  const sizes = new Float32Array(selected.length);
  selected.forEach((n,i)=>{ positions[i*3]=n.x; positions[i*3+1]=n.y; positions[i*3+2]=n.z; sizes[i]=Math.max(3.5, Math.min(size * 2.8, n.size || size)); });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
  const themeColors = colorForTheme();
  const material = new THREE.PointsMaterial({ color, map:makePointTexture(THREE, threeVis.mode === 'neural' ? (kind === 'memory' ? 'soma' : 'neuron') : (kind === 'memory' ? 'orb' : 'star')), alphaTest:.04, size, sizeAttenuation:true, transparent:true, opacity: threeVis.mode === 'neural' ? (kind === 'memory' ? (themeColors.light ? .88 : .98) : (themeColors.light ? .76 : .86)) : .96, depthWrite:false, blending:themeColors.light ? THREE.NormalBlending : THREE.AdditiveBlending });
  const points = new THREE.Points(geometry, material); points.userData.nodes = selected; scene.add(points); return points;
}
function buildThreeLinkSegments(THREE, edges){
  const positions = [];
  edges.forEach((e,i)=>{
    if(threeVis.mode === 'neural'){
      const ax=e.a.x, ay=e.a.y, az=e.a.z, bx=e.b.x, by=e.b.y, bz=e.b.z;
      const dx=bx-ax, dy=by-ay, dz=bz-az;
      const len=Math.max(1, Math.hypot(dx,dy,dz));
      const bend=(i%2?1:-1) * Math.min(58, 18 + len*.12);
      const cx=(ax+bx)/2 + (-dy/len)*bend;
      const cy=(ay+by)/2 + (dx/len)*bend*.55 + Math.sin(i*.71)*18;
      const cz=(az+bz)/2 + Math.cos(i*.53)*bend*.72;
      e._curve={cx,cy,cz};
      let px=ax, py=ay, pz=az;
      for(let step=1; step<=7; step++){
        const t=step/7, inv=1-t;
        const x=inv*inv*ax+2*inv*t*cx+t*t*bx;
        const y=inv*inv*ay+2*inv*t*cy+t*t*by;
        const z=inv*inv*az+2*inv*t*cz+t*t*bz;
        positions.push(px,py,pz,x,y,z); px=x; py=y; pz=z;
      }
    } else {
      positions.push(e.a.x,e.a.y,e.a.z,e.b.x,e.b.y,e.b.z);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions),3));
  return geometry;
}
async function renderThreeVisualiser(data){
  const THREE = await loadThreeModule();
  clearThreeScene(); threeVis.data = data; updateThreeUI(); threeInspectorDefault();
  const viewport = $('#threeViewport'); if(!viewport) return;
  const colors = colorForTheme();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
  } catch(err) {
    $('#threeViewport').classList.add('three-fallback');
    $('#threeLabels').innerHTML = `<div class="three-fallback-card"><h3>WebGL unavailable</h3><p>This comparison view needs GPU/WebGL. The original Canvas Visualiser remains available for this browser.</p></div>`;
    $('#threeInspector').innerHTML = `<div class="inspector-kicker">Three.js inspector</div><h3>WebGL unavailable</h3><p class="muted">Try this page in desktop Chrome/Safari/Firefox with hardware acceleration enabled.</p>`;
    return;
  }
  $('#threeViewport').classList.remove('three-fallback');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(colors.bg, 0);
  viewport.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(colors.bg, threeVis.mode === 'neural' ? .0011 : .0009);
  const camera = new THREE.PerspectiveCamera(48, 1, 1, 5000);
  const group = new THREE.Group(); scene.add(group);
  const ambient = new THREE.AmbientLight(0xffffff, .55); scene.add(ambient);
  const light = new THREE.PointLight(colors.entity, 1.2, 1200); light.position.set(180,220,260); scene.add(light);
  const nodes = buildThreePositions(data); const byId = new Map(nodes.map(n=>[n.id,n])); const edges = limitedThreeEdges(data, byId);
  const linkGeom = buildThreeLinkSegments(THREE, edges);
  group.add(new THREE.LineSegments(linkGeom, new THREE.LineBasicMaterial({ color:colors.link, transparent:true, opacity: threeVis.mode === 'neural' ? (colors.light ? .30 : .40) : .22, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite:false })));
  if(threeVis.mode === 'neural'){
    addHaloPoints(THREE, group, nodes, 'entity', colors.entity, 50);
    addHaloPoints(THREE, group, nodes, 'memory', colors.memory, 48);
    addNeuralDendrites(THREE, group, nodes, colors);
  }
  group.add(addPoints(THREE, group, nodes, 'entity', colors.entity, threeVis.mode === 'neural' ? 24 : 7));
  group.add(addPoints(THREE, group, nodes, 'memory', colors.memory, threeVis.mode === 'neural' ? 20 : 5.8));
  const starCount = threeVis.mode === 'neural' ? 360 : 520;
  const starPositions = new Float32Array(starCount*3);
  for(let i=0;i<starCount;i++){ const r=600+((i*37)%480), a=i*2.17, b=((i*53)%180-90)*Math.PI/180; starPositions.set([Math.cos(a)*Math.cos(b)*r, Math.sin(b)*r, Math.sin(a)*Math.cos(b)*r], i*3); }
  const starGeom = new THREE.BufferGeometry(); starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions,3));
  scene.add(new THREE.Points(starGeom, new THREE.PointsMaterial({ color:0xffffff, map:makePointTexture(THREE, 'orb'), alphaTest:.04, size:1.6, transparent:true, opacity:.38, depthWrite:false })));
  const pulseEdges = threeVis.mode === 'neural' ? edges.slice(0, 90) : [];
  const pulseGeom = new THREE.BufferGeometry(); const pulsePositions = new Float32Array(pulseEdges.length*3); pulseGeom.setAttribute('position', new THREE.BufferAttribute(pulsePositions,3));
  const pulsePoints = new THREE.Points(pulseGeom, new THREE.PointsMaterial({ color:colors.pulse, map:makePointTexture(THREE, 'star'), alphaTest:.03, size:threeVis.mode === 'neural' ? 10.5 : 5.2, transparent:true, opacity:threeVis.mode === 'neural' ? (colors.light ? .54 : .98) : .85, depthWrite:false, depthTest:false, blending:colors.light ? THREE.NormalBlending : THREE.AdditiveBlending })); group.add(pulsePoints);
  const labelNodes = nodes.filter(n => !/^[a-f0-9]{10,}$/i.test(String(n.label||''))).sort((a,b)=>(b._degree+b._weight)-(a._degree+a._weight)).slice(0, threeVis.mode === 'neural' ? 36 : 22);
  $('#threeLabels').innerHTML = neuralAuraOverlay(threeVis.neuralRegions) + labelNodes.map((n,i)=>`<span class="three-label ${n.kind === 'memory' ? 'memory' : ''}" data-i="${i}">${esc(String(n.label||'').replace(/^memory:/,'mem ').slice(0,24))}</span>`).join('');
  Object.assign(threeVis, { THREE, renderer, scene, camera, group, nodes, edgePairs:edges, labels:labelNodes, pulses:pulseEdges, pulsePoints });
  $('#threeClusters').innerHTML = (data.clusters || []).map(c => `<span class="cluster-pill">${esc(c.label)} <strong>${Number(c.count).toLocaleString()}</strong></span>`).join('');
  resetThreeCamera(); bindThreeControls(); resizeThree(); animateThree(0);
}
function resizeThree(){
  if(!threeVis.renderer) return;
  const viewport = $('#threeViewport'); const rect = viewport.getBoundingClientRect();
  const w = Math.max(320, rect.width), h = Math.max(320, rect.height);
  threeVis.renderer.setSize(w,h,false); threeVis.camera.aspect = w/h; threeVis.camera.updateProjectionMatrix();
}
function updateThreeAuras(rect, projectVector){
  if(threeVis.mode !== 'neural') return;
  const mobile = rect.width < 520;
  $$('#threeLabels .three-aura-oval').forEach(el => {
    const region = el.dataset.region || '';
    const pts = threeVis.nodes.filter(n => n.neuralRegion === region);
    const screens = [];
    pts.forEach(n => {
      projectVector.set(n.x,n.y,n.z).applyMatrix4(threeVis.group.matrixWorld).project(threeVis.camera);
      if(projectVector.z < 1 && projectVector.z > -1) screens.push({ x:(projectVector.x*.5+.5)*rect.width, y:(-projectVector.y*.5+.5)*rect.height });
    });
    if(screens.length < 2){ el.style.opacity = '0'; return; }
    const xs = screens.map(p=>p.x), ys = screens.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const maxW = mobile ? rect.width * .62 : Math.min(340, rect.width * .34);
    const maxH = mobile ? rect.height * .30 : Math.min(230, rect.height * .26);
    const w = Math.max(mobile ? 92 : 128, Math.min(maxW, (maxX - minX) + (mobile ? 46 : 74)));
    const h = Math.max(mobile ? 58 : 78, Math.min(maxH, (maxY - minY) + (mobile ? 34 : 56)));
    el.style.left = `${cx}px`; el.style.top = `${cy}px`; el.style.width = `${w}px`; el.style.height = `${h}px`; el.style.opacity = screens.length > 4 ? '.42' : '.28';
  });
}
function updateThreeLabels(){
  if(!threeVis.camera || !threeVis.group) return;
  const viewport = $('#threeViewport'); const rect = viewport.getBoundingClientRect(); const v = new threeVis.THREE.Vector3();
  updateThreeAuras(rect, v);
  const labelBoxes = [];
  const zoomReveal = threeVis.mode === 'neural' ? Math.max(0, Math.min(1, (900 - threeVis.cameraZ) / 420)) : 0;
  const maxLabels = threeVis.mode === 'neural' ? ((rect.width < 520 ? 7 : 11) + Math.round(zoomReveal * (rect.width < 520 ? 9 : 12))) : 22;
  let shown = 0;
  $$('#threeLabels .three-label').forEach((el,i)=>{
    const n = threeVis.labels[i]; if(!n) return;
    v.set(n.x,n.y,n.z).applyMatrix4(threeVis.group.matrixWorld).project(threeVis.camera);
    const sx = (v.x*.5+.5)*rect.width, sy = (-v.y*.5+.5)*rect.height;
    const visible = v.z < 1 && v.z > -1 && sx > 8 && sx < rect.width - 8 && sy > 8 && sy < rect.height - 8;
    const pulse = threeVis.mode === 'neural' && i > 3 ? Math.sin((threeVis.lastT || 0) * .00032 + i * 1.73) : 1;
    const box = {x:sx-54,y:sy-13,w:108,h:24};
    const collides = labelBoxes.some(b => !(box.x+box.w<b.x || b.x+b.w<box.x || box.y+box.h<b.y || b.y+b.h<box.y));
    const show = visible && shown < maxLabels && !collides && (threeVis.mode !== 'neural' || i <= 3 || pulse > .08);
    el.style.display = show ? '' : 'none';
    if(show){
      shown++; labelBoxes.push(box);
      el.style.left = `${sx}px`; el.style.top = `${sy}px`;
      const depthAlpha = Math.max(.32, Math.min(.86, 1 - Math.abs(v.z)*.35));
      const pulseAlpha = threeVis.mode === 'neural' && i > 3 ? Math.min(.78, .38 + pulse * .36) : depthAlpha;
      el.style.opacity = String(Math.min(depthAlpha, pulseAlpha));
    }
  });
}
function animateThree(t=0){
  if(!threeVis.renderer) return;
  resizeThree();
  const delta = threeVis.lastT ? Math.min(48, t - threeVis.lastT) : 16; threeVis.lastT = t;
  if(!threeVis.paused && !threeVis.drag) threeVis.yaw += delta * (threeVis.mode === 'neural' ? .00009 : .000055);
  clampThreeCamera();
  threeVis.group.rotation.y = threeVis.yaw; threeVis.group.rotation.x = threeVis.pitch;
  threeVis.camera.position.set(threeVis.panX, threeVis.panY, threeVis.cameraZ); threeVis.camera.lookAt(threeVis.panX, threeVis.panY, 0);
  if(threeVis.pulsePoints){
    const attr = threeVis.pulsePoints.geometry.attributes.position; const arr = attr.array;
    threeVis.pulses.forEach((e,i)=>{ const phase=(t*.00030 + (i%17)/17)%1; const inv=1-phase; if(e._curve){ arr[i*3]=inv*inv*e.a.x+2*inv*phase*e._curve.cx+phase*phase*e.b.x; arr[i*3+1]=inv*inv*e.a.y+2*inv*phase*e._curve.cy+phase*phase*e.b.y; arr[i*3+2]=inv*inv*e.a.z+2*inv*phase*e._curve.cz+phase*phase*e.b.z; } else { arr[i*3]=e.a.x+(e.b.x-e.a.x)*phase; arr[i*3+1]=e.a.y+(e.b.y-e.a.y)*phase; arr[i*3+2]=e.a.z+(e.b.z-e.a.z)*phase; } });
    attr.needsUpdate = true;
  }
  threeVis.renderer.render(threeVis.scene, threeVis.camera); updateThreeLabels();
  threeVis.frame = requestAnimationFrame(animateThree);
}
async function loadThreeVisualiser(){ renderThreeVisualiser(await api('/api/constellation?limit=320')); }
function switchThreeMode(mode){ threeVis.mode = mode === 'neural' ? 'neural' : 'constellation'; if(threeVis.data) renderThreeVisualiser(threeVis.data); else loadThreeVisualiser(); }
function clampThreeCamera(){
  const viewport = $('#threeViewport'); const rect = viewport?.getBoundingClientRect?.() || {width:650,height:650};
  threeVis.cameraZ = Math.max(260, Math.min(1800, Number.isFinite(threeVis.cameraZ) ? threeVis.cameraZ : (threeVis.mode === 'neural' ? 600 : 840)));
  threeVis.yaw = Number.isFinite(threeVis.yaw) ? threeVis.yaw : 0;
  threeVis.pitch = Math.max(-1.15, Math.min(1.15, Number.isFinite(threeVis.pitch) ? threeVis.pitch : .32));
  const zoomFactor = 900 / Math.max(320, threeVis.cameraZ);
  const panLimitX = Math.max(120, rect.width * (.45 + zoomFactor * .18));
  const panLimitY = Math.max(120, rect.height * (.34 + zoomFactor * .12));
  threeVis.panX = Math.max(-panLimitX, Math.min(panLimitX, Number.isFinite(threeVis.panX) ? threeVis.panX : 0));
  threeVis.panY = Math.max(-panLimitY, Math.min(panLimitY, Number.isFinite(threeVis.panY) ? threeVis.panY : 0));
}
function bindThreeControls(){
  const viewport = $('#threeViewport'); if(!viewport || viewport.dataset.controlsBound === 'true') return; viewport.dataset.controlsBound = 'true';
  const pointers = threeVis.pointer || new Map(); threeVis.pointer = pointers;
  const dist = () => { const ps=[...pointers.values()]; return ps.length < 2 ? 1 : Math.max(1, Math.hypot(ps[0].x-ps[1].x, ps[0].y-ps[1].y)); };
  const center = () => { const ps=[...pointers.values()]; return ps.length < 2 ? {x:0,y:0} : {x:(ps[0].x+ps[1].x)/2, y:(ps[0].y+ps[1].y)/2}; };
  viewport.addEventListener('contextmenu', e=>e.preventDefault());
  viewport.addEventListener('wheel', e=>{ if(e.cancelable) e.preventDefault(); threeVis.cameraZ *= Math.exp(e.deltaY*.001); clampThreeCamera(); }, {passive:false});
  viewport.addEventListener('pointerdown', e=>{
    if(e.cancelable) e.preventDefault();
    try { viewport.setPointerCapture?.(e.pointerId); } catch(_err) {}
    pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
    if(pointers.size >= 2){ const c=center(); threeVis.drag={mode:'pinch',x:c.x,y:c.y,dist:dist(),cameraZ:threeVis.cameraZ,panX:threeVis.panX,panY:threeVis.panY,moved:false}; }
    else threeVis.drag = {mode:'drag',x:e.clientX,y:e.clientY,yaw:threeVis.yaw,pitch:threeVis.pitch,panX:threeVis.panX,panY:threeVis.panY,moved:false};
    viewport.style.cursor='grabbing';
  }, {passive:false});
  viewport.addEventListener('pointermove', e=>{
    if(!pointers.has(e.pointerId) || !threeVis.drag) return;
    if(e.cancelable) e.preventDefault();
    pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
    const d=threeVis.drag;
    if(d.mode === 'pinch'){
      if(pointers.size < 2) return;
      const c=center(); const scale=dist()/Math.max(1,d.dist);
      threeVis.cameraZ = d.cameraZ / Math.max(.35, Math.min(2.8, scale));
      threeVis.panX = d.panX - (c.x-d.x)*.72;
      threeVis.panY = d.panY + (c.y-d.y)*.72;
      d.moved = d.moved || Math.abs(c.x-d.x)+Math.abs(c.y-d.y)>3 || Math.abs(scale-1)>.015;
      clampThreeCamera(); return;
    }
    const dx=e.clientX-d.x, dy=e.clientY-d.y; if(Math.abs(dx)+Math.abs(dy)>3) d.moved=true;
    if(threeVis.panMode || e.shiftKey){ threeVis.panX=d.panX-dx*.7; threeVis.panY=d.panY+dy*.7; }
    else { threeVis.yaw=d.yaw+dx*.006; threeVis.pitch=d.pitch+dy*.004; }
    clampThreeCamera();
  }, {passive:false});
  const end=e=>{
    pointers.delete(e.pointerId);
    if(threeVis.drag?.moved) viewport.dataset.suppressClick='true';
    if(pointers.size === 1){ const p=[...pointers.values()][0]; threeVis.drag={mode:'drag',x:p.x,y:p.y,yaw:threeVis.yaw,pitch:threeVis.pitch,panX:threeVis.panX,panY:threeVis.panY,moved:true}; }
    else { threeVis.drag=null; viewport.style.cursor='grab'; }
  };
  viewport.addEventListener('pointerup', end); viewport.addEventListener('pointercancel', end); viewport.addEventListener('pointerleave', end);
  viewport.addEventListener('click', e=>{ if(viewport.dataset.suppressClick==='true'){ viewport.dataset.suppressClick='false'; return; } pickThreeNode(e); });
}
function pickThreeNode(e){
  if(!threeVis.camera || !threeVis.group) return;
  const rect = $('#threeViewport').getBoundingClientRect(); const mouseX=e.clientX-rect.left, mouseY=e.clientY-rect.top;
  const v = new threeVis.THREE.Vector3(); let best=null, bestD=Infinity;
  for(const n of threeVis.nodes){
    v.set(n.x,n.y,n.z).applyMatrix4(threeVis.group.matrixWorld).project(threeVis.camera);
    if(v.z < -1 || v.z > 1) continue;
    const sx=(v.x*.5+.5)*rect.width, sy=(-v.y*.5+.5)*rect.height; const d=Math.hypot(sx-mouseX, sy-mouseY);
    if(d < bestD && d < 18){ bestD=d; best=n; }
  }
  if(best) inspectThreeNode(best);
}

$$('nav button').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
$$('.section-tabs button').forEach(b => b.onclick = () => {
  const panelRoute = ({ exploreSearch:'search', exploreMemories:'memories', exploreRecall:'recall', activityTimeline:'timelineView', activityConsolidations:'consolidations', graphGraph:'graph', graphTriples:'triples', todayAdded:'todayAdded', todayRecalled:'todayRecalled', todayTriples:'todayTriples', todayConsolidations:'todayConsolidations' })[b.dataset.panel];
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
window.addEventListener('resize', closeMobileMenu, { passive: true });
window.addEventListener('orientationchange', closeMobileMenu, { passive: true });
$('#memorySearch').onclick = loadMemories;
$('#bulkSelectAll').onchange = () => { latestMemoryItems.forEach(x => $('#bulkSelectAll').checked ? bulkSelection.add(x.id) : bulkSelection.delete(x.id)); loadMemories(); };
$('#bulkClear').onclick = () => { bulkSelection.clear(); loadMemories(); };
$('#bulkExpire').onclick = expireSelectedMemories;
$('#bulkImportance').onclick = setSelectedImportance; $('#memoryQuery').onkeydown = e => { if(e.key==='Enter') loadMemories(); };
$('#globalSearchButton').onclick = loadGlobalSearch; $('#globalSearchQuery').onkeydown = e => { if(e.key==='Enter') loadGlobalSearch(); };
$('#recallButton').onclick = loadRecallDebug; $('#recallQuery').onkeydown = e => { if(e.key==='Enter') loadRecallDebug(); };
$('#timelineButton').onclick = loadTimeline; $('#timelineQuery').onkeydown = e => { if(e.key==='Enter') loadTimeline(); }; $('#timelineGroup').onchange = loadTimeline;
$('#memoryClear').onclick = () => { ['memoryQuery','memorySource','memoryScope','memorySession'].forEach(id => $('#'+id).value = ''); $('#memoryKind').value = 'all'; $('#memoryStatus').value = 'active'; $('#memorySort').value = 'recent'; loadMemories(); };
['memoryKind','memorySource','memoryScope','memorySession','memoryStatus','memorySort'].forEach(id => $('#'+id).onchange = loadMemories);
$('#tripleSearch').onclick = loadTriples; $('#tripleQuery').onkeydown = e => { if(e.key==='Enter') loadTriples(); };
$('#graphRefresh').onclick = loadGraph; $('#graphQuery').onkeydown = e => { if(e.key==='Enter') loadGraph(); };
$('#graphClear').onclick = () => { $('#graphQuery').value = ''; loadGraph(); };
$('#graphResetView').onclick = resetGraphView;
$('#constellationRefresh').onclick = loadConstellation;
$('#constellationReset').onclick = resetConstellationView;
$('#constellationPanMode').onclick = toggleConstellationPanMode;
$('#constellationPause').onclick = toggleConstellationPause;
$$('.visualiser-tabs button[data-visualiser]').forEach(b => b.onclick = () => switchVisualiserMode(b.dataset.visualiser));
$('#threeRefresh').onclick = loadThreeVisualiser;
$('#threeReset').onclick = () => { resetThreeCamera(); threeInspectorDefault(); };
$('#threePanMode').onclick = () => { threeVis.panMode = !threeVis.panMode; updateThreeUI(); };
$('#threePause').onclick = () => { threeVis.paused = !threeVis.paused; updateThreeUI(); };
$$('.visualiser-tabs button[data-three-mode]').forEach(b => b.onclick = () => switchThreeMode(b.dataset.threeMode));
updateVisualiserModeUI();
updateConstellationPauseButton();
updateConstellationPanButton();
$('#consolidationQuery').oninput = renderConsolidations;
$('#consolidationClear').onclick = () => { $('#consolidationQuery').value = ''; renderConsolidations(); };
$('#closeDetail').onclick = () => closeDetail();
$('#loginButton').onclick = async () => {
  try { await postJson('/api/auth/login', {password: $('#loginPassword').value}); hideLogin(); $('#loginError').textContent=''; await refreshAuthState(); loadStats(); }
  catch(e){ $('#loginError').textContent = e.message; }
};
$('#loginPassword').onkeydown = e => { if(e.key==='Enter') $('#loginButton').click(); };
$('#refreshDiagnostics').onclick = loadDiagnostics;
$('#copyDiagnostics').onclick = copyDiagnostics;
$('#saveRuntimeConfig').onclick = async () => {
  try {
    const body = {host: $('#configHost').value.trim(), port: $('#configPort').value.trim(), db_path: $('#configDbPath').value.trim()};
    const r = await postJson('/api/config', body);
    const cfg = r.config || {};
    $('#configHost').value = cfg.host || '';
    $('#configPort').value = cfg.port || '';
    $('#configDbPath').value = cfg.db_path || '';
    const urls = [`This Mac: ${cfg.local_url || ''}`];
    if (cfg.lan_url) urls.push(`LAN: ${cfg.lan_url}`);
    $('#configStatus').textContent = `${r.message || 'Saved. Restart the dashboard to apply server/database changes.'} ${urls.join(' · ')}`;
  } catch(e) { $('#configStatus').textContent = e.message; }
};
$('#saveAuth').onclick = async () => {
  try { const body = {auth_enabled: $('#authEnabled').checked}; if($('#authPassword').value) body.password = $('#authPassword').value; const r = await postJson('/api/config', body); $('#authPassword').value=''; $('#authStatus').textContent = r.message || 'Saved'; }
  catch(e){ $('#authStatus').textContent = e.message; }
};
$('#clearAuth').onclick = async () => {
  try {
    const r = await postJson('/api/config', {clear_password:true});
    $('#authEnabled').checked=false;
    $('#authPassword').value='';
    $('#memoryAdminEnabled').checked=!!(r.config && r.config.memory_admin_enabled);
    $('#authStatus').textContent = r.message || 'Auth disabled';
    await loadAuthStatus();
  } catch(e){
    $('#authStatus').textContent = e.message;
  }
};
$('#saveMemoryAdmin').onclick = async () => {
  try { const r = await postJson('/api/config', {memory_admin_enabled: $('#memoryAdminEnabled').checked}); authState.config = r.config || {}; $('#memoryAdminStatus').textContent = r.message || 'Saved'; await loadAuthStatus(); }
  catch(e){ $('#memoryAdminStatus').textContent = e.message; }
};
$('#createBackup').onclick = async () => {
  try { const r = await postJson('/api/admin/backup', {}); $('#memoryAdminStatus').textContent = `Backup created: ${r.backup.path}`; }
  catch(e){ $('#memoryAdminStatus').textContent = e.message; }
};
$('#viewAuditLog').onclick = async () => {
  try { const r = await api('/api/admin/audit?limit=50'); showDetail(r.items, 'Memory audit log'); }
  catch(e){ $('#memoryAdminStatus').textContent = e.message; }
};
$('#logoutAuth').onclick = async () => { await postJson('/api/auth/logout', {}); showLogin(); };
function toggleTheme(){ setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); }
$('#themeToggle').onclick = toggleTheme;
$('#mobileThemeToggle').onclick = toggleTheme;
window.addEventListener('popstate', e => applyRoute(e.state || urlToRoute()));
initTheme();
const initialRoute = urlToRoute();
pushRoute(initialRoute, true);
refreshAuthState().then(async s => {
  if(s.auth_enabled && !s.authenticated) showLogin();
  else {
    await loadStats();
    if(initialRoute.tab !== 'overview' || initialRoute.drawer) await applyRoute(initialRoute);
  }
}).catch(() => showLogin());
