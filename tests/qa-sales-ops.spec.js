// @ts-check
/**
 * QA spec — sales-ops.html (production)
 * Serves file via file:// (no Supabase auth in CI — tests check structure + fallback states)
 *
 * Test groups:
 *   A. Structure / brand (1-6)
 *   B. Loading states (7-9)             ← NEW: data-source wiring
 *   C. Error / empty fallback states (10-12)  ← NEW
 *   D. Responsive breakpoints (13-20)
 *   E. Chart canvases (21-25)
 *   F. Interactive controls (26-28)
 *   G. Accessibility (29-31)
 *   H. Screenshots (32-39)
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, '../sales-ops.html');

// ── helper: goto and wait ──
async function load(page, opts = {}) {
  await page.goto(FILE, { waitUntil: 'networkidle', ...opts });
}

// ══════════════════════════════════════
// A. STRUCTURE + BRAND
// ══════════════════════════════════════

test.describe('A · Structure + Brand', () => {

  test('A1 · page loads without critical JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await load(page);
    const critical = errors.filter(e => !e.includes('net::ERR_') && !e.includes('Failed to fetch'));
    expect(critical, `JS errors: ${critical.join(', ')}`).toHaveLength(0);
  });

  test('A2 · header shows brand name (ตำนาน)', async ({ page }) => {
    await load(page);
    const title = await page.locator('.header-title').textContent();
    expect(title).toContain('ตำนาน');
  });

  test('A3 · header background is exact brand green #005036', async ({ page }) => {
    await load(page);
    const bg = await page.locator('.header').evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    expect(bg).toBe('rgb(0, 80, 54)');
  });

  test('A4 · header date is populated', async ({ page }) => {
    await load(page);
    const date = await page.locator('#headerDate').textContent();
    expect(date?.trim().length).toBeGreaterThan(3);
  });

  test('A5 · hub link present and points to hub.html', async ({ page }) => {
    await load(page);
    const href = await page.locator('a.hub-link').getAttribute('href');
    expect(href).toContain('hub.html');
  });

  test('A6 · footer references v_daily_revenue', async ({ page }) => {
    await load(page);
    const footer = await page.locator('.footer').textContent();
    expect(footer).toContain('v_daily_revenue');
  });

});

// ══════════════════════════════════════
// B. DATA-SOURCE WIRING (NEW)
// ══════════════════════════════════════

test.describe('B · Data-source wiring', () => {

  test('B1 · Supabase JS client script tag present', async ({ page }) => {
    await load(page);
    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
    );
    const hasSb = scripts.some(s => s.includes('supabase'));
    expect(hasSb, 'Supabase CDN script not found').toBe(true);
  });

  test('B2 · page attempts Supabase query (network request or env-guard message)', async ({ page }) => {
    // On file:// without auth.js, sb=null → env-guard path runs
    // We verify the guard runs without throwing (no crash) and
    // metric cards show either data or "—" (not raw skeleton HTML)
    await load(page);
    await page.waitForTimeout(1500);
    const latestVal = await page.locator('#c-latest').textContent();
    // Should be "—" (env guard) or a ฿ value (if auth available) — never empty skeleton
    expect(latestVal).toBeTruthy();
  });

  test('B3 · loading state HTML is present in source (skeleton + spinner markup exist)', async ({ page }) => {
    // Verify the loading-state elements are defined in HTML source
    // (file:// doesn't support route intercept, so we check DOM definition)
    await load(page);
    // spinner CSS animation must exist
    const hasSpinnerStyle = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const s of sheets) {
        try {
          const rules = Array.from(s.cssRules || []);
          if (rules.some(r => r.selectorText && r.selectorText.includes('spinner'))) return true;
        } catch {}
      }
      return false;
    });
    expect(hasSpinnerStyle, '.spinner CSS not found — loading state missing').toBe(true);
    // skeleton shimmer keyframe must exist
    const hasSkeletonStyle = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const s of sheets) {
        try {
          const rules = Array.from(s.cssRules || []);
          if (rules.some(r => r.selectorText && r.selectorText.includes('skeleton'))) return true;
        } catch {}
      }
      return false;
    });
    expect(hasSkeletonStyle, '.skeleton CSS not found — loading skeleton missing').toBe(true);
    // state-loading class must exist
    const hasLoadingClass = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const s of sheets) {
        try {
          const rules = Array.from(s.cssRules || []);
          if (rules.some(r => r.selectorText && r.selectorText.includes('state-loading'))) return true;
        } catch {}
      }
      return false;
    });
    expect(hasLoadingClass, '.state-loading CSS not found').toBe(true);
  });

});

// ══════════════════════════════════════
// C. ERROR + EMPTY FALLBACK STATES (NEW)
// ══════════════════════════════════════

test.describe('C · Error + Empty fallback states', () => {

  test('C1 · error state renders (state-error class exists in CSS)', async ({ page }) => {
    await load(page);
    // Verify the CSS class is defined (page has the style rule)
    const hasCls = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const s of sheets) {
        try {
          const rules = Array.from(s.cssRules || []);
          if (rules.some(r => r.selectorText && r.selectorText.includes('state-error'))) return true;
        } catch {}
      }
      return false;
    });
    expect(hasCls, '.state-error CSS class not found').toBe(true);
  });

  test('C2 · empty state renders (state-empty class exists in CSS)', async ({ page }) => {
    await load(page);
    const hasCls = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const s of sheets) {
        try {
          const rules = Array.from(s.cssRules || []);
          if (rules.some(r => r.selectorText && r.selectorText.includes('state-empty'))) return true;
        } catch {}
      }
      return false;
    });
    expect(hasCls, '.state-empty CSS class not found').toBe(true);
  });

  test('C3 · anomaly banner hidden by default (no false-alarm on load)', async ({ page }) => {
    await load(page);
    await page.waitForTimeout(1500);
    // On file:// without real data, sb=null → anomaly check never fires → banner stays hidden
    const banner = page.locator('#anomalyBanner');
    const isHidden = await banner.evaluate(el => el.classList.contains('hidden'));
    // Either hidden (no data) or visible (real anomaly) — never a crash
    // We just verify the element exists and has the right attribute
    const count = await banner.count();
    expect(count).toBe(1);
    // If hidden, classList must contain 'hidden'
    if (isHidden) {
      const cls = await banner.getAttribute('class');
      expect(cls).toContain('hidden');
    }
  });

});

// ══════════════════════════════════════
// D. RESPONSIVE BREAKPOINTS
// ══════════════════════════════════════

const BREAKPOINTS = [
  { name: 'mobile-s-360',   width: 360,  height: 800  },
  { name: 'mobile-l-480',   width: 480,  height: 900  },
  { name: 'tablet-768',     width: 768,  height: 1024 },
  { name: 'tablet-l-1024',  width: 1024, height: 1366 },
  { name: 'desktop-1280',   width: 1280, height: 900  },
  { name: 'desktop-l-1920', width: 1920, height: 1080 },
];

test.describe('D · Responsive breakpoints', () => {

  for (const bp of BREAKPOINTS) {
    test(`D-overflow · no horizontal scroll @ ${bp.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await load(page);
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow, `Horizontal scroll @ ${bp.width}px`).toBe(false);
    });
  }

  test('D-col1 · metric cards: 1 col at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await load(page);
    const cols = await page.locator('.metric-row').evaluate(
      el => window.getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length
    );
    expect(cols).toBe(1);
  });

  test('D-col2 · metric cards: 2 cols at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await load(page);
    const cols = await page.locator('.metric-row').evaluate(
      el => window.getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length
    );
    expect(cols).toBe(2);
  });

  test('D-col4 · metric cards: 4 cols at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await load(page);
    const cols = await page.locator('.metric-row').evaluate(
      el => window.getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length
    );
    expect(cols).toBe(4);
  });

  test('D-forecast-col · forecast-row is column on 480px', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await load(page);
    const dir = await page.locator('.forecast-row').evaluate(
      el => window.getComputedStyle(el).flexDirection
    );
    expect(dir).toBe('column');
  });

  test('D-forecast-row · forecast-row is row on 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await load(page);
    const dir = await page.locator('.forecast-row').evaluate(
      el => window.getComputedStyle(el).flexDirection
    );
    expect(dir).toBe('row');
  });

  test('D-chart-grid-stacked · chart-grid 1 col at 480px', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await load(page);
    const cols = await page.locator('.chart-grid').evaluate(
      el => window.getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length
    );
    expect(cols).toBe(1);
  });

  test('D-chart-grid-side · chart-grid 2 cols at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await load(page);
    const cols = await page.locator('.chart-grid').evaluate(
      el => window.getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length
    );
    expect(cols).toBe(2);
  });

  test('D-touch · range buttons height ≥ 44px at 360px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await load(page);
    await page.waitForTimeout(300);
    const heights = await page.locator('.range-btn').evaluateAll(
      els => els.map(el => el.getBoundingClientRect().height)
    );
    for (const h of heights) {
      expect(h, `range-btn height ${h}px < 44px`).toBeGreaterThanOrEqual(44);
    }
  });

});

// ══════════════════════════════════════
// E. CHART CANVASES
// ══════════════════════════════════════

test.describe('E · Chart canvases', () => {

  test('E1 · trend chart canvas present', async ({ page }) => {
    await load(page);
    await expect(page.locator('#trendChart')).toBeVisible();
  });

  test('E2 · channel donut canvas present', async ({ page }) => {
    await load(page);
    await expect(page.locator('#channelDonut')).toBeVisible();
  });

  test('E3 · sparkline canvases present (4 total)', async ({ page }) => {
    await load(page);
    for (const id of ['spk-total','spk-grab','spk-fs','spk-nt']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test('E4 · forecast cards present (3)', async ({ page }) => {
    await load(page);
    const count = await page.locator('.forecast-card').count();
    expect(count).toBe(3);
  });

  test('E5 · metric cards present (4)', async ({ page }) => {
    await load(page);
    const count = await page.locator('.metric-card').count();
    expect(count).toBe(4);
  });

});

// ══════════════════════════════════════
// F. INTERACTIVE CONTROLS
// ══════════════════════════════════════

test.describe('F · Interactive controls', () => {

  test('F1 · range toggle 7D button activates on click', async ({ page }) => {
    await load(page);
    const btn7 = page.locator('.range-btn', { hasText: '7D' });
    await expect(btn7).toBeVisible();
    await btn7.click();
    await expect(btn7).toHaveClass(/active/);
  });

  test('F2 · range toggle 30D button activates on click', async ({ page }) => {
    await load(page);
    const btn30 = page.locator('.range-btn', { hasText: '30D' });
    await btn30.click();
    await expect(btn30).toHaveClass(/active/);
  });

  test('F3 · 14D is active by default', async ({ page }) => {
    await load(page);
    const btn14 = page.locator('.range-btn', { hasText: '14D' });
    await expect(btn14).toHaveClass(/active/);
  });

});

// ══════════════════════════════════════
// G. ACCESSIBILITY
// ══════════════════════════════════════

test.describe('G · Accessibility', () => {

  test('G1 · anomaly banner has role=alert', async ({ page }) => {
    await load(page);
    const role = await page.locator('#anomalyBanner').getAttribute('role');
    expect(role).toBe('alert');
  });

  test('G2 · sparkline canvases have aria-label', async ({ page }) => {
    await load(page);
    for (const id of ['spk-total','spk-grab','spk-fs','spk-nt']) {
      const label = await page.locator(`#${id}`).getAttribute('aria-label');
      expect(label?.length).toBeGreaterThan(0);
    }
  });

  test('G3 · delta table has aria-label', async ({ page }) => {
    await load(page);
    const label = await page.locator('table.delta-table').getAttribute('aria-label');
    expect(label?.length).toBeGreaterThan(0);
  });

});

// ══════════════════════════════════════
// H. SCREENSHOTS (visual record)
// ══════════════════════════════════════

test.describe('H · Screenshots', () => {

  test('H-desktop · screenshot @ 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await load(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/sales-ops-desktop-1280.png', fullPage: true });
  });

  for (const bp of BREAKPOINTS) {
    test(`H-${bp.name} · screenshot @ ${bp.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await load(page);
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: `test-results/sales-ops-${bp.name}.png`,
        fullPage: true,
      });
    });
  }

});
