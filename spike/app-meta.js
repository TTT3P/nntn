/* ==========================================================================
   NNTN Activity Log + Page Meta — shared web components
   Pattern: ATUM Logs (stockmanagementlabs.com) — per-entity activity feed.
   Vanilla custom elements · no framework · just include this script.

   <page-meta
     name="po-receive"
     version="v1.0"
     room="Stock"
     last-sync="2026-04-22T19:24"
     edited-by="ไทน์"
     edited-at="2026-04-22T18:01"
     schema="purchase_orders, stock_movements"
   ></page-meta>

   <activity-log
     entity="MT-019"
     entity-label="หมูสามชั้นสไลซ์"
     events='[{"ts":"2026-04-22T19:24","type":"receive","delta":"+11","before":"6.4kg","after":"17.4kg","user":"ไทน์","note":"PO-0422-lung"}]'
   ></activity-log>

   Both surface compact tokens.css-aligned UI, dependency-free.
   ========================================================================== */

(function () {
  'use strict';

  // ────────────────────────── helpers ──────────────────────────
  function relTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 0) return 'ในอนาคต';
    if (diff < 60) return Math.floor(diff) + ' วินาทีที่แล้ว';
    if (diff < 3600) return Math.floor(diff / 60) + ' นาทีที่แล้ว';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ชม.ที่แล้ว';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' วันที่แล้ว';
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
  }
  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString('th-TH', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const ROOM_COLOR = {
    'Stock':       { bg: '#E8F2EA', fg: '#1F5E2C', dot: '#2F7A3F' },
    'CookingBook': { bg: '#FBF3DC', fg: '#5A4915', dot: '#C9962C' },
    'Sales':       { bg: '#FADFD7', fg: '#8F1A0B', dot: '#C9402C' },
    'Sales Ops':   { bg: '#FADFD7', fg: '#8F1A0B', dot: '#C9402C' },
    'HR':          { bg: '#E0E8F0', fg: '#1F3D5E', dot: '#2F507A' },
    'Financial':   { bg: '#EAE0F0', fg: '#3D1F5E', dot: '#5E2F7A' },
    'Platform':    { bg: '#E5E5E5', fg: '#333',    dot: '#666'    },
  };

  const EVENT_META = {
    receive:  { label: 'รับเข้า',     color: '#2F7A3F', bg: '#DCEADE' },
    dispense: { label: 'เบิกออก',     color: '#8F1A0B', bg: '#FADFD7' },
    adjust:   { label: 'ปรับนับ',     color: '#5A4915', bg: '#FBF3DC' },
    transfer: { label: 'โอนคลัง',     color: '#1F3D5E', bg: '#E0E8F0' },
    produce:  { label: 'แปรรูป',      color: '#3D1F5E', bg: '#EAE0F0' },
    split:    { label: 'แยกถุง',      color: '#3D1F5E', bg: '#EAE0F0' },
    create:   { label: 'สร้าง',       color: '#1F5E2C', bg: '#E8F2EA' },
    edit:     { label: 'แก้ไข',       color: '#5A4915', bg: '#FBF3DC' },
    archive:  { label: 'archive',     color: '#666',    bg: '#E5E5E5' },
    revert:   { label: 'revert',      color: '#8F1A0B', bg: '#FADFD7' },
    cascade:  { label: 'cascade',     color: '#3D1F5E', bg: '#EAE0F0' },
    submit:   { label: 'submit',      color: '#1F5E2C', bg: '#E8F2EA' },
    print:    { label: 'พิมพ์',       color: '#666',    bg: '#E5E5E5' },
    sync:     { label: 'sync',        color: '#1F3D5E', bg: '#E0E8F0' },
  };

  // ────────────────────────── <page-meta> ──────────────────────────
  class PageMeta extends HTMLElement {
    static get observedAttributes() {
      return ['name','version','room','last-sync','edited-by','edited-at','schema'];
    }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const name = this.getAttribute('name') || 'page';
      const version = this.getAttribute('version') || 'v1.0';
      const room = this.getAttribute('room') || 'Stock';
      const lastSync = this.getAttribute('last-sync');
      const editedBy = this.getAttribute('edited-by') || '—';
      const editedAt = this.getAttribute('edited-at');
      const schema = this.getAttribute('schema') || '';
      const rc = ROOM_COLOR[room] || ROOM_COLOR['Stock'];

      this.innerHTML = `
        <style>
          :scope { all: initial; }
        </style>
        <div class="pm-card">
          <div class="pm-row pm-row--top">
            <div class="pm-name">
              <span class="pm-fname">${esc(name)}</span>
              <span class="pm-ver">${esc(version)}</span>
            </div>
            <span class="pm-room" style="background:${rc.bg};color:${rc.fg}">
              <span class="pm-dot" style="background:${rc.dot}"></span>${esc(room)}
            </span>
          </div>
          <div class="pm-grid">
            <div class="pm-kv">
              <div class="pm-k">last sync</div>
              <div class="pm-v">${esc(relTime(lastSync))}</div>
              <div class="pm-vs">${esc(fmtTime(lastSync))}</div>
            </div>
            <div class="pm-kv">
              <div class="pm-k">edited by</div>
              <div class="pm-v">${esc(editedBy)}</div>
              <div class="pm-vs">${esc(relTime(editedAt))}</div>
            </div>
          </div>
          ${schema ? `<div class="pm-schema" title="schema source">
            <span class="pm-schema-k">schema</span>
            <code>${esc(schema)}</code>
          </div>` : ''}
        </div>
        <style>
          page-meta { display:block; font-family: var(--font-sans, system-ui); }
          .pm-card {
            background: linear-gradient(180deg, #fff 0%, #FAFAF5 100%);
            border: 1px solid var(--color-ink-200, #D2D5D0);
            border-radius: var(--radius-md, 8px);
            padding: 10px 12px;
            box-shadow: 0 1px 2px rgba(0,0,0,.04);
            min-width: 240px;
            font-size: 12px;
          }
          .pm-row { display:flex; align-items:center; justify-content:space-between; gap: 10px;}
          .pm-row--top { padding-bottom: 8px; border-bottom: 1px dashed var(--color-ink-200, #D2D5D0); margin-bottom: 8px;}
          .pm-name { display:flex; align-items:baseline; gap:6px; min-width:0;}
          .pm-fname { font-family: var(--font-mono, ui-monospace,monospace); font-weight:700; font-size:12px; color:var(--color-ink-900, #1A1A1A); letter-spacing: .2px;}
          .pm-ver { font-family: var(--font-mono, ui-monospace,monospace); font-size:10px; color: var(--color-primary-700, #2F7A3F); background: var(--color-primary-50, #E8F2EA); padding: 1px 5px; border-radius: 3px; letter-spacing:.3px;}
          .pm-room { display:inline-flex; align-items:center; gap:5px; font-family: var(--font-mono, ui-monospace,monospace); font-size:10px; padding: 2px 7px; border-radius: 3px; letter-spacing:.3px; font-weight:700;}
          .pm-dot { width: 6px; height: 6px; border-radius:50%;}
          .pm-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px;}
          .pm-kv .pm-k { font-family: var(--font-mono, ui-monospace,monospace); font-size:9px; letter-spacing:.8px; color:var(--color-ink-500, #6B6B6B); text-transform: uppercase;}
          .pm-kv .pm-v { font-size:12px; color:var(--color-ink-900, #1A1A1A); font-weight:700; margin-top:2px; line-height:1.3;}
          .pm-kv .pm-vs { font-family: var(--font-mono, ui-monospace,monospace); font-size:9px; color:var(--color-ink-500, #6B6B6B); margin-top:1px; letter-spacing:.2px;}
          .pm-schema { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--color-ink-200, #D2D5D0); display:flex; align-items:center; gap: 6px;}
          .pm-schema-k { font-family: var(--font-mono, ui-monospace,monospace); font-size:9px; letter-spacing:.8px; color:var(--color-ink-500, #6B6B6B); text-transform: uppercase;}
          .pm-schema code { font-family: var(--font-mono, ui-monospace,monospace); font-size:10px; background: var(--color-ink-100, #EDEEEC); padding: 1px 5px; border-radius: 3px; color: var(--color-ink-800, #2D2D2D);}
        </style>
      `;
    }
  }

  // ────────────────────────── <activity-log> ──────────────────────────
  class ActivityLog extends HTMLElement {
    static get observedAttributes() {
      return ['entity','entity-label','events','title','collapsed','max'];
    }
    connectedCallback() {
      this._filter = 'all';
      this._expanded = false;
      this.render();
    }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    parseEvents() {
      const raw = this.getAttribute('events');
      if (!raw) return [];
      try { return JSON.parse(raw); } catch (e) { return []; }
    }
    render() {
      const entity = this.getAttribute('entity') || '';
      const entityLabel = this.getAttribute('entity-label') || '';
      const title = this.getAttribute('title') || 'Activity log';
      const max = parseInt(this.getAttribute('max') || '10', 10);
      const events = this.parseEvents();

      const types = Array.from(new Set(events.map(e => e.type))).filter(Boolean);
      const filtered = this._filter === 'all'
        ? events
        : events.filter(e => e.type === this._filter);
      const visible = this._expanded ? filtered : filtered.slice(0, max);
      const hasMore = filtered.length > visible.length;

      const eventRows = visible.length === 0
        ? `<div class="al-empty">ยังไม่มีกิจกรรม</div>`
        : visible.map(ev => this.renderRow(ev)).join('');

      this.innerHTML = `
        <div class="al-card">
          <div class="al-head">
            <div class="al-head-l">
              <div class="al-title">${esc(title)}</div>
              ${entity ? `<div class="al-entity">
                <code>${esc(entity)}</code>
                ${entityLabel ? `<span class="al-elabel">${esc(entityLabel)}</span>` : ''}
              </div>` : ''}
            </div>
            <div class="al-count">${events.length} events</div>
          </div>
          ${types.length > 1 ? `<div class="al-filters">
            <button class="al-chip ${this._filter === 'all' ? 'is-on' : ''}" data-f="all">all</button>
            ${types.map(t => `
              <button class="al-chip ${this._filter === t ? 'is-on' : ''}" data-f="${esc(t)}">
                ${esc((EVENT_META[t] || {}).label || t)}
              </button>
            `).join('')}
          </div>` : ''}
          <div class="al-feed">${eventRows}</div>
          ${hasMore ? `<button class="al-more" data-expand>
            แสดงทั้งหมด (${filtered.length - visible.length} เพิ่มเติม)
          </button>` : ''}
          ${this._expanded && filtered.length > max ? `<button class="al-more" data-collapse>
            ย่อกลับ
          </button>` : ''}
        </div>
        <style>
          activity-log { display:block; font-family: var(--font-sans, system-ui);}
          .al-card { background: #fff; border: 1px solid var(--color-ink-200, #D2D5D0); border-radius: var(--radius-md, 8px); overflow: hidden;}
          .al-head { padding: 12px 16px; display:grid; grid-template-columns: 1fr auto; gap: 10px; align-items:center; border-bottom: 1px solid var(--color-ink-200, #D2D5D0); background: linear-gradient(180deg, #fff 0%, #FAFAF5 100%);}
          .al-title { font-family: var(--font-display, var(--font-serif, serif)); font-weight: 500; font-size: 16px; color: var(--color-ink-900, #1A1A1A); letter-spacing:-0.005em;}
          .al-entity { display:flex; align-items:center; gap:8px; margin-top: 3px;}
          .al-entity code { font-family: var(--font-mono, ui-monospace,monospace); font-size: 11px; background: var(--color-primary-50, #E8F2EA); color: var(--color-primary-800, #1F5E2C); padding: 2px 7px; border-radius: 3px; font-weight: 700;}
          .al-elabel { font-size: 11px; color: var(--color-ink-600, #4D4D4D);}
          .al-count { font-family: var(--font-mono, ui-monospace,monospace); font-size: 10px; color: var(--color-ink-500, #6B6B6B); letter-spacing: .3px; text-transform: uppercase;}
          .al-filters { display:flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px; border-bottom: 1px dashed var(--color-ink-200, #D2D5D0);}
          .al-chip { font-family: var(--font-mono, ui-monospace,monospace); font-size: 10px; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--color-ink-300, #BABDB7); background: #fff; cursor: pointer; letter-spacing: .3px; color: var(--color-ink-700, #404040);}
          .al-chip.is-on { background: var(--color-ink-900, #1A1A1A); color: #fff; border-color: var(--color-ink-900, #1A1A1A); font-weight: 700;}
          .al-feed { max-height: 360px; overflow-y: auto;}
          .al-empty { padding: 24px 16px; text-align: center; font-size: 13px; color: var(--color-ink-500, #6B6B6B); font-family: var(--font-mono, ui-monospace,monospace);}
          .al-row { display:grid; grid-template-columns: 90px auto 1fr auto; gap: 12px; padding: 10px 16px; border-bottom: 1px dashed var(--color-ink-100, #EDEEEC); align-items: start; font-size: 12px;}
          .al-row:last-child { border-bottom: none;}
          .al-row:hover { background: var(--color-ink-50, #F8F8F5);}
          .al-ts { font-family: var(--font-mono, ui-monospace,monospace); font-size: 10px; color: var(--color-ink-500, #6B6B6B); letter-spacing: .2px; padding-top: 3px;}
          .al-type { font-family: var(--font-mono, ui-monospace,monospace); font-size: 10px; padding: 2px 7px; border-radius: 3px; letter-spacing: .3px; text-transform: uppercase; font-weight: 700; white-space: nowrap; align-self: start;}
          .al-body { color: var(--color-ink-700, #404040); line-height: 1.45; min-width: 0;}
          .al-delta { font-family: var(--font-mono, ui-monospace,monospace); font-weight: 700; font-size: 12px; color: var(--color-ink-900, #1A1A1A);}
          .al-delta.pos { color: var(--color-success-700, #1F5E2C);}
          .al-delta.neg { color: #8F1A0B;}
          .al-trans { font-family: var(--font-mono, ui-monospace,monospace); font-size: 11px; color: var(--color-ink-600, #4D4D4D); letter-spacing: .2px;}
          .al-note { font-size: 11px; color: var(--color-ink-600, #4D4D4D); margin-top: 3px; line-height: 1.4;}
          .al-user { font-family: var(--font-mono, ui-monospace,monospace); font-size: 10px; color: var(--color-ink-500, #6B6B6B); letter-spacing: .2px; padding-top: 3px; text-align:right; white-space: nowrap;}
          .al-more { width: 100%; padding: 10px 16px; background: var(--color-ink-50, #F8F8F5); border: none; border-top: 1px solid var(--color-ink-200, #D2D5D0); font-family: var(--font-mono, ui-monospace,monospace); font-size: 11px; color: var(--color-primary-700, #2F7A3F); cursor: pointer; letter-spacing: .3px; font-weight: 700;}
          .al-more:hover { background: var(--color-primary-50, #E8F2EA);}
        </style>
      `;

      this.querySelectorAll('.al-chip').forEach(b => {
        b.addEventListener('click', () => { this._filter = b.dataset.f; this.render(); });
      });
      const moreBtn = this.querySelector('[data-expand]');
      if (moreBtn) moreBtn.addEventListener('click', () => { this._expanded = true; this.render(); });
      const colBtn = this.querySelector('[data-collapse]');
      if (colBtn) colBtn.addEventListener('click', () => { this._expanded = false; this.render(); });
    }
    renderRow(ev) {
      const meta = EVENT_META[ev.type] || { label: ev.type || 'event', color: '#666', bg: '#E5E5E5' };
      const delta = ev.delta != null ? String(ev.delta) : '';
      const deltaCls = delta.startsWith('+') ? 'pos' : (delta.startsWith('-') || delta.startsWith('−') ? 'neg' : '');
      return `
        <div class="al-row">
          <div class="al-ts">${esc(relTime(ev.ts))}<br/>
            <span style="opacity:.7">${esc(fmtTime(ev.ts))}</span></div>
          <span class="al-type" style="background:${meta.bg};color:${meta.color}">${esc(meta.label)}</span>
          <div class="al-body">
            ${delta ? `<span class="al-delta ${deltaCls}">${esc(delta)}</span> ` : ''}
            ${ev.before != null && ev.after != null
              ? `<span class="al-trans">${esc(ev.before)} → ${esc(ev.after)}</span>`
              : ''}
            ${ev.note ? `<div class="al-note">${esc(ev.note)}</div>` : ''}
          </div>
          <div class="al-user">${esc(ev.user || '—')}</div>
        </div>
      `;
    }
  }

  // register if not yet
  if (!customElements.get('page-meta')) customElements.define('page-meta', PageMeta);
  if (!customElements.get('activity-log')) customElements.define('activity-log', ActivityLog);
})();
