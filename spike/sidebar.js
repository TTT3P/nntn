// NNTN shared sidebar — injects markup into any <aside data-sidebar> element.
// Also renders a theme picker at the bottom and handles theme persistence.
(function () {
  const NAV = [
    { id: "overview", label: "ภาพรวม", href: "dashboard.html", icon: "grid" },
    { id: "stock",    label: "สต๊อกวัตถุดิบ", href: "stock.html", icon: "box", count: 26 },
    { id: "prep",     label: "CookingBook · แปรรูป", href: "prep.html", icon: "swap" },
    { id: "sales",    label: "Sales Ops", href: "#", icon: "trend" },
    { id: "hr",       label: "HR · บุคลากร", href: "#", icon: "user", soon: true },
    { id: "fin",      label: "Financial", href: "#", icon: "coin", soon: true },
  ];
  const ICONS = {
    grid:  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg>',
    box:   '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 6l7-3 7 3-7 3-7-3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 10l7 3 7-3M3 14l7 3 7-3" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    swap:  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M4 10l3-3M4 10l3 3M16 10l-3-3M16 10l-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trend: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 15l4-5 3 3 7-8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 5h4v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    user:  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M3 17c1.5-3 4-4 7-4s5.5 1 7 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    coin:  '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2v16M6 6c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5-1.5 2-4 2.5-4 1-4 2.5 1.5 2.5 4 2.5 4-1 4-2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };

  const THEMES = [
    { id: "warm",   label: "Warm Orange",   swatch: "linear-gradient(135deg,#F05A1A,#E8441A)" },
    { id: "blue",   label: "Cool Blue",     swatch: "linear-gradient(135deg,#2563EB,#1D4ED8)" },
    { id: "green",  label: "Forest Green",  swatch: "linear-gradient(135deg,#10B981,#047857)" },
    { id: "sakura", label: "Sakura Pink",   swatch: "linear-gradient(135deg,#EC4899,#BE185D)" },
    { id: "dark",   label: "Midnight Tech", swatch: "linear-gradient(135deg,#0D1117 50%,#06B6D4 50%)" },
  ];

  // ---------- Theme persistence ----------
  function applyTheme(id) {
    const root = document.documentElement;
    if (id === "warm") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", id);
    try { localStorage.setItem("nntn_theme", id); } catch (e) {}
    document.querySelectorAll(".theme-swatch").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.theme === id ? "true" : "false");
    });
  }
  // Apply saved theme early (before sidebar renders) to avoid flash
  try {
    const saved = localStorage.getItem("nntn_theme");
    if (saved && saved !== "warm") document.documentElement.setAttribute("data-theme", saved);
  } catch (e) {}

  function render(el) {
    const active = el.dataset.active || "";
    const prefix = el.dataset.prefix || "";
    const currentTheme = (localStorage.getItem("nntn_theme") || "warm");
    const html = `
      <div class="sidebar__brand">
        <div class="sidebar__brand-logo" aria-hidden="true">🍜</div>
        <div class="sidebar__brand-text">
          <div class="sidebar__brand-name">ร้านก๋วยเตี๋ยว</div>
          <div class="sidebar__brand-sub">ระบบจัดการร้าน NNTN</div>
        </div>
      </div>
      <button class="sidebar__cta" type="button"><span aria-hidden="true">📥</span><span>รับของเข้า</span></button>
      <nav class="sidebar__section" aria-label="เมนูการใช้งาน">
        <div class="sidebar__section-label">เมนูหลัก</div>
        ${NAV.map(n => `
          <a href="${prefix}${n.href}" class="nav-item ${n.id === active ? 'is-active' : ''}" ${n.id === active ? 'aria-current="page"' : ''} ${n.soon ? 'aria-disabled="true"' : ''}>
            <span class="nav-item__icon" aria-hidden="true">${ICONS[n.icon]}</span>
            <span class="nav-item__label">${n.label}</span>
            ${n.count ? `<span class="nav-item__count">${n.count}</span>` : ''}
            ${n.soon ? `<span class="nav-item__badge">soon</span>` : ''}
          </a>
        `).join('')}
      </nav>
      <div class="sidebar__theme" role="radiogroup" aria-label="เลือกธีม">
        <div class="sidebar__theme-label">Theme</div>
        <div class="sidebar__theme-swatches">
          ${THEMES.map(t => `
            <button type="button" class="theme-swatch" data-theme="${t.id}"
              aria-pressed="${t.id === currentTheme ? 'true' : 'false'}"
              title="${t.label}" style="background:${t.swatch}"></button>
          `).join('')}
        </div>
      </div>`;
    el.innerHTML = html;

    // Wire swatch clicks
    el.querySelectorAll(".theme-swatch").forEach(btn => {
      btn.addEventListener("click", () => applyTheme(btn.dataset.theme));
    });
  }
  document.querySelectorAll('[data-sidebar]').forEach(render);
})();
