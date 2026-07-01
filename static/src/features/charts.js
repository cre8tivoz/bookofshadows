import { esc } from '../utils/escape.js';
import { endpoints } from '../api/endpoints.js';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_ORDER,
  buildAuditActivityChartData,
  buildGrowthChartData,
  loadUplotModule,
  recallDistributionBars,
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

  function disposeInsightsCharts() {
    growthChart?.destroy();
    auditChart?.destroy();
    growthChart = null;
    auditChart = null;
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

  async function loadInsights() {
    const days = Number($('#insightsDays')?.value || 30);
    const growthViewport = $('#growthChartViewport');
    const auditViewport = $('#auditChartViewport');
    if (growthViewport) growthViewport.innerHTML = loadingCardHtml('Loading chart…', 'Fetching memory growth history.');
    if (auditViewport) auditViewport.innerHTML = loadingCardHtml('Loading chart…', 'Fetching admin activity history.');
    try {
      const [growth, audit, recall] = await Promise.all([
        api(endpoints.memoryGrowth(days), { requestKey: 'insights-growth' }),
        api(endpoints.auditActivity(days), { requestKey: 'insights-audit' }),
        api(endpoints.recallDistribution(), { requestKey: 'insights-recall' }),
      ]);
      await renderGrowthChart(growth);
      await renderAuditChart(audit);
      renderRecallDistribution(recall.items || []);
    } catch (e) {
      if (isCancelledRequest(e)) return;
      const message = e?.message || 'Try again.';
      if (growthViewport) growthViewport.innerHTML = fallbackCardHtml('Could not load chart', message);
      if (auditViewport) auditViewport.innerHTML = fallbackCardHtml('Could not load chart', message);
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
  }
  window.addEventListener('resize', resizeInsightsCharts, { passive: true });

  return { loadInsights, disposeInsightsCharts };
}
