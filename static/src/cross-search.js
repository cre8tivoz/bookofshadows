import * as providers from './providers.js';

let _searchDebounce = null;

export function initGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performGlobalSearch();
    }
  });

  input.addEventListener('input', () => {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(performGlobalSearch, 300);
  });

  const btn = document.getElementById('globalSearchButton');
  if (btn) btn.addEventListener('click', performGlobalSearch);

  renderSearchChips(providers.getProviders());
}

export function renderSearchChips(providersMap) {
  const container = document.getElementById('searchProviderChips');
  if (!container) return;
  container.innerHTML = '';
  for (const [slug, info] of Object.entries(providersMap)) {
    const chip = document.createElement('button');
    chip.className = 'provider-chip active';
    chip.dataset.provider = slug;
    chip.innerHTML = `<span class="glyph">${info.glyph}</span>${info.name}`;
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      performGlobalSearch();
    });
    container.appendChild(chip);
  }
}

export async function performGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const resultsContainer = document.getElementById('globalSearchResults');
  if (!input || !resultsContainer) return;

  const q = input.value.trim();
  if (!q) {
    resultsContainer.classList.add('hidden');
    return;
  }

  const activeChips = document.querySelectorAll('.provider-chip.active');
  const providerFilter = Array.from(activeChips).map(c => c.dataset.provider).join(',');

  const params = new URLSearchParams({ q, limit: '100' });
  if (providerFilter) params.set('providers', providerFilter);

  try {
    const resp = await fetch(`/api/search?${params}`);
    const data = await resp.json();
    renderGlobalSearchResults(data.results);
    resultsContainer.classList.remove('hidden');
  } catch (err) {
    console.error('Cross-search failed:', err);
  }
}

function renderGlobalSearchResults(results) {
  const container = document.getElementById('globalSearchResults');
  if (!container) return;
  container.innerHTML = '';

  let totalResults = 0;
  for (const name of Object.keys(results)) {
    totalResults += results[name].rows?.length || 0;
  }

  if (totalResults === 0) {
    container.innerHTML = '<div class="empty-state"><p>No results found.</p></div>';
    return;
  }

  for (const [name, data] of Object.entries(results)) {
    if (!data.rows?.length) continue;
    const info = data.provider || {};
    const section = document.createElement('div');
    section.className = 'search-result-section';
    section.innerHTML = `
      <div class="search-section-header" style="border-left: 3px solid ${info.color || '#666'}">
        <span class="glyph">${info.glyph || ''}</span>
        <span class="name">${info.name || name}</span>
        <span class="count">${data.total || data.rows.length}</span>
      </div>
    `;

    const list = document.createElement('div');
    list.className = 'search-result-rows';
    for (const row of data.rows) {
      const item = document.createElement('div');
      item.className = 'memory-card expandable';
      
      // Build metadata section (hidden by default)
      const metaFields = Object.entries(row.metadata || {}).map(([k, v]) => 
        `<span class="meta-tag">${k}: ${String(v).slice(0, 50)}</span>`
      ).join('');
      
      item.innerHTML = `
        <div class="memory-content">${row.content}</div>
        <div class="memory-meta">
          ${row.kind || 'memory'} · ${row.timestamp || ''}
          ${row.veracity ? ` · ${row.veracity}` : ''}
          ${row.importance ? ` · ${Number(row.importance).toFixed(1)}` : ''}
        </div>
        ${metaFields ? `<div class="memory-metadata hidden">${metaFields}</div>` : ''}
        ${metaFields ? '<button class="expand-btn">Show metadata</button>' : ''}
      `;
      
      // Add expand/collapse handler
      const expandBtn = item.querySelector('.expand-btn');
      const metadataDiv = item.querySelector('.memory-metadata');
      if (expandBtn && metadataDiv) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          metadataDiv.classList.toggle('hidden');
          expandBtn.textContent = metadataDiv.classList.contains('hidden') ? 'Show metadata' : 'Hide metadata';
        });
      }
      
      list.appendChild(item);
    }

    section.appendChild(list);
    container.appendChild(section);
  }
}

export async function loadUnifiedTimeline() {
  const container = document.getElementById('unifiedTimeline');
  if (!container) return;

  container.innerHTML = '<div class="skeleton"><div class="skeleton-line" style="width:60%"></div></div>';

  try {
    const resp = await fetch('/api/timeline?limit=500');
    const data = await resp.json();

    container.innerHTML = '';
    if (!data.timeline || data.timeline.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No timeline entries found.</p></div>';
      return;
    }

    // Add provider filter chips
    const providers = data.providers || [];
    const filterBar = document.createElement('div');
    filterBar.className = 'timeline-filters';
    const activeFilters = new Set(providers);
    
    providers.forEach(provider => {
      const chip = document.createElement('button');
      chip.className = 'timeline-filter-chip active';
      chip.dataset.provider = provider;
      chip.innerHTML = `<span class="glyph">${getProviderGlyph(provider)}</span>${provider}`;
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
        if (activeFilters.has(provider)) {
          activeFilters.delete(provider);
        } else {
          activeFilters.add(provider);
        }
        document.querySelectorAll('.timeline-entry').forEach(entry => {
          const entryProvider = entry.dataset.provider;
          entry.style.display = activeFilters.has(entryProvider) ? '' : 'none';
        });
      });
      filterBar.appendChild(chip);
    });
    container.appendChild(filterBar);

    // Render timeline entries
    let currentDate = '';
    const today = new Date().toISOString().slice(0, 10);
    
    for (const entry of data.timeline) {
      const date = entry.timestamp?.slice(0, 10) || 'Unknown';
      if (date !== currentDate) {
        currentDate = date;
        const dateHeader = document.createElement('div');
        dateHeader.className = 'timeline-date-header';
        dateHeader.textContent = date;
        container.appendChild(dateHeader);
      }

      const item = document.createElement('div');
      item.className = 'timeline-entry';
      item.dataset.provider = entry.provider;
      item.style.borderLeftColor = entry.provider_color || '#666';
      
      // Highlight today's entries
      if (date === today) {
        item.classList.add('today');
      }
      
      item.innerHTML = `
        <span class="provider-badge" style="background:${entry.provider_color || '#666'}">
          ${entry.provider_glyph || ''}
        </span>
        <div class="timeline-content">
          <div class="timeline-text">${entry.content}</div>
          <div class="timeline-meta">${entry.provider_name || entry.provider} · ${entry.kind || 'memory'}</div>
        </div>
        <time class="timeline-time">${entry.timestamp?.slice(11, 16) || ''}</time>
      `;
      container.appendChild(item);
    }

    // Show toast for unavailable timelines
    renderTimelineAvailability(providers);
  } catch (err) {
    container.innerHTML = `<div class="error-banner">Timeline load failed: ${err.message}</div>`;
  }
}

function getProviderGlyph(provider) {
  const glyphs = { mnemosyne: '🧠', mempalace: '🏰', mem0: '☁️', honcho: '🪞' };
  return glyphs[provider] || '📦';
}

function renderTimelineAvailability(activeProviders) {
  // Show info about providers that don't support timeline
  const allProviders = window._providers || {};
  const unavailable = Object.entries(allProviders)
    .filter(([slug, info]) => !info.capabilities?.timeline && activeProviders.includes(slug))
    .map(([_, info]) => info.name);

  if (unavailable.length > 0 && typeof showToast === 'function') {
    showToast({
      tone: 'info',
      title: 'Partial timeline',
      body: `Timeline not available for: ${unavailable.join(', ')}`
    });
  }
}
