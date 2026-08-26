// hub-delivery/drafts.js — รอส่ง tab: load/render draft cards, add/edit/delete draft
// meat+non-meat lines, persist, submit draft. Extracted from hub-delivery.html (split 2/6).

// ─── Drafts ───────────────────────────────────────────────────────────────────
window._draftCache = {}   // id → { nm_lines, meat_lines, ... } (mutable in-memory)

async function loadDrafts() {
  const listEl = document.getElementById('drafts-list')
  listEl.innerHTML = '<div class="loading">กำลังโหลด...</div>'
  try {
    const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
    const DH = { ...H, 'Authorization': 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
    const res = await fetch(`${SB}/rest/v1/delivery_drafts?status=eq.draft&order=created_at.desc&limit=50`, { headers: DH })
    const drafts = await res.json()
    if (!drafts.length) { listEl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:24px">ยังไม่มี Draft ค้างอยู่</div>'; return }
    window._draftCache = {}
    drafts.forEach(d => {
      d.nm_lines   = Array.isArray(d.nm_lines)   ? d.nm_lines   : []
      d.meat_lines = Array.isArray(d.meat_lines) ? d.meat_lines : []
      window._draftCache[d.id] = d
    })
    listEl.innerHTML = drafts.map(d => renderDraftCard(d)).join('')
    drafts.forEach(d => makeSearchable(`dadd-item-${d.id}`, '— พิมพ์ค้นหา SP item —'))
  } catch(e) {
    listEl.innerHTML = `<div style="color:var(--red-light);padding:12px">โหลดไม่ได้: ${e.message}</div>`
  }
}

function renderDraftCard(d) {
  const dt = new Date(d.created_at).toLocaleString('th-TH', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
  const meatCount = d.meat_lines.length
  const nmCount   = d.nm_lines.length
  const meatRows = d.meat_lines.map(m => `
    <div class="hist-item-row" style="background:#FFF8E1">
      <div class="hist-item-name">🥩 ${escHtml(m.name || 'เนื้อตุ๋น')}</div>
      <div class="hist-item-qty">${((m.weight_g||0)/1000).toFixed(3)} <span style="font-size:0.75em;color:#888">กก.</span></div>
      <div class="hist-item-unit" style="font-size:.72rem;color:#aaa">${escHtml(m.lot_date||'')}</div>
      <button class="hist-del-btn" onclick="deleteDraftMeat('${d.id}','${m.bag_id}')" title="ลบถุงนี้ออกจาก Draft">🗑️</button>
    </div>`).join('')
  const nmRows = d.nm_lines.map((l, li) => renderDraftNmRow(d.id, li, l)).join('')
  return `
  <div class="hist-bill-card" id="dc-${d.id}" style="border-left:4px solid #FFA000">
    <div class="hist-bill-header" onclick="toggleDraftCard('${d.id}')">
      <div class="hist-bill-info">
        <div class="hist-bill-num">${escHtml(d.bill_no || '(ยังไม่มีเลขบิล)')} → ${escHtml(d.branch||'')}</div>
        <div class="hist-bill-meta">วันที่: ${d.date} · บันทึก ${dt} · โดย ${escHtml(d.created_by||'?')}</div>
        <div style="font-size:.82rem;margin-top:4px">🥩 ${meatCount} ถุง · 🧂 ${nmCount} รายการ</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();submitDraft('${d.id}')">🚛 ส่งออก</button>
        <button class="btn btn-sm" style="background:#fff0f0;color:#c62828;border:1px solid #ffcdd2" onclick="event.stopPropagation();deleteDraft('${d.id}')">🗑</button>
        <span style="color:var(--muted);padding:4px 8px;cursor:pointer">▼</span>
      </div>
    </div>
    <div class="hist-bill-body" id="dc-body-${d.id}" style="display:none">
      ${meatRows}
      <button class="hist-add-row-btn" onclick="showAddDraftMeat('${d.id}')">+ เพิ่มถุงเนื้อ</button>
      <div class="hist-add-form" id="dmadd-form-${d.id}">
        <div class="add-form-row">
          <select id="dmadd-item-${d.id}" onchange="renderDraftMeatBagPicker('${d.id}')">
            <option value="">— เลือก SKU เนื้อ —</option>
            ${Array.from(new Set(cwBags.map(b => b.item_id))).map(iid => {
              const it = (window._itemsById||{})[iid] || {}
              return `<option value="${iid}">${escHtml(it.sku||'')} | ${escHtml(it.name||iid)}</option>`
            }).join('')}
          </select>
        </div>
        <div id="dmadd-bags-${d.id}" style="margin:8px 0;max-height:200px;overflow-y:auto"></div>
        <div class="add-form-actions" style="display:flex;gap:8px">
          <button class="hist-save-btn" style="flex:2" onclick="saveNewDraftMeat('${d.id}')">บันทึก</button>
          <button class="hist-cancel-btn" style="flex:1" onclick="cancelAddDraftMeat('${d.id}')">ยกเลิก</button>
        </div>
      </div>
      <div id="dc-nm-${d.id}">${nmRows}</div>
      <button class="hist-add-row-btn" onclick="showAddDraftNm('${d.id}')">+ เพิ่ม Non-meat</button>
      <div class="hist-add-form" id="dadd-form-${d.id}">
        <div class="add-form-row">
          <select id="dadd-item-${d.id}">
            <option value="">— เลือก SP item —</option>
            ${spItems.map(i => `<option value="${i.id}" data-sku="${i.sku}" data-unit="${i.unit||''}" data-name="${i.name}">${i.sku} | ${escHtml(i.name)}</option>`).join('')}
          </select>
          <input type="number" id="dadd-qty-${d.id}" min="0" step="0.01" placeholder="จำนวน">
        </div>
        <div class="add-form-actions" style="display:flex;gap:8px">
          <button class="hist-save-btn" style="flex:2" onclick="saveNewDraftNm('${d.id}')">บันทึก</button>
          <button class="hist-cancel-btn" style="flex:1" onclick="cancelAddDraftNm('${d.id}')">ยกเลิก</button>
        </div>
      </div>
    </div>
  </div>`
}

function renderDraftNmRow(draftId, li, l) {
  // Stock indicator — bright red if insufficient, green if OK
  const item = window._itemsById?.[l.item_id]
  const sku = item?.sku || ''
  const isMisc = String(sku).startsWith('MISC')
  let stockBadge = ''
  if (!isMisc && sku && spStockBySku[sku] !== undefined) {
    const have = spStockBySku[sku]
    const need = parseFloat(l.qty) || 0
    if (have <= 0) {
      stockBadge = `<span style="color:#c62828;font-weight:700;font-size:0.8em;margin-left:6px">❌ ของหมด</span>`
    } else if (have < need) {
      stockBadge = `<span style="color:#ef6c00;font-weight:700;font-size:0.8em;margin-left:6px">⚠️ มี ${have} · ไม่พอ</span>`
    } else {
      stockBadge = `<span style="color:#2e7d32;font-weight:600;font-size:0.8em;margin-left:6px">✓ มี ${have}</span>`
    }
  }
  return `
  <div class="hist-item-row" id="drow-${draftId}-${li}">
    <div class="hist-item-name">${escHtml(l.name || l.item_id || '?')}${stockBadge}</div>
    <div class="hist-item-qty">${l.qty} <span style="font-size:0.75em;color:#888">${escHtml(l.unit||'')}</span></div>
    <div class="hist-item-unit"></div>
    <button class="hist-edit-btn" onclick="showEditDraftNm('${draftId}',${li})">✏️ แก้</button>
    <button class="hist-del-btn" onclick="deleteDraftNm('${draftId}',${li})" title="ลบรายการนี้">🗑️</button>
  </div>
  <div class="hist-edit-row" id="dedit-${draftId}-${li}" style="display:none">
    <label>จำนวน:</label>
    <input type="number" id="dedit-input-${draftId}-${li}" value="${l.qty}" min="0"
      step="${window.nntnIsDecimalUnit(l.unit) ? '0.01' : '1'}"
      inputmode="${window.nntnIsDecimalUnit(l.unit) ? 'decimal' : 'numeric'}">
    <button class="hist-save-btn" onclick="saveEditDraftNm('${draftId}',${li})">บันทึก</button>
    <button class="hist-cancel-btn" onclick="cancelEditDraftNm('${draftId}',${li})">ยกเลิก</button>
    <div style="flex:1"></div>
  </div>`
}

function toggleDraftCard(id) {
  const body = document.getElementById(`dc-body-${id}`)
  const header = document.querySelector(`#dc-${id} .hist-bill-header`)
  if (!body) return
  const open = body.style.display !== 'none'
  body.style.display = open ? 'none' : 'block'
  header.classList.toggle('open', !open)
}

function showAddDraftNm(id) {
  document.getElementById(`dadd-form-${id}`).style.display = 'block'
  const ssInput = document.querySelector(`#dadd-form-${id} .ss-input`)
  ;(ssInput || document.getElementById(`dadd-item-${id}`)).focus()
}

function cancelAddDraftNm(id) {
  const form = document.getElementById(`dadd-form-${id}`)
  form.style.display = 'none'
  document.getElementById(`dadd-item-${id}`).value = ''
  const ssInput = form.querySelector('.ss-input')
  if (ssInput) { ssInput.value = ''; const dd = form.querySelector('.ss-dropdown'); if (dd) dd.style.display = 'none' }
  document.getElementById(`dadd-qty-${id}`).value = ''
}

async function saveNewDraftNm(id) {
  const itemSel = document.getElementById(`dadd-item-${id}`)
  const qtyEl   = document.getElementById(`dadd-qty-${id}`)
  const itemId  = itemSel.value
  const qty     = parseFloat(qtyEl.value)
  if (!itemId) { alert('กรุณาเลือก SP item'); return }
  if (isNaN(qty) || qty <= 0) { alert('กรุณากรอกจำนวนที่ถูกต้อง'); return }
  const opt  = itemSel.options[itemSel.selectedIndex]
  const unit = opt?.dataset?.unit || ''
  const name = opt?.dataset?.name || ''
  const chkAdd = window.nntnEnforceIntegerUnit(qty, unit, name)
  if (!chkAdd.ok) { alert(chkAdd.message); return }
  const draft = window._draftCache[id]
  if (!draft) return
  const newLines = [...draft.nm_lines, { item_id: itemId, name, qty: chkAdd.qty, unit }]
  try {
    await persistDraftNmLines(id, newLines)
    draft.nm_lines = newLines
    refreshDraftCard(id)
    _hdToast(`✅ เพิ่ม ${name} x${qty} ${unit}`)
  } catch(e) { _hdToast('❌ บันทึกไม่สำเร็จ: ' + e.message, 'error') }
}

function showEditDraftNm(id, li) {
  document.getElementById(`drow-${id}-${li}`).style.display = 'none'
  document.getElementById(`dedit-${id}-${li}`).style.display = 'flex'
  document.getElementById(`dedit-input-${id}-${li}`).focus()
}

function cancelEditDraftNm(id, li) {
  document.getElementById(`drow-${id}-${li}`).style.display = ''
  document.getElementById(`dedit-${id}-${li}`).style.display = 'none'
}

async function saveEditDraftNm(id, li) {
  const qty = parseFloat(document.getElementById(`dedit-input-${id}-${li}`).value)
  if (isNaN(qty) || qty <= 0) { alert('กรุณากรอกจำนวนที่ถูกต้อง'); return }
  const draft = window._draftCache[id]
  if (!draft) return
  const line = draft.nm_lines[li]
  const chkEdit = window.nntnEnforceIntegerUnit(qty, line?.unit || '', line?.name || '')
  if (!chkEdit.ok) { alert(chkEdit.message); return }
  const newLines = draft.nm_lines.map((l, i) => i === li ? { ...l, qty: chkEdit.qty } : l)
  try {
    await persistDraftNmLines(id, newLines)
    draft.nm_lines = newLines
    refreshDraftCard(id)
    _hdToast('✅ บันทึกจำนวนใหม่แล้ว')
  } catch(e) { _hdToast('❌ บันทึกไม่สำเร็จ: ' + e.message, 'error') }
}

async function deleteDraftNm(id, li) {
  const draft = window._draftCache[id]
  if (!draft) return
  const line = draft.nm_lines[li]
  if (!confirm(`ลบรายการ "${line?.name||'?'}" ออกจาก Draft?`)) return
  const newLines = draft.nm_lines.filter((_, i) => i !== li)
  try {
    await persistDraftNmLines(id, newLines)
    draft.nm_lines = newLines
    refreshDraftCard(id)
    _hdToast('🗑 ลบรายการแล้ว')
  } catch(e) { _hdToast('❌ ลบไม่สำเร็จ: ' + e.message, 'error') }
}

function showAddDraftMeat(id) {
  document.getElementById(`dmadd-form-${id}`).style.display = 'block'
  document.getElementById(`dmadd-item-${id}`).focus()
}

function cancelAddDraftMeat(id) {
  const form = document.getElementById(`dmadd-form-${id}`)
  form.style.display = 'none'
  document.getElementById(`dmadd-item-${id}`).value = ''
  document.getElementById(`dmadd-bags-${id}`).innerHTML = ''
}

function renderDraftMeatBagPicker(id) {
  const itemId = document.getElementById(`dmadd-item-${id}`).value
  const box = document.getElementById(`dmadd-bags-${id}`)
  if (!itemId) { box.innerHTML = ''; return }
  const draft = window._draftCache[id]
  const usedInThis = new Set((draft?.meat_lines||[]).map(m => String(m.bag_id)))
  const avail = cwBags.filter(b => b.item_id === itemId && !usedInThis.has(String(b.id)))
  if (avail.length === 0) { box.innerHTML = '<div style="color:#999;padding:8px">ไม่มีถุงคงเหลือให้เลือก</div>'; return }
  box.innerHTML = avail.map(b => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid #eee;cursor:pointer">
      <input type="checkbox" class="dmadd-bag-cb" data-bag="${b.id}">
      <span style="flex:1">ถุง #${b.id}</span>
      <span style="min-width:70px;text-align:right">${((b.weight_g||0)/1000).toFixed(3)} กก.</span>
      <span style="font-size:.72rem;color:#888">${escHtml(b.lot_date||'')}</span>
      <span style="font-size:.7rem;color:#aaa">${escHtml(b.warehouse||'')}</span>
    </label>`).join('')
}

async function saveNewDraftMeat(id) {
  const itemSel = document.getElementById(`dmadd-item-${id}`)
  const itemId = itemSel.value
  if (!itemId) { alert('กรุณาเลือก SKU เนื้อ'); return }
  const checks = document.querySelectorAll(`#dmadd-bags-${id} .dmadd-bag-cb:checked`)
  if (checks.length === 0) { alert('กรุณาเลือกถุงอย่างน้อย 1 ถุง'); return }
  const draft = window._draftCache[id]
  if (!draft) return
  const item = (window._itemsById||{})[itemId] || {}
  const newBags = []
  checks.forEach(cb => {
    const bagId = cb.dataset.bag
    const b = bagCache[bagId]
    if (!b) return
    newBags.push({ item_id: itemId, bag_id: b.id, name: item.name || '', weight_g: b.weight_g, lot_date: b.lot_date })
  })
  const newLines = [...(draft.meat_lines||[]), ...newBags]
  try {
    await persistDraftMeatLines(id, newLines)
    draft.meat_lines = newLines
    refreshDraftCard(id)
    _hdToast(`✅ เพิ่ม ${newBags.length} ถุง`)
  } catch(e) { _hdToast('❌ บันทึกไม่สำเร็จ: ' + e.message, 'error') }
}

async function deleteDraftMeat(id, bagId) {
  const draft = window._draftCache[id]
  if (!draft) return
  const line = (draft.meat_lines||[]).find(m => String(m.bag_id) === String(bagId))
  if (!confirm(`ลบถุง #${bagId} (${line?.name||'?'} ${((line?.weight_g||0)/1000).toFixed(3)} กก.) ออกจาก Draft?`)) return
  const newLines = (draft.meat_lines||[]).filter(m => String(m.bag_id) !== String(bagId))
  try {
    await persistDraftMeatLines(id, newLines)
    draft.meat_lines = newLines
    refreshDraftCard(id)
    _hdToast('🗑 ลบถุงแล้ว')
  } catch(e) { _hdToast('❌ ลบไม่สำเร็จ: ' + e.message, 'error') }
}

async function persistDraftMeatLines(draftId, newLines) {
  const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
  const DH = { ...H, 'Authorization': 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock', 'Content-Type': 'application/json' }
  const res = await fetch(`${SB}/rest/v1/delivery_drafts?id=eq.${draftId}`, {
    method: 'PATCH', headers: DH, body: JSON.stringify({ meat_lines: newLines })
  })
  if (!res.ok) throw new Error(await res.text())
}

async function persistDraftNmLines(draftId, newLines) {
  const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
  const DH = { ...H, 'Authorization': 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock', 'Content-Type': 'application/json' }
  const res = await fetch(`${SB}/rest/v1/delivery_drafts?id=eq.${draftId}`, {
    method: 'PATCH', headers: DH, body: JSON.stringify({ nm_lines: newLines })
  })
  if (!res.ok) throw new Error(await res.text())
}

function refreshDraftCard(id) {
  const draft = window._draftCache[id]
  if (!draft) return
  const card = document.getElementById(`dc-${id}`)
  if (!card) return
  const body = document.getElementById(`dc-body-${id}`)
  const wasOpen = body && body.style.display !== 'none'
  card.outerHTML = renderDraftCard(draft)
  makeSearchable(`dadd-item-${id}`, '— พิมพ์ค้นหา SP item —')
  if (wasOpen) toggleDraftCard(id)
}

async function submitDraft(draftId) {
  const draft = window._draftCache[draftId]
  if (!draft) { _hdToast('ไม่พบ Draft', 'error'); return }
  if (!confirm('โหลด Draft เข้าฟอร์ม? ตรวจสอบแล้วค่อยกด 🚛 บันทึกส่งออก')) return

  switchTab('delivery')
  if (draft.date) document.getElementById('dl-date').value = draft.date
  const branchMap = { NT: 'ครัวกลาง (NT)', FS: 'หน้าร้าน (FS)' }
  if (draft.branch) document.getElementById('dl-dest').value = branchMap[draft.branch] || draft.branch
  // Always regenerate bill_no — don't reuse draft's (may already be submitted)
  document.getElementById('dl-bill').value = ''
  await suggestBillNum()

  // B9 fix: re-validate meat_lines against live catch_weight status before loading
  // (prevents stale draft from holding bags already Delivered/disposed by another session)
  let meatLines = draft.meat_lines || []
  const prunedBags = []
  if (meatLines.length > 0) {
    try {
      const vTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
      const vH   = { 'apikey': KEY, 'Authorization': 'Bearer ' + vTok }
      const ids  = meatLines.map(m => Number(m.bag_id)).filter(n => Number.isFinite(n))
      if (ids.length > 0) {
        const r = await _fetchCatchWeightBatch(ids.join(','), 'id,status', vH)
        if (r.ok) {
          const rows = await r.json()
          const statusById = new Map(rows.map(x => [String(x.id), x.status]))
          const fresh = []
          meatLines.forEach(m => {
            const st = statusById.get(String(m.bag_id))
            if (st === '✅ In Stock') fresh.push(m)
            else prunedBags.push({ ...m, _liveStatus: st || '(ไม่พบ)' })
          })
          meatLines = fresh
        }
      }
    } catch (_) { /* network glitch — load draft as-is, submit guard will catch */ }
  }
  if (prunedBags.length > 0) {
    // Auto-substitute: for each pruned bag pull in a fresh In-Stock bag of the SAME item
    // (fungible portioned meat = identical weight). The reconciled list loads into the
    // form for review before the user commits with 🚛 บันทึกส่งออก, so any weight change on
    // a variable-weight item stays visible and correctable — it is a suggestion, not a
    // silent commit. This is the "ระบบจะเลือกถุงใหม่ให้" the prune was missing.
    // (root cause 2026-08-26 ลูกชิ้น short-ship — prune removed the bag but never replaced it.)
    const usedIds   = new Set(meatLines.map(m => String(m.bag_id)))
    const swapped   = []
    const stillGone = []
    try {
      const itemIds = [...new Set(prunedBags.map(p => String(p.item_id)).filter(Boolean))]
      const poolByItem = {}
      if (itemIds.length > 0) {
        const idList = itemIds.map(x => `"${x}"`).join(',')
        const freshInStock = await getAll('catch_weight', {
          select: 'id,item_id,weight_g,lot_date,warehouse,legacy_cw_row',
          status: 'eq.✅ In Stock',
          item_id: `in.(${idList})`,
          order: 'lot_date.asc,id.asc'
        })
        if (Array.isArray(freshInStock)) freshInStock.forEach(b => {
          if (usedIds.has(String(b.id))) return   // already in this draft
          ;(poolByItem[String(b.item_id)] = poolByItem[String(b.item_id)] || []).push(b)
        })
      }
      prunedBags.forEach(p => {
        const repl = (poolByItem[String(p.item_id)] || []).shift()   // FEFO oldest; remove to avoid double-assign
        if (repl) {
          usedIds.add(String(repl.id))
          bagCache[repl.id] = repl
          meatLines.push({ item_id: p.item_id, bag_id: repl.id, name: p.name, weight_g: repl.weight_g, lot_date: repl.lot_date })
          swapped.push({ from: p.bag_id, to: repl.id, name: p.name })
        } else {
          stillGone.push(p)
        }
      })
    } catch (_) { prunedBags.forEach(p => stillGone.push(p)) }

    const msg = []
    if (swapped.length > 0) {
      const s = swapped.slice(0, 15).map(x => `• ${x.name}: #${x.from} → #${x.to}`).join('\n')
      msg.push(`✅ ถุงเดิมถูกส่ง/ปรับไปแล้ว — สลับถุงใหม่ให้อัตโนมัติ ${swapped.length} ถุง (ตรวจก่อนกดส่งออก):\n${s}`)
    }
    if (stillGone.length > 0) {
      const g = stillGone.slice(0, 15).map(p => `• ${p.name} #${p.bag_id} → ${p._liveStatus}`).join('\n')
      msg.push(`⚠️ ${stillGone.length} ถุงไม่มีของแทนใน In Stock — ถูกตัดออก:\n${g}`)
    }
    alert(`${msg.join('\n\n')}\n\nรวมถุงเนื้อที่จะส่งตอนนี้: ${meatLines.length} ถุง`)

    // persist reconciled meat_lines back to the draft
    try {
      const pTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
      const pH   = { 'apikey': KEY, 'Authorization': 'Bearer ' + pTok, 'Content-Type': 'application/json',
                     'Content-Profile': 'stock', 'Accept-Profile': 'stock', 'Prefer': 'return=minimal' }
      await fetch(`${SB}/rest/v1/delivery_drafts?id=eq.${draftId}`, {
        method: 'PATCH', headers: pH, body: JSON.stringify({ meat_lines: meatLines })
      })
      // refresh local cache so subsequent submit cross-check sees pruned set
      if (window._draftCache && window._draftCache[draftId]) {
        window._draftCache[draftId] = { ...window._draftCache[draftId], meat_lines: meatLines }
      }
    } catch (_) { /* best-effort persist */ }
  }

  // Rebuild meat blocks grouped by item_id
  const meatByItem = {}
  meatLines.forEach(m => {
    if (!meatByItem[m.item_id]) meatByItem[m.item_id] = { itemId: m.item_id, name: m.name, bags: [] }
    meatByItem[m.item_id].bags.push(m.bag_id)
  })
  document.getElementById('meat-blocks').innerHTML = ''
  Object.keys(meatSel).forEach(k => delete meatSel[k])
  const meatGroups = Object.values(meatByItem)
  if (meatGroups.length === 0) {
    addMeatBlock()
  } else {
    meatGroups.forEach(g => {
      addMeatBlock()
      const n = meatBlockCount
      const sel = document.getElementById(`mb-sku-${n}`)
      if (!sel) return
      sel.value = g.itemId
      const opt = sel.options[sel.selectedIndex]
      const si  = document.getElementById(`mb-sku-${n}-search`)
      if (si && opt?.text) si.value = opt.text
      onMeatItemChange(n)
      setTimeout(() => {
        g.bags.forEach(bagId => {
          if (bagCache[bagId]) meatSel[n].selectedBags.add(bagId)
        })
        renderMeatChips(n)
      }, 80)
    })
  }

  // Rebuild nm rows
  document.getElementById('nm-rows').innerHTML = ''
  nmRowCount = 0
  const nmList = draft.nm_lines || []
  if (nmList.length === 0) {
    addNmRow()
  } else {
    nmList.forEach(saved => {
      addNmRow()
      const n   = nmRowCount
      const sel = document.getElementById(`nm-item-${n}`)
      if (sel && saved.item_id) {
        sel.value = saved.item_id
        const opt = sel.options[sel.selectedIndex]
        const si  = document.getElementById(`nm-item-${n}-search`)
        if (si && opt?.text) si.value = opt.text
        onNmChange(n)
      }
      if (saved.qty)  document.getElementById(`nm-qty-${n}`).value  = saved.qty
      if (saved.unit) document.getElementById(`nm-unit-${n}`).value = saved.unit
    })
  }

  updatePreview()
  await new Promise(r => setTimeout(r, 200))
  _hdToast(`✅ โหลด Draft แล้ว — ตรวจสอบแล้วกด 🚛 บันทึกส่งออก (เนื้อ ${meatLines.length} ถุง / nm ${nmList.length} รายการ)`)
  window._pendingDraftId = draftId
}

async function deleteDraft(id) {
  if (!confirm('ลบ Draft นี้?')) return
  const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
  const DH = { ...H, 'Authorization': 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
  await fetch(`${SB}/rest/v1/delivery_drafts?id=eq.${id}`, { method: 'DELETE', headers: DH })
  loadDrafts()
}
