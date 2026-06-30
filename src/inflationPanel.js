const SERIES = [
  { id: 'CPIAUCSL',      label: 'CPI',              color: '#60A5FA', dash: [] },
  { id: 'CPILFESL',      label: 'Core CPI',          color: '#60A5FA', dash: [6, 3] },
  { id: 'PCEPI',         label: 'PCE',               color: '#34D399', dash: [] },
  { id: 'PCEPILFE',      label: 'Core PCE',          color: '#34D399', dash: [6, 3] },
  { id: 'PPIFIS',        label: 'PPI',               color: '#F87171', dash: [] },
  { id: 'CES0500000003', label: 'Avg Hrly Earnings', color: '#FB923C', dash: [] },
];

const SERIES_PAIRS = [[0, 1], [2, 3], [4, 5]];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Parse "YYYY-MM-DD" strings at local noon to avoid UTC-to-local timezone shift (avoids
// dates appearing one month early in US timezones where UTC midnight = prior day local).
function parseDateTs(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

function computeMoM(levels) {
  const result = [];
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1].value;
    if (prev !== 0)
      result.push({ date: levels[i].date, value: +((levels[i].value / prev - 1) * 100).toFixed(3) });
  }
  return result;
}

const crosshairPlugin = {
  id: 'infl-crosshair',
  afterDraw(chart) {
    const active = chart.tooltip?._active;
    if (!active?.length) return;
    const { ctx, chartArea: { top, bottom } } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.strokeStyle = 'rgba(132, 204, 22, 0.8)'; // lime green
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

function toggleBtn(s) {
  const dashAttr = s.dash.length ? ` stroke-dasharray="${s.dash.join(',')}"` : '';
  return `<button class="btn infl-toggle active" data-id="${s.id}">
    <svg width="20" height="8" viewBox="0 0 20 8" style="vertical-align:middle;margin-right:5px"><line x1="0" y1="4" x2="20" y2="4" stroke="${s.color}" stroke-width="2"${dashAttr}/></svg>${s.label}
  </button>`;
}

export async function init(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '<div class="loading-msg">Fetching data…</div>';

  let rawYoY, rawLevel = null;
  try {
    const yoyJson = await fetch('./data/inflation.json').then(r => {
      if (!r.ok) throw new Error(`data/inflation.json not found — run: python3 src/fetch_data.py`);
      return r.json();
    });
    rawYoY = yoyJson.series;

    const levelJson = await fetch('./data/inflation_level.json')
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    rawLevel = levelJson?.series ?? null;
  } catch (err) {
    container.innerHTML = `<div class="fetch-error">${err.message}</div>`;
    return { setRange: () => {} };
  }

  const rawMoM = rawLevel
    ? Object.fromEntries(SERIES.map(s => [s.id, computeMoM(rawLevel[s.id] ?? [])]))
    : null;

  // Populate release-date byline in the panel header
  const datesEl = document.getElementById('infl-dates');
  if (datesEl) {
    const fmtD = d => { if (!d) return '—'; const [y, m] = d.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; };
    datesEl.innerHTML = [
      ['CPI',               'CPIAUCSL'],
      ['PCE',               'PCEPI'],
      ['PPI',               'PPIFIS'],
      ['Avg. Hrly Earnings','CES0500000003'],
    ].map(([label, id]) => `${label} as of ${fmtD(rawYoY[id]?.at(-1)?.date)}`).join('<br>');
  }

  let mode = 'yy';
  const hasMoM = rawMoM !== null;
  const allMaxTs = Date.now();
  const allMinTs = new Date('2000-01-01').getTime();
  const defaultStartTs = Math.max(allMinTs, allMaxTs - 5 * 365.25 * 24 * 3600 * 1000);
  let currentStartTs = defaultStartTs;
  let currentEndTs   = allMaxTs;

  function seriesData(id) {
    return mode === 'yy' ? rawYoY[id] : (rawMoM?.[id] ?? rawYoY[id]);
  }

  function latestValue(id) {
    const data = seriesData(id);
    if (!data?.length) return '—';
    for (let i = data.length - 1; i >= 0; i--) {
      const ts = parseDateTs(data[i].date);
      if (ts >= currentStartTs && ts <= currentEndTs) return data[i].value.toFixed(1) + '%';
    }
    return (data.at(-1)?.value ?? 0).toFixed(1) + '%';
  }

  container.innerHTML = `
    <div class="controls-row" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;align-items:flex-start">

      <div style="display:flex;flex-direction:column;gap:3px">
        <button class="btn mode-btn active" data-mode="yy" title="Year-over-Year % change">Y/Y</button>
        <button class="btn mode-btn" data-mode="mm" title="Month-over-Month % change"${hasMoM ? '' : ' disabled'}>M/M</button>
      </div>

      <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:flex-end">
        ${SERIES_PAIRS.map(([a, b]) => `
          <div style="display:flex;flex-direction:column;gap:3px">
            ${toggleBtn(SERIES[a])}
            ${toggleBtn(SERIES[b])}
          </div>`).join('')}
        <button class="btn" id="infl-toggle-all" title="Toggle all series on/off">None</button>
      </div>

      <div style="margin-left:auto;display:flex;flex-direction:column;gap:3px">
        <button class="btn" id="infl-reset" title="Reset to current time range">Reset Zoom</button>
        <button class="btn active" id="infl-labels" title="Toggle end-of-series labels">Labels</button>
      </div>

    </div>
    <div class="chart-area"><canvas id="infl-canvas"></canvas></div>
  `;

  let labelsOn = true;

  const ctx   = document.getElementById('infl-canvas').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        ...SERIES.map(s => ({
          label: s.label,
          data: (rawYoY[s.id] ?? []).map(d => ({ x: parseDateTs(d.date), y: d.value })),
          borderColor: s.color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: s.dash,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2,
        })),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'x', intersect: false },
      layout: { padding: { right: 100 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          mode: 'x',
          intersect: false,
          filter: item => item.datasetIndex < SERIES.length && item.parsed.y != null && !isNaN(item.parsed.y),
          external({ chart, tooltip }) {
            let el = chart.canvas.parentElement.querySelector('.infl-tt');
            if (!el) {
              el = document.createElement('div');
              el.className = 'infl-tt';
              chart.canvas.parentElement.style.position = 'relative';
              chart.canvas.parentElement.appendChild(el);
            }
            if (tooltip.opacity === 0) { el.style.opacity = '0'; return; }

            const seen = new Set();
            const rows = (tooltip.dataPoints ?? [])
              .filter(item => { if (seen.has(item.datasetIndex)) return false; seen.add(item.datasetIndex); return true; })
              .map(item => {
                const s = SERIES[item.datasetIndex];
                if (!s) return '';
                const dashAttr = s.dash.length ? ` stroke-dasharray="${s.dash.join(',')}"` : '';
                const val = item.parsed.y.toFixed(1) + '%';
                return `<div style="display:flex;align-items:center;gap:8px;padding:1px 0">
                  <svg width="20" height="8" viewBox="0 0 20 8" style="flex-shrink:0"><line x1="0" y1="4" x2="20" y2="4" stroke="${s.color}" stroke-width="2"${dashAttr}/></svg>
                  <span style="min-width:130px;font:12px/1.4 ui-monospace,'Cascadia Mono','Segoe UI Mono',Menlo,monospace;color:#e2e8f0">${s.label}</span>
                  <span style="font:12px/1.4 ui-monospace,'Cascadia Mono','Segoe UI Mono',Menlo,monospace;color:#e2e8f0">${val}</span>
                </div>`;
              }).join('');

            const d = new Date(tooltip.dataPoints?.[0]?.parsed.x);
            const title = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
            el.innerHTML = `<div style="color:#94a3b8;font-size:12px;margin-bottom:6px">${title}</div>${rows}`;
            el.style.cssText = 'position:absolute;pointer-events:none;z-index:10;background:rgba(11,18,32,0.92);border:1px solid rgba(255,255,255,0.10);border-radius:4px;padding:10px;white-space:nowrap;opacity:1;';

            const ca = chart.chartArea;
            const tw = el.offsetWidth || 230;
            const th = el.offsetHeight || 120;
            const flipX = tooltip.caretX + 16 + tw > ca.right;
            el.style.left = (flipX ? tooltip.caretX - tw - 8 : tooltip.caretX + 16) + 'px';
            el.style.top  = Math.min(Math.max(ca.top, tooltip.caretY - th / 2), ca.bottom - th) + 'px';
          },
        },
        zoom: {
          limits: {
            x: { min: 'original', max: 'original', minRange: 1000 * 60 * 60 * 24 * 90 },
          },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
            onZoomComplete: () => fitYToVisibleX(),
          },
          pan: {
            enabled: true,
            mode: 'x',
            button: 2,
            onPanComplete: () => fitYToVisibleX(),
          },
        },
        datalabels: {
          // Show label at each series' own last data point within the visible x range,
          // not just dataset.length-1 — handles staggered release dates correctly.
          display: context => {
            if (!labelsOn) return false;
            const xMax = context.chart.scales.x?.max;
            const data = context.dataset.data;
            const idx  = context.dataIndex;
            const x    = data[idx]?.x;
            if (x == null) return false;
            if (xMax != null && x > xMax) return false;
            const nextX = data[idx + 1]?.x;
            if (nextX == null) return true;
            return xMax != null && nextX > xMax;
          },
          // Rank series by their last visible y-value and spread them across a 150° arc
          // (285° = upper-right → 75° = lower-right) so labels never overlap.
          align: context => {
            const ds   = context.chart.data.datasets;
            const xMax = context.chart.scales.x?.max;
            const i    = context.datasetIndex;
            if (ds[i]?.hidden) return 0;
            const getLastY = data => {
              for (let k = (data?.length ?? 0) - 1; k >= 0; k--) {
                const x = data[k]?.x;
                if (x != null && (xMax == null || x <= xMax)) return data[k]?.y ?? null;
              }
              return null;
            };
            const visible = ds
              .map((d, idx) => ({ idx, y: d.hidden ? null : getLastY(d.data) }))
              .filter(d => d.y != null)
              .sort((a, b) => b.y - a.y);
            const rank = visible.findIndex(d => d.idx === i);
            if (rank < 0 || visible.length <= 1) return 0;
            return Math.round(285 + (rank / (visible.length - 1)) * 150) % 360;
          },
          anchor: 'end',
          offset: 8,
          formatter: (value, context) => {
            const y = typeof value === 'object' ? value?.y : value;
            if (y == null || isNaN(y)) return null;
            const valStr = y.toFixed(1) + '%';
            const visibleCount = context.chart.data.datasets.filter(ds => !ds.hidden).length;
            if (visibleCount >= 4) {
              const SHORT = ['CPI', 'Core CPI', 'PCE', 'Core PCE', 'PPI', 'Avg Hrly'];
              return `${valStr}, ${SHORT[context.datasetIndex] ?? context.dataset.label}`;
            }
            return valStr;
          },
          color: context => context.dataset.borderColor,
          font: { size: 11, weight: '600' },
          padding: { left: 4 },
          clip: false,
        },
        annotation: {
          annotations: {
            zeroLine: {
              type: 'line',
              yMin: 0,
              yMax: 0,
              borderColor: 'rgba(255, 255, 255, 0.4)',
              borderWidth: 1.5,
            },
            fedTarget: {
              type: 'line',
              yMin: 2,
              yMax: 2,
              borderColor: 'rgba(100, 180, 255, 0.5)',
              borderWidth: 1.5,
              borderDash: [6, 4],
              label: { display: false },
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          min: defaultStartTs,
          max: allMaxTs,
          time: { unit: 'month' },
          title: { display: true, text: 'Year', color: '#e2e8f0' },
          grid: {
            color: ctx => ctx.tick?.major
              ? 'rgba(226,232,240,0.18)'
              : 'rgba(226,232,240,0.05)',
          },
          ticks: {
            major: { enabled: true },
            source: 'auto',
            maxTicksLimit: 120,
            autoSkip: true,
            maxRotation: 0,
            color: ctx => ctx.tick?.major ? '#e2e8f0' : 'rgba(226,232,240,0.35)',
            callback(value, index, ticks) {
              if (ticks[index]?.major) return new Date(value).getFullYear().toString();
              return '';
            },
          },
        },
        y: {
          title: { display: true, text: 'YoY %', color: '#e2e8f0' },
          grid: { color: 'rgba(226,232,240,0.12)' },
          ticks: {
            color: '#e2e8f0',
            callback: v => v.toFixed(1) + '%',
          },
        },
      },
    },
    plugins: [crosshairPlugin],
  });

  document.getElementById('infl-canvas').addEventListener('contextmenu', e => e.preventDefault());

  // Prime the Y-axis for the default 5Y window so the initial render is correct.
  recomputeY(defaultStartTs, allMaxTs);

  function animateYAxis(fromMin, fromMax, toMin, toMax, duration = 350) {
    const start = performance.now();
    function step(now) {
      const raw_t = Math.min(1, (now - start) / duration);
      const t = raw_t < 0.5 ? 2 * raw_t * raw_t : -1 + (4 - 2 * raw_t) * raw_t;
      chart.options.scales.y.min = +(fromMin + (toMin - fromMin) * t).toFixed(2);
      chart.options.scales.y.max = +(fromMax + (toMax - fromMax) * t).toFixed(2);
      chart.update('none');
      if (raw_t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function updateToggleAllBtn() {
    const anyActive = SERIES.some((_, i) => !chart.data.datasets[i]?.hidden);
    const btn = document.getElementById('infl-toggle-all');
    if (btn) btn.textContent = anyActive ? 'None' : 'All';
  }

  function recomputeY(startTs, endTs, animate = false) {
    const prevMin = chart.options.scales.y.min;
    const prevMax = chart.options.scales.y.max;

    let yMin = Infinity, yMax = -Infinity;
    SERIES.forEach((s, i) => {
      if (chart.data.datasets[i]?.hidden) return;
      (seriesData(s.id) ?? []).forEach(d => {
        const ts = parseDateTs(d.date);
        if (ts >= startTs && ts <= endTs) {
          yMin = Math.min(yMin, d.value);
          yMax = Math.max(yMax, d.value);
        }
      });
    });

    let newMin = prevMin ?? 0, newMax = prevMax ?? 10;
    if (isFinite(yMin) && isFinite(yMax)) {
      const pad = Math.max(0.5, (yMax - yMin) * 0.06);
      newMin = +(yMin - pad).toFixed(1);
      newMax = +(yMax + pad).toFixed(1);
    }

    if (animate && prevMin != null && prevMax != null) {
      animateYAxis(prevMin, prevMax, newMin, newMax);
    } else {
      chart.options.scales.y.min = newMin;
      chart.options.scales.y.max = newMax;
      chart.update('none');
    }
  }

  function fitYToVisibleX() {
    const xMin = chart.scales.x?.min;
    const xMax = chart.scales.x?.max;
    if (xMin == null || xMax == null) return;
    recomputeY(xMin, xMax, false);
  }

  container.querySelectorAll('.infl-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const dsIdx = SERIES.findIndex(s => s.id === btn.dataset.id);
      btn.classList.toggle('active');
      chart.data.datasets[dsIdx].hidden = !btn.classList.contains('active');
      updateToggleAllBtn();
      recomputeY(currentStartTs, currentEndTs, true);
    });
  });

  container.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!hasMoM || btn.dataset.mode === mode) return;
      container.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;

      SERIES.forEach((s, i) => {
        chart.data.datasets[i].data = seriesData(s.id).map(d => ({
          x: parseDateTs(d.date),
          y: d.value,
        }));
      });
      chart.options.scales.y.title.text = mode === 'yy' ? 'YoY %' : 'MoM %';

      if (chart.options.plugins?.annotation?.annotations?.fedTarget) {
        chart.options.plugins.annotation.annotations.fedTarget.display = mode === 'yy';
      }

      recomputeY(currentStartTs, currentEndTs, true);
    });
  });

  document.getElementById('infl-reset').addEventListener('click', () => {
    chart.options.scales.x.min = currentStartTs;
    chart.options.scales.x.max = currentEndTs;
    recomputeY(currentStartTs, currentEndTs, true);
  });

  document.getElementById('infl-labels').addEventListener('click', () => {
    labelsOn = !labelsOn;
    document.getElementById('infl-labels').classList.toggle('active', labelsOn);
    chart.update('none');
  });

  document.getElementById('infl-toggle-all').addEventListener('click', () => {
    const anyActive = SERIES.some((_, i) => !chart.data.datasets[i]?.hidden);
    SERIES.forEach((s, i) => {
      chart.data.datasets[i].hidden = anyActive;
      const tb = container.querySelector(`.infl-toggle[data-id="${s.id}"]`);
      if (tb) tb.classList.toggle('active', !anyActive);
    });
    updateToggleAllBtn();
    recomputeY(currentStartTs, currentEndTs, true);
  });

  updateToggleAllBtn();

  return {
    setRange(startTs, endTs) {
      currentStartTs = startTs;
      currentEndTs   = endTs;
      chart.resetZoom?.();
      chart.options.scales.x.min = startTs;
      chart.options.scales.x.max = endTs;
      recomputeY(startTs, endTs, false);
    },
  };
}
