/**
 * NNTN Stock — Client-side Password Gate
 * ----------------------------------------
 * เปลี่ยน password: แก้ค่า AUTH_TOKEN ด้านล่าง
 *   วิธีหา token ใหม่: เปิด browser console แล้วพิมพ์ btoa('รหัสผ่านใหม่')
 *
 * Default password: nntn2026
 * Default token:    bm50bjIwMjY=
 */
(function () {
  var AUTH_KEY   = 'nntn_auth_v1';
  var AUTH_TOKEN = 'bm50bjIwMjY=';        // btoa('nntn2026') — เปลี่ยนได้
  var LOGIN_URL  = '/nntn/login.html';

  // ไม่บล็อกหน้า login เอง
  var path = location.pathname;
  if (path === '/nntn/login.html' || path.endsWith('/login.html')) return;

  // ตรวจ session
  if (localStorage.getItem(AUTH_KEY) !== AUTH_TOKEN) {
    location.replace(LOGIN_URL + '?next=' + encodeURIComponent(location.href));
  }
})();
