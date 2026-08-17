#!/usr/bin/env python3
"""เรนเดอร์ตำราครัว NNTN เป็น PDF จาก cookbook.html + ข้อมูลที่ export ไว้

    python3 export-cookbook-data.py           # ดึงข้อมูลสดก่อน
    python3 build-cookbook-pdf.py v3          # ได้ไฟล์ที่ ~/Desktop/ตำราครัว NNTN — v3.pdf
    python3 build-cookbook-pdf.py ทดสอบ --local   # ลองไฟล์ที่ยังไม่ commit (ไว้ตรวจก่อนปล่อย)

**หน้าตาเล่มมีเจ้าของเดียวคือ cookbook.html** — สคริปต์นี้ไม่จัดหน้าเอง ไม่มี CSS ของตัวเอง
ถ้าเขียนตัวจัดหน้าชุดที่สอง วันหนึ่งเว็บกับเล่มพิมพ์จะไม่ตรงกันแน่นอน

ใช้ cookbook.html **ตัวที่ commit แล้ว (HEAD)** ไม่ใช่ไฟล์ในเครื่อง
เพราะเล่มที่ปล่อยให้ครัวใช้ ต้องตามหลังโค้ดที่ผ่านการ review แล้วเท่านั้น
ระหว่างที่มีงานแก้ค้างอยู่ ของค้างนั้นจะไม่หลุดเข้าเล่ม

ที่สวมทอนมีอย่างเดียวคือแหล่งข้อมูล: จาก Supabase (ต้อง login) → JSON ที่ export ไว้
เพราะ Chrome headless ล็อกอินไม่ได้
"""
import json, re, subprocess, sys, pathlib

WORK   = pathlib.Path(__file__).resolve().parent
REPO   = WORK.parent.parent                      # product-hub/nntn
DATA   = WORK / 'cookbook-data.json'
STAGE  = WORK / 'cookbook-print.html'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else 'draft'
    # ออกที่โฟลเดอร์ของสคริปต์เอง ไม่ใช่ Desktop ของ TINE (2026-08-02 TINE สั่ง อย่าโยนของใส่ Desktop)
    # เล่มที่ปล่อยจริงค่อยคัดไป vault/nntn/Operations/CookBook/ · ของที่ให้ TINE ดูไป ψ/inbox/TINE/
    outdir = WORK / 'out'
    outdir.mkdir(exist_ok=True)
    out = outdir / f'ตำราครัว NNTN — {version}.pdf'

    if not DATA.exists():
        sys.exit(f'ยังไม่มีไฟล์ข้อมูล: {DATA} — รัน export-cookbook-data.py ก่อน')
    d = json.loads(DATA.read_text(encoding='utf-8'))
    counts = {k: len(d.get(k) or []) for k in ('recipes', 'bom', 'ings', 'sops')}
    print('ข้อมูล:', counts)
    if not counts['recipes']:
        sys.exit('ไม่มีสูตรในไฟล์ข้อมูล — หยุด')

    if '--local' in sys.argv:
        # ใช้ไฟล์ในเครื่องทั้งที่ยังไม่ commit — สำหรับ "ตรวจก่อนปล่อย" เท่านั้น
        # เล่มที่ส่งครัวจริงต้องมาจาก HEAD เสมอ
        print('⚠️  --local: ใช้ cookbook.html ที่ยังไม่ commit — ห้ามเอาเล่มนี้ไปปล่อยใช้')
        html = (REPO / 'cookbook.html').read_text(encoding='utf-8')
    else:
        html = subprocess.run(['git', '-C', str(REPO), 'show', 'HEAD:cookbook.html'],
                              capture_output=True, text=True, check=True).stdout
    if not html:
        sys.exit('อ่าน cookbook.html ไม่ได้')

    # ตัดสิ่งที่ต้องใช้เน็ต/ล็อกอิน
    html = html.replace('<script src="/nntn/auth.js"></script>', '')
    html = re.sub(r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2"></script>', '', html)

    # สวม sb ปลอมที่หน้าตา API เหมือนเดิม แต่คืนค่าจาก JSON
    shim = """
const __DATA__ = %s;
const __TABLE__ = { recipes: '__recipes', bom_items: '__bom', ingredients: '__ings', sop_steps: '__sops' };
function __q(rows) {
  const o = {
    data: rows, error: null,
    select: () => o, eq: () => o, neq: () => o, not: () => o, in: () => o, order: () => o, limit: () => o,
    then: (res) => res({ data: rows, error: null }),
  };
  return o;
}
const sb = { schema: () => ({ from: (t) => __q(__DATA__[__TABLE__[t]] || []) }) };
""" % json.dumps({
        '__recipes': d.get('recipes') or [],
        '__bom':     d.get('bom') or [],
        '__ings':    d.get('ings') or [],
        '__sops':    d.get('sops') or [],
    }, ensure_ascii=False)

    client = re.search(r"const SB_URL = .*?const sb = supabase\.createClient\(SB_URL, SB_KEY\);", html, re.S)
    if not client:
        sys.exit('หาโค้ดต่อ Supabase ใน cookbook.html ไม่เจอ — โครงไฟล์เปลี่ยน หยุดก่อนจะได้เล่มผิด')
    html = html.replace(client.group(0), shim)

    STAGE.write_text(html, encoding='utf-8')
    print('staging:', STAGE.name, STAGE.stat().st_size, 'bytes')

    # A4 แนวตั้ง ขอบ 0 เพราะ .page ใน cookbook.html คุมขอบเอง
    r = subprocess.run([CHROME, '--headless', '--disable-gpu', '--no-pdf-header-footer',
                        '--virtual-time-budget=25000', f'--print-to-pdf={out}', STAGE.as_uri()],
                       capture_output=True, text=True)
    if not out.exists():
        print(r.stdout[-2000:]); print(r.stderr[-2000:])
        sys.exit('Chrome ไม่ได้สร้างไฟล์ PDF')
    print('ได้ไฟล์:', out, out.stat().st_size, 'bytes')
    print('อย่าลืม: นับหน้า/นับสูตรเทียบกับข้อมูลก่อนบอกว่าเสร็จ แล้วเก็บเข้า vault/nntn/Operations/CookBook/')


if __name__ == '__main__':
    main()
