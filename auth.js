/**
 * NNTN Stock — Supabase Auth Gate
 * ----------------------------------------
 * ตรวจ Supabase JWT session (nntn_sb_token) แทน PIN เดิม
 * login ผ่าน login.html → Supabase /auth/v1/token → เก็บ JWT ใน localStorage
 */
(function () {
  var SB_TOKEN_KEY = 'nntn_sb_token';
  var LOGIN_URL    = '/nntn/login.html';

  // ไม่บล็อกหน้า login เอง
  var path = location.pathname;
  if (path === '/nntn/login.html' || path.endsWith('/login.html')) return;

  // ตรวจ session
  if (!localStorage.getItem(SB_TOKEN_KEY)) {
    location.replace(LOGIN_URL + '?next=' + encodeURIComponent(location.href));
  }
})();
