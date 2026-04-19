/**
 * NNTN Nav Badge — OOS count indicator for bottom nav
 *
 * Renders count of items with current_stock.status='OUT' into #nntn-nav-badge.
 * Single source of truth (previously copy-pasted into 6 pages with wrong query).
 *
 * Usage (1 line before </body>, after nav HTML):
 *   <script src="/nntn/shared/nntn-nav-badge.js"></script>
 *
 * Requires: element with id="nntn-nav-badge" in the page nav.
 */
(function () {
  if (window.__nntnNavBadgeLoaded) return;
  window.__nntnNavBadgeLoaded = true;

  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtanF1bHppa3B4b3J2cGFhaXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTgzNDAsImV4cCI6MjA5MDYzNDM0MH0.BoslF10vIufPYucuHub_czSxzAhZ9u3nTDQjwgC7I5M';
  const URL = 'https://emjqulzikpxorvpaaiww.supabase.co/rest/v1/current_stock?select=sku&status=eq.OUT';

  function render() {
    const b = document.getElementById('nntn-nav-badge');
    if (!b) return;
    fetch(URL, { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY } })
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          b.textContent = d.length > 99 ? '99+' : String(d.length);
          b.style.display = 'flex';
        }
      })
      .catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
