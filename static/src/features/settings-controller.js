import { endpoints } from '../api/endpoints.js';
import { esc } from '../utils/escape.js';
import { fmtBytes, prettyTime } from '../utils/format.js';
import { trapFocus } from '../utils/a11y.js';

export function createSettingsController({
  $,
  api,
  postJson,
  setCsrfToken,
  confirmAction,
  runButtonAction,
  showDetail,
  showSelectableCopy,
  loadStats,
}) {
  let authState = { config: {}, auth_enabled: false, authenticated: true };
  let loginFocusRelease = null;
  let lastDiagnostics = null;

  function setAuthState(state) {
    if (state) authState = state;
    if (authState.csrf_token) setCsrfToken(authState.csrf_token || '');
    return authState;
  }

  function showLogin() {
    const overlay = $('#loginOverlay');
    if (!overlay) return;
    const wasHidden = overlay.classList.contains('hidden');
    overlay.classList.remove('hidden');
    if (wasHidden) {
      loginFocusRelease = trapFocus(overlay);
      $('#loginPassword')?.focus();
    }
  }

  function hideLogin() {
    const overlay = $('#loginOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    loginFocusRelease?.();
    loginFocusRelease = null;
  }

  function canAdmin() {
    const cfg = authState.config || {};
    const localOnly = ['127.0.0.1', 'localhost', '::1'].includes(cfg.host || '0.0.0.0');
    return !!(cfg.memory_admin_enabled && (localOnly || (authState.auth_enabled && authState.authenticated)));
  }

  function runtimeRow(label, value, opts = {}) {
    const safe = value === undefined || value === null || value === '' ? '—' : value;
    return `<div class="diag-row ${opts.wide ? 'wide' : ''}"><span>${esc(label)}</span><strong title="${esc(safe)}">${esc(safe)}</strong></div>`;
  }

  function renderRuntimeDiagnostics(runtime) {
    const el = $('#runtimeDiagnostics');
    if (!el) return;
    const probe = runtime.probe || {};
    const cfg = runtime.config || {};
    const health = runtime.running && runtime.reachable && !runtime.stale_pid && !runtime.runtime_stale ? 'Healthy' : 'Needs attention';
    const started = runtime.started_at ? prettyTime(Number(runtime.started_at) * 1000) : '';
    el.innerHTML = [
      runtimeRow('Status', health),
      runtimeRow('PID', runtime.pid),
      runtimeRow('PID file', runtime.pid_file_pid),
      runtimeRow('Listener PID', (runtime.listener_pids || []).join(', ') || 'none'),
      runtimeRow('Launch source', runtime.runtime_source || 'server.py'),
      runtimeRow('Stale PID', runtime.stale_pid ? 'yes — repaired on restart/start' : 'no'),
      runtimeRow('Runtime stale', runtime.runtime_stale ? 'yes' : 'no'),
      runtimeRow('Probe', `${probe.status || 'n/a'} ${probe.url || ''}`, { wide: true }),
      runtimeRow('Local URL', cfg.local_url || '', { wide: true }),
      runtimeRow('LAN URL', cfg.lan_url || 'not exposed', { wide: true }),
      runtimeRow('Started', started || runtime.started_at || '', { wide: true }),
    ].join('');
  }

  async function loadRuntimeDiagnostics() {
    try {
      renderRuntimeDiagnostics(await api(endpoints.runtimeStatus()));
    } catch (error) {
      const el = $('#runtimeDiagnostics');
      if (el) el.innerHTML = `<div class="state-card state-error"><strong>Runtime diagnostics unavailable</strong><p>${esc(error.message)}</p></div>`;
    }
  }

  async function loadDiagnostics() {
    const diag = await api(endpoints.diagnostics());
    const counts = diag.table_counts || {};
    const core = ['working_memory', 'episodic_memory', 'triples', 'consolidation_log'].filter((table) => table in counts);
    $('#diagnosticsSummary').innerHTML = `
    <div class="diag-row"><span>Status</span><strong>${diag.ok ? 'OK' : 'Needs attention'}</strong></div>
    <div class="diag-row"><span>DB path</span><strong title="${esc(diag.db_path)}">${esc(diag.db_path)}</strong></div>
    <div class="diag-row"><span>Readable</span><strong>${diag.readable ? 'yes' : 'no'}</strong></div>
    <div class="diag-row"><span>Size</span><strong>${fmtBytes(diag.size_bytes)}</strong></div>
    <div class="diag-row"><span>Last modified</span><strong>${esc(diag.modified_at || 'n/a')}</strong></div>
    <div class="diag-row"><span>Tables</span><strong>${esc((diag.tables || []).length)}</strong></div>
    <div class="diag-row wide"><span>Core rows</span><strong>${core.map((table) => `${table}: ${Number(counts[table] || 0).toLocaleString()}`).join(' · ') || 'none'}</strong></div>`;
    $('#diagnosticsStatus').textContent = diag.error || ((diag.missing_expected_tables || []).length ? `Missing expected tables: ${diag.missing_expected_tables.join(', ')}` : 'Database looks healthy.');
    lastDiagnostics = diag;
    window.lastDiagnostics = diag;
  }

  async function copyDiagnostics() {
    if (!lastDiagnostics) await loadDiagnostics();
    showSelectableCopy('Diagnostics JSON', JSON.stringify(lastDiagnostics, null, 2));
  }

  async function refreshAuthState() {
    authState = await api('/api/auth/status');
    setCsrfToken(authState.csrf_token || '');
    return authState;
  }

  async function loadAuthStatus() {
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
    $('#memoryAdminStatus').textContent = cfg.memory_admin_enabled ? (['127.0.0.1', 'localhost', '::1'].includes(cfg.host || '0.0.0.0') ? 'Local-only admin mode is enabled. Mutations are audited; password is only required for LAN/non-local hosts.' : 'Admin maintenance mode is enabled. LAN/non-local mutations require password auth and are audited.') : 'Admin maintenance mode is disabled; dashboard is read-only.';
  }

  function bindControls() {
    $('#loginButton').onclick = async () => {
      try {
        await runButtonAction($('#loginButton'), 'Signing in...', () => postJson('/api/auth/login', { password: $('#loginPassword').value }), { tone: 'success', title: 'Signed in' });
        hideLogin();
        $('#loginError').textContent = '';
        await refreshAuthState();
        loadStats();
      } catch (error) { $('#loginError').textContent = error.message; }
    };
    $('#loginPassword').onkeydown = (event) => { if (event.key === 'Enter') $('#loginButton').click(); };
    $('#refreshDiagnostics').onclick = loadDiagnostics;
    $('#copyDiagnostics').onclick = copyDiagnostics;
    $('#saveRuntimeConfig').onclick = async () => {
      try {
        const body = { host: $('#configHost').value.trim(), port: $('#configPort').value.trim(), db_path: $('#configDbPath').value.trim() };
        const result = await runButtonAction($('#saveRuntimeConfig'), 'Saving...', () => postJson('/api/config', body), { tone: 'success', title: 'Server settings saved', body: 'Restart the dashboard to apply host, port, or database changes.' });
        const cfg = result.config || {};
        $('#configHost').value = cfg.host || '';
        $('#configPort').value = cfg.port || '';
        $('#configDbPath').value = cfg.db_path || '';
        const urls = [`This Mac: ${cfg.local_url || ''}`];
        if (cfg.lan_url) urls.push(`LAN: ${cfg.lan_url}`);
        $('#configStatus').textContent = `${result.message || 'Saved. Restart the dashboard to apply server/database changes.'} ${urls.join(' · ')}`;
      } catch (error) { $('#configStatus').textContent = error.message; }
    };
    $('#saveAuth').onclick = async () => {
      try {
        const body = { auth_enabled: $('#authEnabled').checked };
        if ($('#authPassword').value) body.password = $('#authPassword').value;
        const result = await runButtonAction($('#saveAuth'), 'Saving...', () => postJson('/api/config', body), { tone: 'success', title: 'Auth settings saved' });
        $('#authPassword').value = '';
        $('#authStatus').textContent = result.message || 'Saved';
      } catch (error) { $('#authStatus').textContent = error.message; }
    };
    $('#clearAuth').onclick = async () => {
      try {
        const ok = await confirmAction({ title: 'Disable password auth?', description: 'This clears the dashboard password and disables password auth.', confirmText: 'Disable auth', tone: 'warn' });
        if (!ok) return;
        const result = await runButtonAction($('#clearAuth'), 'Disabling...', () => postJson('/api/config', { clear_password: true }), { tone: 'success', title: 'Password auth disabled' });
        $('#authEnabled').checked = false;
        $('#authPassword').value = '';
        $('#memoryAdminEnabled').checked = !!(result.config && result.config.memory_admin_enabled);
        $('#authStatus').textContent = result.message || 'Auth disabled';
        await loadAuthStatus();
      } catch (error) {
        $('#authStatus').textContent = error.message;
      }
    };
    $('#saveMemoryAdmin').onclick = async () => {
      try {
        const result = await runButtonAction($('#saveMemoryAdmin'), 'Saving...', () => postJson('/api/config', { memory_admin_enabled: $('#memoryAdminEnabled').checked }), { tone: 'success', title: 'Memory admin settings saved' });
        authState.config = result.config || {};
        $('#memoryAdminStatus').textContent = result.message || 'Saved';
        await loadAuthStatus();
      } catch (error) { $('#memoryAdminStatus').textContent = error.message; }
    };
    $('#createBackup').onclick = async () => {
      try {
        const result = await runButtonAction($('#createBackup'), 'Creating...', () => postJson('/api/admin/backup', {}), (response) => ({ tone: 'success', title: 'Backup created', body: response.backup?.path || '' }));
        $('#memoryAdminStatus').textContent = `Backup created: ${result.backup.path}`;
      } catch (error) { $('#memoryAdminStatus').textContent = error.message; }
    };
    $('#viewAuditLog').onclick = async () => {
      try {
        const result = await api('/api/admin/audit?limit=50');
        showDetail(result.items, 'Memory audit log');
      } catch (error) { $('#memoryAdminStatus').textContent = error.message; }
    };
    $('#logoutAuth').onclick = async () => {
      await runButtonAction($('#logoutAuth'), 'Logging out...', () => postJson('/api/auth/logout', {}), { tone: 'success', title: 'Logged out' });
      setCsrfToken('');
      showLogin();
    };
  }

  return {
    bindControls,
    canAdmin,
    hideLogin,
    loadAuthStatus,
    loadDiagnostics,
    loadRuntimeDiagnostics,
    refreshAuthState,
    setAuthState,
    showLogin,
  };
}
