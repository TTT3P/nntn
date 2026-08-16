// hub-delivery/history-edit.js — ประวัติ row-level edit: render bill rows, inline
// edit/delete row, add line item, per-bill + global audit log, filterHistory + escHtml
// (shared util). Extracted from hub-delivery.html (split 5/6). Globals shared.

// ─── Delete a history row ─────────────────────────────────────────────────────
async function deleteHistRow(gi, ri) {
  const group  = historyData[gi]
  const record = group.rows[ri]
  const item   = record.items || {}
  const name   = item.name || record.item_id || '?'

  if (!confirm(`ลบ "${name}" ออกจากบิลนี้?`)) return

  try {
    const res = await fetch(`${SB}/rest/v1/stock_counts?id=eq.${record.id}`, {
      method: 'DELETE',
      headers: { ...H, Prefer: 'return=minimal' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)

    // Log the delete
    const { bill } = parseBillNote(group.note)
    await logDeliveryEdit({
      bill, action: 'ลบรายการ',
      item_name: item.name || record.item_id || null,
      item_sku:  item.sku  || null,
      old_qty:   record.qty !== null && record.qty !== undefined ? Number(record.qty) : null
    })

    // Remove from local data
    group.rows.splice(ri, 1)

    // Re-render rows container
    const rowsEl = document.getElementById(`hg-rows-${gi}`)
    rowsEl.innerHTML = group.rows.map((r, newRi) => renderHistRow(r, gi, newRi)).join('')

    // Update item count badge
    const countEl = document.querySelector(`#hg-${gi} .hist-bill-count`)
    if (countEl) countEl.textContent = `${group.rows.length} รายการ`

    // If no rows left, show empty message
    if (group.rows.length === 0) {
      rowsEl.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0">ไม่มีรายการในบิลนี้</div>'
    }

    // Refresh per-bill audit log
    loadBillAuditLog(gi, parseBillNote(historyData[gi].note).bill)

  } catch(e) {
    alert(`❌ ลบไม่สำเร็จ: ${e.message}`)
  }
}

// ─── Add a new line item to existing bill ────────────────────────────────────
function showAddItemForm(gi) {
  document.getElementById(`hadd-form-${gi}`).style.display = 'block'
  // Focus ss-input (searchable wrapper) ถ้ามี ไม่งั้น fallback select
  const ssInput = document.querySelector(`#hadd-form-${gi} .ss-input`)
  ;(ssInput || document.getElementById(`hadd-item-${gi}`)).focus()
}

function cancelAddItemForm(gi) {
  const form = document.getElementById(`hadd-form-${gi}`)
  form.style.display = 'none'
  document.getElementById(`hadd-item-${gi}`).value = ''
  const ssInput = form.querySelector('.ss-input')
  if (ssInput) { ssInput.value = ''; form.querySelector('.ss-dropdown').style.display = 'none' }
  document.getElementById(`hadd-qty-${gi}`).value = ''
}

async function saveNewHistItem(gi) {
  const group   = historyData[gi]
  const itemSel = document.getElementById(`hadd-item-${gi}`)
  const qtyEl   = document.getElementById(`hadd-qty-${gi}`)
  const itemId  = itemSel.value
  const dispQty = parseFloat(qtyEl.value)

  if (!itemId) { alert('กรุณาเลือก SP item'); return }
  if (isNaN(dispQty) || dispQty <= 0) { alert('กรุณากรอกจำนวนที่ถูกต้อง'); return }

  const opt  = itemSel.options[itemSel.selectedIndex]
  const sku  = opt?.dataset?.sku || ''
  const unit = opt?.dataset?.unit || ''
  const name = opt?.dataset?.name || sku

  const saveBtn = document.querySelector(`#hadd-form-${gi} .hist-save-btn`)
  saveBtn.disabled = true
  saveBtn.textContent = '⏳...'

  try {
    // Get current stock for this item (latest stock_counts record — all event types)
    const latest = await get('stock_counts', {
      select: 'qty',
      item_id: `eq.${itemId}`,
      order: 'counted_at.desc',
      limit: '1'
    })
    const currentStock = (Array.isArray(latest) && latest.length > 0)
      ? parseFloat(latest[0].qty) || 0
      : (spStockBySku[sku] ?? 0)

    const newQty = currentStock - dispQty

    // INSERT new stock_counts record (with dispense_qty for correct history display)
    const res = await fetch(`${SB}/rest/v1/stock_counts`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify([{
        item_id:      itemId,
        qty:          newQty,
        dispense_qty: dispQty,
        event_type:   'dispense',
        counted_by:   (window.nntnCurrentUser || 'UNKNOWN') + ' · hub-delivery',
        note:         group.note,
        counted_at:   new Date().toISOString()
      }])
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    const inserted = await res.json()
    const newRecord = Array.isArray(inserted) ? inserted[0] : inserted

    // Attach items info locally
    newRecord.items = { name, unit, sku }

    // Add to local data
    const ri = group.rows.length
    group.rows.push(newRecord)

    // Append new row to DOM
    const rowsEl = document.getElementById(`hg-rows-${gi}`)
    rowsEl.insertAdjacentHTML('beforeend', renderHistRow(newRecord, gi, ri))

    // Update item count badge
    const countEl = document.querySelector(`#hg-${gi} .hist-bill-count`)
    if (countEl) countEl.textContent = `${group.rows.length} รายการ`

    // Update local stock cache
    if (sku) spStockBySku[sku] = newQty

    // Log the add
    const { bill } = parseBillNote(group.note)
    await logDeliveryEdit({
      bill, action: 'เพิ่มรายการ',
      item_name: name || null,
      item_sku:  sku  || null,
      new_qty:   dispQty
    })

    cancelAddItemForm(gi)

    // Refresh per-bill audit log
    loadBillAuditLog(gi, parseBillNote(historyData[gi].note).bill)

  } catch(e) {
    alert(`❌ บันทึกไม่สำเร็จ: ${e.message}`)
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'บันทึก'
  }
}

// ─── Per-bill Audit Log ───────────────────────────────────────────────────────
async function loadBillAuditLog(gi, bill) {
  const section = document.getElementById(`hg-audit-${gi}`)
  const rowsEl  = document.getElementById(`hg-audit-rows-${gi}`)
  if (!section || !rowsEl) return
  section.style.display = 'block'
  rowsEl.innerHTML = '<div class="loading" style="font-size:0.82rem">กำลังโหลด log...</div>'
  try {
    const rows = await get('delivery_edit_log', {
      select: 'id,action,item_name,item_sku,old_qty,new_qty,done_at',
      bill:   `eq.${bill}`,
      order:  'done_at.desc',
      limit:  '50'
    })
    const data = Array.isArray(rows) ? rows : []
    if (data.length === 0) {
      rowsEl.innerHTML = '<div style="color:var(--muted);font-size:0.82rem;padding:4px 0">ยังไม่มี log การแก้ไข</div>'
      return
    }
    rowsEl.innerHTML = `<div style="overflow-x:auto"><table class="audit-table" style="font-size:0.8rem">
      <thead><tr><th>วันเวลา</th><th>action</th><th>รายการ</th><th>qty</th></tr></thead>
      <tbody>${data.map(r => {
        const dt = r.done_at ? new Date(r.done_at) : null
        const dateStr = dt
          ? dt.toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'2-digit' })
            + ' ' + dt.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' })
          : '—'
        const cls = r.action === 'แก้ไข' ? 'audit-action-edit'
                  : r.action === 'ลบรายการ' ? 'audit-action-delete'
                  : r.action === 'เพิ่มรายการ' ? 'audit-action-add' : ''
        let qtyHtml = '—'
        if (r.action === 'แก้ไข')        qtyHtml = `${r.old_qty ?? '?'} → ${r.new_qty ?? '?'}`
        else if (r.action === 'ลบรายการ')   qtyHtml = `<span class="audit-qty-delete">${r.old_qty ?? '?'}</span>`
        else if (r.action === 'เพิ่มรายการ') qtyHtml = `<span class="audit-qty-add">${r.new_qty ?? '?'}</span>`
        const item = r.item_sku ? `${escHtml(r.item_sku)} ${escHtml(r.item_name||'')}` : escHtml(r.item_name||'—')
        return `<tr>
          <td style="white-space:nowrap;color:var(--muted)">${dateStr}</td>
          <td class="${cls}">${escHtml(r.action||'—')}</td>
          <td>${item}</td>
          <td>${qtyHtml}</td>
        </tr>`
      }).join('')}</tbody>
    </table></div>`
  } catch(e) {
    rowsEl.innerHTML = '<div class="warn-banner" style="font-size:0.82rem">❌ โหลด log ไม่ได้</div>'
  }
}

// ─── Audit Log ────────────────────────────────────────────────────────────────
async function logDeliveryEdit({ bill, action, item_name, item_sku, old_qty, new_qty, note }) {
  try {
    await fetch(`${SB}/rest/v1/delivery_edit_log`, {
      method: 'POST',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify([{
        bill:      bill || null,
        action:    action,
        item_name: item_name || null,
        item_sku:  item_sku  || null,
        old_qty:   old_qty   !== undefined ? old_qty : null,
        new_qty:   new_qty   !== undefined ? new_qty : null,
        done_at:   new Date().toISOString(),
        note:      note || null
      }])
    })
  } catch(e) {
    console.warn('audit log failed:', e.message)
  }
}

async function loadAuditLog() {
  const el = document.getElementById('audit-log-content')
  if (!el) return
  el.innerHTML = '<div class="loading">กำลังโหลด log...</div>'
  try {
    const rows = await get('delivery_edit_log', {
      select: 'id,bill,action,item_name,item_sku,old_qty,new_qty,done_at,note',
      order:  'done_at.desc',
      limit:  '50'
    })
    const data = Array.isArray(rows) ? rows : []
    if (data.length === 0) {
      el.innerHTML = '<div class="hist-empty">ยังไม่มี log การแก้ไข</div>'
      return
    }
    el.innerHTML = `
      <div style="overflow-x:auto">
        <table class="audit-table">
          <thead>
            <tr>
              <th>วันเวลา</th>
              <th>บิล</th>
              <th>action</th>
              <th>รายการ</th>
              <th>qty เดิม → qty ใหม่</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(r => {
              const dt = r.done_at ? new Date(r.done_at) : null
              const dateStr = dt
                ? dt.toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'2-digit' })
                  + ' ' + dt.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' })
                : '—'
              const actionClass =
                r.action === 'แก้ไข'      ? 'audit-action-edit'   :
                r.action === 'ลบรายการ'   ? 'audit-action-delete' :
                r.action === 'เพิ่มรายการ' ? 'audit-action-add'    : ''
              let qtyHtml = '—'
              if (r.action === 'แก้ไข') {
                qtyHtml = `${r.old_qty ?? '?'} → ${r.new_qty ?? '?'}`
              } else if (r.action === 'ลบรายการ') {
                qtyHtml = `<span class="audit-qty-delete">${r.old_qty ?? '?'}</span>`
              } else if (r.action === 'เพิ่มรายการ') {
                qtyHtml = `<span class="audit-qty-add">${r.new_qty ?? '?'}</span>`
              }
              const itemLabel = r.item_sku ? `${escHtml(r.item_sku)} ${escHtml(r.item_name || '')}` : escHtml(r.item_name || '—')
              return `<tr>
                <td style="white-space:nowrap;color:var(--muted)">${dateStr}</td>
                <td style="white-space:nowrap">${escHtml(r.bill || '—')}</td>
                <td class="${actionClass}">${escHtml(r.action || '—')}</td>
                <td>${itemLabel}</td>
                <td>${qtyHtml}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </div>`
  } catch(e) {
    el.innerHTML = `<div class="warn-banner">❌ โหลด log ไม่ได้: ${e.message}</div>`
  }
}

function filterHistory() {
  const q = document.getElementById('hist-search').value.trim().toLowerCase()
  if (!q) { renderHistory(historyData); return }
  const filtered = historyData.filter(g => g.note.toLowerCase().includes(q))
  renderHistory(filtered)
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
