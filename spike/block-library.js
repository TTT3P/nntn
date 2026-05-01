/* ============================================================
 * NNTN · Block Library (Phase 6)
 * --------------------------------------------------------------
 * <block-card> = chrome (title, period, trend, tooltip, states)
 * Body is slotted HTML — child blocks below are convenience
 * authors that emit body content for the common block kinds.
 *
 * Pattern: block-card handles state (loading | empty | error |
 * ready) + chrome; body is whatever you slot. Inline SVG only,
 * zero deps.
 * ============================================================ */

(function () {

  /* ────────────── shared svg helpers ────────────── */
  function svg(tag, attrs, children) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (children) for (const c of children) el.appendChild(c);
    return el;
  }
  function path(d, attrs) { return svg('path', Object.assign({ d: d }, attrs || {})); }

  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toFixed(1);
  }
  function parseJSON(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch (e) { return fallback; }
  }

  /* ───────────────────────────────────────────────────────
   * <block-card> — universal chrome
   *   attrs:
   *     title         · "Revenue · 7d"
   *     period        · "7d" | "30d" | "today"  (badge)
   *     tooltip       · "Sum of v_sales_daily.gross"
   *     trend         · numeric (+12.4 / -3.2)
   *     trend-suffix  · "%" (default)
   *     state         · "ready" | "loading" | "empty" | "error"
   *     drilldown     · "/sales-ops-dashboard.html#tile-revenue"
   *     compact       · boolean (smaller padding)
   * ─────────────────────────────────────────────────────── */
  class BlockCard extends HTMLElement {
    static get observedAttributes() { return ['title', 'period', 'tooltip', 'trend', 'trend-suffix', 'state', 'drilldown', 'compact', 'subtitle']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }

    render() {
      const title    = this.getAttribute('title') || '';
      const subtitle = this.getAttribute('subtitle') || '';
      const period   = this.getAttribute('period') || '';
      const tooltip  = this.getAttribute('tooltip') || '';
      const trend    = this.getAttribute('trend');
      const tSuf     = this.getAttribute('trend-suffix') || '%';
      const state    = this.getAttribute('state') || 'ready';
      const drill    = this.getAttribute('drilldown') || '';
      const compact  = this.hasAttribute('compact');

      // Preserve slotted children — extract once on first render
      if (!this._slotHTML) {
        this._slotHTML = this.innerHTML.trim();
      }
      const body = this._slotHTML;

      const trendNum = trend != null ? parseFloat(trend) : null;
      const trendUp  = trendNum != null && trendNum >= 0;
      const trendStr = trendNum != null
        ? (trendUp ? '↑ +' : '↓ ') + Math.abs(trendNum) + tSuf
        : '';

      this.innerHTML = `
        <article class="bc bc--state-${state}${compact ? ' bc--compact' : ''}">
          <header class="bc__head">
            <div class="bc__title-row">
              <h3 class="bc__title">${title}</h3>
              ${tooltip ? `<button class="bc__info" type="button" aria-label="info" data-tooltip="${tooltip.replace(/"/g, '&quot;')}">?</button>` : ''}
            </div>
            <div class="bc__chips">
              ${period ? `<span class="bc__period">${period}</span>` : ''}
              ${trendStr ? `<span class="bc__trend bc__trend--${trendUp ? 'up' : 'down'}">${trendStr}</span>` : ''}
            </div>
          </header>
          ${subtitle ? `<div class="bc__subtitle">${subtitle}</div>` : ''}
          <div class="bc__body">
            ${state === 'loading' ? this._loadingHTML() : ''}
            ${state === 'empty'   ? this._emptyHTML()   : ''}
            ${state === 'error'   ? this._errorHTML()   : ''}
            ${state === 'ready'   ? body                : ''}
          </div>
          ${drill && state === 'ready' ? `<a class="bc__drill" href="${drill}">drilldown →</a>` : ''}
        </article>
      `;
    }

    _loadingHTML() {
      return `<div class="bc__skeleton"><div class="bc__skel-row"></div><div class="bc__skel-row" style="width: 70%"></div><div class="bc__skel-row" style="width: 50%"></div></div>`;
    }
    _emptyHTML() {
      const msg = this.getAttribute('empty-text') || 'ยังไม่มีข้อมูลในช่วงนี้';
      const cta = this.getAttribute('empty-cta');
      return `<div class="bc__empty">
        <div class="bc__empty-icon">∅</div>
        <p>${msg}</p>
        ${cta ? `<button class="bc__empty-cta">${cta}</button>` : ''}
      </div>`;
    }
    _errorHTML() {
      const msg = this.getAttribute('error-text') || 'โหลด data ไม่ได้';
      return `<div class="bc__error">
        <div class="bc__error-icon">!</div>
        <p>${msg}</p>
        <button class="bc__retry">ลองอีกครั้ง</button>
      </div>`;
    }
  }
  customElements.define('block-card', BlockCard);


  /* ───────────────────────────────────────────────────────
   * Body authors — emit inline HTML/SVG, then designed to be
   * placed inside <block-card> as slotted content.
   *
   * Each is a custom element that renders into itself (no shadow
   * DOM) so block-card's slot model still works.
   * ─────────────────────────────────────────────────────── */

  /* metric-kpi · big number + caption */
  class MetricKPI extends HTMLElement {
    connectedCallback() {
      const value = this.getAttribute('value') || '—';
      const unit  = this.getAttribute('unit') || '';
      const cap   = this.getAttribute('caption') || '';
      const sub   = this.getAttribute('compare') || '';
      this.innerHTML = `
        <div class="mk">
          <div class="mk__row"><span class="mk__v">${value}</span>${unit ? `<span class="mk__u">${unit}</span>` : ''}</div>
          ${cap ? `<div class="mk__c">${cap}</div>` : ''}
          ${sub ? `<div class="mk__s">${sub}</div>` : ''}
        </div>`;
    }
  }
  customElements.define('metric-kpi', MetricKPI);

  /* chart-line · sparkline-or-full · data="[1,2,3,4]" */
  class ChartLine extends HTMLElement {
    connectedCallback() {
      const data = parseJSON(this.getAttribute('data'), []);
      const labels = parseJSON(this.getAttribute('labels'), []);
      const w = parseInt(this.getAttribute('width')) || 320;
      const h = parseInt(this.getAttribute('height')) || 110;
      const pad = 14;
      const stroke = this.getAttribute('stroke') || 'var(--color-primary-600)';
      const fill   = this.getAttribute('fill')   || 'var(--color-primary-100)';
      if (!data.length) { this.innerHTML = '<div class="bc__empty">no data</div>'; return; }
      const min = Math.min(...data), max = Math.max(...data);
      const span = max - min || 1;
      const step = (w - pad * 2) / (data.length - 1 || 1);
      const pts = data.map((v, i) => {
        const x = pad + i * step;
        const y = h - pad - ((v - min) / span) * (h - pad * 2);
        return [x, y];
      });
      const linePath = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
      const areaPath = linePath + ` L${pts[pts.length-1][0]} ${h-pad} L${pts[0][0]} ${h-pad} Z`;
      const last = pts[pts.length - 1];

      // Y gridlines (3)
      let grid = '';
      for (let i = 0; i <= 3; i++) {
        const y = pad + (h - pad * 2) * (i / 3);
        grid += `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="var(--color-ink-100)" stroke-width="1" />`;
      }

      // X labels (first/mid/last)
      let xLabels = '';
      if (labels.length) {
        const mid = Math.floor(labels.length / 2);
        const indices = [0, mid, labels.length - 1];
        indices.forEach(i => {
          const x = pad + i * step;
          xLabels += `<text x="${x}" y="${h - 2}" font-size="9" fill="var(--color-ink-500)" text-anchor="middle" font-family="ui-monospace, monospace">${labels[i]}</text>`;
        });
      }

      this.innerHTML = `
        <svg class="cl" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img">
          ${grid}
          <path d="${areaPath}" fill="${fill}" opacity="0.5" />
          <path d="${linePath}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          <circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="${stroke}" />
          <circle cx="${last[0]}" cy="${last[1]}" r="6" fill="${stroke}" opacity="0.18" />
          ${xLabels}
        </svg>`;
    }
  }
  customElements.define('chart-line', ChartLine);

  /* chart-bar · vertical bars · data="[{label,value},…]" */
  class ChartBar extends HTMLElement {
    connectedCallback() {
      const data = parseJSON(this.getAttribute('data'), []);
      const w = parseInt(this.getAttribute('width')) || 320;
      const h = parseInt(this.getAttribute('height')) || 140;
      const pad = 18;
      const fill = this.getAttribute('fill') || 'var(--color-primary-500)';
      const accent = this.getAttribute('accent-fill') || 'var(--color-accent-500)';
      const accentIdx = parseInt(this.getAttribute('accent-index'));
      if (!data.length) { this.innerHTML = '<div class="bc__empty">no data</div>'; return; }
      const max = Math.max(...data.map(d => d.value));
      const barW = (w - pad * 2) / data.length * 0.66;
      const gap  = (w - pad * 2) / data.length * 0.34;
      let bars = '';
      data.forEach((d, i) => {
        const x = pad + i * (barW + gap);
        const bh = ((d.value) / max) * (h - pad * 2 - 14);
        const y = h - pad - bh;
        const c = (i === accentIdx) ? accent : fill;
        bars += `
          <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="2" fill="${c}" />
          <text x="${x + barW / 2}" y="${y - 3}" font-size="10" fill="var(--color-ink-700)" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="600">${fmt(d.value)}</text>
          <text x="${x + barW / 2}" y="${h - 4}" font-size="9" fill="var(--color-ink-500)" text-anchor="middle" font-family="ui-monospace, monospace">${d.label}</text>`;
      });
      this.innerHTML = `
        <svg class="cb" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img">
          <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--color-ink-200)" stroke-width="1" />
          ${bars}
        </svg>`;
    }
  }
  customElements.define('chart-bar', ChartBar);

  /* chart-donut · data="[{label,value,color},…]" */
  class ChartDonut extends HTMLElement {
    connectedCallback() {
      const data = parseJSON(this.getAttribute('data'), []);
      const center = this.getAttribute('center') || '';
      const centerLabel = this.getAttribute('center-label') || '';
      const sz = 140, r = 56, innerR = 38, cx = sz / 2, cy = sz / 2;
      if (!data.length) { this.innerHTML = '<div class="bc__empty">no data</div>'; return; }
      const total = data.reduce((s, d) => s + d.value, 0);
      let angle = -Math.PI / 2;
      let arcs = '';
      const palette = ['var(--color-primary-600)', 'var(--color-accent-500)', 'var(--color-info-500)', 'var(--color-warning-500)', 'var(--color-ink-500)', 'var(--color-success-500)'];
      data.forEach((d, i) => {
        const slice = (d.value / total) * Math.PI * 2;
        const a2 = angle + slice;
        const large = slice > Math.PI ? 1 : 0;
        const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
        const x2 = cx + r * Math.cos(a2),    y2 = cy + r * Math.sin(a2);
        const x3 = cx + innerR * Math.cos(a2), y3 = cy + innerR * Math.sin(a2);
        const x4 = cx + innerR * Math.cos(angle), y4 = cy + innerR * Math.sin(angle);
        const c = d.color || palette[i % palette.length];
        arcs += `<path d="M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z" fill="${c}" />`;
        angle = a2;
      });

      // legend
      let legend = '<ul class="cd__legend">';
      data.forEach((d, i) => {
        const c = d.color || palette[i % palette.length];
        const pct = ((d.value / total) * 100).toFixed(0);
        legend += `<li><span class="cd__sw" style="background:${c}"></span>${d.label} <b>${pct}%</b></li>`;
      });
      legend += '</ul>';

      this.innerHTML = `
        <div class="cd">
          <svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" role="img">
            ${arcs}
            ${center ? `<text x="${cx}" y="${cy - 2}" font-size="20" font-weight="600" text-anchor="middle" fill="var(--color-ink-900)" font-family="var(--font-display, serif)">${center}</text>` : ''}
            ${centerLabel ? `<text x="${cx}" y="${cy + 14}" font-size="10" text-anchor="middle" fill="var(--color-ink-500)" font-family="ui-monospace, monospace">${centerLabel}</text>` : ''}
          </svg>
          ${legend}
        </div>`;
    }
  }
  customElements.define('chart-donut', ChartDonut);

  /* table-leaderbd · top-N table · data="[{rank,label,value,trend},…]" */
  class TableLeaderboard extends HTMLElement {
    connectedCallback() {
      const data = parseJSON(this.getAttribute('data'), []);
      const valueLabel = this.getAttribute('value-label') || 'value';
      if (!data.length) { this.innerHTML = '<div class="bc__empty">no data</div>'; return; }
      const max = Math.max(...data.map(d => d.value));
      let rows = '';
      data.forEach((d, i) => {
        const pct = (d.value / max) * 100;
        const trendChip = d.trend != null
          ? `<span class="lb__trend lb__trend--${d.trend >= 0 ? 'up' : 'down'}">${d.trend >= 0 ? '↑' : '↓'}${Math.abs(d.trend)}%</span>`
          : '';
        rows += `
          <tr>
            <td class="lb__rk">${i + 1}</td>
            <td class="lb__lbl">${d.label}</td>
            <td class="lb__bar"><span class="lb__bar-fill" style="width:${pct}%"></span></td>
            <td class="lb__val">${fmt(d.value)}</td>
            <td class="lb__t">${trendChip}</td>
          </tr>`;
      });
      this.innerHTML = `
        <table class="lb">
          <thead><tr><th>#</th><th>name</th><th></th><th>${valueLabel}</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }
  }
  customElements.define('table-leaderbd', TableLeaderboard);

  /* heatmap-grid · 7×N calendar grid · data="[{date,value},…]" */
  class HeatmapGrid extends HTMLElement {
    connectedCallback() {
      const data = parseJSON(this.getAttribute('data'), []);
      const cols = parseInt(this.getAttribute('cols')) || data.length / 7;
      if (!data.length) { this.innerHTML = '<div class="bc__empty">no data</div>'; return; }
      const max = Math.max(...data.map(d => d.value));
      const cellSize = 14, gap = 3;
      const w = cols * (cellSize + gap);
      const h = 7 * (cellSize + gap);
      let cells = '';
      data.forEach((d, i) => {
        const col = Math.floor(i / 7);
        const row = i % 7;
        const x = col * (cellSize + gap);
        const y = row * (cellSize + gap);
        const intensity = max ? d.value / max : 0;
        let fill = 'var(--color-ink-100)';
        if (intensity > 0)    fill = 'var(--color-primary-100)';
        if (intensity > 0.25) fill = 'var(--color-primary-300)';
        if (intensity > 0.5)  fill = 'var(--color-primary-500)';
        if (intensity > 0.75) fill = 'var(--color-primary-700)';
        cells += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fill}"><title>${d.date}: ${d.value}</title></rect>`;
      });
      this.innerHTML = `
        <div class="hg">
          <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${cells}</svg>
          <div class="hg__legend">
            <span>น้อย</span>
            <span class="hg__sw" style="background:var(--color-ink-100)"></span>
            <span class="hg__sw" style="background:var(--color-primary-300)"></span>
            <span class="hg__sw" style="background:var(--color-primary-500)"></span>
            <span class="hg__sw" style="background:var(--color-primary-700)"></span>
            <span>มาก</span>
          </div>
        </div>`;
    }
  }
  customElements.define('heatmap-grid', HeatmapGrid);

  /* low-stock-alert · list of warning rows */
  class LowStockAlert extends HTMLElement {
    connectedCallback() {
      const data = parseJSON(this.getAttribute('data'), []);
      if (!data.length) { this.innerHTML = '<div class="bc__empty">ทุก SKU ปลอดภัย</div>'; return; }
      let rows = '';
      data.forEach(d => {
        const sev = d.severity || (d.qty < d.min * 0.5 ? 'critical' : 'warn');
        rows += `
          <li class="lsa lsa--${sev}">
            <span class="lsa__sku">${d.sku}</span>
            <span class="lsa__name">${d.name}</span>
            <span class="lsa__qty">${d.qty}<small>${d.unit || ''}</small></span>
            <span class="lsa__min">min ${d.min}</span>
          </li>`;
      });
      this.innerHTML = `<ul class="lsa-list">${rows}</ul>`;
    }
  }
  customElements.define('low-stock-alert', LowStockAlert);

  /* progress-tier · stacked horizontal bar · data="[{label,value,color}]" */
  class ProgressTier extends HTMLElement {
    connectedCallback() {
      const data = parseJSON(this.getAttribute('data'), []);
      if (!data.length) { this.innerHTML = '<div class="bc__empty">no data</div>'; return; }
      const total = data.reduce((s, d) => s + d.value, 0);
      const palette = ['var(--color-primary-700)', 'var(--color-primary-500)', 'var(--color-accent-500)', 'var(--color-ink-300)'];
      let segs = '', legend = '';
      data.forEach((d, i) => {
        const pct = ((d.value / total) * 100).toFixed(1);
        const c = d.color || palette[i % palette.length];
        segs += `<div class="pt__seg" style="width:${pct}%; background:${c}" title="${d.label}: ${d.value}"></div>`;
        legend += `<li><span class="pt__sw" style="background:${c}"></span>${d.label} <b>${fmt(d.value)}</b> <small>(${pct}%)</small></li>`;
      });
      this.innerHTML = `
        <div class="pt">
          <div class="pt__bar">${segs}</div>
          <ul class="pt__legend">${legend}</ul>
        </div>`;
    }
  }
  customElements.define('progress-tier', ProgressTier);

  /* map-cards · grid of small cards (warehouses, locations) */
  class MapCards extends HTMLElement {
    connectedCallback() {
      const data = parseJSON(this.getAttribute('data'), []);
      if (!data.length) { this.innerHTML = '<div class="bc__empty">no data</div>'; return; }
      let cards = '';
      data.forEach(d => {
        const status = d.status || 'ok';
        cards += `
          <div class="mc mc--${status}">
            <div class="mc__id">${d.id}</div>
            <div class="mc__name">${d.name}</div>
            <div class="mc__metric"><b>${d.metric}</b><small>${d.metricLabel || ''}</small></div>
            ${d.note ? `<div class="mc__note">${d.note}</div>` : ''}
          </div>`;
      });
      this.innerHTML = `<div class="mc-grid">${cards}</div>`;
    }
  }
  customElements.define('map-cards', MapCards);

  /* timeline-event · vertical timeline */
  class TimelineEvent extends HTMLElement {
    connectedCallback() {
      const data = parseJSON(this.getAttribute('data'), []);
      if (!data.length) { this.innerHTML = '<div class="bc__empty">no events</div>'; return; }
      let items = '';
      data.forEach((d, i) => {
        const tone = d.tone || 'default';
        items += `
          <li class="te te--${tone}">
            <div class="te__dot"></div>
            <div class="te__time">${d.time}</div>
            <div class="te__body">
              <div class="te__t">${d.title}</div>
              ${d.note ? `<div class="te__n">${d.note}</div>` : ''}
            </div>
          </li>`;
      });
      this.innerHTML = `<ul class="te-list">${items}</ul>`;
    }
  }
  customElements.define('timeline-event', TimelineEvent);

  /* empty-state · slot-friendly */
  class EmptyState extends HTMLElement {
    connectedCallback() {
      const icon = this.getAttribute('icon') || '∅';
      const title = this.getAttribute('title') || 'ไม่มีข้อมูล';
      const note = this.getAttribute('note') || '';
      const cta = this.getAttribute('cta') || '';
      this.innerHTML = `
        <div class="es">
          <div class="es__icon">${icon}</div>
          <h4 class="es__t">${title}</h4>
          ${note ? `<p class="es__n">${note}</p>` : ''}
          ${cta ? `<button class="es__cta">${cta}</button>` : ''}
        </div>`;
    }
  }
  customElements.define('empty-state', EmptyState);

})();
