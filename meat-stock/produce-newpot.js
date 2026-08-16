// meat-stock/produce-newpot.js — หม้อตุ๋น: cook-modal helpers + create/plan new pot
// (item dropdown, bag select, submit). Split from produce-pot.js (step 8).
// Classic <script src>; state in produce-kanban.js. showCookModal/closeCookModal here.

// ── Cook Modal helpers ──
function showCookModal(html) {
  let overlay = document.getElementById('cook-modal-overlay')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'cook-modal-overlay'
    overlay.className = 'modal-overlay'
    overlay.onclick = (e) => { if (e.target === overlay) closeCookModal() }
    document.body.appendChild(overlay)
  }
  overlay.innerHTML = html
  overlay.classList.add('open')
}
function closeCookModal() {
  const overlay = document.getElementById('cook-modal-overlay')
  if (overlay) overlay.classList.remove('open')
  currentNewPotBags.clear()
  currentClosePot = null
}

// ── Create New Pot ──
function openPlanPotModal() { openNewPotModal('plan') }

function openNewPotModal(mode = 'cook') {
  _newPotMode = mode
  currentNewPotBags = new Set()
  const hour = new Date().getHours()
  let shift = 'เช้า'
  if (hour >= 12 && hour < 16) shift = 'บ่าย'
  else if (hour >= 16) shift = 'เย็น'

  const isPlan = mode === 'plan'
  const title = isPlan ? '📝 วางแผนเนื้อที่จะตุ๋น' : '🔥 เปิดเนื้อเข้าหม้อ'
  const sub = isPlan ? 'เลือกเนื้อสด → วางแผน (status → open, ยังไม่ consume ถุง)' : 'เลือกเนื้อสด → ส่งเข้าหม้อ (status → cooking)'
  const submitLabel = isPlan ? '📝 บันทึกแผน' : '🔥 ส่งเข้าหม้อ'

  showCookModal(`
  <div class="modal-box">
    <div class="modal-title">${title}</div>
    <div class="modal-sub">${sub}</div>

    <div class="cook-sec">
      <div class="cook-sec-label">Session Info</div>
      <div class="row2">
        <div>
          <label>ชื่อ (auto)</label>
          <input type="text" id="np-pot-name" value="จากชื่อเนื้อ" readonly
                 style="background:#f0f0f0;color:var(--muted);font-size:.82rem">
        </div>
        <div>
          <label>กะ</label>
          <select id="np-shift">
            <option value="เช้า" ${shift==='เช้า'?'selected':''}>🌅 เช้า</option>
            <option value="บ่าย" ${shift==='บ่าย'?'selected':''}>☀️ บ่าย</option>
            <option value="เย็น" ${shift==='เย็น'?'selected':''}>🌙 เย็น</option>
          </select>
        </div>
      </div>
    </div>

    <div class="cook-sec">
      <div class="cook-sec-label">เนื้อสดเข้าหม้อ</div>
      <div style="margin-bottom:8px">
        <label>รายการเนื้อ</label>
        <select id="np-item" onchange="onNewPotItemChange()">
          <option value="">— เลือก —</option>
        </select>
      </div>
      <div>
        <label>เลือกถุง (แตะเพื่อเลือก/ยกเลิก)</label>
        <div class="cook-bag-picker" id="np-bag-picker">
          <div style="padding:16px;text-align:center;color:var(--muted);font-size:0.78rem">เลือกรายการก่อน</div>
        </div>
        <div style="margin-top:8px;font-size:0.82rem;color:var(--muted)">
          เลือกแล้ว: <b id="np-selected-count">0</b> ถุง / <b id="np-selected-kg">0.000</b> กก.
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeCookModal()">ยกเลิก</button>
      <button class="btn-confirm" onclick="submitNewPot()">${submitLabel}</button>
    </div>
  </div>
  `)
  loadNewPotItemDropdown()
}

function loadNewPotItemDropdown() {
  _npRawBagsByItem = {}
  cwStock.forEach(b => {
    if (b.warehouse !== 'A') return
    const item = items.find(i => i.id === b.item_id)
    if (!item) return
    if (item.name.includes('[')) return  // ตัด pre-packed (เช่น เสือร้องไห้ออส[500g]) — ไม่เข้าหม้อตุ๋น
    if (item.category && item.category !== 'meat_raw' && item.category !== 'meat_fresh' && item.category !== 'meat' && item.category !== 'meat_trim' && !item.name.includes('สด') && !item.name.includes('ดิบ')) return
    if (!_npRawBagsByItem[item.id]) _npRawBagsByItem[item.id] = { item, bags: [] }
    _npRawBagsByItem[item.id].bags.push(b)
  })

  const sel = document.getElementById('np-item')
  if (!sel) return
  const groups = Object.values(_npRawBagsByItem).filter(g => g.bags.length > 0)
  if (groups.length === 0) {
    sel.innerHTML = '<option value="">— ไม่มีเนื้อสดในสต๊อก —</option>'
    return
  }
  sel.innerHTML = '<option value="">— เลือก —</option>' +
    groups.map(g => `<option value="${g.item.id}">${escHtml(g.item.name)} (${g.bags.length} ถุง)</option>`).join('')
}

function onNewPotItemChange() {
  const itemId = document.getElementById('np-item').value
  currentNewPotBags = new Set()
  const picker = document.getElementById('np-bag-picker')
  if (!itemId) {
    picker.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:0.78rem">เลือกรายการก่อน</div>'
    updateNewPotSelected()
    return
  }
  const group = _npRawBagsByItem[itemId]
  if (!group || group.bags.length === 0) {
    picker.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:0.78rem">ไม่มีถุง</div>'
    return
  }
  const sorted = [...group.bags].sort((a, b) => (a.lot_date || '').localeCompare(b.lot_date || ''))
  picker.innerHTML = sorted.map(b => {
    const kg = ((b.weight_g || 0) / 1000).toFixed(3)
    const label = b.legacy_cw_row || `#${b.id}`
    return `<span class="cook-bag-chip" data-id="${b.id}" onclick="toggleNewPotBag('${b.id}')">${label} ${kg}กก.</span>`
  }).join('')
  updateNewPotSelected()
}

function toggleNewPotBag(bagId) {
  const chip = document.querySelector(`.cook-bag-chip[data-id="${bagId}"]`)
  if (!chip) return
  const key = String(bagId)
  if (currentNewPotBags.has(key)) {
    currentNewPotBags.delete(key)
    chip.classList.remove('selected')
  } else {
    currentNewPotBags.add(key)
    chip.classList.add('selected')
  }
  updateNewPotSelected()
}

function updateNewPotSelected() {
  let totalKg = 0
  currentNewPotBags.forEach(id => {
    const bag = cwStock.find(b => String(b.id) === String(id))
    if (bag) totalKg += (Number(bag.weight_g) || 0) / 1000
  })
  const cntEl = document.getElementById('np-selected-count')
  const kgEl = document.getElementById('np-selected-kg')
  if (cntEl) cntEl.textContent = currentNewPotBags.size
  if (kgEl) kgEl.textContent = totalKg.toFixed(3)
}

async function submitNewPot() {
  const shift = document.getElementById('np-shift').value
  const itemId = document.getElementById('np-item').value
  const bagIds = Array.from(currentNewPotBags).map(id => parseInt(id)).filter(n => !isNaN(n))
  const isPlan = _newPotMode === 'plan'

  if (!itemId) { alert('กรุณาเลือกรายการเนื้อ'); return }
  if (bagIds.length === 0) { alert('กรุณาเลือกถุงอย่างน้อย 1 ถุง'); return }

  const selectedItem = items.find(i => i.id === itemId)
  const baseName = selectedItem?.name || 'เนื้อ'
  const sameNameToday = kanbanSessions.filter(s => {
    if (s.status === 'cancelled') return false
    const sRaw = s.cook_inputs?.[0]?.items?.name || s.notes || ''
    return sRaw === baseName || (s.notes && s.notes.startsWith(baseName))
  }).length
  const potName = sameNameToday > 0 ? `${baseName} #${sameNameToday + 1}` : baseName

  const totalKg = bagIds.reduce((s, id) => {
    const b = cwStock.find(x => Number(x.id) === id)
    return s + ((Number(b?.weight_g) || 0) / 1000)
  }, 0)

  const confirmMsg = isPlan
    ? `ยืนยันวางแผน "${potName}"?\n\nกะ${shift}\n${bagIds.length} ถุง / ${totalKg.toFixed(3)} กก.\n\n📝 ถุงจะยังไม่ถูก consume — รอกด "เริ่มตุ๋น"`
    : `ยืนยันเปิด "${potName}" เข้าหม้อ?\n\nกะ${shift}\n${bagIds.length} ถุง / ${totalKg.toFixed(3)} กก.\n\n⚠️ ถุงที่เลือกจะถูก mark "❌ Out" ทันที`
  if (!confirm(confirmMsg)) return

  const btn = document.querySelector('#cook-modal-overlay .btn-confirm')
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังส่ง...' }

  let sessionId = null
  try {
    const sRes = await post('cook_sessions', [{
      session_date: today(),
      shift,
      status: isPlan ? 'open' : 'cooking',
      notes: potName
    }])
    sessionId = sRes[0].id

    await post('cook_inputs', [{
      session_id: sessionId,
      item_id: itemId,
      kg_raw: totalKg,
      catch_weight_ids: bagIds
    }])

    if (!isPlan) {
      const idList = bagIds.join(',')
      const patchRes = await fetch(`${SB}/rest/v1/catch_weight?id=in.(${idList})`, {
        method: 'PATCH',
        headers: {...H, Prefer:'return=minimal'},
        body: JSON.stringify({
          status: '❌ Out',
          cook_session_id: sessionId,
          notes: `${potName} | กะ${shift}`
        })
      })
      if (!patchRes.ok) throw new Error(`PATCH catch_weight: HTTP ${patchRes.status} — ${await patchRes.text()}`)
    }

    closeCookModal()
    const okMsg = isPlan
      ? `📝 วางแผน "${potName}" แล้ว\n${bagIds.length} ถุง / ${totalKg.toFixed(3)} กก.\n\nแตะ card ในคอลัมน์ "วางแผน" เพื่อเริ่มตุ๋น`
      : `✅ เปิด "${potName}" เข้าหม้อแล้ว\n${bagIds.length} ถุง / ${totalKg.toFixed(3)} กก.`
    alert(okMsg)
    await reloadCwAndKanban()

  } catch(e) {
    if (sessionId) {
      try {
        await fetch(`${SB}/rest/v1/cook_inputs?session_id=eq.${sessionId}`, { method: 'DELETE', headers: {...H, Prefer:'return=minimal'} })
        await fetch(`${SB}/rest/v1/cook_sessions?id=eq.${sessionId}`, { method: 'DELETE', headers: {...H, Prefer:'return=minimal'} })
      } catch(_){}
    }
    alert(`❌ ไม่สำเร็จ: ${e.message}`)
    if (btn) { btn.disabled = false; btn.textContent = isPlan ? '📝 บันทึกแผน' : '🔥 ส่งเข้าหม้อ' }
  }
}
