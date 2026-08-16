// hub-delivery/build.js — เตรียมใบ tab: meat blocks (SKU + bag pick), bag modal,
// non-meat rows, live preview. Extracted from hub-delivery.html inline (split 1/6).
// Classic <script src>, globals shared (mtItems/cwBags/meatSel/... + helpers in inline).

// ─── Meat Blocks ──────────────────────────────────────────────────────────────
function addMeatBlock() {
  meatBlockCount++
  const n = meatBlockCount
  meatSel[n] = { itemId: null, selectedBags: new Set() }

  const opts = mtItems.map(i =>
    `<option value="${i.id}" data-name="${i.name}" data-sku="${i.sku}">${i.sku} | ${i.name}</option>`
  ).join('')

  const div = document.createElement('div')
  div.className = 'meat-block no-print-border'
  div.id = `meat-block-${n}`
  div.innerHTML = `
    <div class="meat-block-header">
      <div class="meat-block-title">รายการที่ ${n}</div>
      ${n > 1 ? `<button class="btn-danger" onclick="removeMeatBlock(${n})">✕</button>` : ''}
    </div>
    <div class="mb">
      <label>SKU / รายการ</label>
      <select id="mb-sku-${n}" onchange="onMeatItemChange(${n})">
        <option value="">— เลือก MT item —</option>${opts}
      </select>
    </div>
    <button class="btn btn-outline btn-outline-blue btn-sm no-print"
            id="mb-pick-btn-${n}" style="display:none;width:100%;margin-bottom:10px"
            onclick="openBagModal(${n})">
      📦 เลือกถุง
    </button>
    <div id="mb-chips-${n}"></div>
    <div class="meat-summary" id="mb-sum-${n}" style="display:none"></div>`

  document.getElementById('meat-blocks').appendChild(div)
  makeSearchable(`mb-sku-${n}`, '— พิมพ์ค้นหา MT item —')
  renumberMeatBlocks()
}

function removeMeatBlock(n) {
  document.getElementById(`meat-block-${n}`)?.remove()
  delete meatSel[n]
  renumberMeatBlocks()
  updatePreview()
}

function renumberMeatBlocks() {
  document.querySelectorAll('#meat-blocks .meat-block').forEach((block, idx) => {
    const titleEl = block.querySelector('.meat-block-title')
    if (titleEl) titleEl.textContent = `รายการที่ ${idx + 1}`
  })
}

// Pre-submit safety net (2026-08-10 short-ship bug class): renderMeatChips() renders
// one `.lot-chip.selected` per bag in meatSel[n].selectedBags, scoped under #meat-blocks
// (the bag-picker modal reuses the same class name but lives outside #meat-blocks, so it
// doesn't interfere here). If a future silent state wipe desyncs the DOM from what's about
// to be sent to the RPC, this trips instead of quietly submitting a smaller bag list.
function checkMeatBagInvariant(allBagIds) {
  const domChipCount = document.querySelectorAll('#meat-blocks .lot-chip.selected').length
  return domChipCount === allBagIds.length
}

function onMeatItemChange(n) {
  const sel = document.getElementById(`mb-sku-${n}`)
  const itemId = sel.value
  const prevItemId = meatSel[n].itemId

  // No-op re-fire guard — makeSearchable's pick() dispatches a 'change' event on
  // EVERY option pick, including re-picking the value that's already selected
  // (stray click / mobile touch re-tap on the custom dropdown). Without this guard
  // that silently wiped selectedBags with zero warning — confirmed root cause of the
  // 2026-08-10 short-ship (10 delivered vs 15 packed, 5 bags vanished with no error).
  if (itemId === prevItemId) return

  // Real SKU change while bags are already selected → confirm before wiping,
  // same UX pattern as the Form-vs-Draft mismatch confirm() used elsewhere in this file.
  if (prevItemId && meatSel[n].selectedBags.size > 0) {
    const count = meatSel[n].selectedBags.size
    if (!confirm(`เปลี่ยนรายการ (รายการที่ ${n}) จะล้างถุงที่เลือกไว้ ${count} ถุง — ยืนยัน?`)) {
      // Revert both the underlying <select> and the visible search-input text
      // (makeSearchable renders a separate text input over the hidden native select).
      sel.value = prevItemId
      const searchInput = document.getElementById(`mb-sku-${n}-search`)
      if (searchInput) {
        const prevOpt = Array.from(sel.options).find(o => o.value === prevItemId)
        searchInput.value = prevOpt ? prevOpt.text : ''
      }
      return
    }
  }

  meatSel[n].itemId = itemId
  meatSel[n].selectedBags = new Set()
  document.getElementById(`mb-chips-${n}`).innerHTML = ''
  document.getElementById(`mb-sum-${n}`).style.display = 'none'
  const btn = document.getElementById(`mb-pick-btn-${n}`)
  if (itemId) {
    const name = sel.options[sel.selectedIndex]?.dataset?.name || ''
    btn.style.display = 'block'
    btn.textContent = `📦 เลือกถุง — ${name}`
  } else {
    btn.style.display = 'none'
  }
  updatePreview()
}

function renderMeatChips(n) {
  const { itemId, selectedBags } = meatSel[n]
  const chipsEl = document.getElementById(`mb-chips-${n}`)
  const sumEl = document.getElementById(`mb-sum-${n}`)

  if (selectedBags.size === 0) {
    chipsEl.innerHTML = ''
    sumEl.style.display = 'none'
    return
  }

  // Group by lot
  const lots = {}
  selectedBags.forEach(id => {
    const b = bagCache[id]
    if (!b) return
    const lot = b.lot_date ? b.lot_date.split('T')[0] : 'unknown'
    if (!lots[lot]) lots[lot] = []
    lots[lot].push(b)
  })

  chipsEl.innerHTML = Object.entries(lots).sort().map(([lot, bags]) => {
    const chips = bags.map(b => {
      const cw = b.legacy_cw_row ? `${b.legacy_cw_row}` : '#' + String(b.id).substring(0, 6)
      const kg = ((b.weight_g || 0) / 1000).toFixed(3)
      return `<div class="lot-chip selected" style="cursor:default">
        <div class="lot-name">${cw}</div>
        <div class="lot-kg">${kg} กก.</div>
      </div>`
    }).join('')
    return `<div class="lot-group-label">lot ${fmtDate(lot)} — ${bags.length} ถุง</div>
            <div class="lot-chips">${chips}</div>`
  }).join('')

  let totalKg = 0
  selectedBags.forEach(id => { totalKg += (bagCache[id]?.weight_g || 0) / 1000 })
  sumEl.style.display = 'block'
  sumEl.innerHTML = `✅ <b>${selectedBags.size} ถุง</b> / <b>${totalKg.toFixed(3)} กก.</b>`

  updatePreview()
  saveDraft()
}

// ─── Bag Modal ────────────────────────────────────────────────────────────────
async function openBagModal(n) {
  _modalBlock = n
  const { itemId, selectedBags } = meatSel[n]
  if (!itemId) return

  const sel = document.getElementById(`mb-sku-${n}`)
  const name = sel.options[sel.selectedIndex]?.dataset?.name || ''
  document.getElementById('bag-modal-title').textContent = `📦 ${name}`

  let bags = cwBags.filter(b => b.item_id === itemId)
  const body = document.getElementById('bag-modal-body')

  // Self-heal stale cache: cwBags is fetched once at page load (init()) and never
  // re-fetched. If new production is recorded into catch_weight while this tab stays
  // open, the in-memory cache misses those rows and the picker looks empty even though
  // fresh stock exists server-side. Confirmed root cause 2026-08-13 (MT-047 marinated
  // batch created mid-session — TINE's already-open tab never saw the new bags, RLS/data
  // ruled out as separate causes). Re-fetch In-Stock bags once before declaring empty.
  if (bags.length === 0) {
    body.innerHTML = `<div style="text-align:center;color:var(--muted);padding:24px">กำลังตรวจสอบสต๊อกล่าสุด…</div>`
    document.getElementById('bag-modal').classList.add('open')
    try {
      // getAll(), not get() — a single limit=N request silently truncates at
      // PostgREST's server-side 1000-row cap (see getAll() comment above). Using a
      // capped single fetch here would have re-produced the exact same class of bug
      // this re-fetch is trying to self-heal.
      const freshBags = await getAll('catch_weight', {
        select: 'id,item_id,weight_g,lot_date,warehouse,legacy_cw_row',
        status: 'eq.✅ In Stock',
        order: 'lot_date.asc,id.asc'
      })
      if (Array.isArray(freshBags)) {
        cwBags = freshBags
        cwBags.forEach(b => { bagCache[b.id] = b })
        bags = cwBags.filter(b => b.item_id === itemId)
      }
    } catch (_) { /* network hiccup — fall through to empty-state message below */ }
  }

  const lots = {}
  bags.forEach(b => {
    const lot = b.lot_date ? b.lot_date.split('T')[0] : 'unknown'
    if (!lots[lot]) lots[lot] = []
    lots[lot].push(b)
  })

  if (bags.length === 0) {
    body.innerHTML = `<div style="text-align:center;color:var(--muted);padding:24px">ไม่มีถุง In Stock สำหรับรายการนี้</div>`
  } else {
    body.innerHTML = Object.entries(lots).sort().map(([lot, lotBags]) => {
      const chips = lotBags.map(b => {
        const cw = b.legacy_cw_row ? `${b.legacy_cw_row}` : '#' + String(b.id).substring(0, 6)
        const kg = ((b.weight_g || 0) / 1000).toFixed(3)
        const isSel = selectedBags.has(String(b.id)) ? ' selected' : ''
        return `<div class="lot-chip${isSel}" id="bagchip-${b.id}"
                     data-id="${b.id}" onclick="toggleBag('${b.id}')">
          <div class="lot-name">${cw}</div>
          <div class="lot-kg">${kg} กก.</div>
        </div>`
      }).join('')
      return `<div class="lot-group-label">lot ${fmtDate(lot)} — ${lotBags.length} ถุง</div>
              <div class="lot-chips">${chips}</div>`
    }).join('')
  }

  updateModalCount()
  document.getElementById('bag-modal').classList.add('open')
}

function toggleBag(bagId) {
  const n = _modalBlock
  const sel = meatSel[n].selectedBags
  const chip = document.getElementById(`bagchip-${bagId}`)
  if (sel.has(bagId)) { sel.delete(bagId); chip?.classList.remove('selected') }
  else                 { sel.add(bagId);    chip?.classList.add('selected') }
  updateModalCount()
}

function updateModalCount() {
  const n = _modalBlock
  const sel = meatSel[n]?.selectedBags || new Set()
  let kg = 0
  sel.forEach(id => { kg += (bagCache[id]?.weight_g || 0) / 1000 })
  const el = document.getElementById('bag-modal-count')
  el.textContent = sel.size === 0
    ? 'แตะถุงเพื่อเลือก'
    : `เลือกแล้ว ${sel.size} ถุง / ${kg.toFixed(3)} กก.`
}

function confirmBags() {
  const n = _modalBlock
  renderMeatChips(n)
  closeBagModal()
}

function closeBagModal() {
  document.getElementById('bag-modal').classList.remove('open')
  _modalBlock = null
}

// ─── Non-meat Rows ────────────────────────────────────────────────────────────
function addNmRow() {
  nmRowCount++
  const n = nmRowCount
  const opts = spItems.map(i => {
    const stk = spStockBySku[i.sku]
    const isMisc = i.sku.startsWith('MISC')
    const isOOS = !isMisc && stk !== undefined && stk <= 0
    const stkTag = isMisc ? '' : (stk !== undefined ? ` · มี ${stk}` : '')
    const oosTag = isOOS ? ' ❌ หมด' : ''
    return `<option value="${i.id}" data-sku="${i.sku}" data-unit="${i.unit || ''}" data-name="${i.name}" ${isOOS ? 'disabled' : ''}>${i.sku} | ${i.name}${stkTag}${oosTag}</option>`
  }).join('')

  const wrap = document.createElement('div')
  wrap.className = 'nm-row-wrap'
  wrap.id = `nm-row-${n}`
  wrap.innerHTML = `
    <div class="nm-row">
      <select id="nm-item-${n}" onchange="onNmChange(${n})">
        <option value="">— เลือก SP item —</option>${opts}
      </select>
      <input type="number" id="nm-qty-${n}" min="0" step="0.01" placeholder="qty" oninput="validateNmQty(${n})">
      <input type="text" id="nm-unit-${n}" placeholder="หน่วย" oninput="updatePreview()">
      <button class="btn-danger" onclick="removeNmRow(${n})">✕</button>
    </div>
    <div class="nm-avail" id="nm-avail-${n}"></div>
    <input type="text" id="nm-note-${n}" placeholder="ชื่อรายการ (บังคับ)" style="display:none;width:100%;margin-top:4px;box-sizing:border-box" oninput="updatePreview();saveDraft()">`

  document.getElementById('nm-rows').appendChild(wrap)
  makeSearchable(`nm-item-${n}`, '— พิมพ์ค้นหา SP item —')
}

function removeNmRow(n) {
  document.getElementById(`nm-row-${n}`)?.remove()
  updatePreview()
  saveDraft()
}

function onNmChange(n) {
  const sel    = document.getElementById(`nm-item-${n}`)
  const opt    = sel.options[sel.selectedIndex]
  const sku    = opt?.dataset?.sku || ''
  const isMisc = sku.startsWith('MISC')
  const avEl   = document.getElementById(`nm-avail-${n}`)
  const noteEl = document.getElementById(`nm-note-${n}`)
  const _nmUnit = isMisc ? '' : (opt?.dataset?.unit || '')
  document.getElementById(`nm-unit-${n}`).value = _nmUnit
  const _nmQtyInput = document.getElementById(`nm-qty-${n}`)
  if (_nmQtyInput) {
    _nmQtyInput.step = window.nntnIsDecimalUnit(_nmUnit) ? '0.01' : '1'
    _nmQtyInput.inputMode = window.nntnIsDecimalUnit(_nmUnit) ? 'decimal' : 'numeric'
  }
  if (noteEl) noteEl.style.display = isMisc ? '' : 'none'
  if (isMisc) {
    avEl.textContent = ''
  } else if (sku && spStockBySku[sku] !== undefined) {
    const avail = spStockBySku[sku]
    avEl.className = 'nm-avail'
    avEl.textContent = `มีอยู่: ${avail} ${opt?.dataset?.unit || 'หน่วย'}`
  } else {
    avEl.className = 'nm-avail'
    avEl.textContent = ''
  }
  validateNmQty(n)
  saveDraft()
}

function validateNmQty(n) {
  const sel   = document.getElementById(`nm-item-${n}`)
  const opt   = sel?.options[sel.selectedIndex]
  const sku   = opt?.dataset?.sku || ''
  const unit  = opt?.dataset?.unit || 'หน่วย'
  const qty   = parseFloat(document.getElementById(`nm-qty-${n}`)?.value) || 0
  const avEl  = document.getElementById(`nm-avail-${n}`)
  const avail = spStockBySku[sku]

  if (!sku || avail === undefined) { updatePreview(); return }

  if (qty <= 0) {
    avEl.className = 'nm-avail'
    avEl.textContent = `มีอยู่: ${avail} ${unit}`
  } else if (qty <= avail) {
    avEl.className = 'nm-avail ok'
    avEl.textContent = `✅ เบิกได้ — คงเหลือ ${(avail - qty)} ${unit}`
  } else {
    avEl.className = 'nm-avail over'
    avEl.textContent = `⚠️ เบิกได้สูงสุด ${avail} ${unit} (มีอยู่ ${avail})`
  }
  updatePreview()
}

// ─── Preview ──────────────────────────────────────────────────────────────────
function updatePreview() {
  const date  = document.getElementById('dl-date').value
  const dest  = document.getElementById('dl-dest').value
  const bill  = document.getElementById('dl-bill').value.trim()

  // Collect meat data
  const meatRows = []
  Object.entries(meatSel).forEach(([n, state]) => {
    if (!state.itemId || state.selectedBags.size === 0) return
    const skuEl = document.getElementById(`mb-sku-${n}`)
    const name = skuEl?.options[skuEl.selectedIndex]?.dataset?.name || '?'
    state.selectedBags.forEach(id => {
      const b = bagCache[id]
      if (!b) return
      const cw = b.legacy_cw_row ? `${b.legacy_cw_row}` : '#' + String(id).substring(0, 6)
      const lot = fmtDate(b.lot_date)
      const kg  = ((b.weight_g || 0) / 1000).toFixed(3)
      meatRows.push({ name, cw, lot, kg: parseFloat(kg) })
    })
  })

  // Collect non-meat data — ใช้ querySelectorAll แทน index loop เพื่อรองรับ delete+add
  const nmRows = []
  document.querySelectorAll('#nm-rows .nm-row-wrap').forEach(wrap => {
    const n = wrap.id.replace('nm-row-', '')
    const itemEl = document.getElementById(`nm-item-${n}`)
    const qtyEl  = document.getElementById(`nm-qty-${n}`)
    const unitEl = document.getElementById(`nm-unit-${n}`)
    if (!itemEl || !itemEl.value) return
    const opt    = itemEl.options[itemEl.selectedIndex]
    const sku    = opt?.dataset?.sku || ''
    const isMisc = sku.startsWith('MISC')
    const name   = isMisc
      ? (document.getElementById(`nm-note-${n}`)?.value?.trim() || 'รายการพิเศษ')
      : (opt?.dataset?.name || '?')
    const qty  = parseFloat(qtyEl?.value) || 0
    const unit = unitEl?.value || ''
    if (qty > 0) nmRows.push({ name, qty, unit })
  })

  const el = document.getElementById('preview-content')

  if (meatRows.length === 0 && nmRows.length === 0) {
    el.innerHTML = `<div style="color:var(--muted);font-size:.85rem">กรอกข้อมูลและเลือกถุงเพื่อดู Preview</div>`
    return
  }

  const totalMeatKg = meatRows.reduce((s, r) => s + r.kg, 0)

  let html = `<div class="dn-header">
    <h2>ใบนำส่ง — ${bill || '(ยังไม่ระบุเลขบิล)'}</h2>
    <div class="dn-meta">วันที่: ${date ? fmtDate(date) : '—'} | ปลายทาง: ${dest}</div>
  </div>`

  if (meatRows.length > 0) {
    html += `<div class="dn-section-title">Block 1 — เนื้อตุ๋น (${meatRows.length} ถุง / ${totalMeatKg.toFixed(3)} กก.)</div>
    <table class="dn-table">
      <thead><tr><th>#CW</th><th>รายการ</th><th>lot</th><th style="text-align:right">กก.</th></tr></thead>
      <tbody>`
    meatRows.forEach((r, i) => {
      html += `<tr><td>${r.cw}</td><td>${r.name}</td><td>${r.lot}</td><td style="text-align:right">${r.kg.toFixed(3)}</td></tr>`
    })
    html += `</tbody>
      <tfoot><tr><td colspan="3">รวม ${meatRows.length} ถุง</td><td style="text-align:right">${totalMeatKg.toFixed(3)} กก.</td></tr></tfoot>
    </table>`
  }

  if (nmRows.length > 0) {
    html += `<div class="dn-section-title">Block 2 — Non-meat</div>
    <table class="dn-table">
      <thead><tr><th>รายการ</th><th style="text-align:right">จำนวน</th><th>หน่วย</th></tr></thead>
      <tbody>`
    nmRows.forEach(r => {
      html += `<tr><td>${r.name}</td><td style="text-align:right">${r.qty}</td><td>${r.unit}</td></tr>`
    })
    html += `</tbody></table>`
  }

  el.innerHTML = html
}
