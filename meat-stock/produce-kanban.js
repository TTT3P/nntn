// meat-stock/produce-kanban.js — หม้อตุ๋น: kanban board render + session detail/reverse.
// Split from produce.js (kanban view side · step 7). Holds shared produce state
// (kanbanSessions/currentClosePot/...). Pot-creation/close modals → produce-pot.js.

// ════ หม้อตุ๋น (Cooking Kanban) ════
let kanbanSessions = []
let currentClosePot = null
let currentNewPotBags = new Set()
let _npRawBagsByItem = {}
let _newPotMode = 'cook'

async function loadKanban() {
  try {
    const tday = today()
    const sessions = await get('cook_sessions', {
      select: 'id,session_date,shift,status,notes,created_at,updated_at,cook_inputs(id,kg_raw,item_id,catch_weight_ids,items(id,sku,name,category,yield_expected_min,yield_expected_max)),cook_outputs(id,kg_cooked,bag_count,item_id,items(id,sku,name,category))',
      session_date: `eq.${tday}`,
      order: 'created_at.desc',
      limit: '50'
    })
    kanbanSessions = Array.isArray(sessions) ? sessions : []
    renderKanbanBoard()
  } catch(e) {
    const errEl = document.getElementById('kc-cook-body')
    if (errEl) errEl.innerHTML = `<div class="kanban-empty" style="color:var(--red-light)">❌ ${e.message}</div>`
  }
}

function renderKanbanBoard() {
  const plan = kanbanSessions.filter(s => s.status === 'open')
  const cook = kanbanSessions.filter(s => s.status === 'cooking')
  const done = kanbanSessions.filter(s => s.status === 'done')

  document.getElementById('cw-plan-count').textContent = plan.length
  document.getElementById('cw-cook-count').textContent = cook.length
  document.getElementById('cw-done-count').textContent = done.length
  document.getElementById('kc-plan').textContent = plan.length
  document.getElementById('kc-cook').textContent = cook.length
  document.getElementById('kc-done').textContent = done.length

  const planBody = document.getElementById('kc-plan-body')
  const cookBody = document.getElementById('kc-cook-body')
  const doneBody = document.getElementById('kc-done-body')

  planBody.innerHTML = plan.length
    ? plan.map(s => renderKanbanCard(s, 'plan')).join('')
    : '<div class="kanban-empty">ไม่มี</div>'
  cookBody.innerHTML = cook.length
    ? cook.map(s => renderKanbanCard(s, 'cook')).join('')
    : '<div class="kanban-empty">ไม่มี</div>'
  doneBody.innerHTML = done.length
    ? done.map(s => renderKanbanCard(s, 'done')).join('')
    : '<div class="kanban-empty">ยังไม่มี</div>'
}

function renderKanbanCard(session, type) {
  const inputs = session.cook_inputs || []
  const outputs = session.cook_outputs || []
  const rawKg = inputs.reduce((s, i) => s + (Number(i.kg_raw) || 0), 0)
  const cookedKg = outputs.reduce((s, o) => s + (Number(o.kg_cooked) || 0), 0)
  const bagCount = outputs.reduce((s, o) => s + (Number(o.bag_count) || 0), 0)
  const rawName = inputs[0]?.items?.name || '—'
  const cookedName = outputs[0]?.items?.name || '—'
  const shift = session.shift || ''
  const potName = session.notes || rawName || `Session ${session.id.substring(0,6)}`

  const createdAt = new Date(session.created_at)
  const now = new Date()
  const elapsedMin = Math.floor((now - createdAt) / 60000)
  const elapsedStr = elapsedMin < 60
    ? `${elapsedMin} นาที`
    : `${Math.floor(elapsedMin/60)} ชม ${elapsedMin%60} นาที`

  let yieldTag = ''
  if (type === 'done' && rawKg > 0) {
    const yieldPct = (cookedKg / rawKg) * 100
    const expMin = inputs[0]?.items?.yield_expected_min
    let yieldCls = 'kct-yield-good'
    if (expMin != null && yieldPct < Number(expMin)) yieldCls = 'kct-yield-bad'
    yieldTag = `<span class="kanban-card-tag ${yieldCls}">yield ${yieldPct.toFixed(1)}%</span>`
  }

  let body = ''
  if (type === 'plan') {
    body = `<div class="kanban-card-meta">${rawKg.toFixed(1)} กก. · กะ${shift}</div>
            <span class="kanban-card-tag kct-plan">พร้อมเริ่ม</span>`
  } else if (type === 'cook') {
    body = `<div class="kanban-card-meta">${rawKg.toFixed(1)} กก. · กะ${shift}</div>
            <span class="kanban-card-tag kct-time">⏱ ${elapsedStr}</span>`
  } else {
    body = `<div class="kanban-card-meta">${rawKg.toFixed(1)} → ${cookedKg.toFixed(1)} กก. · ${bagCount} ถุง</div>
            <div class="kanban-card-meta" style="font-size:.72rem;color:var(--muted)">→ ${escHtml(cookedName)} · กะ${shift}</div>
            ${yieldTag}`
  }

  return `<div class="kanban-card kanban-card-${type}" onclick="onKanbanCardClick('${session.id}')">
    <div class="kanban-card-title">${escHtml(potName)}</div>
    ${body}
  </div>`
}


function onKanbanCardClick(sessionId) {
  const session = kanbanSessions.find(s => s.id === sessionId)
  if (!session) return
  if (session.status === 'cooking') {
    openClosePotModal(session)
  } else if (session.status === 'open') {
    startPlanSession(session)
  } else {
    showSessionDetail(session)
  }
}


function showSessionDetail(session) {
  const inputs = session.cook_inputs || []
  const outputs = session.cook_outputs || []
  const rawKg = inputs.reduce((s, i) => s + (Number(i.kg_raw) || 0), 0)
  const potName = session.notes || `Session ${session.id.substring(0,6)}`
  const statusMap = { open: '🟡 รอเริ่ม', cooking: '🔥 กำลังตุ๋น', done: '✅ เสร็จแล้ว', cancelled: '❌ ยกเลิก' }
  const statusLabel = statusMap[session.status] || session.status

  const createdAt = session.created_at ? new Date(session.created_at) : null
  const startStr = createdAt ? `${createdAt.getHours().toString().padStart(2,'0')}:${createdAt.getMinutes().toString().padStart(2,'0')}` : '—'

  const mainOutputs = outputs.filter(o => o.items?.category === 'meat_cooked' || !o.items?.category?.startsWith('meat_trim'))
  const mainKg = mainOutputs.reduce((s, o) => s + (Number(o.kg_cooked) || 0), 0)
  const mainBags = mainOutputs.reduce((s, o) => s + (Number(o.bag_count) || 0), 0)
  const bypOutputs = outputs.filter(o => !mainOutputs.includes(o))
  const bypKg = bypOutputs.reduce((s, o) => s + (Number(o.kg_cooked) || 0), 0)
  const bypBags = bypOutputs.reduce((s, o) => s + (Number(o.bag_count) || 0), 0)

  const yieldPct = rawKg > 0 ? ((mainKg / rawKg) * 100) : null
  const totalRecoveryPct = rawKg > 0 ? (((mainKg + bypKg) / rawKg) * 100) : null
  const expMin = inputs[0]?.items?.yield_expected_min
  let yieldColor = 'var(--green)'
  let yieldEmoji = '🟢'
  if (expMin != null && yieldPct != null && yieldPct < Number(expMin)) { yieldColor = 'var(--red-light)'; yieldEmoji = '🔴' }

  const inputRows = inputs.map(i => `
    <div style="display:flex;justify-content:space-between;font-size:0.88rem;padding:4px 0;border-bottom:1px dashed var(--border)">
      <span>${escHtml(i.items?.name || '—')}</span>
      <span><b>${(Number(i.kg_raw)||0).toFixed(3)}</b> กก.</span>
    </div>
  `).join('') || '<div style="color:var(--muted);font-size:0.85rem">ไม่มี input</div>'

  const outputRows = outputs.length ? outputs.map(o => {
    const isByp = bypOutputs.includes(o)
    return `
    <div style="display:flex;justify-content:space-between;font-size:0.88rem;padding:4px 0;border-bottom:1px dashed var(--border)">
      <span>${isByp ? '🟡 ' : ''}${escHtml(o.items?.name || '—')}</span>
      <span><b>${(Number(o.kg_cooked)||0).toFixed(3)}</b> กก. / ${o.bag_count || 0} ถุง</span>
    </div>`
  }).join('') : '<div style="color:var(--muted);font-size:0.85rem">ยังไม่มี output</div>'

  const yieldBlock = (yieldPct != null) ? `
    <div class="cook-sec">
      <div class="cook-sec-label">Yield</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span>Input</span><span>${rawKg.toFixed(3)} กก.</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span>Output หลัก</span><span>${mainKg.toFixed(3)} กก.</span>
      </div>
      ${bypKg > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span>By-product</span><span>${bypKg.toFixed(3)} กก.</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px solid var(--border);color:${yieldColor}">
        <span>Yield</span><span>${yieldPct.toFixed(1)}% ${yieldEmoji}${expMin != null ? ` (min ${Number(expMin).toFixed(0)}%)` : ''}</span>
      </div>
      ${bypKg > 0 ? `<div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--muted);margin-top:4px">
        <span>Total recovery</span><span>${totalRecoveryPct.toFixed(1)}%</span>
      </div>` : ''}
    </div>
  ` : ''

  showCookModal(`
  <div class="modal-box">
    <div class="modal-title">📋 ${escHtml(potName)}</div>
    <div class="modal-sub">${statusLabel} | กะ${session.shift || '—'} | เริ่ม ${startStr}</div>

    <div class="cook-sec">
      <div class="cook-sec-label">Input (raw)</div>
      ${inputRows}
      <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
        <span>รวม</span><span>${rawKg.toFixed(3)} กก.</span>
      </div>
    </div>

    <div class="cook-sec">
      <div class="cook-sec-label">Output (cooked)</div>
      ${outputRows}
      ${outputs.length ? `<div style="display:flex;justify-content:space-between;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
        <span>รวม</span><span>${(mainKg+bypKg).toFixed(3)} กก. / ${mainBags+bypBags} ถุง</span>
      </div>` : ''}
    </div>

    ${yieldBlock}

    ${session.notes ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:8px">Notes: ${escHtml(session.notes)}</div>` : ''}

    <div class="modal-actions" style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn-confirm" onclick="closeCookModal()" style="flex:2">ปิด</button>
      ${session.status === 'done' ? `<button class="btn-danger" onclick="revertClosePot('${session.id}')" style="flex:1;background:#FFF3E0;color:#E65100;border:1px solid #FFB74D">↩️ ย้อนหม้อ</button>` : ''}
    </div>
  </div>
  `)
}

async function revertClosePot(sessionId) {
  const reasons = ['น้ำหนักผิด', 'ลืม byproduct', 'เลือก item ผิด', 'อื่นๆ']
  const prompt_text = reasons.map((r,i) => `${i+1}. ${r}`).join('\n')
  const pick = prompt(`↩️ ย้อนหม้อนี้?\n\nระบบจะลบถุงผลผลิต + cook_outputs + คืน session ไป "กำลังตุ๋น"\n(ถุง input ยัง Out ตามเดิม)\n\nเลือกเหตุผล (1-${reasons.length}):\n${prompt_text}`)
  if (pick === null) return
  const idx = parseInt(pick) - 1
  if (isNaN(idx) || idx < 0 || idx >= reasons.length) return alert('เหตุผลไม่ถูกต้อง')
  const extra = (reasons[idx] === 'อื่นๆ') ? (prompt('อธิบายเหตุผล:') || '') : ''
  const reason = extra ? `${reasons[idx]} — ${extra}` : reasons[idx]

  if (!confirm(`ยืนยันย้อน?\n\nเหตุผล: ${reason}\n\n⚠️ ถุงผลผลิตจะถูกลบ — ถ้า deliver ไปแล้วจะ error`)) return

  try {
    const res = await fetch(`${SB}/rest/v1/rpc/revert_close_pot`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_session_id: sessionId, p_reason: reason })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${await res.text()}`)
    const result = await res.json()
    closeCookModal()
    alert(`✅ ย้อนหม้อสำเร็จ\nลบถุง: ${result.bags_deleted} ถุง\nลบ output: ${result.outputs_deleted} rows\nSession กลับเป็น: กำลังตุ๋น`)
    await reloadCwAndKanban()
  } catch(e) {
    alert(`❌ ย้อนไม่สำเร็จ: ${e.message}`)
  }
}

async function reloadCwAndKanban() {
  try {
    const cw = await getAll('catch_weight', {
      'select':'id,item_id,weight_g,lot_date,warehouse,status,legacy_cw_row,items(name,sku,category)',
      'status':'eq.✅ In Stock'
    })
    cwStock = Array.isArray(cw) ? cw.map(r => ({
      ...r,
      item_name: r.items?.name || '',
      item_sku: r.items?.sku || '',
      item_category: r.items?.category || ''
    })) : []
    const d = new Date()
    const ds = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
    const hdr = document.getElementById('header-cw')
    if (hdr) hdr.innerHTML = `${ds} | CW <span>✅ ${cwStock.length} ถุง</span>`
  } catch(_){}
  await loadKanban()
}
