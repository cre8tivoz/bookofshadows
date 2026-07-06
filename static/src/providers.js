const PROVIDER_KEYS = {
  default_provider: 'bos.default_provider',
  last_selected_provider: 'bos.last_selected_provider',
};

let _providers = {};
let _health = {};
let _selectedProvider = null;
let _onSelectCallbacks = [];

export function onProviderSelect(cb) {
  _onSelectCallbacks.push(cb);
}

export function getProviders() {
  return _providers;
}

export function getSelectedProvider() {
  return _selectedProvider;
}

export function getProviderHealth(slug) {
  return _health[slug] || { status: 'unknown', message: 'Unknown' };
}

function getDefaultProvider() {
  return localStorage.getItem(PROVIDER_KEYS.default_provider)
    || localStorage.getItem(PROVIDER_KEYS.last_selected_provider)
    || Object.keys(_providers)[0]
    || null;
}

export function setDefaultProvider(slug) {
  localStorage.setItem(PROVIDER_KEYS.default_provider, slug);
  document.querySelectorAll('.star').forEach(s => {
    s.textContent = s.dataset.slug === slug ? '★' : '☆';
  });
}

function saveLastProvider(slug) {
  localStorage.setItem(PROVIDER_KEYS.last_selected_provider, slug);
}

export function renderProviderTabs(providers) {
  _providers = providers;
  const container = document.getElementById('providerTabs');
  if (!container) return;
  container.innerHTML = '';
  for (const [slug, info] of Object.entries(providers)) {
    const tab = document.createElement('button');
    tab.className = 'provider-tab';
    tab.dataset.provider = slug;
    tab.style.setProperty('--provider-color', info.color);
    tab.innerHTML = `
      <span class="glyph">${info.glyph}</span>
      <span class="name">${info.name}</span>
      <span class="star" data-slug="${slug}">☆</span>
    `;
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('star')) {
        setDefaultProvider(slug);
      } else {
        selectProvider(slug);
      }
    });
    container.appendChild(tab);
  }
}

export function renderSidebar(providers, health) {
  _health = health;
  const sidebar = document.getElementById('providerSidebar');
  if (!sidebar) return;
  sidebar.innerHTML = '';
  for (const [slug, info] of Object.entries(providers)) {
    const h = health[slug] || {};
    const card = document.createElement('div');
    card.className = `provider-card status-${h.status || 'unknown'}`;
    card.innerHTML = `
      <div class="card-swatch" style="background:${info.color}"></div>
      <div class="card-body">
        <div class="card-header">
          <span class="glyph">${info.glyph}</span>
          <span class="name">${info.name}</span>
        </div>
        <div class="card-status">
          <span class="status-dot status-${h.status || 'unknown'}"></span>
          <span class="status-text">${h.message || 'Unknown'}</span>
        </div>
        <div class="card-count">${h.row_count || 0} memories</div>
      </div>
    `;
    sidebar.appendChild(card);
  }
}

export function selectProvider(slug) {
  _selectedProvider = slug;
  saveLastProvider(slug);
  const info = _providers[slug];
  if (!info) return;

  // Update tab active state
  document.querySelectorAll('.provider-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.provider === slug);
  });

  // Show/hide visualiser tabs based on capabilities
  const graphSupported = info.capabilities?.graph;
  const tabConstellation = document.getElementById('tab-constellation');
  const tabNeural = document.getElementById('tab-neural');
  if (tabConstellation) tabConstellation.classList.toggle('hidden', !graphSupported);
  if (tabNeural) tabNeural.classList.toggle('hidden', !graphSupported);

  // Show/hide peer tabs (only for Honcho)
  const peerTabs = document.querySelectorAll('[data-visualiser="peer"], [data-three-mode="peer"]');
  peerTabs.forEach(tab => {
    const isHoncho = slug === 'honcho';
    tab.classList.toggle('nav-hidden', !isHoncho);
    tab.setAttribute('aria-hidden', !isHoncho ? 'true' : 'false');
    tab.tabIndex = isHoncho ? 0 : -1;
  });

  // If switching away from honcho while in peer mode, switch back to constellation
  if (slug !== 'honcho') {
    const currentMode = localStorage.getItem('mnemosyne-dashboard-visualiser-mode');
    if (currentMode === 'peer') {
      localStorage.setItem('mnemosyne-dashboard-visualiser-mode', 'constellation');
    }
  }

  // Notify listeners
  _onSelectCallbacks.forEach(cb => cb(slug, info));
}

export function showEmptyState(providerName, reason) {
  const el = document.getElementById('emptyState');
  if (!el) return;
  el.innerHTML = `
    <div class="empty-emoji">📭</div>
    <h2>${providerName} — no memories found</h2>
    <p>${reason || 'This provider is connected but has no memories yet.'}</p>
    <p class="empty-hint">Add memories via Hermes Agent, then refresh.</p>
  `;
  el.classList.remove('hidden');
  const content = document.getElementById('contentArea');
  if (content) content.classList.add('hidden');
}

export function hideEmptyState() {
  const el = document.getElementById('emptyState');
  if (el) el.classList.add('hidden');
  const content = document.getElementById('contentArea');
  if (content) content.classList.remove('hidden');
}

export function showLoadingSkeleton() {
  const el = document.getElementById('loadingSkeleton');
  if (!el) return;
  el.innerHTML = `
    <div class="skeleton-line" style="width:60%"></div>
    <div class="skeleton-line" style="width:80%"></div>
    <div class="skeleton-line" style="width:40%"></div>
    <div class="skeleton-line" style="width:70%"></div>
  `;
  el.classList.remove('hidden');
  const content = document.getElementById('contentArea');
  if (content) content.classList.add('hidden');
}

export function hideLoadingSkeleton() {
  const el = document.getElementById('loadingSkeleton');
  if (el) el.classList.add('hidden');
  const content = document.getElementById('contentArea');
  if (content) content.classList.remove('hidden');
}

export function showErrorBanner(message, retryFn) {
  const el = document.getElementById('errorBanner');
  if (!el) return;
  const text = document.getElementById('errorText');
  if (text) text.textContent = message;
  const btn = document.getElementById('retryBtn');
  if (btn) btn.onclick = retryFn;
  el.classList.remove('hidden');
}

export function hideErrorBanner() {
  const el = document.getElementById('errorBanner');
  if (el) el.classList.add('hidden');
}

export async function loadProviderContent(slug) {
  showLoadingSkeleton();
  hideErrorBanner();
  try {
    const resp = await fetch(`/api/${slug}/memories?limit=100`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    hideLoadingSkeleton();
    if (!data.memories || data.memories.length === 0) {
      const info = _providers[slug];
      showEmptyState(info?.name || slug, 'No memories found.');
    } else {
      hideEmptyState();
      const content = document.getElementById('contentArea');
      if (content) {
        content.innerHTML = data.memories.map(m => `
          <div class="memory-card">
            <div class="memory-content">${m.content}</div>
            <div class="memory-meta">${m.kind || 'memory'} · ${m.timestamp || ''}</div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    hideLoadingSkeleton();
    showErrorBanner(`Failed to load ${slug}: ${err.message}`, () => loadProviderContent(slug));
  }
}

export async function bootstrapProviderShell() {
  // Load provider registry
  const providersResp = await fetch('/api/providers');
  const { providers } = await providersResp.json();
  _providers = providers;

  // Render shell
  renderProviderTabs(providers);

  // Load health
  const healthResp = await fetch('/api/health');
  const { providers: health } = await healthResp.json();
  renderSidebar(providers, health);

  // Select default provider (don't auto-load content — it dumps memories above the cards)
  const defaultSlug = getDefaultProvider();
  if (providers[defaultSlug]) {
    selectProvider(defaultSlug);
    // loadProviderContent(defaultSlug); // DISABLED: renders above metric cards
  } else if (Object.keys(providers).length === 0) {
    showEmptyState('Book of Shadows', 'No memory providers detected.');
  }
}
