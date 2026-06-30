const TREASURY = [
  { id: 'DGS1MO', maturity: 1 / 12 },
  { id: 'DGS3MO', maturity: 3 / 12 },
  { id: 'DGS6MO', maturity: 6 / 12 },
  { id: 'DGS1',   maturity: 1 },
  { id: 'DGS2',   maturity: 2 },
  { id: 'DGS3',   maturity: 3 },
  { id: 'DGS5',   maturity: 5 },
  { id: 'DGS7',   maturity: 7 },
  { id: 'DGS10',  maturity: 10 },
  { id: 'DGS20',  maturity: 20 },
  { id: 'DGS30',  maturity: 30 },
];

const TIPS = [
  { id: 'DFII5',  maturity: 5 },
  { id: 'DFII7',  maturity: 7 },
  { id: 'DFII10', maturity: 10 },
  { id: 'DFII20', maturity: 20 },
  { id: 'DFII30', maturity: 30 },
];

const BREAKEVEN_PAIRS = [
  { treasury: 'DGS5',  tips: 'DFII5',  maturity: 5 },
  { treasury: 'DGS7',  tips: 'DFII7',  maturity: 7 },
  { treasury: 'DGS10', tips: 'DFII10', maturity: 10 },
  { treasury: 'DGS20', tips: 'DFII20', maturity: 20 },
  { treasury: 'DGS30', tips: 'DFII30', maturity: 30 },
];

const SPEEDS = [0.5, 1, 2, 4];
const BASE_MS = 800;

// Parse "YYYY-MM" or "YYYY-MM-DD" strings at local noon to prevent UTC midnight
// from appearing as the prior month in US timezones.
function parseDateTs(str) {
  const parts = str.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2] ?? 1, 12).getTime();
}

export async function init(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = buildShell();

  let raw, fetchedAt;
  try {
    const json = await fetch('./data/yield_curve.json').then(r => {
      if (!r.ok) throw new Error(`data/yield_curve.json not found — run: python3 src/fetch_data.py`);
      return r.json();
    });
    raw       = json.series;
    fetchedAt = json.fetched_at;
  } catch (err) {
    container.querySelector('.chart-area').innerHTML =
      `<div class="fetch-error">${err.message}</div>`;
    return { fetchedAt: null, setRange: () => {} };
  }

  const snapshots = buildSnapshots(raw);
  container.querySelector('.chart-area').innerHTML = '<canvas id="yc-canvas"></canvas>';

  const ctx   = document.getElementById('yc-canvas').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [] },
    options: chartOptions(),
  });

  const slider   = document.getElementById('yc-slider');
  const controls = container.querySelector('.controls-row');
  controls.style.opacity       = '';
  controls.style.pointerEvents = '';

  let activeSnapshots = snapshots;
  let idx     = snapshots.length - 1;
  let playing = false;
  let speed   = 1;
  let timer   = null;
  const visible = { treasury: true, tips: true, breakeven: true };

  function render(i, animated = false) {
    idx = i;
    const snap = activeSnapshots[i];
    if (!snap) return;

    const newDatasets = makeDatasets(snap, visible);

    if (animated && chart.data.datasets.length > 0) {
      // Update data in-place so Chart.js animates FROM the current rendered
      // positions TO the new positions, rather than restarting from zero.
      newDatasets.forEach((ds, j) => {
        chart.data.datasets[j].data   = ds.data;
        chart.data.datasets[j].hidden = ds.hidden;
      });
      chart.options.animation = { duration: 600, easing: 'easeInOutSine' };
      chart.update();
    } else {
      chart.data.datasets = newDatasets;
      chart.update('none');
    }

    updateStats(snap);
    document.getElementById('yc-date').textContent = snap.month;
    slider.value = i;
  }

  function updateStats(snap) {
    const v      = snap.values;
    const pct    = n => n != null ? n.toFixed(2) + '%' : '—';
    const spread = (a, b) => {
      if (a == null || b == null) return '—';
      const d = a - b;
      return (d >= 0 ? '+' : '') + d.toFixed(2) + '%';
    };
    const bei = (v['DGS10'] != null && v['DFII10'] != null) ? v['DGS10'] - v['DFII10'] : null;
    document.getElementById('yc-stat-10y').textContent   = pct(v['DGS10']);
    document.getElementById('yc-stat-10y2y').textContent = spread(v['DGS10'], v['DGS2']);
    document.getElementById('yc-stat-10y3m').textContent = spread(v['DGS10'], v['DGS3MO']);
    document.getElementById('yc-stat-bei').textContent    = pct(bei);
    document.getElementById('yc-stat-real').textContent   = pct(v['DFII10']);
    document.getElementById('yc-stat-30y10y').textContent = spread(v['DGS30'], v['DGS10']);
  }

  function play() {
    playing = true;
    document.getElementById('yc-play').textContent = '⏸';
    timer = setInterval(
      () => render(idx + 1 >= activeSnapshots.length ? 0 : idx + 1, true),
      BASE_MS / speed
    );
  }

  function pause() {
    playing = false;
    document.getElementById('yc-play').textContent = '▶';
    clearInterval(timer);
  }

  document.getElementById('yc-play').addEventListener('click', () => playing ? pause() : play());

  slider.addEventListener('input', e => { pause(); render(+e.target.value, false); });

  container.querySelectorAll('.yc-speed').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.yc-speed').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      speed = +btn.dataset.speed;
      if (playing) { pause(); play(); }
    });
  });

  container.querySelectorAll('.yc-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.series;
      visible[s] = !visible[s];
      btn.classList.toggle('active');
      render(idx, false);
    });
  });

  render(activeSnapshots.length - 1, false);

  return {
    fetchedAt,
    setRange(startTs, endTs) {
      pause();
      activeSnapshots = snapshots.filter(s => {
        const ts = parseDateTs(s.month + '-01');
        return ts >= startTs && ts <= endTs;
      });
      if (!activeSnapshots.length) return;

      // Lock y-axis to the range's full extent so axis stays stable during animation
      const { yMin, yMax } = computeYRange(activeSnapshots);
      chart.options.scales.y.min = yMin;
      chart.options.scales.y.max = yMax;

      slider.max = activeSnapshots.length - 1;
      render(activeSnapshots.length - 1, false);
    },
  };
}

function buildShell() {
  return `
    <div class="stat-row">
      <div class="stat-card">
        <span class="stat-label">10Y Yield</span>
        <span class="stat-value" id="yc-stat-10y">—</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">10Y – 2Y</span>
        <span class="stat-value" id="yc-stat-10y2y">—</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">10Y – 3M</span>
        <span class="stat-value" id="yc-stat-10y3m">—</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">10Y Breakeven</span>
        <span class="stat-value" id="yc-stat-bei">—</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">10Y Real</span>
        <span class="stat-value" id="yc-stat-real">—</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">30Y – 10Y</span>
        <span class="stat-value" id="yc-stat-30y10y">—</span>
      </div>
    </div>
    <div class="controls-row" style="opacity:0.35;pointer-events:none">
      <button id="yc-play" class="btn">▶</button>
      <span id="yc-date" class="snap-date"></span>
      <input type="range" id="yc-slider" min="0" value="0" class="range-slider">
      <div class="btn-group">
        ${SPEEDS.map(s => `<button class="btn yc-speed${s === 1 ? ' active' : ''}" data-speed="${s}">${s}×</button>`).join('')}
      </div>
      <div class="btn-group">
        <button class="btn yc-toggle active" data-series="treasury">Nominal</button>
        <button class="btn yc-toggle active" data-series="tips">TIPS</button>
        <button class="btn yc-toggle active" data-series="breakeven">Breakeven</button>
      </div>
    </div>
    <div class="chart-area">
      <div class="loading-msg">Fetching data…</div>
    </div>
  `;
}

function buildSnapshots(raw) {
  const byMonth = {};
  for (const [id, obs] of Object.entries(raw)) {
    for (const { date, value } of obs) {
      const m = date.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = {};
      if (byMonth[m][id] === undefined) byMonth[m][id] = value;
    }
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, values]) => ({ month, values }));
}

function computeYRange(snaps) {
  let min = Infinity, max = -Infinity;
  for (const { values: v } of snaps) {
    for (const s of TREASURY) {
      if (v[s.id] != null) { min = Math.min(min, v[s.id]); max = Math.max(max, v[s.id]); }
    }
    for (const s of TIPS) {
      if (v[s.id] != null) { min = Math.min(min, v[s.id]); max = Math.max(max, v[s.id]); }
    }
    for (const p of BREAKEVEN_PAIRS) {
      if (v[p.treasury] != null && v[p.tips] != null) {
        const bei = v[p.treasury] - v[p.tips];
        min = Math.min(min, bei);
        max = Math.max(max, bei);
      }
    }
  }
  if (!isFinite(min)) return { yMin: 0, yMax: 6 };
  const pad = Math.max(0.3, (max - min) * 0.08);
  return {
    yMin: +Math.min(0, min - pad).toFixed(1),
    yMax: +(max + pad).toFixed(1),
  };
}

function makeDatasets(snap, visible) {
  const v = snap.values;
  // Always emit a fixed-length array (null where data is absent) so that
  // Chart.js can match points by index across frames for smooth animation.
  return [
    {
      label: 'Treasury Nominal',
      data: TREASURY.map(s => ({ x: s.maturity, y: v[s.id] ?? null })),
      borderColor: '#60A5FA',
      backgroundColor: 'rgba(96,165,250,0.07)',
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.35,
      spanGaps: true,
      fill: false,
      hidden: !visible.treasury,
    },
    {
      label: 'TIPS Real',
      data: TIPS.map(s => ({ x: s.maturity, y: v[s.id] ?? null })),
      borderColor: '#34D399',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.35,
      spanGaps: true,
      fill: false,
      hidden: !visible.tips,
    },
    {
      label: 'Breakeven',
      data: BREAKEVEN_PAIRS.map(p => ({
        x: p.maturity,
        y: (v[p.treasury] != null && v[p.tips] != null)
          ? +(v[p.treasury] - v[p.tips]).toFixed(3)
          : null,
      })),
      borderColor: '#FBBF24',
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0,
      spanGaps: true,
      fill: false,
      hidden: !visible.breakeven,
    },
  ];
}

function maturityLabel(v) {
  if (v < 0.1)  return '1M';
  if (v < 0.3)  return '3M';
  if (v < 0.6)  return '6M';
  if (v < 1.5)  return '1Y';
  if (v < 2.5)  return '2Y';
  if (v < 3.5)  return '3Y';
  if (v < 5.5)  return '5Y';
  if (v < 8)    return '7Y';
  if (v < 15)   return '10Y';
  if (v < 25)   return '20Y';
  return '30Y';
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    // 'x' mode finds every dataset's point at the same x-coordinate, so
    // hovering at 10Y returns Nominal + TIPS + Breakeven (all share that maturity).
    // 'index' would use array position, which fails because TIPS/Breakeven only
    // have 5 points while Treasury has 11.
    interaction: { mode: 'x', intersect: false },
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      annotation: {
        annotations: {
          zeroLine: {
            type: 'line',
            yMin: 0,
            yMax: 0,
            borderColor: 'rgba(255, 255, 255, 0.4)',
            borderWidth: 1.5,
          },
        },
      },
      tooltip: {
        bodyFont: { family: 'ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, monospace', size: 12 },
        callbacks: {
          title: items => 'Maturity: ' + maturityLabel(items[0]?.parsed.x),
          label: item => {
            const name = item.dataset.label.padEnd(18);
            const val  = item.parsed.y.toFixed(2) + '%';
            return ` ${name}${val.padStart(7)}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: 0,
        max: 32,
        afterBuildTicks: scale => {
          scale.ticks = TREASURY.map(s => ({ value: s.maturity }));
        },
        title: { display: true, text: 'Maturity', color: '#e2e8f0' },
        grid: { color: 'rgba(226,232,240,0.12)' },
        ticks: {
          color: '#e2e8f0',
          maxRotation: 45,
          minRotation: 0,
          callback: v => (v < 0.15 || (v > 0.35 && v < 0.75)) ? '' : maturityLabel(v),
        },
      },
      y: {
        title: { display: true, text: 'Yield (%)', color: '#e2e8f0' },
        grid: { color: 'rgba(226,232,240,0.12)' },
        ticks: {
          color: '#e2e8f0',
          callback: v => v.toFixed(1) + '%',
        },
      },
    },
  };
}
