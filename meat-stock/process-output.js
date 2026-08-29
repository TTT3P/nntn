// meat-stock/process-output.js — แปรรูป: output groups (kitchen multi-SKU), SKU dropdown/
// filter, allowed-SKU calc, repack label + pogCount/SCRAP_MAP/REPACK_MAP. Split (step 9).

// ════ แปรรูป ════
function onProcTypeChange() {
  const type = document.getElementById('proc-type').value
  const isKitchen = type === 'kitchen'
  const isRepack  = type === 'repack'
  const isMix     = type === 'mix'
  document.getElementById('proc-kitchen-groups').style.display = isKitchen ? 'block' : 'none'
  document.getElementById('proc-out-sku-row').style.display = isMix ? '' : 'none'
  document.getElementById('proc-out-repack-row').style.display = isRepack ? 'block' : 'none'
  // Legacy single bag rows: used for mix mode (and repack via #proc-out-bags-repack)
  document.getElementById('proc-bag-rows').style.display = isKitchen ? 'none' : ''
  if (isKitchen && document.querySelectorAll('#pog-list .pog').length === 0) {
    addProcOutGroup()
  }
  updateRepackItemLabel()
  updateProcOutputSum()
}

// ── Multi-output groups for kitchen mode ─────────────────────────────────
let pogCount = 0
function addProcOutGroup() {
  pogCount++
  const n = pogCount
  const wrap = document.createElement('div')
  wrap.className = 'pog'
  wrap.id = `pog-${n}`
  wrap.style.cssText = 'background:#f9f9f9;border-radius:8px;padding:10px;margin-bottom:10px;position:relative'
  wrap.innerHTML = `
    <button class="btn-danger" onclick="removeProcOutGroup(${n})" style="position:absolute;top:8px;right:8px">✕</button>
    <div class="row2" style="margin-right:32px">
      <div><label>SKU output</label>
        <select id="pog-sku-${n}" onchange="updateProcOutputSum()">
          <option value="">— เลือก SKU —</option>
        </select>
      </div>
      <div><label>จำนวนถุง</label>
        <input type="number" id="pog-bags-${n}" min="1" placeholder="0" oninput="updateProcOutGroupBagRows(${n})">
      </div>
    </div>
    <div class="row2" style="margin-top:6px;margin-right:32px;align-items:end">
      <div><label>น้ำหนักต่อถุง (กรัม)</label>
        <input type="number" id="pog-uniform-${n}" placeholder="เช่น 75" min="0" step="0.1">
      </div>
      <div>
        <button class="btn btn-outline btn-outline-blue btn-sm" onclick="fillUniformWeight(${n})" style="width:100%">📋 เติมเท่ากันทั้งหมด</button>
      </div>
    </div>
    <div id="pog-bag-rows-${n}" style="margin-top:8px"><div class="loading">ระบุจำนวนถุงก่อน</div></div>
    <div class="sum-row" style="margin-top:6px">รวมกลุ่ม: <b id="pog-sum-${n}">0.000</b> กก.</div>`
  document.getElementById('pog-list').appendChild(wrap)
  renderPogDropdown(n, computeAllowedOutputSkus())
}

function fillUniformWeight(n) {
  const g = parseFloat(document.getElementById(`pog-uniform-${n}`)?.value)
  if (!g || g <= 0) { alert('กรุณากรอกน้ำหนักต่อถุงก่อน'); return }
  const rows = document.querySelectorAll(`#pog-bag-rows-${n} input[type=number]`)
  if (rows.length === 0) { alert('กรุณาระบุจำนวนถุงก่อน'); return }
  rows.forEach(inp => { inp.value = g })
  updateProcOutputSum()
}

function removeProcOutGroup(n) {
  const el = document.getElementById(`pog-${n}`)
  if (el) el.remove()
  updateProcOutputSum()
  // Always keep at least 1 group
  if (document.querySelectorAll('#pog-list .pog').length === 0) addProcOutGroup()
}

function renderPogDropdown(n, skuList) {
  const sel = document.getElementById(`pog-sku-${n}`)
  if (!sel) return
  const currentVal = sel.value
  sel.innerHTML = '<option value="">— เลือก —</option>'
  skuList.forEach(sku => {
    const i = window._bySku?.[sku]
    if (!i) return
    const o = document.createElement('option')
    o.value = i.id
    o.textContent = `${i.sku} | ${i.name}`
    if (i.id === currentVal) o.selected = true
    sel.appendChild(o)
  })
}

function computeAllowedOutputSkus() {
  const inputSelects = document.querySelectorAll('[id^="proc-item-sel-"]')
  const selectedMainSkus = new Set()
  inputSelects.forEach(sel => {
    const itemName = sel.value
    if (!itemName) return
    const item = Object.values(window._bySku || {}).find(i => i.name === itemName)
    if (item && REPACK_MAP[item.sku]) selectedMainSkus.add(item.sku)
  })
  if (selectedMainSkus.size === 0) return window._PROC_OUTPUT_SKUS || []
  const allowed = new Set()
  selectedMainSkus.forEach(sku => (REPACK_MAP[sku] || []).forEach(o => allowed.add(o)))
  return [...allowed]
}

function updateProcOutGroupBagRows(n) {
  const cnt = parseInt(document.getElementById(`pog-bags-${n}`)?.value) || 0
  const cont = document.getElementById(`pog-bag-rows-${n}`)
  const existing = []
  cont.querySelectorAll('input[type=number]').forEach(i => existing.push(i.value))
  cont.innerHTML = ''
  for (let i = 1; i <= cnt; i++) {
    const row = document.createElement('div')
    row.className = 'bag-row'
    row.innerHTML = `
      <div class="bag-no">${i}</div>
      <input type="number" placeholder="กรัม" value="${existing[i-1]||''}"
             oninput="updateProcOutputSum()" style="text-align:right">
      <div class="bag-kg" id="pog-kg-${n}-${i}">—</div>
      <div></div>`
    cont.appendChild(row)
  }
  if (cnt === 0) cont.innerHTML = '<div class="loading">ระบุจำนวนถุงก่อน</div>'
  updateProcOutputSum()
}

function updateRepackItemLabel() {
  const type = document.getElementById('proc-type').value
  if (type !== 'repack') return
  const label = document.getElementById('proc-repack-item-label')
  const firstChip = document.querySelector('[id^=pcbag-].selected')
  if (firstChip?.dataset?.name) {
    label.textContent = `📦 ถุงใหม่จะเป็น: ${firstChip.dataset.name} (item เดิม)`
    label.style.background = '#E8F5E9'; label.style.borderLeftColor = 'var(--green)'
  } else {
    label.textContent = '⏳ เลือกถุงต้นทางก่อน'
    label.style.background = ''; label.style.borderLeftColor = ''
  }
}

// SCRAP_MAP: input SKU → trim SKU (auto-pick · ไม่ให้น้องเลือก)
// 1 SKU ครอบ origin (ไทย/ออส) — เพราะ scrap ไม่ track origin ลึก
const SCRAP_MAP = {
  'SP-101': 'MT-021',  // พิคานย่าออส → เศษเนื้อพิคานย่า
  'SP-206': 'MT-021',  // พิคานย่าไทย → เศษเนื้อพิคานย่า
  'SP-036': 'MT-015',  // สันนอก → เศษเนื้อสะโพก
  'SP-037': 'MT-015',  // สะโพกก้อน → เศษเนื้อสะโพก (28/04 ไทน์ consolidate · MT-038 deprecated)
  'SP-087': 'MT-042',  // เสือร้องไห้ออส → เศษริ้วขาว
  'MT-028': 'MT-012',  // สามชั้นตุ๋น (repack) → เศษคัทรวม fallback
  'MT-019': 'MT-012',  // เนื้อสดหมักนุ่ม (repack) → เศษคัทรวม fallback
  'SP-022': 'MT-048'   // เนื้อน่องกรอบสด → เศษเนื้อน่องกรอบ
}

// REPACK_MAP: main input SKU → allowed output SKUs (null = any output)
// Source: NNTN guide 19/04/2026 (ไทน์ confirm)
const REPACK_MAP = {
  'MT-028': ['MT-040','MT-051'],           // สามชั้นตุ๋น → [75G]เนื้อตุ๋น + [75G]เนื้อตุ๋น(ราดข้าว) (04/07 ผูก MT-051 ตาม SRCP-019 output_item_id)
  'MT-004': ['MT-046','MT-044'],           // ชายโครงตุ๋น (raw) → MT-046 ชายโครงตุ๋น (เนื้อตุ๋น) Lv.2 byproduct + MT-044 เนื้อโกเบ (06/05 DEC-022 mirror MT-035→MT-045)
  'MT-046': ['MT-040'],                    // ชายโครงตุ๋น (เนื้อตุ๋น) → [75G]เนื้อตุ๋น (26/08 TINE: MT-054 ชายโครงตุ๋น75 merged→MT-040 เนื้อตุ๋น75; was ['MT-054'] route B 26/07)
  'MT-035': ['MT-059','MT-049','MT-056','MT-045'],   // น่องลายตุ๋น (ปิดหม้อ, CW) → MT-059 น่องลายตุ๋น(หั่น) Lv.2 + MT-049 [75G] + MT-056 [150G] + MT-045 เศษ (29/08 TINE: ปิดหม้อ=น่องลายตุ๋น · หั่นแยก SKU · ตัด self-output เดิม)
  'MT-059': ['MT-049','MT-056','MT-045'],            // น่องลายตุ๋น(หั่น) → MT-049 [75G] + MT-056 [150G] + MT-045 เศษ (29/08 TINE: 75G ทำได้จากทั้งปิดหม้อและหั่น)
  'MT-019': ['MT-018'],                    // เนื้อสดหมักนุ่ม → [75G]หมักนุ่ม
  'SP-206': ['MT-043','MT-020','MT-057'],  // พิคานย่าไทย (ดิบ) → 75G/100G/200G (MT-057 13/08 TINE)
  'SP-101': ['MT-008','MT-014','MT-058'],  // พิคานย่าออส (ดิบ) → 75G/100G/200G (MT-058 13/08 TINE)
  'SP-036': ['MT-007','MT-053','MT-052','MT-055'],   // สันนอก (ดิบ) → [75G]/[100G]/[150G]แดดเดียว + [100G]แดดเดียว(พิเศษ) MT-055 (MT-053 19/07 · MT-055 26/07 TINE route A: เนื้อ/ต้นทุนเท่า MT-053)
  'SP-037': ['MT-037','MT-011'],           // เนื้อสะโพกก้อน → [75G]แม็กกี้ + [75G]เนื้อบด (27/04 แม็กกี้ · 14/07 ไทน์ confirm เพิ่ม MT-011 นโยบายเศษดิบ)
  'SP-087': ['MT-030'],                    // เสือร้องไห้ออส[500g] → [75G]กิวด้ง (02/05 ไทน์ confirm: กิวด้งเท่านั้น · ไม่ใช่แม็กกี้)
  'SP-020': ['MT-039'],                    // ลูกชิ้นเนื้อ → [500g]ลูกชิ้นเนื้อ
  'SP-031': ['MT-009'],                    // ลูกชิ้นเอ็นเนื้อ → [500g]ลูกชิ้นเอ็นเนื้อ
  'SP-038': ['MT-011'],                    // เนื้อบด → [75G]เนื้อบด (SP-038 dormant, 0 stock/ประวัติ — คงไว้ตามสั่ง ไม่แตะ)
  'SP-022': ['MT-047'],                    // เนื้อน่องกรอบสด → เนื้อน่องกรอบหมัก
  'MT-015': ['MT-011'],                    // เศษเนื้อสะโพก (ดิบ) → [75G]เนื้อบด (14/07 ไทน์ confirm นโยบายเศษดิบ)
  'MT-021': ['MT-011'],                    // เศษเนื้อพิคานย่า (ดิบ) → [75G]เนื้อบด (14/07 ไทน์ confirm นโยบายเศษดิบ)
  'MT-048': ['MT-011'],                    // เศษเนื้อน่องกรอบ (ดิบ) → [75G]เนื้อบด (14/07 ไทน์ confirm นโยบายเศษดิบ)
  'MT-012': ['MT-011'],                    // เศษเนื้อคัทรวม (ดิบ) → [75G]เนื้อบด (14/07 ไทน์ confirm — stock/ประวัติน้อยมาก แค่ 1 row เม.ย.)
  'SP-209': ['MT-011'],                    // เศษเนื้อ (ดิบ) → [75G]เนื้อบด (14/07 ไทน์ confirm — stock/ประวัติน้อยมาก แค่ 1 row เม.ย.)
  'MT-042': []                             // เศษริ้วขาว → ห้ามผลิต MT-011 (14/07 ไทน์ confirm) · [] เพราะ 16/16 rows ในประวัติเป็น by-product event ล้วน ไม่เคยถูกใช้เป็น input จริง — ไม่มี output อื่นให้ปัก
}

function renderProcOutputDropdown(skuList) {
  const skuSel = document.getElementById('proc-sku-out')
  if (!skuSel) return
  const currentVal = skuSel.value
  skuSel.innerHTML = '<option value="">— เลือก —</option>'
  skuList.forEach(sku => {
    const i = window._bySku?.[sku]
    if (!i) return
    const o = document.createElement('option')
    o.value = i.id
    o.textContent = `${i.sku} | ${i.name}`
    if (i.id === currentVal) o.selected = true
    skuSel.appendChild(o)
  })
}

function updateProcOutputFilter() {
  // Collect selected main input SKUs (ignore trim — trim = additive)
  const inputSelects = document.querySelectorAll('[id^="proc-item-sel-"]')
  const selectedMainSkus = new Set()
  inputSelects.forEach(sel => {
    const itemName = sel.value
    if (!itemName) return
    const item = Object.values(window._bySku || {}).find(i => i.name === itemName)
    if (item && REPACK_MAP[item.sku]) {
      selectedMainSkus.add(item.sku)
    }
  })
  if (selectedMainSkus.size === 0) {
    // No main input selected → show full list
    renderProcOutputDropdown(window._PROC_OUTPUT_SKUS || [])
    return
  }
  // Union of allowed outputs
  const allowed = new Set()
  selectedMainSkus.forEach(sku => {
    (REPACK_MAP[sku] || []).forEach(o => allowed.add(o))
  })
  renderProcOutputDropdown([...allowed])
  // Refresh all kitchen multi-SKU group dropdowns
  document.querySelectorAll('#pog-list .pog').forEach(grp => {
    const n = grp.id.replace('pog-', '')
    renderPogDropdown(n, [...allowed])
  })
}

// dual-mode export: browser no-op; commonjs so the SKU-ref drift guard can read the maps
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REPACK_MAP, SCRAP_MAP }
}
