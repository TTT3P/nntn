// hub-delivery/history.js — ประวัติ tab: load history, render bill list, edit/print
// bill. Extracted from hub-delivery.html (split 3/6). historyData state lives here;
// row-level edit/render helpers are in history-edit.js (globals, loaded together).

// ─── History ──────────────────────────────────────────────────────────────────
let historyData = []   // array of bill groups

let _historyLoading = false
async function loadHistory() {
  if (_historyLoading) return   // dedupe: switchTab click can race the post-submit setTimeout refresh
  _historyLoading = true
  const listEl = document.getElementById('hist-list')
  listEl.innerHTML = '<div class="loading">กำลังโหลดประวัติ...</div>'
  const searchVal = (document.getElementById('hist-search')?.value || '').toLowerCase()

  try {
    const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
    const SHh = { ...H, Authorization: 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
    // ดึงจาก deliveries + lines โดยตรง
    const res = await fetch(
      `${SB}/rest/v1/deliveries?select=id,bill_no,branch,date,channel,created_at,delivery_lines(id,catch_weight_id,item_id,qty,weight_g,note)&order=created_at.desc&limit=100`,
      { headers: SHh }
    )
    const deliveries = await res.json()

    if (!Array.isArray(deliveries)) {
      console.error('loadHistory: non-array response', deliveries)
      listEl.innerHTML = `<div class="warn-banner">❌ โหลดประวัติไม่ได้: ${deliveries?.message || 'unknown'}</div>`
      return
    }
    if (deliveries.length === 0) {
      listEl.innerHTML = '<div class="hist-empty">ยังไม่มีประวัติการส่ง</div>'
      historyLoaded = true
      return
    }

    // Resolve item metadata client-side from window._itemsById
    deliveries.forEach(d => {
      (d.delivery_lines || []).forEach(l => {
        const it = window._itemsById?.[l.item_id]
        if (it) l.items = { sku: it.sku, name: it.name, unit: it.unit }
      })
    })

    // Fetch catch_weight status for all referenced cw_ids (reverse detection)
    const cwIds = Array.from(new Set(
      deliveries.flatMap(d => (d.delivery_lines||[]).map(l => l.catch_weight_id).filter(Boolean))
    ))
    const cwStatus = {}
    if (cwIds.length) {
      // chunk to avoid URL length limit (~2000 chars)
      const chunks = []
      for (let i = 0; i < cwIds.length; i += 200) chunks.push(cwIds.slice(i, i+200))
      // Fetch chunks in parallel. This was a sequential await loop — on a large/
      // polluted history (~4.6k cw_ids → 24 chunks) that meant 24 serial round-trips
      // (~3s locally, >15s in CI → history tab timed out). Promise.all collapses it to
      // roughly one round-trip; failed chunks degrade to [] so one bad chunk can't
      // block the rest (same skip-on-error behavior as before).
      const chunkResults = await Promise.all(chunks.map(chunk =>
        _fetchCatchWeightBatch(chunk.join(','), 'id,status', SHh)
          .then(cwRes => (cwRes.ok ? cwRes.json() : []))
          .catch(() => [])
      ))
      chunkResults.forEach(rows => rows.forEach(r => { cwStatus[r.id] = r.status }))
    }

    let filtered = deliveries
    if (searchVal) {
      filtered = deliveries.filter(d =>
        (d.bill_no||'').toLowerCase().includes(searchVal) ||
        (d.branch||'').toLowerCase().includes(searchVal)
      )
    }

    // Build historyData compatible with renderHistory (grouped by bill)
    historyData = filtered.map(d => {
      const lines = d.delivery_lines || []
      const meatLines = lines.filter(l => l.catch_weight_id)
      const nmLines = lines.filter(l => !l.catch_weight_id && l.item_id)
      const totalKg = meatLines.reduce((s, l) => s + (l.weight_g || 0) / 1000, 0)
      // Reverse detection: catch_weight.status = '✅ In Stock' = ถุงกลับมาแล้ว (reversed)
      const reversedMeat = meatLines.filter(l => cwStatus[l.catch_weight_id] === '✅ In Stock').length
      const meatCount = meatLines.length
      let reverseStatus = 'none'
      if (meatCount > 0) {
        if (reversedMeat === meatCount) reverseStatus = 'all'
        else if (reversedMeat > 0) reverseStatus = 'partial'
      }
      return {
        bill_no: d.bill_no,
        branch: d.branch,
        date: d.date,
        meat_count: meatCount,
        nm_count: nmLines.length,
        total_kg: totalKg,
        meat_lines: meatLines,
        nm_lines: nmLines,
        delivery_id: d.id,
        counted_at: d.date,
        reverse_status: reverseStatus,
        reversed_meat: reversedMeat
      }
    })

    historyLoaded = true
    renderDeliveryHistory(historyData)

  } catch(e) {
    listEl.innerHTML = `<div class="warn-banner">❌ โหลดประวัติไม่ได้: ${e.message}</div>`
  } finally {
    _historyLoading = false
  }
}

function renderDeliveryHistory(deliveries) {
  const listEl = document.getElementById('hist-list')
  if (!deliveries.length) {
    listEl.innerHTML = '<div class="hist-empty">ไม่พบประวัติการส่ง</div>'
    return
  }
  listEl.innerHTML = deliveries.map((d, i) => {
    const meatRows = (d.meat_lines||[]).map(l => {
      const name = l.items?.name || 'เนื้อตุ๋น'
      const kg = l.weight_g ? (l.weight_g/1000).toFixed(3) : '?'
      return `<div style="font-size:.82rem;padding:4px 8px;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between;background:#FFF8E1">
        <span>🥩 ${name}</span>
        <span style="color:var(--muted)">${kg} กก.</span>
      </div>`
    }).join('')
    const nmRows = (d.nm_lines||[]).map(l =>
      `<div style="font-size:.82rem;padding:4px 8px;border-bottom:1px solid #f5f5f5;display:flex;justify-content:space-between">
        <span>${l.items?.name || '?'}</span>
        <span style="color:var(--muted)">${l.qty} ${l.items?.unit||''}</span>
      </div>`
    ).join('')
    const hasSub = (d.meat_lines?.length || 0) + (d.nm_lines?.length || 0) > 0
    const isAllReversed = d.reverse_status === 'all'
    const isPartialReversed = d.reverse_status === 'partial'
    const groupStyle = isAllReversed ? 'opacity:.55;background:#FAFAFA' : ''
    const billStyle = isAllReversed ? 'text-decoration:line-through;color:#888' : ''
    const reverseBadge = isAllReversed
      ? `<span style="background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A;border-radius:6px;padding:2px 8px;font-size:.72rem;font-weight:700;margin-left:6px">🔄 REVERSED</span>`
      : isPartialReversed
        ? `<span style="background:#FFF3E0;color:#E65100;border:1px solid #FFB74D;border-radius:6px;padding:2px 8px;font-size:.72rem;font-weight:700;margin-left:6px">⚠️ partial ${d.reversed_meat}/${d.meat_count}</span>`
        : ''
    return `<div class="hist-group" style="margin-bottom:10px;border:1px solid var(--border);border-radius:10px;overflow:hidden;${groupStyle}">
      <div class="hist-header" onclick="if(this.nextElementSibling)this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"
           style="padding:12px 14px;cursor:pointer;background:#fafafa;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <span style="font-weight:700;${billStyle}">${d.bill_no||'?'}</span>${reverseBadge}
          <span style="font-size:.8rem;color:var(--muted);margin-left:8px">${d.branch} · ${fmtDate(d.date)}</span>
        </div>
        <div style="font-size:.82rem;color:var(--muted);display:flex;gap:10px;align-items:center;flex-shrink:0">
          <span>🥩 ${d.meat_count} ถุง/${d.total_kg.toFixed(3)}กก.</span>
          ${d.nm_count > 0 ? `<span>🧂 ${d.nm_count} รายการ</span>` : ''}
          <button class="btn btn-sm btn-outline-blue" onclick="event.stopPropagation();printHistBill(${i})" title="พิมพ์ใบนำส่ง">🖨</button>
          <button class="btn btn-sm" onclick="event.stopPropagation();editHistBill(${i})" title="แก้ไข bill_no / branch / date" style="background:#FFF3E0;color:#E65100;border:1px solid #FFB74D">✏️</button>
          <span>▼</span>
        </div>
      </div>
      ${hasSub ? `<div style="display:none">${meatRows}${nmRows}</div>` : ''}
    </div>`
  }).join('')
}

async function editHistBill(i) {
  const d = historyData[i]
  if (!d) return
  const newBill = prompt(`แก้ไข bill_no\n\nปัจจุบัน: ${d.bill_no}\n\nใส่ใหม่ (หรือเว้นว่างเพื่อไม่แก้):`, d.bill_no || '')
  if (newBill === null) return
  const newBranch = prompt(`แก้ไข branch\n\nปัจจุบัน: ${d.branch}\n\nใส่ใหม่ — NT หรือ FS:`, d.branch || '')
  if (newBranch === null) return
  const newDate = prompt(`แก้ไข date (YYYY-MM-DD)\n\nปัจจุบัน: ${d.date}`, d.date || '')
  if (newDate === null) return

  const patch = {}
  if (newBill.trim() && newBill.trim() !== d.bill_no) patch.bill_no = newBill.trim()
  if (['NT','FS'].includes(newBranch.trim()) && newBranch.trim() !== d.branch) patch.branch = newBranch.trim()
  if (newDate.trim() && /^\d{4}-\d{2}-\d{2}$/.test(newDate.trim()) && newDate.trim() !== d.date) patch.date = newDate.trim()

  if (Object.keys(patch).length === 0) return alert('ไม่มีการเปลี่ยนแปลง')
  if (!confirm(`ยืนยันแก้ไข?\n\n${JSON.stringify(patch, null, 2)}`)) return

  try {
    const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
    const SH = { ...H, 'Authorization': 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
    const res = await fetch(`${SB}/rest/v1/deliveries?id=eq.${d.id}`, {
      method: 'PATCH',
      headers: { ...SH, Prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${await res.text()}`)
    alert('✅ แก้ไขแล้ว — refresh ประวัติ')
    historyLoaded = false
    loadHistory()
  } catch(e) {
    alert(`❌ แก้ไขไม่สำเร็จ: ${e.message}`)
  }
}

function printHistBill(i) {
  const d = historyData[i]
  if (!d) return
  const dateStr = fmtDate(d.date)
  const branchFull = d.branch === 'NT' ? 'ครัวกลาง (NT)' : d.branch === 'FS' ? 'หน้าร้าน (FS)' : (d.branch || '-')
  const meatRows = (d.meat_lines||[]).map((l, idx) => {
    const name = l.items?.name || 'เนื้อตุ๋น'
    const kg = l.weight_g ? (l.weight_g/1000).toFixed(3) : '?'
    return `<tr><td>${idx+1}</td><td>🥩 ${escHtml(name)}</td><td style="text-align:right">${kg}</td><td>กก.</td></tr>`
  }).join('')
  const nmRows = (d.nm_lines||[]).map((l, idx) => {
    const name = l.items?.name || l.item_id || '?'
    const unit = l.items?.unit || ''
    return `<tr><td>${(d.meat_lines||[]).length + idx + 1}</td><td>${escHtml(name)}</td><td style="text-align:right">${l.qty}</td><td>${escHtml(unit)}</td></tr>`
  }).join('')
  const totalKg = (d.total_kg || 0).toFixed(3)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(d.bill_no||'')}</title>
<style>
  body { font-family: 'Sarabun', sans-serif; padding: 20px; color: #222; }
  h1 { font-size: 1.4rem; margin: 0 0 4px }
  .meta { font-size: .9rem; color: #555; margin-bottom: 14px }
  .meta b { color: #222 }
  table { width: 100%; border-collapse: collapse; font-size: .92rem }
  th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left }
  th { background: #f0f0f0 }
  td:first-child { width: 40px; text-align: center }
  td:nth-child(3) { width: 80px }
  td:nth-child(4) { width: 60px }
  .summary { margin-top: 14px; font-size: .9rem; display: flex; gap: 20px }
  .sig { margin-top: 40px; display: flex; justify-content: space-between; font-size: .88rem }
  .sig > div { text-align: center; width: 45% }
  .sig .line { border-top: 1px solid #444; margin-top: 40px; padding-top: 4px }
  @media print { body { padding: 10px } }
</style></head><body>
<h1>🚚 ใบนำส่ง — ${escHtml(d.bill_no||'')}</h1>
<div class="meta">
  วันที่: <b>${dateStr}</b> &nbsp;·&nbsp; ปลายทาง: <b>${escHtml(branchFull)}</b>
</div>
<table>
  <thead><tr><th>#</th><th>รายการ</th><th style="text-align:right">จำนวน</th><th>หน่วย</th></tr></thead>
  <tbody>${meatRows}${nmRows}</tbody>
</table>
<div class="summary">
  <span>🥩 เนื้อ <b>${d.meat_count}</b> ถุง / <b>${totalKg}</b> กก.</span>
  ${d.nm_count > 0 ? `<span>🧂 Non-meat <b>${d.nm_count}</b> รายการ</span>` : ''}
</div>
<div class="sig">
  <div><div class="line">ผู้ส่ง</div></div>
  <div><div class="line">ผู้รับ</div></div>
</div>
<scr${''}ipt>window.onload=()=>{setTimeout(()=>window.print(),250)}</scr${''}ipt>
</body></html>`
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) { alert('ไม่สามารถเปิดหน้าต่างใหม่ได้ — กรุณาอนุญาต popup'); return }
  w.document.write(html)
  w.document.close()
}
