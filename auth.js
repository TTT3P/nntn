/**
 * NNTN Stock — Supabase Auth Gate
 * ----------------------------------------
 * - ตรวจ JWT session (nntn_sb_token)
 * - Auto-refresh เมื่อ token ใกล้หมดอายุ (< 5 นาที)
 * - Inject ปุ่ม "ออกจากระบบ" ทุกหน้า
 */
(function () {
  'use strict';

  var SB          = 'https://emjqulzikpxorvpaaiww.supabase.co';
  var KEY         = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtanF1bHppa3B4b3J2cGFhaXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTgzNDAsImV4cCI6MjA5MDYzNDM0MH0.BoslF10vIufPYucuHub_czSxzAhZ9u3nTDQjwgC7I5M';
  var TOKEN_KEY   = 'nntn_sb_token';
  var REFRESH_KEY = 'nntn_sb_refresh';
  var EXPIRES_KEY = 'nntn_sb_expires';
  var LOGIN_URL   = '/nntn/login.html';

  // ไม่บล็อกหน้า login เอง
  var path = location.pathname;
  if (path === '/nntn/login.html' || path.endsWith('/login.html')) return;

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
      return true;
    } catch (e) {
      logout();
      return false;
    }
  }

  var token   = localStorage.getItem(TOKEN_KEY);
  var expires = parseInt(localStorage.getItem(EXPIRES_KEY) || '0', 10);
  var now     = Math.floor(Date.now() / 1000);

  // ไม่มี token → redirect login
  if (!token) {
    location.replace(LOGIN_URL + '?next=' + encodeURIComponent(location.href));
    return;
  }

  // Token ใกล้หมด / หมดแล้ว → refresh แล้ว reload
  if (expires && now >= expires - 300) {
    document.documentElement.style.visibility = 'hidden';
    refreshSession().then(function (ok) {
      if (ok) location.reload();
    });
    return;
  }

  // Refresh อัตโนมัติทุก 50 นาที (background)
  setInterval(function () {
    var exp = parseInt(localStorage.getItem(EXPIRES_KEY) || '0', 10);
    var n   = Math.floor(Date.now() / 1000);
    if (!exp || n >= exp - 300) refreshSession();
  }, 50 * 60 * 1000);

  // Inject ปุ่ม logout
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
