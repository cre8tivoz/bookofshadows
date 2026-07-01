import { esc } from '../utils/escape.js';
import { endpoints } from '../api/endpoints.js';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_ORDER,
  buildAuditActivityChartData,
  buildGrowthChartData,
  buildLifecycleTransitionChartData,
  buildNamedSeriesChartData,
  buildReviewBacklogChartData,
  buildVeracityMixChartData,
  heatmapCells,
  loadUplotModule,
  rankedBars,
  recallDistributionBars,
  VERACITY_LABELS,
  VERACITY_ORDER,
} from '../utils/charts.js';

const CHART_HEIGHT_FALLBACK = 240;

function isCancelledRequest(error) {
  return error?.name === 'ApiError' && error.status === 0 && !error.retryable;
}

function resolveCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function withAlpha(hex, alpha) {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex;
}

function loadingCardHtml(title, detail) {
  return `<div class="async-loading-card"><h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`;
}

function fallbackCardHtml(title, detail) {
  return `<div class="async-fallback-card"><h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`;
}

function chartTooltipPlugin(labels, colors) {
  let tooltip = null;
  return {
    hooks: {
      init: (u) => {
        tooltip = document.createElement('div');
        tooltip.className = 'u-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.display = 'none';
        tooltip.style.zIndex = '5';
        u.over.appendChild(tooltip);
      },
      setCursor: (u) => {
        if (!tooltip) return;
        const { idx } = u.cursor;
        if (idx == null) {
          tooltip.style.display = 'none';
          return;
        }
        const x = u.data[0][idx];
        const rows = labels
          .map((label, i) => {
            const value = u.data[i + 1]?.[idx] ?? 0;
            return `<div><span style="color:${esc(colors[i])}">${esc(label)}</span> <strong>${esc(String(value))}</strong></div>`;
          })
          .join('');
        tooltip.innerHTML = `<div class="u-tooltip-date">${esc(new Date(x * 1000).toLocaleDateString())}</div>${rows}`;
        tooltip.style.display = 'block';
        const overWidth = u.over.clientWidth;
        const left = u.cursor.left ?? 0;
        const top = u.cursor.top ?? 0;
        tooltip.style.left = `${Math.max(0, Math.min(left + 12, overWidth - tooltip.offsetWidth - 4))}px`;
        tooltip.style.top = `${Math.max(0, top - 8)}px`;
      },
    },
  };
}

export function createChartsFeature({ $, api, switchTab, loadMemories }) {
  let growthChart = null;
  let auditChart = null;
  let veracityChart = null;
  let sourceChart = null;
  let reviewBacklogChart = null;
  let lifecycleChart = null;

  function disposeInsightsCharts() {
    growthChart?.destroy();
    auditChart?.destroy();
    veracityChart?.destroy();
    sourceChart?.destroy();
    reviewBacklogChart?.destroy();
    lifecycleChart?.destroy();
    growthChart = null;
    auditChart = null;
    veracityChart = null;
    sourceChart = null;
    reviewBacklogChart = null;
    lifecycleChart = null;
  }

  function baseChartOptions(viewport, series) {
    const axisColor = resolveCssVar('--text-muted');
    const gridColor = resolveCssVar('--chart-grid');
    return {
      width: viewport.clientWidth || 600,
      height: viewport.clientHeight || CHART_HEIGHT_FALLBACK,
      series,
      scales: { x: { time: true } },
      axes: [
        { stroke: axisColor, grid: { stroke: gridColor }, ticks: { stroke: gridColor } },
        { stroke: axisColor, grid: { stroke: gridColor }, ticks: { stroke: gridColor } },
      ],
      cursor: { drag: { x: true, y: false } },
    };
  }

  async function renderGrowthChart(seriesData) {
    const viewport = $('#growthChartViewport');
    if (!viewport) return;
    const { default: uPlot } = await loadUplotModule();
    const data = buildGrowthChartData(seriesData);
    const labels = ['Working', 'Episodic'];
    const colors = [resolveCssVar('--chart-1'), resolveCssVar('--chart-2')];
    const series = [
      {},
      ...labels.map((label, i) => ({
        label,
        stroke: colors[i],
        width: 2,
        fill: withAlpha(colors[i], '26'),
      })),
    ];
    growthChart?.destroy();
    viewport.innerHTML = '';
    growthChart = new uPlot(
      { ...baseChartOptions(viewport, series), plugins: [chartTooltipPlugin(labels, colors)] },
      data,
      viewport,
    );
  }

  async function renderAuditChart(seriesData) {
    const viewport = $('#auditChartViewport');
    if (!viewport) return;
    const { default: uPlot } = await loadUplotModule();
    const data = buildAuditActivityChartData(seriesData);
    const labels = AUDIT_ACTION_ORDER.map((action) => AUDIT_ACTION_LABELS[action]);
    const colors = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'].map(resolveCssVar);
    const series = [
      {},
      ...labels.map((label, i) => ({
        label,
        stroke: colors[i],
        width: 2,
      })),
    ];
    auditChart?.destroy();
    viewport.innerHTML = '';
    auditChart = new uPlot(
      { ...baseChartOptions(viewport, series), plugins: [chartTooltipPlugin(labels, colors)] },
      data,
      viewport,
    );
  }

  async function renderMultiSeriesChart({ viewportId, labels, data, colors, currentChart, assignChart }) {
    const viewport = $(`#${viewportId}`);
    if (!viewport) return;
    const { default: uPlot } = await loadUplotModule();
    const series = [
      {},
      ...labels.map((label, i) => ({
        label,
        stroke: colors[i % colors.length],
        width: 2,
        fill: labels.length <= 4 ? withAlpha(colors[i % colors.length], '1c') : undefined,
      })),
    ];
    currentChart?.destroy();
    viewport.innerHTML = '';
    assignChart(new uPlot(
      { ...baseChartOptions(viewport, series), plugins: [chartTooltipPlugin(labels, colors)] },
      data,
      viewport,
    ));
  }

  function chartColors(count) {
    const vars = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6'];
    return Array.from({ length: count }, (_, i) => resolveCssVar(vars[i % vars.length]));
  }

  async function renderVeracityChart(seriesData) {
    const data = buildVeracityMixChartData(seriesData);
    const labels = VERACITY_ORDER.map((name) => VERACITY_LABELS[name]);
    await renderMultiSeriesChart({
      viewportId: 'veracityChartViewport',
      labels,
      data,
      colors: chartColors(labels.length),
      currentChart: veracityChart,
      assignChart: (chart) => { veracityChart = chart; },
    });
  }

  async function renderSourceChart(seriesData) {
    const { names, data } = buildNamedSeriesChartData(seriesData, 'sources', 'by_source');
    await renderMultiSeriesChart({
      viewportId: 'sourceChartViewport',
      labels: names,
      data,
      colors: chartColors(names.length),
      currentChart: sourceChart,
      assignChart: (chart) => { sourceChart = chart; },
    });
  }

  async function renderReviewBacklogChart(seriesData) {
    const { labels, data } = buildReviewBacklogChartData(seriesData);
    await renderMultiSeriesChart({
      viewportId: 'reviewBacklogChartViewport',
      labels,
      data,
      colors: chartColors(labels.length),
      currentChart: reviewBacklogChart,
      assignChart: (chart) => { reviewBacklogChart = chart; },
    });
  }

  async function renderLifecycleChart(seriesData) {
    const { labels, data } = buildLifecycleTransitionChartData(seriesData);
    await renderMultiSeriesChart({
      viewportId: 'lifecycleChartViewport',
      labels,
      data,
      colors: chartColors(labels.length),
      currentChart: lifecycleChart,
      assignChart: (chart) => { lifecycleChart = chart; },
    });
  }

  function renderRecallDistribution(items) {
    const el = $('#recallDistribution');
    if (!el) return;
    const bars = recallDistributionBars(items);
    if (!bars.some((bar) => bar.count > 0)) {
      el.innerHTML = '<span class="muted">No recall activity recorded yet.</span>';
      return;
    }
    el.innerHTML = bars
      .map(
        (bar) =>
          `<button class="pattern-bar" data-bucket="${esc(bar.bucket)}" title="Browse memories recalled ${esc(bar.bucket)} times"><span class="pattern-bar-fill" style="width:${bar.percent}%"></span><span class="pattern-bar-label">Recalled ${esc(bar.bucket)}×</span><strong>${bar.count.toLocaleString()}</strong></button>`,
      )
      .join('');
    el.querySelectorAll('.pattern-bar').forEach((btn) => {
      btn.onclick = () => {
        switchTab('memories');
        $('#memoryStatus').value = 'active';
        $('#memorySort').value = 'recall';
        $('#memoryQuery').value = '';
        loadMemories();
      };
    });
  }

  function renderBars(el, items, emptyText, onClick) {
    if (!el) return;
    const bars = rankedBars(items);
    if (!bars.some((bar) => bar.count > 0)) {
      el.innerHTML = `<span class="muted">${esc(emptyText)}</span>`;
      return;
    }
    el.innerHTML = bars.map((bar) =>
      `<button class="pattern-bar" data-query="${esc(bar.query)}"><span class="pattern-bar-fill" style="width:${bar.percent}%"></span><span class="pattern-bar-label">${esc(bar.label)}</span><strong>${bar.count.toLocaleString()}</strong></button>`,
    ).join('');
    el.querySelectorAll('.pattern-bar').forEach((btn) => {
      btn.onclick = () => onClick(btn.dataset.query || '');
    });
  }

  function renderClusters(payload) {
    const jumpToMemories = (query) => {
      switchTab('memories');
      $('#memoryStatus').value = 'active';
      $('#memoryQuery').value = query || '';
      loadMemories();
    };
    renderBars($('#domainClusters'), payload?.domains || [], 'No domain clusters detected yet.', jumpToMemories);
    renderBars($('#entityClusters'), payload?.entities || [], 'No entity clusters detected yet.', jumpToMemories);
  }

  function renderSessionHeatmap(payload) {
    const el = $('#sessionHeatmap');
    if (!el) return;
    const rows = heatmapCells(payload);
    if (!rows.length || !rows.some((row) => row.cells.some((cell) => cell.count > 0))) {
      el.innerHTML = '<span class="muted">No recent session activity found.</span>';
      return;
    }
    el.innerHTML = `
      <div class="heatmap-hours">${(payload.hours || []).map((hour) => `<span>${hour % 6 === 0 ? hour : ''}</span>`).join('')}</div>
      ${rows.map((row) => `
        <div class="heatmap-row">
          <strong>${esc(row.day)}</strong>
          <div class="heatmap-cells">${row.cells.map((cell) => `<span class="heat-cell" title="${esc(row.day)} ${cell.hour}:00 · ${cell.count} memories" style="--heat:${cell.intensity}"></span>`).join('')}</div>
        </div>
      `).join('')}
    `;
  }

  function renderActionCards(payload) {
    const el = $('#insightCards');
    if (!el) return;
    const cards = payload?.cards || [];
    if (!cards.length) {
      el.innerHTML = '<span class="muted">No insight cards available yet.</span>';
      return;
    }
    el.innerHTML = cards.map((card) => `
      <button class="insight-action-card" data-tab="${esc(card.action?.tab || '')}" data-queue="${esc(card.action?.queue || '')}" data-query="${esc(card.action?.q || '')}" data-session="${esc(card.action?.session_id || '')}">
        <span>${esc(card.title || 'Insight')}</span>
        <strong>${Number(card.value || 0).toLocaleString()}</strong>
        <em>${esc(card.detail || '')}</em>
      </button>
    `).join('');
    el.querySelectorAll('.insight-action-card').forEach((card) => {
      card.onclick = () => {
        if (card.dataset.tab === 'review') {
          switchTab('review');
          const select = $('#reviewQueueSelect');
          if (select && card.dataset.queue) select.value = card.dataset.queue;
          return;
        }
        switchTab('memories');
        $('#memoryStatus').value = 'active';
        if (card.dataset.query) $('#memoryQuery').value = card.dataset.query;
        if (card.dataset.session) $('#memorySession').value = card.dataset.session;
        loadMemories();
      };
    });
  }

  async function loadInsights() {
    const days = Number($('#insightsDays')?.value || 30);
    const loadingTargets = [
      ['growthChartViewport', 'Fetching memory growth history.'],
      ['auditChartViewport', 'Fetching admin activity history.'],
      ['veracityChartViewport', 'Fetching trust mix history.'],
      ['sourceChartViewport', 'Fetching source breakdown history.'],
      ['reviewBacklogChartViewport', 'Fetching review backlog history.'],
      ['lifecycleChartViewport', 'Fetching lifecycle events.'],
    ];
    loadingTargets.forEach(([id, detail]) => {
      const el = $(`#${id}`);
      if (el) el.innerHTML = loadingCardHtml('Loading chart…', detail);
    });
    try {
      const [growth, audit, recall, veracity, sources, reviewBacklog, lifecycle, clusters, heatmap, actionCards] = await Promise.all([
        api(endpoints.memoryGrowth(days), { requestKey: 'insights-growth' }),
        api(endpoints.auditActivity(days), { requestKey: 'insights-audit' }),
        api(endpoints.recallDistribution(), { requestKey: 'insights-recall' }),
        api(endpoints.veracityMix(days), { requestKey: 'insights-veracity' }),
        api(endpoints.sourceBreakdown(days), { requestKey: 'insights-sources' }),
        api(endpoints.reviewBacklog(days), { requestKey: 'insights-review-backlog' }),
        api(endpoints.lifecycleTransitions(days), { requestKey: 'insights-lifecycle' }),
        api(endpoints.entityClusters(10), { requestKey: 'insights-clusters' }),
        api(endpoints.sessionHeatmap(days), { requestKey: 'insights-heatmap' }),
        api(endpoints.actionCards(), { requestKey: 'insights-cards' }),
      ]);
      await renderGrowthChart(growth);
      await renderAuditChart(audit);
      await renderVeracityChart(veracity);
      await renderSourceChart(sources);
      await renderReviewBacklogChart(reviewBacklog);
      await renderLifecycleChart(lifecycle);
      renderRecallDistribution(recall.items || []);
      renderClusters(clusters);
      renderSessionHeatmap(heatmap);
      renderActionCards(actionCards);
    } catch (e) {
      if (isCancelledRequest(e)) return;
      const message = e?.message || 'Try again.';
      loadingTargets.forEach(([id]) => {
        const el = $(`#${id}`);
        if (el) el.innerHTML = fallbackCardHtml('Could not load chart', message);
      });
    }
  }

  function resizeInsightsCharts() {
    const growthViewport = $('#growthChartViewport');
    const auditViewport = $('#auditChartViewport');
    if (growthChart && growthViewport) {
      growthChart.setSize({ width: growthViewport.clientWidth || 600, height: growthViewport.clientHeight || CHART_HEIGHT_FALLBACK });
    }
    if (auditChart && auditViewport) {
      auditChart.setSize({ width: auditViewport.clientWidth || 600, height: auditViewport.clientHeight || CHART_HEIGHT_FALLBACK });
    }
    [
      [veracityChart, $('#veracityChartViewport')],
      [sourceChart, $('#sourceChartViewport')],
      [reviewBacklogChart, $('#reviewBacklogChartViewport')],
      [lifecycleChart, $('#lifecycleChartViewport')],
    ].forEach(([chart, viewport]) => {
      if (chart && viewport) chart.setSize({ width: viewport.clientWidth || 600, height: viewport.clientHeight || CHART_HEIGHT_FALLBACK });
    });
  }
  window.addEventListener('resize', resizeInsightsCharts, { passive: true });

  return { loadInsights, disposeInsightsCharts };
}
