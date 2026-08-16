// meat-stock/process.js — แปรรูป (repack/portion) tab: output groups, SKU filters,
// input bag chips, yield calc, scrap, submit. Extracted (monolith split · step 5).
// Classic <script src>, globals shared (pogCount/SCRAP_MAP/REPACK_MAP + core helpers).

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
  'MT-046': ['MT-054'],                    // ชายโครงตุ๋น (เนื้อตุ๋น) → MT-054 [75G]ชายโครงตุ๋น (26/07 TINE route B: พอร์ชันจากตัวตุ๋นแยกแล้ว ไม่ใช่ MT-004)
  'MT-035': ['MT-035','MT-049','MT-056','MT-045'],   // เนื้อน่องลายตุ๋น (CW ปัจจุบัน) → MT-035 ชิ้นสวย + MT-049 [75G] + MT-056 [150G]น่องลายตุ๋น (01/08 TINE) + MT-045 เศษ (เศษไว้ท้ายสุด)
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

function addProcInput() {
  procInputCount++
  const n = procInputCount
  // Curated list: SKU หลัก + เศษเนื้อ (category=meat_trim)
  const MAIN_PROC_SKUS = ['MT-028','MT-004','MT-046','MT-019','MT-035','SP-206','SP-101','SP-036','SP-037','SP-087','SP-020','SP-031','SP-038']  // MT-046 เพิ่ม 26/07 (route B input สำหรับ [75G]ชายโครงตุ๋น)
  const mainInStock = [...new Set(
    cwStock.filter(r => MAIN_PROC_SKUS.includes(r.item_sku)).map(r => r.item_name).filter(Boolean)
  )].sort()
  const scrapInStock = [...new Set(
    cwStock.filter(r => r.item_category === 'meat_trim' && !MAIN_PROC_SKUS.includes(r.item_sku))
      .map(r => r.item_name).filter(Boolean)
  )].sort()
  const mainOpts = mainInStock.map(nm => `<option value="${nm}">${nm}</option>`).join('')
  const scrapOpts = scrapInStock.map(nm => `<option value="${nm}">${nm}</option>`).join('')
  const itemOpts =
    (mainOpts ? `<optgroup label="หลัก">${mainOpts}</optgroup>` : '') +
    (scrapOpts ? `<optgroup label="เศษเนื้อ">${scrapOpts}</optgroup>` : '')
  const isEmpty = mainInStock.length + scrapInStock.length === 0
  if (isEmpty) {
    // Options empty — always try reload (cwStock may be stale / not loaded / partial)
    setTimeout(() => {
      if (typeof loadStock === 'function') {
        loadStock().then(() => {
          const sel = document.getElementById(`proc-item-sel-${n}`)
          if (sel && sel.options.length <= 1) {
            // After reload still empty → re-render this row with fresh cwStock
            document.getElementById(`proc-in-card-${n}`)?.remove()
            procInputCount--
            addProcInput()
          }
        })
      }
    }, 100)
  }

  const div = document.createElement('div')
  div.style.marginBottom = '10px'
  div.innerHTML = `
    <div style="background:#f9f9f9;border-radius:8px;padding:10px;position:relative" id="proc-in-card-${n}">
      <button class="btn-danger" onclick="document.getElementById('proc-in-card-${n}').remove();updateProcSum();updateRepackItemLabel();updateProcOutputFilter()"
              style="position:absolute;top:8px;right:8px">✕</button>
      <div class="mb">
        <label>ประเภทเนื้อ</label>
        <select id="proc-item-sel-${n}" onchange="loadProcBagChips(${n});updateProcOutputFilter()">
          <option value="">— เลือก item —</option>${itemOpts}
        </select>
      </div>
      <div id="proc-bag-chips-area-${n}"></div>
      <div style="margin-top:6px">
        <label>รวม input (กก.)</label>
        <input type="number" id="proc-in-kg-${n}" placeholder="0.000" step="0.001"
               style="background:#f0f0f0" readonly>
      </div>
    </div>`
  document.getElementById('proc-inputs').appendChild(div)
}

function loadProcBagChips(n) {
  const itemName = document.getElementById(`proc-item-sel-${n}`).value
  const area = document.getElementById(`proc-bag-chips-area-${n}`)
  if (!itemName) { area.innerHTML = ''; updateProcSum(); return }

  const bags = cwStock.filter(r => r.item_name === itemName)
  const lots = {}
  bags.forEach(r => {
    const lot = r.lot_date ? r.lot_date.split('T')[0] : 'unknown'
    if (!lots[lot]) lots[lot] = []
    lots[lot].push(r)
  })

  area.innerHTML = Object.entries(lots).sort().map(([lot, lotBags]) => `
    <div style="margin-bottom:8px">
      <div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">
        lot ${fmtDate(lot)} — ${lotBags.length} ถุง
      </div>
      <div class="lot-chips" style="margin:0">
        ${lotBags.map(r => {
          const kg = ((r.weight_g||0)/1000).toFixed(3)
          const cw = r.legacy_cw_row || '#'+String(r.id).substring(0,6)
          return `<div class="lot-chip" id="pcbag-${n}-${r.id}"
                       data-id="${r.id}" data-kg="${(r.weight_g||0)/1000}"
                       data-name="${r.item_name||''}" data-item-id="${r.item_id||''}"
                       data-warehouse="${r.warehouse||''}"
                       onclick="toggleProcBag(${n},'${r.id}')">
            <div class="lot-name">${cw}</div>
            <div class="lot-kg">${kg} กก.</div>
          </div>`
        }).join('')}
      </div>
    </div>`).join('')

  updateRepackItemLabel()
}

function toggleProcBag(n, bagId) {
  document.getElementById(`pcbag-${n}-${bagId}`)?.classList.toggle('selected')
  recalcProcInputKg(n)
  updateRepackItemLabel()
}

function recalcProcInputKg(n) {
  let total = 0
  document.querySelectorAll(`#proc-bag-chips-area-${n} .lot-chip.selected`)
    .forEach(c => { total += parseFloat(c.dataset.kg) || 0 })
  document.getElementById(`proc-in-kg-${n}`).value = total > 0 ? total.toFixed(3) : ''
  updateProcSum()
}

function updateProcSum() {
  let total=0
  document.querySelectorAll('[id^=proc-in-kg-]').forEach(inp=>{ total+=parseFloat(inp.value)||0 })
  document.getElementById('proc-input-sum').textContent=total.toFixed(3)
  updateProcYield()
}

function updateProcBagRows() {
  const type = document.getElementById('proc-type').value
  const bagEl = type === 'repack'
    ? document.getElementById('proc-out-bags-repack')
    : document.getElementById('proc-out-bags')
  const cnt = parseInt(bagEl?.value)||0
  const cont=document.getElementById('proc-bag-rows')
  const existing=[]; cont.querySelectorAll('input[type=number]').forEach(i=>existing.push(i.value))
  cont.innerHTML=''
  for(let i=1;i<=cnt;i++){
    const row=document.createElement('div'); row.className='bag-row'
    row.innerHTML=`
      <div class="bag-no">${i}</div>
      <input type="number" placeholder="กรัม" value="${existing[i-1]||''}"
             oninput="updateProcOutputSum()" style="text-align:right">
      <div class="bag-kg" id="pcb-kg-${i}">—</div>
      <div></div>`
    cont.appendChild(row)
  }
  if(cnt===0) cont.innerHTML='<div class="loading">ระบุจำนวนถุงก่อน</div>'
  updateProcOutputSum()
}

function updateProcOutputSum() {
  const type = document.getElementById('proc-type')?.value
  let total = 0
  if (type === 'kitchen') {
    document.querySelectorAll('#pog-list .pog').forEach(grp => {
      const n = grp.id.replace('pog-', '')
      let grpKg = 0
      grp.querySelectorAll(`#pog-bag-rows-${n} input[type=number]`).forEach((inp, idx) => {
        const g = parseFloat(inp.value) || 0
        grpKg += g / 1000
        const kgEl = document.getElementById(`pog-kg-${n}-${idx+1}`)
        if (kgEl) kgEl.textContent = g > 0 ? (g/1000).toFixed(3)+' กก.' : '—'
      })
      const sumEl = document.getElementById(`pog-sum-${n}`)
      if (sumEl) sumEl.textContent = grpKg.toFixed(3)
      total += grpKg
    })
  } else {
    document.querySelectorAll('#proc-bag-rows input[type=number]').forEach((inp,idx)=>{
      const g=parseFloat(inp.value)||0; total+=g/1000
      const el=document.getElementById(`pcb-kg-${idx+1}`)
      if(el) el.textContent=g>0?(g/1000).toFixed(3)+' กก.':'—'
    })
  }
  document.getElementById('proc-output-sum').textContent=total.toFixed(3)
  updateProcYield()
}

function updateProcYield() {
  const inp=parseFloat(document.getElementById('proc-input-sum').textContent)||0
  const out=parseFloat(document.getElementById('proc-output-sum').textContent)||0
  document.getElementById('pyb-input').textContent=inp.toFixed(3)+' กก.'
  document.getElementById('pyb-output').textContent=out.toFixed(3)+' กก.'
  const pctEl=document.getElementById('pyb-pct')
  if(inp>0&&out>0){
    const pct=out/inp*100
    pctEl.textContent=pct.toFixed(1)+'%'
    pctEl.className='val '+(pct<50?'yield-bad':pct<75?'yield-warn':'yield-ok')
  } else { pctEl.textContent='—'; pctEl.className='val' }
}

function addScrap() {
  // Auto-pick scrap SKU from first selected input chip via SCRAP_MAP
  let scrapSku = '', scrapName = '', scrapItemId = ''
  document.querySelectorAll('#proc-inputs select').forEach(sel => {
    if (scrapSku || !sel.value) return
    const inputItem = items.find(i => i.name === sel.value)
    if (inputItem && SCRAP_MAP[inputItem.sku]) {
      scrapSku = SCRAP_MAP[inputItem.sku]
      const trimItem = items.find(i => i.sku === scrapSku)
      if (trimItem) { scrapName = trimItem.name; scrapItemId = trimItem.id }
    }
  })
  if (!scrapItemId) {
    // Fallback: เลือก MT-012 เศษคัทรวม (catch-all)
    const fb = items.find(i => i.sku === 'MT-012')
    if (fb) { scrapItemId = fb.id; scrapSku = 'MT-012'; scrapName = fb.name }
  }

  const div=document.createElement('div'); div.style.marginBottom='8px'
  div.innerHTML=`<div class="row2">
    <div style="display:flex;align-items:center;padding:8px 10px;background:#fafafa;border:1px solid var(--border);border-radius:6px;font-size:0.9rem">
      <span style="color:var(--muted);margin-right:6px">🗑️</span>
      <b>${scrapSku}</b>&nbsp;·&nbsp;<span>${scrapName}</span>
      <input type="hidden" class="scrap-item" value="${scrapItemId}">
    </div>
    <div style="display:flex;gap:6px">
      <input type="number" class="scrap-g" placeholder="กรัม">
      <button class="btn-danger" onclick="this.closest('.row2').remove()">✕</button>
    </div></div>`
  const btn=document.querySelector('#proc-scraps .btn')
  document.getElementById('proc-scraps').insertBefore(div,btn)
}

async function submitProcess() {
  const date = document.getElementById('proc-date').value
  const type = document.getElementById('proc-type').value
  if (!date) { alert('กรุณาเลือกวันที่'); return }

  // 1. Input bags (selected chips)
  const inputBags = []
  document.querySelectorAll('#proc-inputs .lot-chip.selected').forEach(chip => {
    inputBags.push({
      id:        chip.dataset.id,
      item_id:   chip.dataset.itemId,
      kg:        parseFloat(chip.dataset.kg) || 0,
      name:      chip.dataset.name,
      warehouse: chip.dataset.warehouse || ''
    })
  })
  if (inputBags.length === 0) { alert('กรุณาเลือกถุงต้นทางอย่างน้อย 1 ถุง'); return }

  // 2-3. Output bags — kitchen = multi-group · repack/mix = single group legacy
  const outputRows = []
  if (type === 'kitchen') {
    const groups = document.querySelectorAll('#pog-list .pog')
    if (groups.length === 0) { alert('กรุณาเพิ่มกลุ่ม SKU ผลผลิตอย่างน้อย 1 กลุ่ม'); return }
    let globalBagNo = 0
    for (const grp of groups) {
      const n = grp.id.replace('pog-', '')
      const skuSel = document.getElementById(`pog-sku-${n}`)
      const outId = skuSel?.value
      if (!outId) { alert(`กรุณาเลือก SKU output ในทุกกลุ่ม (กลุ่มที่ ${n})`); return }
      let grpHasBag = false
      // Output warehouse: cooked intermediate (เนื้อตุ๋น เช่น MT-004/MT-035/MT-044/MT-045) → คลัง B · portioned final → คลัง C
      const _outItem = items.find(i => i.id === outId)
      const _outWh = (_outItem?.tier === 'intermediate' && _outItem?.category === 'meat_cooked') ? 'B' : 'C'
      document.querySelectorAll(`#pog-bag-rows-${n} input[type=number]`).forEach(inp => {
        const g = parseFloat(inp.value)
        if (!g || g <= 0) return
        globalBagNo++
        grpHasBag = true
        outputRows.push({
          item_id:      outId,
          lot_date:     date,
          bag_no:       globalBagNo,
          weight_g:     g,
          warehouse:    _outWh,
          status:       '✅ In Stock',
          date_recorded: date,
          notes:        `แปรรูปจาก ${inputBags.length} ถุง (kitchen)`,
          source:       'web-process'
        })
      })
      if (!grpHasBag) { alert(`กรุณากรอกน้ำหนัก output อย่างน้อย 1 ถุง (กลุ่มที่ ${n})`); return }
    }
  } else {
    const outItemId = type === 'repack'
      ? inputBags[0].item_id
      : document.getElementById('proc-sku-out')?.value
    if (!outItemId) { alert('กรุณาเลือก SKU output'); return }
    // repack = แบ่งถุงของเดิม ไม่เปลี่ยน SKU → ต้องอยู่คลังเดิมของ input เสมอ
    // (เดิม hardcode 'B' ทำให้ของดิบจากคลัง A เช่น SP-037 หลุดไปโผล่ B — fix 14/07 TINE approve)
    const outWarehouse = type === 'repack' ? (inputBags[0].warehouse || 'B') : 'C'
    document.querySelectorAll('#proc-bag-rows input[type=number]').forEach((inp, idx) => {
      const g = parseFloat(inp.value)
      if (!g || g <= 0) return
      outputRows.push({
        item_id:      outItemId,
        lot_date:     date,
        bag_no:       idx + 1,
        weight_g:     g,
        warehouse:    outWarehouse,
        status:       '✅ In Stock',
        date_recorded: date,
        notes:        `แปรรูปจาก ${inputBags.length} ถุง (${type})`,
        source:       'web-process'
      })
    })
  }
  if (outputRows.length === 0) { alert('กรุณากรอกน้ำหนัก output อย่างน้อย 1 ถุง'); return }

  // (mass-balance guard moved below — needs scraps kg, which is computed after this point)

  // 4. Scraps — INSERT CW rows for each (item_id required from dropdown)
  const scraps = []
  const scrapRows = []
  document.querySelectorAll('#proc-scraps .row2').forEach(row => {
    const sel = row.querySelector('.scrap-item')
    const itemId = sel?.value
    const trimItem = items.find(i => i.id === itemId)
    const g = parseFloat(row.querySelector('input.scrap-g')?.value)
    if (itemId && g > 0) {
      scraps.push(`${trimItem?.name || itemId} ${g}g`)
      scrapRows.push({
        item_id:      itemId,
        lot_date:     date,
        bag_no:       scrapRows.length + 1,
        weight_g:     g,
        warehouse:    'C',
        status:       '✅ In Stock',
        date_recorded: date,
        notes:        `เศษจากแปรรูป ${inputBags.length} ถุง`,
        source:       'web-process-scrap'
      })
    }
  })

  // ── Mass-balance guard ──────────────────────────────────────────────────
  // Output (ผลผลิต + เศษ) ห้ามหนักกว่า Input — เป็นไปไม่ได้ทางฟิสิกส์ (แปรรูป/แบ่งถุง
  // ไม่เพิ่มมวล). Output เกิน = เลือกถุงต้นทางไม่ครบ (เคส สามชั้นตุ๋น 14/08 ที่ถุงใหม่
  // ไม่โผล่ให้เลือก) หรือกรอกน้ำหนักผิด. HARD BLOCK — กันซ้ำ ไม่ให้กดข้ามเหมือน soft confirm เดิม.
  const _inKg  = inputBags.reduce((s,b) => s + (b.kg || 0), 0)
  const _outKg = outputRows.reduce((s,r) => s + r.weight_g/1000, 0)
               + scrapRows.reduce((s,r) => s + r.weight_g/1000, 0)
  const _yPct  = _inKg > 0 ? (_outKg / _inKg * 100) : 0
  if (_inKg > 0 && _yPct > 110) {
    alert(`❌ บันทึกไม่ได้ — Output หนักกว่า Input (เป็นไปไม่ได้ทางฟิสิกส์)\n\n`
      + `Input (ถุงต้นทางที่เลือก): ${_inKg.toFixed(3)} กก. · ${inputBags.length} ถุง\n`
      + `Output (ผลผลิต + เศษ): ${_outKg.toFixed(3)} กก.\n`
      + `Yield: ${_yPct.toFixed(0)}%  (ต้อง ≤ 110%)\n\n`
      + `มักเกิดจาก "เลือกถุงต้นทางไม่ครบ" — เช็คว่าเลือก lot/ถุงครบทุกใบที่ใช้จริงหรือยัง\n`
      + `ถ้าถุงที่ใช้จริงไม่โผล่ให้เลือก → แจ้ง admin (อาจเป็นบั๊กโหลดถุงไม่ครบ)`)
    return
  }
  if (_inKg > 0 && _yPct < 30) {
    if (!confirm(`⚠️ Yield ต่ำผิดปกติ: ${_yPct.toFixed(0)}%\n\nInput: ${_inKg.toFixed(3)} กก.\nOutput: ${_outKg.toFixed(3)} กก.\n\nลืมกรอกน้ำหนัก output หรือเปล่า?\n\nOK = ยืนยันส่ง · Cancel = แก้ก่อน`)) return
  }

  const btn = document.querySelector('#page-process .btn-primary')
  btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'

  try {
    // PATCH input bags → '🔄 Repacked' (แปรรูป = repack, material preserved)
    const idList = inputBags.map(b => `"${b.id}"`).join(',')
    const r1 = await fetch(`${SB}/rest/v1/catch_weight?id=in.(${idList})`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ status: '🔄 Repacked', notes: `แปรรูป ${date}` })
    })
    if (!r1.ok) throw new Error(await r1.text())

    // INSERT output bags
    const r2 = await fetch(`${SB}/rest/v1/catch_weight`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify(outputRows)
    })
    if (!r2.ok) throw new Error(await r2.text())

    // INSERT scrap rows (separate so output bag_no series stays clean)
    if (scrapRows.length) {
      const r2s = await fetch(`${SB}/rest/v1/catch_weight`, {
        method: 'POST',
        headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify(scrapRows)
      })
      if (!r2s.ok) throw new Error(await r2s.text())
    }

    const inKg  = inputBags.reduce((s,b) => s + b.kg, 0)
    const outKg = outputRows.reduce((s,r) => s + r.weight_g / 1000, 0)
    const yPct  = inKg > 0 ? (outKg / inKg * 100).toFixed(1) + '%' : '—'

    let msg = `✅ บันทึกแปรรูปสำเร็จ\nInput: ${inputBags.length} ถุง / ${inKg.toFixed(3)} กก.\nOutput: ${outputRows.length} ถุง / ${outKg.toFixed(3)} กก.\nYield: ${yPct}`
    if (scraps.length) msg += `\nเศษ: ${scraps.join(', ')}`

    // Submit-done modal + redirect history (28/04 ไทน์ rule)
    if (window.nntnSubmitDone) {
      window.nntnSubmitDone({
        title: '♻️ แปรรูปสำเร็จ',
        summary: `<strong>Input:</strong> ${inputBags.length} ถุง / ${inKg.toFixed(3)} กก.<br><strong>Output:</strong> ${outputRows.length} ถุง / ${outKg.toFixed(3)} กก.<br><strong>Yield:</strong> ${yPct}${scraps.length ? '<br><strong>เศษ:</strong> '+scraps.join(', ') : ''}`,
        eventType: 'create_bag',
        delaySec: 4
      })
    } else { alert(msg) }

    // Reset
    document.getElementById('proc-inputs').innerHTML = ''
    document.getElementById('proc-bag-rows').innerHTML = '<div class="loading">ระบุจำนวนถุงก่อน</div>'
    document.getElementById('proc-output-sum').textContent = '0.000'
    document.getElementById('proc-input-sum').textContent  = '0.000'
    const pogList = document.getElementById('pog-list')
    if (pogList) { pogList.innerHTML = ''; pogCount = 0 }
    procInputCount = 0
    addProcInput()
    if (type === 'kitchen') addProcOutGroup()
    loadStock()
  } catch(e) {
    alert('❌ เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    btn.disabled = false; btn.textContent = '✅ บันทึกแปรรูป'
  }
}
