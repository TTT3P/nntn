# NNTN — ระบบสต๊อกครัวเนื้อในตำนาน

> Vanilla HTML/CSS/JS · Supabase Postgres · GitHub Pages
> Live: <https://ttt3p.github.io/nntn/hub.html>

ดู `BLUEPRINT.md` สำหรับสถาปัตยกรรม · `ship-log.md` สำหรับประวัติ deploy

---

## Security

ระบบใช้ **defense in depth** ใน 4 ชั้น:

### 1. SAST · Semgrep (PR-time)
Workflow: `.github/workflows/semgrep.yml`
- Trigger: ทุก PR เข้า `main`, push `main`, weekly Sun 01:00 BKK
- Rulesets: `p/security-audit` · `p/owasp-top-ten` · `p/javascript`
- Severity gate: `ERROR`/`WARNING` ขัดการ merge
- Findings ดูที่ **Security tab → Code scanning** (SARIF upload)

### 2. Secret Scanning · GitHub built-in
- ✅ Secret scanning enabled
- ✅ Push protection enabled (block commit ที่มี secret pattern)
- Verify: `gh api repos/TTT3P/nntn --jq '.security_and_analysis'`

### 3. Database · Supabase RLS + triggers
- `sm_block_mutation` — `stock_movements` append-only · UPDATE/DELETE raises
- `prevent_deliver_if_not_in_stock` — บล็อก submit ถ้าถุงไม่ใช่ In Stock
- Anon key เท่านั้นใน frontend · service_role อยู่ฝั่ง server เสมอ
- รายละเอียด: `BLUEPRINT.md` §Triggers (critical safety)

### 4. CI baseline
- `.github/workflows/qa-playwright.yml` — 17 Playwright E2E tests ทุก push
- `.github/workflows/security-probe.yml` — periodic probe
- `.github/workflows/backup.yml` — pg_dump backup

### Reporting a vulnerability
ส่ง private message ใน Discord `#platform` หรือเปิด private security advisory ที่ <https://github.com/TTT3P/nntn/security/advisories/new>

### Coverage notes
P2 interim stack (May 2026 →) ครอบคลุม ~80% ของ Claude Security review (Enterprise · 90d wait). Followup: Claude Security promotion เมื่อ available.
