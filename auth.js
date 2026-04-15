/**
 * NNTN Stock — Supabase Auth Gate + Session Loader
 * ----------------------------------------
 * - ตรวจ JWT session (nntn_sb_token)
 * - Auto-refresh เมื่อ token ใกล้หมดอายุ (< 5 นาที)
 * - Inject ปุ่ม "ออกจากระบบ" ทุกหน้า
 * - Monkey-patch `supabase.createClient` → every client auto-includes
 *   `Authorization: Bearer <user_access_token>` in every PostgREST request
 *   → zero-edit migration: pages can keep their existing createClient calls
 *
 * Load order (important):
 *   <script src="/nntn/auth.js"></script>              ← this file
 *   <script src="https://cdn.../supabase-js@2"></script> ← SDK
 *   <script>  const sb = supabase.createClient(URL, KEY);  </script>
 *
 * auth.js installs a `defineProperty` hook on `window.supabase` that rewrites
 * `createClient` to inject user JWT header — runs synchronously when SDK loads.
 */
(function () {
  'use strict';

  var SB          = 'https://emjqulzikpxorvpaaiww.supabase.co';
  var KEY         = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtanF1bHppa3B4b3J2cGFhaXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTgzNDAsImV4cCI6MjA5MDYzNDM0MH0.BoslF10vIufPYucuHub_czSxzAhZ9u3nTDQjwgC7I5M';
  var TOKEN_KEY   = 'nntn_sb_token';
  var REFRESH_KEY = 'nntn_sb_refresh';
  var EXPIRES_KEY = 'nntn_sb_expires';
  var LOGIN_URL   = '/nntn/login.html';

  // Expose anon constants for any legacy code that references them
  window.NNTN_SB_URL  = SB;
  window.NNTN_SB_ANON = KEY;

  var path = location.pathname;
  var isLoginPage = (path === '/nntn/login.html' || path.endsWith('/login.html'));

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  }

  function logout() {
    clearSession();
    location.replace(LOGIN_URL);
  }

  async function refreshSession() {
    var rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) { logout(); return false; }
    try {
      var res = await fetch(SB + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      });
      if (!res.ok) { logout(); return false; }
      var data = await res.json();
      localStorage.setItem(TOKEN_KEY,   data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      localStorage.setItem(EXPIRES_KEY, String(data.expires_at));
      // Update any existing clients' header to use new token
      window.__nntnCurrentToken = data.access_token;
      return true;
    } catch (e) {
      logout();
      return false;
    }
  }

  // ============================================================
  // Install createClient monkey-patch via property descriptor
  // ============================================================
  function patchCreateClient(supabaseNs) {
    if (!supabaseNs || !supabaseNs.createClient || supabaseNs.__nntnPatched) return;

    var original = supabaseNs.createClient.bind(supabaseNs);

    supabaseNs.createClient = function patchedCreateClient(url, key, options) {
      options = options || {};
      options.global = options.global || {};
      options.global.headers = options.global.headers || {};

      // Inject user JWT into Authorization header (overrides anon bearer)
      var tok = window.__nntnCurrentToken || localStorage.getItem(TOKEN_KEY);
      if (tok) {
        options.global.headers['Authorization'] = 'Bearer ' + tok;
      }

      // Always ensure apikey header (Supabase JS does this already, but be safe)
      if (key && !options.global.headers['apikey']) {
        options.global.headers['apikey'] = key;
      }

      return original(url, key, options);
    };

    supabaseNs.__nntnPatched = true;
  }

  // Install ASAP using Object.defineProperty setter hook.
  // auth.js runs BEFORE supabase-js CDN script, so `window.supabase` is undefined.
  // We install a setter that intercepts the assignment when supabase-js loads.
  function installPatchWhenReady() {
    // If already loaded (hot-reload / rare case), patch immediately
    if (window.supabase && window.supabase.createClient) {
      patchCreateClient(window.supabase);
      return;
    }

    var _sb = undefined;
    try {
      Object.defineProperty(window, 'supabase', {
        configurable: true,
        get: function () { return _sb; },
        set: function (v) {
          _sb = v;
          patchCreateClient(_sb);
        },
      });
    } catch (e) {
      // Fallback: if defineProperty fails, fall back to polling
      console.warn('[auth] defineProperty setter failed, falling back to polling:', e);
      var start = Date.now();
      var iv = setInterval(function () {
        if (window.supabase && window.supabase.createClient) {
          clearInterval(iv);
          patchCreateClient(window.supabase);
        } else if (Date.now() - start > 10000) {
          clearInterval(iv);
          console.error('[auth] supabase-js did not load within 10s — createClient patch NOT installed');
        }
      }, 10);
    }
  }

  // Login page → don't gate, just install patch (login uses anon key directly anyway)
  if (isLoginPage) {
    installPatchWhenReady();
    return;
  }

  var token   = localStorage.getItem(TOKEN_KEY);
  var expires = parseInt(localStorage.getItem(EXPIRES_KEY) || '0', 10);
  var now     = Math.floor(Date.now() / 1000);

  // No token → redirect login
  if (!token) {
    location.replace(LOGIN_URL + '?next=' + encodeURIComponent(location.href));
    return;
  }

  // Token near expiry → refresh + reload
  if (expires && now >= expires - 300) {
    document.documentElement.style.visibility = 'hidden';
    refreshSession().then(function (ok) {
      if (ok) location.reload();
    });
    return;
  }

  // Set current token (readable by patched createClient + fetch)
  window.__nntnCurrentToken = token;

  // Install the patch NOW (before any page script runs createClient)
  installPatchWhenReady();

  // ============================================================
  // Also monkey-patch window.fetch for raw REST calls (e.g. badge loaders)
  // that hardcode anon key in Authorization header
  // ============================================================
  (function patchFetch() {
    if (!window.fetch || window.fetch.__nntnPatched) return;
    var orig = window.fetch.bind(window);
    var wrapped = function patchedFetch(input, init) {
      try {
        var url = (typeof input === 'string') ? input : (input && input.url) || '';
        if (url.indexOf(SB + '/rest/v1') === 0) {
          init = init || {};
          var h = init.headers;
          var tok = window.__nntnCurrentToken || localStorage.getItem(TOKEN_KEY);
          if (tok) {
            if (h instanceof Headers) {
              h.set('Authorization', 'Bearer ' + tok);
            } else if (h && typeof h === 'object') {
              h['Authorization'] = 'Bearer ' + tok;
            } else {
              init.headers = { 'Authorization': 'Bearer ' + tok, 'apikey': KEY };
            }
          }
        }
      } catch (e) {
        console.warn('[auth] fetch patch error:', e);
      }
      return orig(input, init);
    };
    wrapped.__nntnPatched = true;
    window.fetch = wrapped;
  })();

  // Auto-refresh every 50 minutes
  setInterval(function () {
    var exp = parseInt(localStorage.getItem(EXPIRES_KEY) || '0', 10);
    var n   = Math.floor(Date.now() / 1000);
    if (!exp || n >= exp - 300) refreshSession();
  }, 50 * 60 * 1000);

  // Logout button
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.createElement('button');
    btn.textContent = 'ออกจากระบบ';
    btn.title = 'Logout';
    btn.onclick = logout;
    btn.style.cssText = [
      'position:fixed', 'bottom:20px', 'right:20px', 'z-index:9999',
      'background:#8B0000', 'color:#fff', 'border:none', 'border-radius:8px',
      'padding:8px 16px', 'font-size:0.75rem', 'font-family:Sarabun,sans-serif',
      'cursor:pointer', 'box-shadow:0 2px 8px rgba(0,0,0,0.35)', 'opacity:0.9'
    ].join(';');
    btn.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
    btn.addEventListener('mouseleave', function () { btn.style.opacity = '0.9'; });
    document.body.appendChild(btn);
  });
})();
