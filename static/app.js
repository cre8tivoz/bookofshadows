const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const THEME_KEY = 'mnemosyne-dashboard-theme';
let graphState = { nodes: [], edges: [], byId: {} };
let consolidationState = [];
let authState = { config: {}, auth_enabled: false, authenticated: true };
let currentRoute = { tab: 'overview' };
let applyingHistory = false;
let bulkSelection = new Set();
let latestMemoryItems = [];
let graphView = { scale:1, x:0, y:0, dragging:false, sx:0, sy:0, ox:0, oy:0 };

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
function routeTabState(tab=currentRoute.tab || 'overview'){ return { tab }; }
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
  const route = { tab: params.get('tab') || 'overview' };
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
  return ({ search:'explore', recall:'explore', memories:'explore', timelineView:'activity', consolidations:'activity', triples:'graph', todayAdded:'today', todayRecalled:'today', todayTriples:'today', todayConsolidations:'today' })[name] || name;
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
  const nav = document.querySelector(`nav button[data-tab="${section}"]`);
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
function profileItem(row){
  const item = row.item || {};
  const attrs = row.kind === 'memory' ? `data-id="${esc(item.id || '')}"` : `data-json='${esc(JSON.stringify(item))}'`;
  return `<div class="profile-item" ${attrs}><span class="badge">${esc(row.kind)}</span><p>${esc(row.label || '')}</p><small>${esc(prettyTime(row.timestamp) || row.timestamp || '')} · score ${Number(row.importance || 0).toFixed(2)}</small></div>`;
}
async function loadProfile(){
  const data = await api('/api/profile/inferred?limit=10');
  $('#profileGrid').innerHTML = (data.sections || []).map(s => `<section class="profile-section glass"><div class="section-head mini"><h2>${esc(s.name)}</h2><span>${esc(s.count)} signal${Number(s.count) === 1 ? '' : 's'}</span></div>${(s.items || []).map(profileItem).join('')}</section>`).join('') || '<p class="muted">No inferred profile data found.</p>';
  $$('#profileGrid .profile-item[data-id]').forEach(el => el.onclick = () => openMemoryDetail(el.dataset.id));
  $$('#profileGrid .profile-item[data-json]').forEach(el => el.onclick = () => showDetail(JSON.parse(el.dataset.json), 'Profile source detail'));
}
function constellationInspectorDefault(){ $('#constellationInspector').innerHTML = `<div class="inspector-kicker">Constellation inspector</div><h3>Nothing selected</h3><p class="muted">Pick a star, memory, or link to inspect the underlying read-only source.</p>`; }
function inspectConstellationNode(node){
  $('#constellationInspector').innerHTML = `<div class="inspector-kicker">${esc(node.kind || 'entity')}</div><h3>${esc(node.label)}</h3><p class="muted">${esc(node.category || 'Other')} · ${Number(node.count || 0).toLocaleString()} signal(s) · weight ${Number(node.weight || 0).toFixed(2)}</p>${node.preview ? `<p>${esc(node.preview)}</p>` : ''}<div class="inspector-actions">${node.memory_id ? '<button id="constellationMemory" class="primary tiny">Open memory</button>' : ''}<button id="constellationSearch" class="tiny">Search memories</button></div>`;
  if(node.memory_id) $('#constellationMemory').onclick = () => openMemoryDetail(node.memory_id);
  $('#constellationSearch').onclick = () => { $('#memoryQuery').value = node.label.replace(/^memory:/,''); switchTab('memories'); };
}
function drawConstellation(data){
  const svg = $('#constellationSvg'); svg.innerHTML = '';
  const nodes = (data.nodes || []).slice(0,180);
  const edges = (data.edges || []);
  const w=1000,h=680,cx=w/2,cy=h/2;
  const categories = [...new Set(nodes.map(n => n.category || 'Other'))];
  const catIndex = Object.fromEntries(categories.map((c,i)=>[c,i]));
  nodes.forEach((n,i) => { const ci=catIndex[n.category || 'Other'] || 0; const angle=(i/nodes.length)*Math.PI*2 + ci*.45; const ring=n.kind === 'memory' ? 305 + (i%5)*42 : 165 + ci*48; n.x=cx+Math.cos(angle)*ring; n.y=cy+Math.sin(angle)*ring*.82; });
  const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
  svg.insertAdjacentHTML('afterbegin', `<defs><radialGradient id="starGlow"><stop offset="0%" stop-color="#fff"/><stop offset="45%" stop-color="#65d6ff"/><stop offset="100%" stop-color="#7c7cff" stop-opacity=".25"/></radialGradient><linearGradient id="constellationEdge" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#65d6ff" stop-opacity=".22"/><stop offset="55%" stop-color="#7c7cff" stop-opacity=".72"/><stop offset="100%" stop-color="#ffd166" stop-opacity=".28"/></linearGradient></defs>`);
  edges.filter(e => byId[e.source] && byId[e.target]).slice(0,360).forEach(e => { const s=byId[e.source], t=byId[e.target]; const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',s.x); line.setAttribute('y1',s.y); line.setAttribute('x2',t.x); line.setAttribute('y2',t.y); line.setAttribute('class',`constellation-link ${e.kind || ''}`); line.onclick = () => showDetail(e.item || e, 'Constellation link'); svg.appendChild(line); });
  nodes.forEach(n => { const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class',`constellation-node ${n.kind || 'entity'}`); g.dataset.id=n.id; g.onclick = () => inspectConstellationNode(n); const r=Math.min(24, 5 + Math.sqrt(Number(n.weight || n.count || 1))*4); const c=document.createElementNS('http://www.w3.org/2000/svg','circle'); c.setAttribute('cx',n.x); c.setAttribute('cy',n.y); c.setAttribute('r',r); g.appendChild(c); const text=document.createElementNS('http://www.w3.org/2000/svg','text'); text.textContent=(n.label || '').replace(/^memory:/,'mem '); if(text.textContent.length>26) text.textContent=text.textContent.slice(0,23)+'…'; text.setAttribute('x',n.x+r+5); text.setAttribute('y',n.y+4); g.appendChild(text); svg.appendChild(g); });
  $('#constellationClusters').innerHTML = (data.clusters || []).map(c => `<span class="cluster-pill">${esc(c.label)} <strong>${Number(c.count).toLocaleString()}</strong></span>`).join('');
  constellationInspectorDefault();
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
$('#constellationReset').onclick = loadConstellation;
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
