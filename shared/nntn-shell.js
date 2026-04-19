/**
 * NNTN Shared Shell v2 — iframe-based SPA feel
 *
 * Behavior:
 *  • When in iframe: do nothing (content page renders bare inside iframe)
 *  • When on /nntn/app.html: render sidebar + topbar + iframe router
 *  • When on content page directly: redirect to /nntn/app.html#<current-path>
 *
 * Usage (1 line in every page before </body>):
 *   <script src="/nntn/shared/nntn-shell.js"></script>
 */
(function () {
  if (window.__nntnShellLoaded) return;
  window.__nntnShellLoaded = true;

  const inIframe = window.top !== window.self;
  if (inIframe) return; // Let content page render bare inside iframe

  const isAppHost = /\/app\.html$/.test(location.pathname);
  const defaultPath = '/nntn/dashboard.html';

  // Direct visit to a content page → stay standalone (backward compat + tests).
  // Unified SPA-feel lives at /nntn/app.html#<page>.
  if (!isAppHost) return;

  // We're on app.html — build shell

  // Inject tokens CSS
  if (!document.querySelector('link[href*="nntn-tokens.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/nntn/shared/nntn-tokens.css';
    document.head.appendChild(link);
  }

  // Shell CSS
  const style = document.createElement('style');
  style.textContent = `
    html, body { height:100%; margin:0; padding:0; overflow:hidden; background: var(--nntn-color-bg); font-family: var(--nntn-font-family); }
    #nntn-layout { display: grid; grid-template-columns: var(--nntn-sidebar-width) 1fr; grid-template-rows: var(--nntn-header-height) 1fr; grid-template-areas: "sidebar topbar" "sidebar frame"; height:100vh; }
    @media (max-width: 900px) {
      #nntn-layout { grid-template-columns: 1fr; grid-template-areas: "topbar" "frame"; }
      #nntn-sidebar { display:none; position:fixed; top:var(--nntn-header-height); left:0; width:240px; height:calc(100vh - var(--nntn-header-height)); z-index: var(--nntn-z-modal); }
      #nntn-sidebar.open { display:block; }
    }

    #nntn-sidebar { grid-area: sidebar; background: #1a1d21; color: #d7dde2; overflow-y: auto; font-size: var(--nntn-font-sm); }
    #nntn-sidebar .brand { padding: var(--nntn-space-4) var(--nntn-space-5); border-bottom: 1px solid #2e3135; display:flex; align-items:center; gap:var(--nntn-space-2); }
    #nntn-sidebar .brand-logo { width:32px; height:32px; background: var(--nntn-color-primary); border-radius: var(--nntn-radius-md); display:flex; align-items:center; justify-content:center; font-size:18px; }
    #nntn-sidebar .brand-name { font-weight: var(--nntn-weight-semibold); color: #fff; font-size: var(--nntn-font-md); }
    #nntn-sidebar .brand-sub { font-size: var(--nntn-font-xs); color:#8c9196; margin-top:2px; }
    #nntn-sidebar nav { padding: var(--nntn-space-3) var(--nntn-space-2); }
    #nntn-sidebar .nav-section { font-size: var(--nntn-font-xs); text-transform:uppercase; letter-spacing:0.06em; color:#6d7175; padding: var(--nntn-space-3) var(--nntn-space-3) var(--nntn-space-2); }
    #nntn-sidebar a.nav-item, #nntn-sidebar .nav-group-head { display:flex; align-items:center; gap:var(--nntn-space-3); padding: var(--nntn-space-2) var(--nntn-space-3); border-radius:var(--nntn-radius-md); color:#d7dde2; margin-bottom:2px; text-decoration:none; cursor:pointer; user-select:none; }
    #nntn-sidebar a.nav-item:hover, #nntn-sidebar .nav-group-head:hover { background:#2e3135; }
    #nntn-sidebar a.nav-item.active { background:#2e3135; color:#fff; font-weight:var(--nntn-weight-medium); }
    #nntn-sidebar .nav-group-head.has-active { color:#fff; font-weight:var(--nntn-weight-medium); }
    #nntn-sidebar .nav-item .icon, #nntn-sidebar .nav-group-head .icon { width:18px; text-align:center; flex-shrink:0; }
    #nntn-sidebar .nav-group-head .chev { margin-left:auto; transition: transform var(--nntn-transition-fast); opacity:0.6; font-size:11px; }
    #nntn-sidebar .nav-group.open .nav-group-head .chev { transform: rotate(90deg); }
    #nntn-sidebar .nav-group-children { display:none; padding-left: var(--nntn-space-6); margin-top:2px; border-left: 1px solid #2e3135; margin-left:var(--nntn-space-4); }
    #nntn-sidebar .nav-group.open .nav-group-children { display:block; }
    #nntn-sidebar .nav-group-children a.nav-item { padding: 6px var(--nntn-space-3); font-size: 13px; }

    #nntn-topbar { grid-area: topbar; background: var(--nntn-color-surface); border-bottom: 1px solid var(--nntn-color-border); display:flex; align-items:center; justify-content:space-between; padding: 0 var(--nntn-space-6); }
    #nntn-topbar .breadcrumb { color: var(--nntn-color-text-subdued); font-size: var(--nntn-font-sm); }
    #nntn-topbar .breadcrumb a { color: var(--nntn-color-info); text-decoration:none; cursor:pointer; }
    #nntn-topbar .user-chip { background:var(--nntn-color-surface-subdued); padding:4px var(--nntn-space-3); border-radius:var(--nntn-radius-full); font-size:var(--nntn-font-sm); }
    #nntn-topbar .hamburger { display:none; background:none; border:none; font-size:20px; cursor:pointer; padding:0 var(--nntn-space-2) 0 0; color:var(--nntn-color-text); }
    @media (max-width: 900px) { #nntn-topbar .hamburger { display:block; } }

    #nntn-frame-wrap { grid-area: frame; position:relative; background: var(--nntn-color-bg); }
    #nntn-frame { position:absolute; inset:0; width:100%; height:100%; border:0; background:var(--nntn-color-bg); }
    #nntn-loader { position:absolute; top:0; left:0; right:0; height:2px; background:var(--nntn-color-primary); transform:translateX(-100%); transition: transform var(--nntn-transition-base); z-index:10; }
    #nntn-loader.loading { animation: nntn-loading 1.2s ease-in-out infinite; }
    @keyframes nntn-loading {
      0% { transform: translateX(-100%); }
      50% { transform: translateX(0); }
      100% { transform: translateX(100%); }
    }
  `;
  document.head.appendChild(style);

  // Nav config — supports { children: [...] } for expandable groups
  const NAV = [
    { href: '/nntn/dashboard.html', icon: '🏠', label: 'Dashboard' },
    { section: 'Stock' },
    {
      icon: '🥩', label: 'Meat Stock', key: 'meat-stock', children: [
        { href: '/nntn/meat-stock/#receive', label: 'รับเนื้อสด' },
        { href: '/nntn/meat-stock/#cook', label: 'ปิดหม้อ' },
        { href: '/nntn/meat-stock/#repack', label: 'แปรรูป' },
        { href: '/nntn/meat-stock/', label: 'ทั้งหมด' }
      ]
    },
    {
      icon: '🚚', label: 'Delivery', key: 'delivery', children: [
        { href: '/nntn/hub-delivery.html', label: 'ออกใบนำส่ง' },
        { href: '/nntn/po-receive.html', label: 'PO Receive' },
        { href: '/nntn/stock-dispense.html', label: 'Stock Dispense' }
      ]
    },
    { href: '/nntn/production-history.html', icon: '♻️', label: 'Production History' },
    { section: 'Cookingbook' },
    {
      icon: '📖', label: 'Recipes', key: 'cookingbook', children: [
        { href: '/nntn/cookingbook/menu-bom.html', label: 'Menu BOM' },
        { href: '/nntn/production-log-form.html', label: 'Production Log' }
      ]
    },
    { section: 'Admin' },
    {
      icon: '🏷️', label: 'Items & BOM', key: 'admin', children: [
        { href: '/nntn/admin-items.html', label: 'Items' },
        { href: '/nntn/admin-bom.html', label: 'BOM Admin' }
      ]
    },
    { section: 'Reports' },
    { href: '/nntn/data-pipeline.html', icon: '📊', label: 'Data Pipeline' }
  ];

  const OPEN_KEY = 'nntn_nav_open';
  let openGroups = {};
  try { openGroups = JSON.parse(localStorage.getItem(OPEN_KEY) || '{}'); } catch (_) {}

  // Build layout
  document.body.innerHTML = '';
  const layout = document.createElement('div');
  layout.id = 'nntn-layout';
  layout.innerHTML = `
    <aside id="nntn-sidebar">
      <div class="brand">
        <div class="brand-logo">🥩</div>
        <div><div class="brand-name">NNTN</div><div class="brand-sub">ครัวเนื้อในตำนาน</div></div>
      </div>
      <nav id="nntn-nav"></nav>
    </aside>
    <div id="nntn-topbar">
      <div style="display:flex; align-items:center; gap:var(--nntn-space-3);">
        <button class="hamburger" id="nntn-burger" aria-label="menu">☰</button>
        <div class="breadcrumb" id="nntn-breadcrumb">—</div>
      </div>
      <div class="user-chip">👤 <span id="nntn-user">user</span></div>
    </div>
    <div id="nntn-frame-wrap">
      <div id="nntn-loader"></div>
      <iframe id="nntn-frame" name="nntnFrame" src="about:blank"></iframe>
    </div>
  `;
  document.body.appendChild(layout);

  // Render nav items (supports nested groups)
  const nav = document.getElementById('nntn-nav');
  function renderNav(activeHref) {
    nav.innerHTML = NAV.map(n => {
      if (n.section) return `<div class="nav-section">${n.section}</div>`;
      if (n.children) {
        const hasActive = n.children.some(c => c.href === activeHref);
        const open = openGroups[n.key] || hasActive;
        return `
          <div class="nav-group ${open ? 'open' : ''}" data-group="${n.key}">
            <div class="nav-group-head ${hasActive ? 'has-active' : ''}" data-toggle="${n.key}">
              <span class="icon">${n.icon}</span> <span>${n.label}</span>
              <span class="chev">▸</span>
            </div>
            <div class="nav-group-children">
              ${n.children.map(c => `<a class="nav-item ${c.href === activeHref ? 'active' : ''}" href="${c.href}" data-nav="${c.href}">${c.label}</a>`).join('')}
            </div>
          </div>`;
      }
      return `<a class="nav-item ${n.href === activeHref ? 'active' : ''}" href="${n.href}" data-nav="${n.href}"><span class="icon">${n.icon}</span> ${n.label}</a>`;
    }).join('');
  }
  renderNav('');

  // User
  document.getElementById('nntn-user').textContent = (localStorage.getItem('nntn_user') || 'user').slice(0, 20);

  const iframe = document.getElementById('nntn-frame');
  const loader = document.getElementById('nntn-loader');
  const breadcrumb = document.getElementById('nntn-breadcrumb');

  function findNav(href) {
    for (const n of NAV) {
      if (n.href === href) return { item: n, parent: null };
      if (n.children) {
        const c = n.children.find(x => x.href === href);
        if (c) return { item: c, parent: n };
      }
    }
    return { item: null, parent: null };
  }
  function labelFromHref(href) {
    const { item, parent } = findNav(href);
    if (!item) return href.replace(/^\/nntn\//, '').replace(/\.html$/, '');
    return parent ? `${parent.label} · ${item.label}` : item.label;
  }

  function setActive(href) {
    renderNav(href);
  }

  function updateBreadcrumb(href) {
    const label = labelFromHref(href);
    breadcrumb.innerHTML = `<a data-home>NNTN</a> · <span>${label}</span>`;
    document.querySelector('[data-home]').onclick = () => navigate(defaultPath);
    document.title = `${label} · NNTN`;
  }

  function navigate(href, { push = true } = {}) {
    if (!href) href = defaultPath;
    loader.classList.add('loading');
    iframe.src = href;
    setActive(href);
    updateBreadcrumb(href);
    if (push) {
      const newHash = '#' + encodeURIComponent(href);
      if (location.hash !== newHash) history.pushState({ href }, '', newHash);
    }
  }

  iframe.addEventListener('load', () => {
    loader.classList.remove('loading');
    // Re-close mobile sidebar after nav
    document.getElementById('nntn-sidebar').classList.remove('open');
  });

  // Intercept nav clicks (link OR group toggle)
  document.getElementById('nntn-nav').addEventListener('click', e => {
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      const key = toggle.dataset.toggle;
      const group = toggle.closest('.nav-group');
      const isOpen = group.classList.toggle('open');
      openGroups[key] = isOpen;
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(openGroups)); } catch (_) {}
      return;
    }
    const a = e.target.closest('a.nav-item');
    if (!a) return;
    e.preventDefault();
    navigate(a.dataset.nav);
  });

  // Mobile hamburger
  document.getElementById('nntn-burger').addEventListener('click', () => {
    document.getElementById('nntn-sidebar').classList.toggle('open');
  });

  // Back/forward button
  window.addEventListener('popstate', e => {
    const href = (e.state && e.state.href) || decodeURIComponent((location.hash || '').slice(1)) || defaultPath;
    navigate(href, { push: false });
  });

  // Initial load
  const initPath = decodeURIComponent((location.hash || '').slice(1)) || defaultPath;
  navigate(initPath, { push: false });
})();
