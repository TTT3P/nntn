/**
 * NNTN Shared Shell v1
 * Injects sidebar + topbar into any page → unified "one app" feel
 *
 * Usage (1 line before </body>):
 *   <script src="/nntn/shared/nntn-shell.js"></script>
 *
 * Optional page config (before shell script):
 *   <script>window.NNTN_PAGE = { title: 'Dashboard', breadcrumb: 'Home' }</script>
 *
 * Idempotent — safe to include multiple times.
 */
(function () {
  if (window.__nntnShellLoaded) return;
  window.__nntnShellLoaded = true;

  // Auto-inject tokens CSS if missing
  if (!document.querySelector('link[href*="nntn-tokens.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/nntn/shared/nntn-tokens.css';
    document.head.appendChild(link);
  }

  // Shell CSS (scoped, won't clobber page styles)
  const style = document.createElement('style');
  style.textContent = `
    body { margin: 0 !important; padding-left: var(--nntn-sidebar-width) !important; padding-top: var(--nntn-header-height) !important; background: var(--nntn-color-bg); font-family: var(--nntn-font-family); }
    @media (max-width: 900px) { body { padding-left: 0 !important; } #nntn-sidebar { display: none; } }

    #nntn-sidebar {
      position: fixed; left: 0; top: 0; bottom: 0; width: var(--nntn-sidebar-width);
      background: #1a1d21; color: #d7dde2; overflow-y: auto; z-index: var(--nntn-z-sticky);
      font-family: var(--nntn-font-family); font-size: var(--nntn-font-sm);
    }
    #nntn-sidebar .brand { padding: var(--nntn-space-4) var(--nntn-space-5) var(--nntn-space-4); border-bottom: 1px solid #2e3135; display:flex; align-items:center; gap:var(--nntn-space-2); }
    #nntn-sidebar .brand-logo { width:32px; height:32px; background: var(--nntn-color-primary); border-radius: var(--nntn-radius-md); display:flex; align-items:center; justify-content:center; font-size:18px; }
    #nntn-sidebar .brand-name { font-weight: var(--nntn-weight-semibold); color: #fff; font-size: var(--nntn-font-md); }
    #nntn-sidebar .brand-sub { font-size: var(--nntn-font-xs); color:#8c9196; margin-top:2px; }
    #nntn-sidebar nav { padding: var(--nntn-space-3) var(--nntn-space-2); }
    #nntn-sidebar .nav-section { font-size: var(--nntn-font-xs); text-transform:uppercase; letter-spacing:0.06em; color:#6d7175; padding: var(--nntn-space-3) var(--nntn-space-3) var(--nntn-space-2); }
    #nntn-sidebar a.nav-item { display:flex; align-items:center; gap:var(--nntn-space-3); padding: var(--nntn-space-2) var(--nntn-space-3); border-radius:var(--nntn-radius-md); color:#d7dde2; margin-bottom:2px; text-decoration:none; }
    #nntn-sidebar a.nav-item:hover { background:#2e3135; }
    #nntn-sidebar a.nav-item.active { background:#2e3135; color:#fff; font-weight:var(--nntn-weight-medium); }
    #nntn-sidebar .nav-item .icon { width:18px; text-align:center; flex-shrink:0; }
    #nntn-sidebar .nav-item .badge { margin-left:auto; background:var(--nntn-color-primary); color:#fff; padding:1px 6px; border-radius:var(--nntn-radius-full); font-size:10px; }

    #nntn-topbar {
      position: fixed; top:0; left: var(--nntn-sidebar-width); right:0; height: var(--nntn-header-height);
      background: var(--nntn-color-surface); border-bottom: 1px solid var(--nntn-color-border);
      display:flex; align-items:center; justify-content:space-between;
      padding: 0 var(--nntn-space-6); z-index: calc(var(--nntn-z-sticky) - 1);
    }
    @media (max-width: 900px) { #nntn-topbar { left: 0; } }
    #nntn-topbar .breadcrumb { color: var(--nntn-color-text-subdued); font-size: var(--nntn-font-sm); }
    #nntn-topbar .breadcrumb a { color: var(--nntn-color-info); text-decoration:none; }
    #nntn-topbar .user-chip { background:var(--nntn-color-surface-subdued); padding:4px var(--nntn-space-3); border-radius:var(--nntn-radius-full); font-size:var(--nntn-font-sm); }
    #nntn-topbar .hamburger { display:none; background:none; border:none; font-size:20px; cursor:pointer; padding:0 var(--nntn-space-2) 0 0; color:var(--nntn-color-text); }
    @media (max-width: 900px) {
      #nntn-topbar .hamburger { display:block; }
      #nntn-sidebar.open { display:block !important; z-index: calc(var(--nntn-z-modal) + 1); }
    }
  `;
  document.head.appendChild(style);

  // Detect active nav by path
  const path = location.pathname;
  function isActive(match) {
    if (match === '/nntn/' && (path === '/nntn/' || path === '/nntn/dashboard.html')) return true;
    if (match !== '/nntn/' && path.includes(match)) return true;
    return false;
  }
  function navItem(href, icon, label, badge) {
    const active = isActive(href) ? 'active' : '';
    const b = badge ? `<span class="badge">${badge}</span>` : '';
    return `<a class="nav-item ${active}" href="${href}"><span class="icon">${icon}</span> ${label} ${b}</a>`;
  }

  // Build sidebar HTML
  const sidebar = document.createElement('aside');
  sidebar.id = 'nntn-sidebar';
  sidebar.innerHTML = `
    <div class="brand">
      <div class="brand-logo">🥩</div>
      <div><div class="brand-name">NNTN</div><div class="brand-sub">ครัวเนื้อในตำนาน</div></div>
    </div>
    <nav>
      ${navItem('/nntn/dashboard.html', '🏠', 'Dashboard')}

      <div class="nav-section">Stock</div>
      ${navItem('/nntn/meat-stock/', '🥩', 'Meat Stock')}
      ${navItem('/nntn/hub-delivery.html', '🚚', 'Delivery')}
      ${navItem('/nntn/po-receive.html', '📥', 'PO Receive')}
      ${navItem('/nntn/stock-dispense.html', '📤', 'Stock Dispense')}
      ${navItem('/nntn/production-history.html', '♻️', 'Production History')}

      <div class="nav-section">Cookingbook</div>
      ${navItem('/nntn/cookingbook/menu-bom.html', '📖', 'Menu BOM')}
      ${navItem('/nntn/production-log-form.html', '📝', 'Production Log')}

      <div class="nav-section">Admin</div>
      ${navItem('/nntn/admin-items.html', '🏷️', 'Items')}
      ${navItem('/nntn/admin-bom.html', '🧪', 'BOM Admin')}

      <div class="nav-section">Reports</div>
      ${navItem('/nntn/data-pipeline.html', '📊', 'Data Pipeline')}
    </nav>
  `;

  // Topbar
  const topbar = document.createElement('div');
  topbar.id = 'nntn-topbar';
  const crumb = (window.NNTN_PAGE && window.NNTN_PAGE.breadcrumb) || autoBreadcrumb();
  const user = (localStorage.getItem('nntn_user') || 'user').slice(0, 20);
  topbar.innerHTML = `
    <div style="display:flex; align-items:center; gap:var(--nntn-space-3);">
      <button class="hamburger" id="nntn-burger" aria-label="menu">☰</button>
      <div class="breadcrumb">${crumb}</div>
    </div>
    <div class="user-chip">👤 ${user}</div>
  `;

  function autoBreadcrumb() {
    const parts = path.replace(/^\/nntn\//, '').replace(/\.html$/, '').split('/').filter(Boolean);
    if (parts.length === 0 || parts[0] === 'dashboard') return 'Dashboard';
    return parts.map((p, i) => {
      const label = decodeURIComponent(p).replace(/-/g, ' ');
      return i === parts.length - 1 ? `<span>${label}</span>` : `<a href="/nntn/${parts.slice(0, i + 1).join('/')}">${label}</a>`;
    }).join(' · ');
  }

  // Inject
  function mount() {
    if (document.getElementById('nntn-sidebar')) return;
    document.body.insertBefore(sidebar, document.body.firstChild);
    document.body.insertBefore(topbar, sidebar.nextSibling);

    // Mobile toggle
    const burger = document.getElementById('nntn-burger');
    if (burger) burger.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
