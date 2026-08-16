// meat-stock/produce-closepot.js — หม้อตุ๋น: close pot (yield calc, byproduct bags,
// duplicate-bag soft-warning, submit) + cancel/plan-session. Split from produce-pot.js.
// Classic <script src>; uses showCookModal (produce-newpot.js, loaded first) + state.

// ── Close Pot ──
function openClosePotModal(session) {
  currentClosePot = session
  const inputs = session.cook_inputs || []
  const rawItemEmbed = inputs[0]?.items
  const rawKg = inputs.reduce((s, i) => s + (Number(i.kg_raw) || 0), 0)
  const potName = session.notes || `Session ${session.id.substring(0,6)}`
  const cookedOpts = items
    .filter(i => i.category === 'meat_cooked')
    .map(i => `<option value="${i.id}">${escHtml(i.name)}</option>`)
    .join('')
  const startTime = new Date(session.created_at).toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'})

  // Lookup byproduct info from global items (has byproduct_item_id + byproduct_required)
  const rawItemFull = items.find(i => i.id === rawItemEmbed?.id)
  // กระดูกวัว (และ item ที่ใช้ต้มซุปเฉยๆ) ไม่มี output ถุง
  const noOutputMode = rawItemFull?.sku === 'SP-034' || (rawItemEmbed?.name||'').includes('กระดูก')
  const bypItemId = rawItemFull?.byproduct_item_id
  const bypItem = bypItemId ? items.find(i => i.id === bypItemId) : null
  const bypRequired = !!rawItemFull?.byproduct_required
  const bypSection = bypItem ? `
    <div class="cook-sec" style="background:#FFF8E1;border:1.5px solid #FFE082">
      <div class="cook-sec-label" style="color:#E65100">
        By-product — ${escHtml(bypItem.name)} ${bypRequired ? '<span style="color:var(--red-light)">(บังคับ)</span>' : '<span style="color:var(--muted)">(ไม่บังคับ)</span>'}
      </div>
      <div class="row2">
        <div>
          <label>จำนวนถุง</label>
          <input type="number" id="cp-byp-count" min="0" placeholder="0" oninput="updateClosePotBypBags()">
        </div>
        <div style="display:flex;align-items:flex-end">
          <div style="font-size:0.82rem;color:var(--muted)">รวม: <b id="cp-byp-kg-sum">0.000</b> กก.</div>
        </div>
      </div>
      <div id="cp-byp-rows" style="margin-top:10px"></div>
    </div>
  ` : ''

  showCookModal(`
  <div class="modal-box">
    <input type="hidden" id="cp-no-output" value="${noOutputMode ? '1' : '0'}">
    <div class="modal-title">✏️ ปิดหม้อ — ${escHtml(potName)}</div>
    <div class="modal-sub">บันทึกผลผลิต + คำนวณ yield</div>

    <div class="cook-sec">
      <div class="cook-sec-label">Input (เริ่ม ${startTime} | กะ${session.shift})</div>
      <div style="font-size:0.92rem">${escHtml(rawItemEmbed?.name || '—')}: <b>${rawKg.toFixed(3)} กก.</b></div>
    </div>

    ${noOutputMode ? `<div class="cook-sec" style="background:#E8F5E9;border:1.5px solid #A5D6A7">
      <div style="color:#2e7d32;font-weight:700">🍲 ต้มซุป — ไม่มีผลผลิตถุง</div>
      <div style="font-size:.85rem;color:var(--muted);margin-top:4px">บันทึกเพื่อ record การใช้วัตถุดิบ</div>
    </div>` : `<div class="cook-sec">
      <div class="cook-sec-label">ผลผลิตหลัก (Main output)</div>
      <div class="row2">
        <div>
          <label>เนื้อตุ๋น</label>
          <select id="cp-item" onchange="calcClosePotYield()">
            <option value="">— เลือก —</option>${cookedOpts}
          </select>
        </div>
        <div>
          <label>จำนวนถุง</label>
          <input type="number" id="cp-bag-count" min="1" placeholder="0" oninput="updateClosePotBags()">
        </div>
      </div>
      <div id="cp-bag-rows" style="margin-top:10px"></div>
    </div>`}

    ${noOutputMode ? '' : bypSection}

    <div class="cook-sec" id="cp-yield-box" style="display:none">
      <div class="cook-sec-label">Yield</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span>Input</span><span>${rawKg.toFixed(3)} กก.</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span>Output หลัก</span><span id="cp-yo">—</span>
      </div>
      <div id="cp-byp-line" style="display:none;justify-content:space-between;margin-bottom:3px">
        <span>By-product</span><span id="cp-yb">—</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
        <span>Yield</span><span id="cp-yp">—</span>
      </div>
      <div id="cp-total-line" style="display:none;justify-content:space-between;font-size:0.78rem;color:var(--muted);margin-top:4px">
        <span>Total recovery</span><span id="cp-tr">—</span>
      </div>
      <div id="cp-waste-line" style="display:none;justify-content:space-between;font-size:0.78rem;color:#E65100;margin-top:4px">
        <span>Waste</span><span id="cp-wl">—</span>
      </div>
    </div>

    <div class="cook-sec" style="margin-top:8px">
      <div class="cook-sec-label">Waste / สูญเสีย</div>
      <div class="row2">
        <div>
          <label>น้ำหนัก waste (กก.)</label>
          <input type="number" id="cp-waste-kg" min="0" step="0.001" placeholder="0.000" oninput="calcClosePotYield()" style="width:100%">
        </div>
        <div>
          <label>หมายเหตุ waste</label>
          <input type="text" id="cp-waste-note" placeholder="เช่น กระดูก, หนัง, ไขมัน" style="width:100%">
        </div>
      </div>
    </div>

    <div class="modal-actions" style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn-cancel" onclick="closeCookModal()">ออก</button>
      <button class="btn-danger" onclick="cancelPot()" style="background:#c62828;color:#fff">🚫 ยกเลิกหม้อ</button>
      <button class="btn-confirm" onclick="submitClosePot()">✅ ปิดหม้อ</button>
    </div>
  </div>
  `)
}

async function cancelPot() {
  if (!currentClosePot) return
  const sessionId = currentClosePot.id
  const potName = currentClosePot.notes || `Session ${sessionId.substring(0,6)}`

  const reasons = ['ไหม้/เผา', 'เสีย/บูด', 'ผิดสูตร/รสชาติ', 'อุปกรณ์เสีย', 'อื่นๆ']
  const reasonPrompt = reasons.map((r,i) => `${i+1}. ${r}`).join('\n')
  const pick = prompt(`ยกเลิกหม้อ "${potName}"?\n\nเลือกเหตุผล (พิมพ์ 1-${reasons.length}):\n${reasonPrompt}`)
  if (pick === null) return
  const idx = parseInt(pick) - 1
  if (isNaN(idx) || idx < 0 || idx >= reasons.length) { alert('เหตุผลไม่ถูกต้อง'); return }
  const reason = reasons[idx]

  const extra = (reason === 'อื่นๆ') ? (prompt('อธิบายเหตุผลเพิ่มเติม:') || '') : ''
  const fullReason = extra ? `${reason} — ${extra}` : reason

  if (!confirm(`ยืนยันยกเลิก "${potName}"?\n\nเหตุผล: ${fullReason}\n\n⚠️ ถุง raw ที่เลือกจะถูก restore เป็น ✅ In Stock`)) return

  const btn = document.querySelector('#cook-modal-overlay .btn-danger')
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังยกเลิก...' }

  try {
    const restoreRes = await fetch(`${SB}/rest/v1/catch_weight?cook_session_id=eq.${sessionId}&status=eq.❌ Out`, {
      method: 'PATCH',
      headers: {...H, Prefer:'return=minimal'},
      body: JSON.stringify({ status: '✅ In Stock', cook_session_id: null, notes: '' })
    })
    if (!restoreRes.ok) throw new Error(`restore bags: HTTP ${restoreRes.status} — ${await restoreRes.text()}`)

    const newNotes = `${currentClosePot.notes || ''} | ❌ cancelled: ${fullReason}`.trim()
    const upRes = await fetch(`${SB}/rest/v1/cook_sessions?id=eq.${sessionId}`, {
      method: 'PATCH',
      headers: {...H, Prefer:'return=minimal'},
      body: JSON.stringify({ status: 'cancelled', notes: newNotes })
    })
    if (!upRes.ok) throw new Error(`UPDATE session: HTTP ${upRes.status} — ${await upRes.text()}`)

    closeCookModal()
    alert(`🚫 ยกเลิกหม้อ "${potName}" แล้ว\nเหตุผล: ${fullReason}\n\nถุง raw restore เรียบร้อย`)
    await reloadCwAndKanban()
  } catch(e) {
    alert(`❌ ยกเลิกไม่สำเร็จ: ${e.message}`)
    if (btn) { btn.disabled = false; btn.textContent = '🚫 ยกเลิกหม้อ' }
  }
}

async function startPlanSession(session) {
  const sessionId = session.id
  const potName = session.notes || `Session ${sessionId.substring(0,6)}`
  const inputs = session.cook_inputs || []
  const bagIds = (inputs[0]?.catch_weight_ids) || []
  const rawKg = inputs.reduce((s, i) => s + (Number(i.kg_raw) || 0), 0)

  if (bagIds.length === 0) { alert('ไม่มีถุงใน plan นี้ — ข้อมูลอาจผิดพลาด'); return }

  const stillAvailable = bagIds.every(id => {
    const b = cwStock.find(x => Number(x.id) === Number(id))
    return b && b.status === '✅ In Stock'
  })
  if (!stillAvailable) {
    alert(`⚠️ ถุงบางถุงถูก consume ไปแล้ว (อาจเปิดหม้ออื่นไปก่อน)\n\nกรุณายกเลิก plan นี้แล้ววางแผนใหม่`)
    return
  }

  if (!confirm(`เริ่มตุ๋น "${potName}"?\n\n${bagIds.length} ถุง / ${rawKg.toFixed(3)} กก.\n\n⚠️ ถุงจะถูก mark "❌ Out" ทันที และ session → cooking`)) return

  try {
    const idList = bagIds.join(',')
    const patchRes = await fetch(`${SB}/rest/v1/catch_weight?id=in.(${idList})`, {
      method: 'PATCH',
      headers: {...H, Prefer:'return=minimal'},
      body: JSON.stringify({
        status: '❌ Out',
        cook_session_id: sessionId,
        notes: `${potName} | กะ${session.shift || ''}`
      })
    })
    if (!patchRes.ok) throw new Error(`PATCH bags: HTTP ${patchRes.status} — ${await patchRes.text()}`)

    const upRes = await fetch(`${SB}/rest/v1/cook_sessions?id=eq.${sessionId}`, {
      method: 'PATCH',
      headers: {...H, Prefer:'return=minimal'},
      body: JSON.stringify({ status: 'cooking' })
    })
    if (!upRes.ok) throw new Error(`UPDATE session: HTTP ${upRes.status} — ${await upRes.text()}`)

    alert(`🔥 เริ่มตุ๋น "${potName}" แล้ว`)
    await reloadCwAndKanban()
  } catch(e) {
    alert(`❌ เริ่มตุ๋นไม่สำเร็จ: ${e.message}`)
  }
}

function updateClosePotBypBags() {
  const count = parseInt(document.getElementById('cp-byp-count').value) || 0
  const rows = document.getElementById('cp-byp-rows')
  if (!rows) return
  if (count <= 0) { rows.innerHTML = ''; calcClosePotYield(); return }
  rows.innerHTML = `
    <div style="display:grid;grid-template-columns:40px 1fr 80px;gap:6px;font-size:0.72rem;color:var(--muted);padding:4px 0">
      <span>ถุง</span><span>น้ำหนัก (กรัม)</span><span>กก.</span>
    </div>
  ` + Array.from({length: count}, (_, i) => `
    <div style="display:grid;grid-template-columns:40px 1fr 80px;gap:6px;margin-bottom:4px">
      <span style="display:flex;align-items:center;font-size:0.82rem">#${i+1}</span>
      <input type="number" class="cp-byp-bw" data-idx="${i}" placeholder="0" oninput="calcClosePotYield()" style="padding:6px">
      <span class="cp-byp-bk" data-idx="${i}" style="display:flex;align-items:center;font-size:0.82rem;color:var(--muted)">0.000</span>
    </div>
  `).join('')
  calcClosePotYield()
}

function cpBagKey(e, idx) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const inputs = document.querySelectorAll('.cp-bw')
  const next = inputs[idx + 1]
  if (next) { next.focus(); next.select() }
  else {
    const waste = document.getElementById('cp-waste-kg')
    if (waste) waste.focus()
  }
}

function updateClosePotBags() {
  const count = parseInt(document.getElementById('cp-bag-count').value) || 0
  const rows = document.getElementById('cp-bag-rows')
  if (!rows) return
  if (count <= 0) { rows.innerHTML = ''; calcClosePotYield(); return }
  rows.innerHTML = `
    <div style="display:grid;grid-template-columns:40px 1fr 80px;gap:6px;font-size:0.72rem;color:var(--muted);padding:4px 0">
      <span>ถุง</span><span>น้ำหนัก (กรัม)</span><span>กก.</span>
    </div>
  ` + Array.from({length: count}, (_, i) => `
    <div style="display:grid;grid-template-columns:40px 1fr 80px;gap:6px;margin-bottom:4px">
      <span style="display:flex;align-items:center;font-size:0.82rem">#${i+1}</span>
      <input type="number" class="cp-bw" data-idx="${i}" placeholder="0" oninput="calcClosePotYield()" onkeydown="cpBagKey(event,${i})" style="padding:6px">
      <span class="cp-bk" data-idx="${i}" style="display:flex;align-items:center;font-size:0.82rem;color:var(--muted)">0.000</span>
    </div>
  `).join('')
  calcClosePotYield()
}

function calcClosePotYield() {
  if (!currentClosePot) return
  const inputs = currentClosePot.cook_inputs || []
  const rawKg = inputs.reduce((s, i) => s + (Number(i.kg_raw) || 0), 0)

  let totalG = 0
  document.querySelectorAll('.cp-bw').forEach((el, i) => {
    const g = parseFloat(el.value) || 0
    totalG += g
    const kgSpan = document.querySelector(`.cp-bk[data-idx="${i}"]`)
    if (kgSpan) kgSpan.textContent = (g / 1000).toFixed(3)
  })
  const totalKg = totalG / 1000

  let bypG = 0
  document.querySelectorAll('.cp-byp-bw').forEach((el, i) => {
    const g = parseFloat(el.value) || 0
    bypG += g
    const kgSpan = document.querySelector(`.cp-byp-bk[data-idx="${i}"]`)
    if (kgSpan) kgSpan.textContent = (g / 1000).toFixed(3)
  })
  const bypKg = bypG / 1000
  const bypSumEl = document.getElementById('cp-byp-kg-sum')
  if (bypSumEl) bypSumEl.textContent = bypKg.toFixed(3)

  const box = document.getElementById('cp-yield-box')
  if (!box) return
  if (totalG <= 0 && bypG <= 0) { box.style.display = 'none'; return }
  box.style.display = 'block'
  const yoEl = document.getElementById('cp-yo')
  if (yoEl) yoEl.textContent = `${totalKg.toFixed(3)} กก.`

  const bypLine = document.getElementById('cp-byp-line')
  const totalLine = document.getElementById('cp-total-line')
  if (bypG > 0) {
    if (bypLine) { bypLine.style.display = 'flex'; document.getElementById('cp-yb').textContent = `${bypKg.toFixed(3)} กก.` }
    if (totalLine && rawKg > 0) {
      totalLine.style.display = 'flex'
      const totalRec = ((totalKg + bypKg) / rawKg * 100).toFixed(1)
      document.getElementById('cp-tr').textContent = `${totalRec}% (หลัก+byproduct)`
    }
  } else {
    if (bypLine) bypLine.style.display = 'none'
    if (totalLine) totalLine.style.display = 'none'
  }

  if (rawKg > 0 && totalG > 0) {
    const yieldPct = (totalKg / rawKg) * 100
    const itemId = document.getElementById('cp-item')?.value
    const cookedItem = items.find(i => i.id === itemId)
    const expMin = cookedItem?.yield_expected_min
    let color = 'var(--green)'
    let emoji = '🟢'
    let rangeTxt = ''
    if (expMin != null) {
      rangeTxt = ` (min ${Number(expMin).toFixed(0)}%)`
      if (yieldPct < Number(expMin)) { color = 'var(--red-light)'; emoji = '🔴' }
    }
    const yp = document.getElementById('cp-yp')
    if (yp) {
      yp.textContent = `${yieldPct.toFixed(1)}% ${emoji}${rangeTxt}`
      yp.style.color = color
    }
    const wasteKg = parseFloat(document.getElementById('cp-waste-kg')?.value || 0) || 0
    const wasteLine = document.getElementById('cp-waste-line')
    const wasteLabel = document.getElementById('cp-wl')
    if (wasteLine && wasteLabel) {
      if (wasteKg > 0) {
        const wastePct = (wasteKg / rawKg * 100).toFixed(1)
        wasteLabel.textContent = `${wasteKg.toFixed(3)} กก. (${wastePct}%)`
        wasteLine.style.display = 'flex'
      } else {
        wasteLine.style.display = 'none'
      }
    }
  }
}

// ════ Duplicate-bag soft-warning (non-blocking) ════
// ป้องกันกรอกถุงซ้ำ (double-count): เช็คก่อนสร้างถุงใหม่ว่ามีถุง item เดียวกัน +
// weight_g เท่ากันเป๊ะ ที่ถูกส่ง (🚚 Delivered) ไปแล้วภายใน 7 วันล่าสุดหรือไม่ —
// ใช้วันส่งจริงจาก stock.deliveries.date (join ผ่าน delivery_lines.catch_weight_id)
// ไม่ใช้ catch_weight.updated_at เพราะเป็นข้อมูลอิสระ ไม่ผูกกับ trigger ที่เพิ่งแก้
// (migration_catch_weight_updated_at.sql) — คืน array ของ match, "warn ไม่บล็อก":
// เจอเมื่อไหร่ผู้เรียกต้องโชว์ confirm() ให้ user ตัดสินใจเอง ไม่ throw/abort เอง
// เช็คพลาด (network/schema) → คืน [] เงียบๆ ไม่ทำให้ปิดหม้อ/บันทึกล่ม (fail-open by design)
async function findRecentDeliveredDuplicates(itemId, itemName, weightsG) {
  const uniqueWeights = [...new Set((weightsG || []).filter(g => g > 0))]
  if (!itemId || uniqueWeights.length === 0) return []
  try {
    const orFilter = uniqueWeights.map(g => `weight_g.eq.${g}`).join(',')
    const candidates = await get('catch_weight', {
      item_id: `eq.${itemId}`,
      status:  'eq.🚚 Delivered',
      or:      `(${orFilter})`,
      select:  'id,weight_g'
    })
    if (!Array.isArray(candidates) || candidates.length === 0) return []

    const idList = candidates.map(c => c.id).join(',')
    const linesRes = await fetch(
      `${SB}/rest/v1/delivery_lines?select=catch_weight_id,deliveries(bill_no,date,branch)&catch_weight_id=in.(${idList})`,
      { headers: { ...H, 'Accept-Profile': 'stock' } }
    )
    if (!linesRes.ok) return []
    const lines = await linesRes.json()
    if (!Array.isArray(lines)) return []

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7)
    const byId = {}; candidates.forEach(c => { byId[c.id] = c })

    return lines
      .filter(l => l.deliveries?.date && new Date(l.deliveries.date) >= cutoff)
      .map(l => ({
        item_name: itemName || '',
        weight_g:  byId[l.catch_weight_id]?.weight_g,
        bill_no:   l.deliveries.bill_no,
        date:      l.deliveries.date,
        branch:    l.deliveries.branch
      }))
  } catch (e) {
    console.warn('[dup-bag-check] skipped (non-blocking):', e)
    return []
  }
}

async function submitClosePot() {
  if (!currentClosePot) return
  const sessionId = currentClosePot.id
  const itemId = document.getElementById('cp-item')?.value || ''
  const bagWeights = Array.from(document.querySelectorAll('.cp-bw'))
    .map(el => parseFloat(el.value) || 0)
    .filter(g => g > 0)

  const noOutput = document.getElementById('cp-no-output')?.value === '1'
  if (!noOutput) {
    if (!itemId) { alert('กรุณาเลือกเนื้อตุ๋น'); return }
    if (bagWeights.length === 0) { alert('กรุณากรอกน้ำหนักอย่างน้อย 1 ถุง'); return }
  }

  const totalKg = bagWeights.reduce((s, g) => s + g, 0) / 1000

  const inputs = currentClosePot.cook_inputs || []
  const rawItemFull = items.find(i => i.id === inputs[0]?.items?.id)
  const bypItemId = rawItemFull?.byproduct_item_id
  const bypItem = bypItemId ? items.find(i => i.id === bypItemId) : null
  const bypRequired = !!rawItemFull?.byproduct_required

  const bypWeights = Array.from(document.querySelectorAll('.cp-byp-bw'))
    .map(el => parseFloat(el.value) || 0)
    .filter(g => g > 0)

  if (bypRequired && bypWeights.length === 0) {
    alert(`⚠️ ${bypItem?.name || 'By-product'} บังคับ — กรุณากรอกอย่างน้อย 1 ถุง`)
    return
  }

  // UX #2: Prompt if item has byproduct configured but น้องไม่กรอก (optional but easy to miss)
  if (bypItem && !bypRequired && bypWeights.length === 0) {
    if (!confirm(`🥩 รายการนี้มี "${bypItem.name}" เป็น by-product ที่ระบบรองรับ\n\nมั่นใจว่าไม่มี ${bypItem.name} จริง ๆ ?\n\n- กด OK = ไม่มี byproduct, ปิดหม้อต่อ\n- กด Cancel = กลับไปกรอก byproduct ก่อน`)) return
  }

  const bypKg = bypWeights.reduce((s, g) => s + g, 0) / 1000
  const bypMsg = bypWeights.length > 0 ? `\nBy-product: ${bypWeights.length} ถุง / ${bypKg.toFixed(3)} กก.` : ''

  // Duplicate-bag soft-warning — เช็คก่อนยืนยันปิดหม้อ (ไม่บล็อก แค่เตือนถ้าเจอ)
  const dupMatches = []
  if (!noOutput && itemId) {
    const outName = items.find(i => i.id === itemId)?.name || ''
    dupMatches.push(...await findRecentDeliveredDuplicates(itemId, outName, bagWeights))
  }
  if (bypItem?.id && bypWeights.length > 0) {
    dupMatches.push(...await findRecentDeliveredDuplicates(bypItem.id, bypItem.name || '', bypWeights))
  }
  if (dupMatches.length > 0) {
    const dupLines = dupMatches.map(m => `• ${m.item_name} ${m.weight_g} กรัม — ส่งไปแล้ว ${fmtDate(m.date)} บิล ${m.bill_no} (${m.branch})`).join('\n')
    if (!confirm(`⚠️ พบถุงน้ำหนักตรงกับที่ส่งไปแล้วภายใน 7 วัน — อาจกรอกซ้ำ?\n\n${dupLines}\n\nกด OK = ยืนยันบันทึกต่อ (ถ้ามั่นใจว่าไม่ซ้ำ) · Cancel = กลับไปตรวจสอบก่อน`)) return
  }

  if (!confirm(`ยืนยันปิดหม้อ?\n\nผลผลิต: ${bagWeights.length} ถุง / ${totalKg.toFixed(3)} กก.${bypMsg}`)) return

  const btn = document.querySelector('#cook-modal-overlay .btn-confirm')
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...' }

  try {
    const wasteKg = parseFloat(document.getElementById('cp-waste-kg')?.value || 0) || 0
    const wasteNote = document.getElementById('cp-waste-note')?.value?.trim() || ''

    // Atomic RPC — cook_outputs + catch_weight + session status all-or-nothing
    const rpcRes = await fetch(`${SB}/rest/v1/rpc/submit_close_pot`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_session_id:   sessionId,
        p_main_item_id: noOutput ? null : itemId,
        p_main_weights: noOutput ? [] : bagWeights,
        p_byp_item_id:  (bypItem && bypWeights.length > 0) ? bypItem.id : null,
        p_byp_weights:  bypWeights,
        p_waste_kg:     wasteKg,
        p_waste_note:   wasteNote,
        p_rcp_code:     null
      })
    })
    if (!rpcRes.ok) throw new Error(`submit_close_pot RPC: HTTP ${rpcRes.status} — ${await rpcRes.text()}`)

    closeCookModal()
    await reloadCwAndKanban()
    if (window.nntnSubmitDone) {
      window.nntnSubmitDone({
        title: '🔥 ปิดหม้อสำเร็จ',
        summary: `บันทึก <strong>${bagWeights.length} ถุง</strong> / ${totalKg.toFixed(3)} กก.${bypMsg ? '<br>'+bypMsg.replace(/\n/g,'<br>') : ''}`,
        eventType: 'create_bag',
        delaySec: 4
      })
    } else { alert(`✅ ปิดหม้อสำเร็จ\n${bagWeights.length} ถุง / ${totalKg.toFixed(3)} กก.${bypMsg}`) }

  } catch(e) {
    alert(`❌ ปิดหม้อไม่สำเร็จ: ${e.message}`)
    if (btn) { btn.disabled = false; btn.textContent = '✅ ปิดหม้อ' }
  }
}
