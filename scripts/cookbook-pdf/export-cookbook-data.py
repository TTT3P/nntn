#!/usr/bin/env python3
"""ดึงข้อมูลตำราสดจาก Supabase ออกมาเป็น JSON ให้ build-cookbook-pdf.py ใช้

ทำไมต้องมีขั้นนี้: cookbook.html อ่าน Supabase ตรงๆ แต่ต้อง login ก่อน RLS ถึงจะปล่อยข้อมูล
Chrome headless ล็อกอินไม่ได้ เลยดึงข้อมูลด้วย service key ตรงนี้แทน แล้วค่อยเอาไปสวมทอน

คอลัมน์ที่ดึงต้องตรงกับที่ cookbook.html เรียกใช้ ถ้าในไฟล์นั้นเพิ่มคอลัมน์ ต้องมาเพิ่มที่นี่ด้วย
ส่วนตัวกรอง (is_active · ตัดหมวดเซ็ต/ดีล) และการเรียงลำดับ ต้องทำให้เสร็จตรงนี้
เพราะตัว shim ฝั่ง build ทำ eq/neq/order ไม่ได้ — มันคืนข้อมูลทั้งก้อนตามที่ได้มา

คีย์อ่านจาก ~/.config/nntn/.env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
"""
import json, pathlib, sys, urllib.parse, urllib.request

ENV = pathlib.Path.home() / '.config' / 'nntn' / '.env'
OUT = pathlib.Path(__file__).parent / 'cookbook-data.json'
CUT_CATEGORY = 'เซ็ต/ดีล'   # 26/07 TINE: ไม่เอาลงตำรา

cfg = {}
for line in ENV.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        cfg[k.strip()] = v.strip()
URL = cfg['SUPABASE_URL'].rstrip('/')
KEY = cfg['SUPABASE_SERVICE_ROLE_KEY']


def get(table, select, extra=''):
    """ดึงทีละ 1000 แถวจนหมด (PostgREST จำกัดจำนวนต่อ request)"""
    rows, offset = [], 0
    while True:
        q = f'{URL}/rest/v1/{table}?select={urllib.parse.quote(select)}{extra}&limit=1000&offset={offset}'
        req = urllib.request.Request(q, headers={
            'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Accept-Profile': 'cookingbook',
        })
        page = json.loads(urllib.request.urlopen(req).read().decode())
        rows += page
        if len(page) < 1000:
            return rows
        offset += 1000


recipes = [r for r in get('recipes',
    'id,rcp_code,name,type,category,batch_size_g,unit', '&is_active=eq.true')
    if r.get('category') != CUT_CATEGORY]
if not recipes:
    sys.exit('ไม่มีสูตรกลับมาเลย — หยุด ไม่งั้นจะได้เล่มเปล่า')
ids = {r['id'] for r in recipes}

bom = [b for b in get('bom_items',
    'recipe_id,line_no,qty_g,unit,note,ingredient_id,sub_recipe_id') if b['recipe_id'] in ids]
bom.sort(key=lambda b: (b['recipe_id'], b.get('line_no') or 0))

ings = get('ingredients', 'id,name,category')

sops = [s for s in get('sop_steps',
    'recipe_id,steps_freeform,cover_photo_url,status,reviewed_by,reviewed_at,version')
    if s['recipe_id'] in ids]
sops.sort(key=lambda s: -(s.get('version') or 0))   # เวอร์ชันล่าสุดมาก่อน เหมือน .order() ในไฟล์จริง

data = {'recipes': recipes, 'bom': bom, 'ings': ings, 'sops': sops}
OUT.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
print('เขียนแล้ว:', OUT, OUT.stat().st_size, 'bytes')
print({k: len(v) for k, v in data.items()})
