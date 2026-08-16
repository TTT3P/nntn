// hub-delivery/adjust.js — ปรับแก้ tab: load/render adjustable bills, add/swap/reverse
// bag via RPC, bill-note parse/suggest. Extracted from hub-delivery.html (split 4/6).

// ─── Adjust Tab ──────────────────────────────────────────────────────────────
let adjustData = []

let _adjustLoading = false
async function loadAdjust() {
  if (_adjustLoading) return   // dedupe: same switchTab re-entrancy risk as loadHistory
  _adjustLoading = true
  const el = document.getElementById('adjust-list')
  el.innerHTML = '<div class="loading">กำลังโหลดบิลที่ปรับแก้ได้...</div>'
  try {
    const tok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
    const SH = { ...H, Authorization: 'Bearer ' + tok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
    const cutoff = new Date(Date.now() - 24*60*60*1000).toISOString()
    const res = await fetch(
      `${SB}/rest/v1/deliveries?select=id,bill_no,branch,date,channel,created_at,created_by,delivery_lines(id,catch_weight_id,item_id,qty,weight_g,note)&created_at=gte.${cutoff}&order=created_at.desc`,
      { headers: SH }
    )
    const deliveries = await res.json()
    if (!Array.isArray(deliveries) || !deliveries.length) {
      el.innerHTML = '<div class="hist-empty">ไม่มีบิลที่ปรับแก้ได้ (ภายใน 24 ชม.)</div>'
      return
    }

    // created_by guard
    const me = window.nntnCurrentUser || null
    const allowed = deliveries.filter(d => !d.created_by || d.created_by === me)
    if (!allowed.length) {
      el.innerHTML = '<div class="hist-empty">ไม่มีบิลที่คุณมีสิทธิ์ปรับแก้</div>'
      return
    }

    // Resolve item names
    allowed.forEach(d => {
      (d.delivery_lines || []).forEach(l => {
        const it = window._itemsById?.[l.item_id]
        if (it) l.items = { sku: it.sku, name: it.name, unit: it.unit }
      })
    })

    // Fetch catch_weight status for reverse detection
    const cwIds = Array.from(new Set(
      allowed.flatMap(d => (d.delivery_lines||[]).map(l => l.catch_weight_id).filter(Boolean))
    ))
    const cwStatus = {}
    if (cwIds.length) {
      const chunks = []
      for (let i = 0; i < cwIds.length; i += 200) chunks.push(cwIds.slice(i, i+200))
      for (const chunk of chunks) {
        const cwRes = await _fetchCatchWeightBatch(chunk.join(','), 'id,status,bag_no,weight_g', { ...H, Authorization: 'Bearer ' + tok })
        if (cwRes.ok) (await cwRes.json()).forEach(r => { cwStatus[r.id] = r })
      }
    }

    adjustData = allowed.map(d => ({ ...d, cwStatus }))
    renderAdjust(adjustData, cwStatus)
  } catch (e) {
    el.innerHTML = `<div class="warn-banner">❌ โหลดไม่ได้: ${e.message}</div>`
  } finally {
    _adjustLoading = false
  }
}

function renderAdjust(deliveries, cwStatus) {
  const el = document.getElementById('adjust-list')
  el.innerHTML = deliveries.map((d, di) => {
    const lines = d.delivery_lines || []
    const meatLines = lines.filter(l => l.catch_weight_id)
    const nmLines = lines.filter(l => !l.catch_weight_id && l.item_id)

    const meatHtml = meatLines.map(l => {
      const cw = cwStatus[l.catch_weight_id] || {}
      const name = l.items?.name || '?'
      const kg = (l.weight_g || 0) / 1000
      const isReversed = cw.status === '✅ In Stock'
      const statusBadge = isReversed
        ? '<span style="background:#E8F5E9;color:#2E7D32;border-radius:4px;padding:1px 6px;font-size:.7rem;margin-left:4px">คืนแล้ว</span>'
        : '<span style="background:#FFF8E1;color:#F57F17;border-radius:4px;padding:1px 6px;font-size:.7rem;margin-left:4px">ส่งแล้ว</span>'
      const actions = isReversed ? '' : `
        <button class="btn btn-sm" onclick="event.stopPropagation();adjustReverse(${di},${l.catch_weight_id})"
                style="background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A;font-size:.72rem;padding:2px 8px"
                title="คืนเข้าสต๊อก">🗑️ คืน</button>
        <button class="btn btn-sm" onclick="event.stopPropagation();adjustSwap(${di},${l.catch_weight_id},'${escHtml(l.items?.name||'')}')"
                style="background:#E3F2FD;color:#1565C0;border:1px solid #90CAF9;font-size:.72rem;padding:2px 8px"
                title="สลับถุง">🔄 สลับ</button>`
      return `<div style="font-size:.82rem;padding:6px 8px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;background:${isReversed?'#FAFAFA':'#FFF8E1'}">
        <span style="${isReversed?'opacity:.5;text-decoration:line-through':''}">🥩 ${escHtml(name)} <span style="color:var(--muted)">#${cw.bag_no||'?'} · ${kg.toFixed(3)}กก.</span>${statusBadge}</span>
        <span style="display:flex;gap:4px">${actions}</span>
      </div>`
    }).join('')

    const nmHtml = nmLines.map(l => {
      return `<div style="font-size:.82rem;padding:4px 8px;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between">
        <span>${escHtml(l.items?.name || '?')}</span>
        <span style="color:var(--muted)">${l.qty} ${escHtml(l.items?.unit||'')}</span>
      </div>`
    }).join('')

    const ageMin = Math.round((Date.now() - new Date(d.created_at).getTime()) / 60000)
    const ageStr = ageMin < 60 ? `${ageMin} นาทีที่แล้ว` : `${Math.round(ageMin/60)} ชม.ที่แล้ว`

    return `<div style="margin-bottom:12px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
      <div style="padding:12px 14px;background:#fafafa;display:flex;justify-content:space-between;align-items:center;cursor:pointer"
           onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        <div>
          <span style="font-weight:700">${escHtml(d.bill_no||'?')}</span>
          <span style="font-size:.8rem;color:var(--muted);margin-left:8px">${escHtml(d.branch)} · ${fmtDate(d.date)} · ${ageStr}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-sm" onclick="event.stopPropagation();adjustAddBag(${di})"
                  style="background:#E8F5E9;color:#2E7D32;border:1px solid #A5D6A7;font-size:.72rem;padding:2px 10px"
                  title="เพิ่มถุงเข้าบิลนี้">➕ เพิ่มถุง</button>
          <span>▼</span>
        </div>
      </div>
      <div style="display:none">${meatHtml}${nmHtml || '<div style="font-size:.82rem;padding:6px 8px;color:var(--muted)">ไม่มีรายการ non-meat</div>'}</div>
    </div>`
  }).join('')
}

async function callAdjustRpc(rpcName, params) {
  const tok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
  const res = await fetch(`${SB}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: { ...H, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = body?.message || body?.details || JSON.stringify(body)
    throw new Error(msg)
  }
  return body
}

async function adjustReverse(di, cwId) {
  const reason = prompt('เหตุผลที่คืนถุง (≥ 10 ตัวอักษร):')
  if (!reason) return
  if (reason.length < 10) return alert('❌ เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร')
  if (!confirm(`ยืนยันคืนถุง #${cwId} เข้าสต๊อก?\n\nเหตุผล: ${reason}`)) return
  try {
    const actor = window.nntnCurrentUser || 'unknown'
    const r = await callAdjustRpc('rpc_delivery_reverse', { p_actor: actor, p_cw_id: cwId, p_reason: reason })
    alert(`✅ คืนถุงสำเร็จ (sm #${r.sm_id})`)
    _logSubmit('adjust_reverse', 'success', { cw_id: cwId, reason }, { ref_id: cwId.toString() })
    loadAdjust()
  } catch (e) {
    alert(`❌ คืนไม่ได้: ${e.message}`)
    _logSubmit('adjust_reverse', 'error', { cw_id: cwId, reason }, { error_msg: e.message })
  }
}

async function adjustSwap(di, oldCwId, itemName) {
  const d = adjustData[di]
  if (!d) return
  try {
    const tok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
    const itemId = d.delivery_lines.find(l => l.catch_weight_id === oldCwId)?.item_id
    // paginate past the 1000-row cap so no In Stock bag is hidden from the swap picker (was limit:50)
    const swapParams = {
      status: 'eq.✅ In Stock',
      select: 'id,bag_no,weight_g,item_id',
      order: 'item_id,bag_no,id'
    }
    if (itemId) swapParams.item_id = `eq.${itemId}`
    const available = await getAll('catch_weight', swapParams)
    if (!available?.length) return alert('❌ ไม่มีถุงว่างใน stock สำหรับรายการนี้')

    const opts = available.map(b => `#${b.bag_no} (${(b.weight_g/1000).toFixed(3)}กก.) [id:${b.id}]`).join('\n')
    const pick = prompt(`สลับถุง #${oldCwId} (${itemName})\n\nเลือกถุงใหม่ — พิมพ์เลข id:\n\n${opts}`)
    if (!pick) return
    const newCwId = parseInt(pick.replace(/[^\d]/g, ''), 10)
    if (!newCwId || !available.find(b => b.id === newCwId)) return alert('❌ id ไม่ถูกต้อง — ต้องเป็นตัวเลขจากรายการ')

    const reason = prompt('เหตุผลที่สลับ (≥ 10 ตัวอักษร):')
    if (!reason) return
    if (reason.length < 10) return alert('❌ เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร')

    const oldBag = d.cwStatus[oldCwId]
    const newBag = available.find(b => b.id === newCwId)
    if (!confirm(`ยืนยันสลับ?\n\nออก: #${oldBag?.bag_no||oldCwId} → กลับเข้าสต๊อก\nเข้า: #${newBag.bag_no} (${(newBag.weight_g/1000).toFixed(3)}กก.) → ส่งออก\n\nเหตุผล: ${reason}`)) return

    const actor = window.nntnCurrentUser || 'unknown'
    const r = await callAdjustRpc('rpc_delivery_swap_bag', { p_actor: actor, p_old_cw_id: oldCwId, p_new_cw_id: newCwId, p_reason: reason })
    alert(`✅ สลับสำเร็จ\n\nถุงเก่า #${oldCwId} → In Stock (sm #${r.sm_reverse_id})\nถุงใหม่ #${newCwId} → Delivered (sm #${r.sm_deliver_id})`)
    _logSubmit('adjust_swap', 'success', { old_cw_id: oldCwId, new_cw_id: newCwId, reason })
    loadAdjust()
  } catch (e) {
    alert(`❌ สลับไม่ได้: ${e.message}`)
    _logSubmit('adjust_swap', 'error', { old_cw_id: oldCwId, reason: '' }, { error_msg: e.message })
  }
}

async function adjustAddBag(di) {
  const d = adjustData[di]
  if (!d) return
  try {
    const tok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
    // paginate past the 1000-row cap so every In Stock bag is selectable (was limit:100)
    const available = await getAll('catch_weight', {
      status: 'eq.✅ In Stock',
      select: 'id,bag_no,weight_g,item_id',
      order: 'item_id,bag_no,id'
    })
    if (!available?.length) return alert('❌ ไม่มีถุงว่างใน stock')

    // Group by item for readability
    const grouped = {}
    available.forEach(b => {
      const it = window._itemsById?.[b.item_id]
      const name = it?.name || b.item_id
      if (!grouped[name]) grouped[name] = []
      grouped[name].push(b)
    })
    const opts = Object.entries(grouped).map(([name, bags]) =>
      `── ${name} ──\n` + bags.map(b => `  #${b.bag_no} (${(b.weight_g/1000).toFixed(3)}กก.) [id:${b.id}]`).join('\n')
    ).join('\n')

    const pick = prompt(`เพิ่มถุงเข้าบิล ${d.bill_no}\n\nเลือกถุง — พิมพ์เลข id:\n\n${opts}`)
    if (!pick) return
    const newCwId = parseInt(pick.replace(/[^\d]/g, ''), 10)
    if (!newCwId || !available.find(b => b.id === newCwId)) return alert('❌ id ไม่ถูกต้อง')

    const reason = prompt('เหตุผลที่เพิ่ม (≥ 10 ตัวอักษร):')
    if (!reason) return
    if (reason.length < 10) return alert('❌ เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร')

    const newBag = available.find(b => b.id === newCwId)
    const bagName = window._itemsById?.[newBag.item_id]?.name || '?'
    if (!confirm(`ยืนยันเพิ่มถุง?\n\nบิล: ${d.bill_no}\nถุง: ${bagName} #${newBag.bag_no} (${(newBag.weight_g/1000).toFixed(3)}กก.)\n\nเหตุผล: ${reason}`)) return

    const actor = window.nntnCurrentUser || 'unknown'
    const r = await callAdjustRpc('rpc_delivery_add_bag', { p_actor: actor, p_delivery_id: d.id, p_cw_id: newCwId, p_reason: reason })
    alert(`✅ เพิ่มถุงสำเร็จ (sm #${r.sm_id})`)
    _logSubmit('adjust_add', 'success', { delivery_id: d.id, cw_id: newCwId, reason })
    loadAdjust()
  } catch (e) {
    alert(`❌ เพิ่มไม่ได้: ${e.message}`)
    _logSubmit('adjust_add', 'error', { delivery_id: d?.id }, { error_msg: e.message })
  }
}

function parseBillNote(note) {
  // note format: "NT-20260409-01 → ครัวกลาง (NT)"
  const parts = (note || '').split('→')
  return {
    bill: parts[0]?.trim() || note,
    dest: parts[1]?.trim() || ''
  }
}

async function suggestBillNum() {
  const billEl = document.getElementById('dl-bill')
  if (billEl.value.trim()) return
  const dateVal = document.getElementById('dl-date').value
  const dest    = document.getElementById('dl-dest').value
  if (!dateVal) return
  const tag = dest.includes('NT') ? 'NT' : dest.includes('FS') ? 'FS' : 'OT'
  const d   = dateVal.replace(/-/g, '')   // 20260418
  const prefix = `${tag}${d}`             // NT20260418
  // ค้นจาก deliveries table โดยตรง
  const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
  const SHst = { ...H, Authorization: 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
  try {
    const res  = await fetch(`${SB}/rest/v1/deliveries?bill_no=like.${prefix}*&select=bill_no&limit=50`, { headers: SHst })
    const rows = await res.json()
    let maxSeq = 0
    ;(Array.isArray(rows) ? rows : []).forEach(r => {
      const m = (r.bill_no || '').match(new RegExp(`${prefix}-(\\d+)`))
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1]))
    })
    billEl.value = `${prefix}-${maxSeq + 1}`
  } catch(_) {
    billEl.value = `${prefix}-1`
  }
  updatePreview()
}

function renderHistory(groups) {
  const listEl = document.getElementById('hist-list')
  if (groups.length === 0) {
    listEl.innerHTML = '<div class="hist-empty">ยังไม่มีประวัติการส่ง Non-meat</div>'
    return
  }
  const effectiveGis = []
  listEl.innerHTML = groups.map((g, gi) => {
    // ใช้ original index จาก historyData เสมอ (กัน filter-then-edit ผิด group)
    const realGi = historyData.indexOf(g)
    const effectiveGi = realGi >= 0 ? realGi : gi
    effectiveGis.push(effectiveGi)
    const { bill, dest } = parseBillNote(g.note)
    const dateStr = g.counted_at ? fmtDate(g.counted_at) : '—'
    const itemCount = g.rows.length
    return `
    <div class="hist-bill-card" id="hg-${effectiveGi}">
      <div class="hist-bill-header" onclick="toggleBillCard(${effectiveGi})">
        <div class="hist-bill-info">
          <div class="hist-bill-num">${escHtml(bill)}</div>
          <div class="hist-bill-meta">${escHtml(dest)} · ${dateStr}</div>
        </div>
        <span class="hist-bill-count">${itemCount} รายการ</span>
      </div>
      <div class="hist-bill-body" id="hg-body-${effectiveGi}" style="display:none">
        <div id="hg-rows-${effectiveGi}">
          ${g.rows.map((r, ri) => renderHistRow(r, effectiveGi, ri)).join('')}
        </div>
        <button class="hist-add-row-btn" onclick="showAddItemForm(${effectiveGi})">+ เพิ่มรายการ</button>
        <div class="hist-add-form" id="hadd-form-${effectiveGi}">
          <div class="add-form-row">
            <select id="hadd-item-${effectiveGi}">
              <option value="">— เลือก SP item —</option>
              ${spItems.map(i => `<option value="${i.id}" data-sku="${i.sku}" data-unit="${i.unit||''}" data-name="${i.name}">${i.sku} | ${escHtml(i.name)}</option>`).join('')}
            </select>
            <input type="number" id="hadd-qty-${effectiveGi}" min="0" step="0.01" placeholder="จำนวน">
          </div>
          <div class="hist-add-form .add-form-actions" style="display:flex;gap:8px">
            <button class="hist-save-btn" style="flex:2" onclick="saveNewHistItem(${effectiveGi})">บันทึก</button>
            <button class="hist-cancel-btn" style="flex:1" onclick="cancelAddItemForm(${effectiveGi})">ยกเลิก</button>
          </div>
        </div>
        <!-- Per-bill audit log -->
        <div id="hg-audit-${effectiveGi}" style="display:none;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="font-size:0.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">📋 Log การแก้ไข</div>
          <div id="hg-audit-rows-${effectiveGi}"></div>
        </div>
      </div>
    </div>`
  }).join('')
  // Apply searchable to each hadd-item select
  effectiveGis.forEach(gi => makeSearchable(`hadd-item-${gi}`, '— พิมพ์ค้นหา SP item —'))
}

function renderHistRow(r, gi, ri) {
  // MT row (catch_weight delivered) — read-only
  if (r._rowType === 'mt') {
    const item   = r.items || {}
    const name   = `🥩 ${item.name || 'เนื้อตุ๋น'}${r.legacy_cw_row ? ` [${r.legacy_cw_row}]` : ''}`
    const kgDisp = r.weight_g ? (r.weight_g / 1000).toFixed(3) : '?'
    const lot    = r.lot_date || ''
    return `
  <div class="hist-item-row" id="hrow-${gi}-${ri}" style="background:#FFF8E1">
    <div class="hist-item-name">${escHtml(name)}</div>
    <div class="hist-item-qty">${kgDisp} <span style="font-size:0.75em;color:#888">กก.</span></div>
    <div class="hist-item-unit" style="font-size:0.72rem;color:#aaa">${lot}</div>
    <span style="font-size:0.72rem;color:#E65100;padding:4px 8px;background:#FFF3E0;border-radius:6px">เนื้อตุ๋น</span>
  </div>`
  }

  // SP row (stock_counts) — editable
  const item        = r.items || {}
  const name        = item.name || r.item_id || '?'
  const unit        = item.unit || ''
  const dispQty     = r.dispense_qty !== null && r.dispense_qty !== undefined ? Number(r.dispense_qty) : null
  const remainQty   = r.qty !== null && r.qty !== undefined ? Number(r.qty) : null
  const displayQty  = dispQty !== null ? dispQty : (remainQty !== null ? remainQty : '?')
  const editVal     = dispQty !== null ? dispQty : (remainQty !== null ? remainQty : '')
  const qtyLabel    = dispQty !== null ? 'เบิก' : 'คงเหลือ'
  return `
  <div class="hist-item-row" id="hrow-${gi}-${ri}">
    <div class="hist-item-name">${escHtml(name)}</div>
    <div class="hist-item-qty">${displayQty} <span style="font-size:0.75em;color:#888">${qtyLabel}</span></div>
    <div class="hist-item-unit">${escHtml(unit)}</div>
    <button class="hist-edit-btn" onclick="showEditRow(${gi},${ri})">✏️ แก้</button>
    <button class="hist-del-btn" onclick="deleteHistRow(${gi},${ri})" title="ลบรายการนี้">🗑️</button>
  </div>
  <div class="hist-edit-row" id="hedit-${gi}-${ri}" style="display:none">
    <label>จำนวนเบิก:</label>
    <input type="number" id="hedit-input-${gi}-${ri}" value="${editVal}" step="0.01" min="0">
    <button class="hist-save-btn" onclick="saveHistRow(${gi},${ri})">บันทึก</button>
    <button class="hist-cancel-btn" onclick="cancelEditRow(${gi},${ri})">ยกเลิก</button>
    <div style="flex:1"></div>
  </div>
  <div class="hist-warn" id="hwarn-${gi}-${ri}" style="display:none">
    ⚠️ แก้ไข = จำนวนที่เบิกจริง (บิลนี้)
  </div>`
}

function toggleBillCard(gi) {
  const body   = document.getElementById(`hg-body-${gi}`)
  const header = document.querySelector(`#hg-${gi} .hist-bill-header`)
  const isOpen = body.style.display !== 'none'
  body.style.display   = isOpen ? 'none' : 'block'
  header.classList.toggle('open', !isOpen)
  if (!isOpen) {
    const group = historyData[gi]
    if (group) {
      const { bill } = parseBillNote(group.note)
      loadBillAuditLog(gi, bill)
    }
  }
}

function showEditRow(gi, ri) {
  document.getElementById(`hedit-${gi}-${ri}`).style.display = 'flex'
  document.getElementById(`hwarn-${gi}-${ri}`).style.display = 'block'
  document.getElementById(`hedit-input-${gi}-${ri}`).focus()
}

function cancelEditRow(gi, ri) {
  document.getElementById(`hedit-${gi}-${ri}`).style.display = 'none'
  document.getElementById(`hwarn-${gi}-${ri}`).style.display = 'none'
}

async function saveHistRow(gi, ri) {
  const group  = historyData[gi]
  const record = group.rows[ri]
  // Edit field = dispense_qty if available, else qty
  const hasDispQty = record.dispense_qty !== null && record.dispense_qty !== undefined
  const oldQty = hasDispQty ? Number(record.dispense_qty) : (record.qty !== null ? Number(record.qty) : null)
  const newQty = parseFloat(document.getElementById(`hedit-input-${gi}-${ri}`).value)

  if (isNaN(newQty) || newQty < 0) { alert('กรุณากรอกตัวเลขที่ถูกต้อง'); return }

  const saveBtn = document.querySelector(`#hedit-${gi}-${ri} .hist-save-btn`)
  saveBtn.disabled = true
  saveBtn.textContent = '⏳...'

  try {
    // If record has dispense_qty: update dispense_qty + recalculate remaining qty (avail = qty + dispense_qty)
    const patchBody = hasDispQty
      ? { dispense_qty: newQty, qty: Number(record.qty) + Number(record.dispense_qty) - newQty }
      : { qty: newQty }

    const res = await fetch(`${SB}/rest/v1/stock_counts?id=eq.${record.id}`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify(patchBody)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)

    // Log the edit
    const item = record.items || {}
    const { bill } = parseBillNote(group.note)
    await logDeliveryEdit({
      bill, action: 'แก้ไข',
      item_name: item.name || record.item_id || null,
      item_sku:  item.sku  || null,
      old_qty:   oldQty,
      new_qty:   newQty
    })

    // Update local data
    if (hasDispQty) {
      record.qty = Number(record.qty) + Number(record.dispense_qty) - newQty
      record.dispense_qty = newQty
    } else {
      record.qty = newQty
    }

    // Re-render entire rows container (same approach as deleteHistRow — avoids index/ID mismatch)
    const rowsEl = document.getElementById(`hg-rows-${gi}`)
    rowsEl.innerHTML = group.rows.map((r, newRi) => renderHistRow(r, gi, newRi)).join('')

    // Flash green on the updated row (find by new index after re-render)
    const newRi = group.rows.indexOf(record)
    const newRowEl = document.getElementById(`hrow-${gi}-${newRi}`)
    if (newRowEl) {
      newRowEl.style.background = '#E8F5E9'
      setTimeout(() => { newRowEl.style.background = '' }, 1200)
    }

    // Refresh per-bill audit log
    loadBillAuditLog(gi, parseBillNote(historyData[gi].note).bill)

  } catch(e) {
    alert(`❌ บันทึกไม่สำเร็จ: ${e.message}`)
    saveBtn.disabled = false
    saveBtn.textContent = 'บันทึก'
  }
}
