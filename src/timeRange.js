export class TimeRangeSelector {
  constructor({ containerId, minTs, maxTs, defaultYears = 5, onChange }) {
    this.minTs    = minTs;
    this.maxTs    = maxTs;
    this.onChange = onChange;
    this._drag    = null;
    this._raf     = null;

    this.startTs = defaultYears > 0
      ? Math.max(minTs, maxTs - defaultYears * 365.25 * 24 * 3600 * 1000)
      : minTs;
    this.endTs = maxTs;

    this.el = document.getElementById(containerId);
    this._render();
    this._bind();
    // Fire initial range synchronously so panels update before first paint
    this.onChange(this.startTs, this.endTs);
  }

  _pct(ts)   { return (ts - this.minTs) / (this.maxTs - this.minTs) * 100; }
  _clamp(ts) { return Math.max(this.minTs, Math.min(this.maxTs, ts)); }

  _render() {
    const sy   = new Date(this.minTs).getFullYear();
    const ey   = new Date(this.maxTs).getFullYear();
    const span = ey - sy;
    const step = span > 15 ? 5 : span > 8 ? 2 : 1;
    const ticks = [];
    for (let y = Math.ceil(sy / step) * step; y <= ey; y += step) {
      const pct = this._pct(new Date(`${y}-01-01`).getTime());
      if (pct >= 0 && pct <= 100)
        ticks.push(`<span style="left:${pct.toFixed(2)}%">${y}</span>`);
    }

    this.el.innerHTML = `
      <div class="trs-top">
        <span class="trs-label">Timeline</span>
        <div class="btn-group">
          <button class="btn trs-p" data-y="1">1Y</button>
          <button class="btn trs-p" data-y="2">2Y</button>
          <button class="btn trs-p active" data-y="5">5Y</button>
          <button class="btn trs-p" data-y="10">10Y</button>
          <button class="btn trs-p" data-y="0">All</button>
        </div>
      </div>
      <div class="trs-wrap" id="trs-wrap">
        <div class="trs-track"></div>
        <div class="trs-sel" id="trs-sel">
          <div class="trs-hl" id="trs-hl"></div>
          <div class="trs-hr" id="trs-hr"></div>
        </div>
        <div class="trs-axis">${ticks.join('')}</div>
      </div>
    `;
    this._updateUI();
  }

  _updateUI() {
    const l   = this._pct(this.startTs);
    const r   = this._pct(this.endTs);
    const sel = document.getElementById('trs-sel');
    if (sel) {
      sel.style.left  = l.toFixed(2) + '%';
      sel.style.width = (r - l).toFixed(2) + '%';
    }
  }

  _emit() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this.onChange(this.startTs, this.endTs));
  }

  _bind() {
    const MIN_SPAN = 30 * 24 * 3600 * 1000;

    this.el.addEventListener('mousedown', e => {
      const t = e.target;
      let type = null;
      if (t.id === 'trs-hl')            type = 'left';
      else if (t.id === 'trs-hr')       type = 'right';
      else if (t.closest('#trs-sel'))   type = 'body';
      if (!type) return;
      e.preventDefault();
      this._drag = { type, startX: e.clientX, s0: this.startTs, e0: this.endTs };
    });

    document.addEventListener('mousemove', e => {
      if (!this._drag) return;
      const wrap = document.getElementById('trs-wrap');
      if (!wrap) return;
      const { type, startX, s0, e0 } = this._drag;
      const dts = ((e.clientX - startX) / (wrap.getBoundingClientRect().width - 64)) * (this.maxTs - this.minTs);

      if (type === 'left') {
        this.startTs = this._clamp(s0 + dts);
        if (this.startTs > this.endTs - MIN_SPAN) this.startTs = this.endTs - MIN_SPAN;
      } else if (type === 'right') {
        this.endTs = this._clamp(e0 + dts);
        if (this.endTs < this.startTs + MIN_SPAN) this.endTs = this.startTs + MIN_SPAN;
      } else {
        const dur = e0 - s0;
        this.startTs = this._clamp(s0 + dts);
        this.endTs   = this.startTs + dur;
        if (this.endTs > this.maxTs) { this.endTs = this.maxTs; this.startTs = this.maxTs - dur; }
        if (this.startTs < this.minTs) { this.startTs = this.minTs; this.endTs = this.minTs + dur; }
      }

      this._updateUI();
      this._emit();
    });

    document.addEventListener('mouseup', () => { this._drag = null; });

    this.el.addEventListener('click', e => {
      const btn = e.target.closest('.trs-p');
      if (!btn) return;
      this.el.querySelectorAll('.trs-p').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const years = +btn.dataset.y;
      this.endTs   = this.maxTs;
      this.startTs = years === 0 ? this.minTs : this._clamp(this.maxTs - years * 365.25 * 24 * 3600 * 1000);
      this._updateUI();
      this.onChange(this.startTs, this.endTs);
    });
  }
}
