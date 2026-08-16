// meat-stock/stock-view.js — สต๊อกปัจจุบัน tab: live stock board, warehouse expand,
// bag trace modal. Split from stock.js; yield panel → stock-yield.js (loaded first).

// ════ สต๊อกปัจจุบัน ════
async function loadStock() {
  loadYieldAnalytics()
  try {
    const [cw, ys] = await Promise.all([
      getAll('catch_weight', { 'select':'id,item_id,weight_g,lot_date,warehouse,status,legacy_cw_row,items(name,sku,category)', 'status':'eq.✅ In Stock' }),
      get('yield_summary', { select:'item_name,yield_pct,yield_expected_min,yield_expected_max,yield_status', order:'yield_pct.desc' })
    ])

    const rows=Array.isArray(cw)?cw:[]
    // อัปเดต cwStock global ด้วย — ใช้โดย produce/process lot chips
    cwStock = rows.map(r => ({
      ...r,
      item_name: r.items?.name || '',
      item_sku: r.items?.sku || '',
      item_category: r.items?.category || ''
    }))
    const totalKg=rows.reduce((s,r)=>s+(parseFloat(r.weight_g)||0),0)/1000
    const byWh={A:0,B:0,C:0}
    rows.forEach(r=>{ const k=r.warehouse||''; if(byWh[k]!==undefined) byWh[k]++ })

    document.getElementById('sk-total').textContent=rows.length+' ถุง'
    // Load-completeness guard: displayed bags must equal the server's true In Stock count.
    countRows('catch_weight', { 'status':'eq.✅ In Stock' }).then(total => {
      if (total != null && total !== rows.length) {
        console.warn(`[nntn] In Stock load incomplete: showing ${rows.length} of ${total} bags`)
        const el = document.getElementById('sk-total')
        if (el) el.innerHTML = `${rows.length} ถุง <span style="color:var(--red-light);font-size:.72rem">⚠️ ไม่ครบ (${rows.length}/${total})</span>`
      }
    })
    document.getElementById('sk-kg').textContent=totalKg.toFixed(2)+' กก.'
    document.getElementById('sk-a').textContent=byWh.A>0?byWh.A+' ถุง':'—'
    document.getElementById('sk-b').textContent=byWh.B>0?byWh.B+' ถุง':'—'
    document.getElementById('sk-c').textContent=byWh.C>0?byWh.C+' ถุง':'—'

    // Infer warehouse from item name (for 0-stock items that have no bags)
    function inferWh(name, cat) {
      const n = name||''
      const c = cat||''
      if(/^\[[\d]+[Gg]\]/.test(n)) return 'C'
      if(c==='meat_portioned') return 'C'
      if(c==='meat_cooked') return 'B'
      if(c==='meat_raw'||c==='meat_fresh') return 'A'
      if(n.includes('ตุ๋น')||n.includes('หมักนุ่ม')) return 'B'
      return 'A'
    }

    // Build item category map (id → category)
    const itemCatMap={}
    items.forEach(it=>{ if(it.id) itemCatMap[it.id]=it.category||'' })

    // Group by warehouse → item | meat_trim → SCRAP section
    const byWhGroups={A:{},B:{},C:{},SCRAP:{}}
    const itemsInStock=new Set()
    rows.forEach(r=>{
      const wh = r.warehouse||inferWh(r.items?.name||'',r.items?.category||'')
      const nm = r.items?.name || r.item_name || '?'
      const cat = itemCatMap[r.item_id]||''
      itemsInStock.add(nm)
      const target = cat==='meat_trim' ? 'SCRAP' : wh
      if(!byWhGroups[target][nm]) byWhGroups[target][nm]={count:0,kg:0,lots:new Set(),bags:[],outOfStock:false}
      byWhGroups[target][nm].count++
      byWhGroups[target][nm].kg+=(parseFloat(r.weight_g)||0)/1000
      if(r.lot_date) byWhGroups[target][nm].lots.add(r.lot_date.split('T')[0])
      byWhGroups[target][nm].bags.push(r)
    })

    // 0-stock: MT- (cooked/portion) และ SP- ที่เป็นเนื้อ (raw cuts เช่น สะโพกก้อน พิคานย่า)
    const MEAT_CATS=['meat','meat_raw','meat_fresh','meat_cooked','meat_portioned','meat_other']
    items.filter(it=>it.sku&&(it.sku.startsWith('MT')||it.sku.startsWith('SP-'))&&MEAT_CATS.includes(it.category)).forEach(it=>{
      if(!it.name||itemsInStock.has(it.name)) return
      if(it.category==='meat_trim'){
        if(!byWhGroups.SCRAP[it.name]) byWhGroups.SCRAP[it.name]={count:0,kg:0,lots:new Set(),bags:[],outOfStock:true}
        return
      }
      if(!MEAT_CATS.includes(it.category)) return
      const wh=inferWh(it.name,it.category)
      if(!byWhGroups[wh][it.name]) byWhGroups[wh][it.name]={count:0,kg:0,lots:new Set(),bags:[],outOfStock:true}
    })

    // Store globally for expand/modal
    window._stockGrouped = Object.assign({}, byWhGroups.A, byWhGroups.B, byWhGroups.C, byWhGroups.SCRAP)

    const whMeta={
      A:{label:'เนื้อสด',icon:'🥩',color:'var(--blue)',bg:'var(--blue-bg)'},
      B:{label:'เนื้อตุ๋น',icon:'🫕',color:'var(--blue)',bg:'var(--blue-bg)'},
      C:{label:'เนื้อแพค',icon:'📦',color:'var(--blue)',bg:'var(--blue-bg)'},
      SCRAP:{label:'เศษ / By-products',icon:'🗂️',color:'var(--muted)',bg:'#f5f5f5'}
    }

    function renderWhSection(wh, grouped) {
      const entries=Object.entries(grouped).sort((a,b)=>{
        if(a[1].outOfStock!==b[1].outOfStock) return a[1].outOfStock?1:-1
        return b[1].kg-a[1].kg
      })
      if(!entries.length) return ''
      const meta=whMeta[wh]
      const inStockCount=entries.filter(([,d])=>!d.outOfStock).reduce((s,[,d])=>s+d.count,0)
      const outCount=entries.filter(([,d])=>d.outOfStock).length
      return `<tr style="background:${meta.bg}">
        <td colspan="4" style="font-weight:700;padding:8px 12px;font-size:.85rem;color:${meta.color}">
          ${meta.icon} ${meta.label}
          <span style="font-weight:400;color:var(--muted)">(${inStockCount} ถุง${outCount?' · ❌ หมด '+outCount+' รายการ':''})</span>
        </td></tr>`
      +entries.map(([name,d])=>d.outOfStock?`
        <tr style="opacity:.6">
          <td style="color:var(--muted)">${name}</td>
          <td></td>
          <td style="text-align:right;color:var(--muted)">0.000</td>
          <td><span class="badge badge-low">❌ หมด</span></td>
        </tr>`:`
        <tr class="stock-group-row" onclick="toggleStockExpand('${wh}','${name.replace(/'/g,"\\'")}')">
          <td>${name}</td>
          <td style="color:var(--muted);font-size:.8rem">${[...d.lots].map(fmtDate).join(', ')}</td>
          <td style="text-align:right;font-weight:600">${d.kg.toFixed(3)}</td>
          <td><span class="badge badge-ok">✅ ${d.count} ถุง</span></td>
        </tr>
        <tr class="stock-expand-row" id="expand-${wh}-${name.replace(/[^a-zA-Z0-9ก-๙]/g,'_')}" style="display:none">
          <td colspan="4">
            <div class="stock-bag-list">
              ${d.bags.sort((a,b)=>new Date(a.lot_date)-new Date(b.lot_date)).map(bag=>`
                <div class="stock-bag-item">
                  <span class="bag-cw">${bag.legacy_cw_row||'#'+String(bag.id).substring(0,6)}</span>
                  <span class="bag-lot">${bag.lot_date?fmtDate(bag.lot_date.split('T')[0]):''}</span>
                  <span class="bag-wt">${((parseFloat(bag.weight_g)||0)/1000).toFixed(3)} กก.</span>
                  <button class="btn-adj" onclick="event.stopPropagation();openTraceModal(${bag.id})" style="background:#E3F2FD;color:#1565C0;border:1px solid #90CAF9;margin-right:4px">🔍 ที่มา</button>
                  <button class="btn-adj" onclick="event.stopPropagation();openAdjModal(${JSON.stringify(bag).replace(/"/g,'&quot;')})">⚙️ ปรับยอด</button>
                </div>`).join('')}
            </div>
          </td>
        </tr>`).join('')
    }

    document.getElementById('stock-rows').innerHTML=
      renderWhSection('A',byWhGroups.A)+
      renderWhSection('B',byWhGroups.B)+
      renderWhSection('C',byWhGroups.C)+
      renderWhSection('SCRAP',byWhGroups.SCRAP)||
      '<tr><td colspan="4" class="loading">ไม่มีข้อมูล</td></tr>'

    // Yield summary
    const ysRows=Array.isArray(ys)?ys:[]
    document.getElementById('yield-rows').innerHTML=ysRows.map(r=>{
      const icon=r.yield_status==='OK'?'✅':r.yield_status==='LOW'?'🔴':'🟡'
      const cls=r.yield_status==='OK'?'badge-ok':r.yield_status==='LOW'?'badge-low':'badge-warn'
      const rng=`${r.yield_expected_min?.toFixed(0)||'?'}–${r.yield_expected_max?.toFixed(0)||'?'}%`
      return `<tr>
        <td>${r.item_name}</td>
        <td style="text-align:right;font-weight:600">${parseFloat(r.yield_pct).toFixed(1)}%</td>
        <td style="color:var(--muted);font-size:.8rem">${rng}</td>
        <td><span class="badge ${cls}">${icon} ${r.yield_status}</span></td>
      </tr>`
    }).join('')||'<tr><td colspan="4" class="loading">ไม่มีข้อมูล</td></tr>'

  } catch(e){
    console.error(e)
    document.getElementById('stock-rows').innerHTML = `<tr><td colspan="4" style="color:red;padding:12px">❌ โหลดสต๊อกไม่ได้: ${e.message}</td></tr>`
  }
}

// ── Stock expand ───────────────────────────────────────
// FIX 04/05 (T-EXPAND-DUPLICATE-ID): include warehouse in id key.
// Old code used id='expand-${name}' so item present in 2 warehouses (e.g. ชายโครงตุ๋น
// in WH B + WH C) collided · getElementById returned only the first row · clicking
// the second warehouse's row toggled the first (invisible to user).
function toggleStockExpand(wh, name) {
  const key = (wh ? wh + '-' : '') + name.replace(/[^a-zA-Z0-9ก-๙]/g,'_')
  const row = document.getElementById('expand-'+key)
  if (!row) return
  row.style.display = row.style.display==='none' ? 'table-row' : 'none'
}

// ── Trace modal (P4 Task 1-2) ──────────────────────────
async function openTraceModal(bagId) {
  showCookModal(`<div class="modal-box">
    <div class="modal-title">🔍 Trace — กำลังโหลด...</div>
    <div class="modal-actions"><button class="btn-cancel" onclick="closeCookModal()">ปิด</button></div>
  </div>`)

  try {
    const bagRows = await get('catch_weight', {
      select: 'id,item_id,weight_g,warehouse,status,legacy_cw_row,lot_date,cook_session_id,notes,source,created_at,items(name,category)',
      id: `eq.${bagId}`,
      limit: '1'
    })
    const bag = Array.isArray(bagRows) ? bagRows[0] : null
    if (!bag) throw new Error('ไม่พบถุง')

    const itemName = bag.items?.name || '—'
    const itemCat = bag.items?.category || ''
    const isCooked = itemCat === 'meat_cooked' || itemCat === 'meat_trim'
    const weightKg = (Number(bag.weight_g) || 0) / 1000
    const bagLabel = bag.legacy_cw_row || `#${String(bag.id).substring(0,6)}`

    let backwardHtml = ''
    let forwardHtml = ''

    // ── BACKWARD: raw source (if this is cooked with cook_session_id) ──
    if (bag.cook_session_id) {
      const sessRows = await get('cook_sessions', {
        select: 'id,session_date,shift,status,notes,created_at,cook_inputs(kg_raw,catch_weight_ids,items(name))',
        id: `eq.${bag.cook_session_id}`,
        limit: '1'
      })
      const sess = Array.isArray(sessRows) ? sessRows[0] : null
      if (sess) {
        const rawBagIds = (sess.cook_inputs?.[0]?.catch_weight_ids) || []
        let rawBagsHtml = ''
        if (rawBagIds.length > 0) {
          const rawBags = await get('catch_weight', {
            select: 'id,legacy_cw_row,weight_g,lot_date,source,notes,items(name)',
            id: `in.(${rawBagIds.join(',')})`
          })
          const rows = Array.isArray(rawBags) ? rawBags : []
          rawBagsHtml = rows.map(rb => `
            <div style="display:flex;justify-content:space-between;font-size:.82rem;padding:4px 0;border-bottom:1px dashed var(--border)">
              <span>${escHtml(rb.legacy_cw_row || '#' + String(rb.id).substring(0,6))} · ${escHtml(rb.items?.name || '—')}</span>
              <span>${((Number(rb.weight_g)||0)/1000).toFixed(3)} กก. · lot ${rb.lot_date ? rb.lot_date.split('T')[0] : '—'}</span>
            </div>
          `).join('')
        }
        const startedAt = sess.created_at ? new Date(sess.created_at) : null
        const startStr = startedAt ? `${startedAt.getDate().toString().padStart(2,'0')}/${(startedAt.getMonth()+1).toString().padStart(2,'0')}/${startedAt.getFullYear()} ${startedAt.getHours().toString().padStart(2,'0')}:${startedAt.getMinutes().toString().padStart(2,'0')}` : '—'
        backwardHtml = `
          <div class="cook-sec" style="background:#FFF3E0;border:1.5px solid #FFCC80">
            <div class="cook-sec-label" style="color:#E65100">⬅️ ที่มา (raw source)</div>
            <div style="font-size:.82rem;color:var(--muted);margin-bottom:4px">ตุ๋นเมื่อ: <b style="color:#333">${startStr}</b> · กะ${sess.shift || '—'}</div>
            ${rawBagsHtml || '<div style="color:var(--muted);font-size:.8rem">ไม่มีข้อมูล raw bags</div>'}
          </div>
        `
      }
    }

    // ── BACKWARD (repack/mix/kitchen): ไม่มี cook_session_id + ไม่มี session table ผูก proc flow นี้เลย
    // (repack_session_id ไม่เคยถูกเขียนค่าจริงในระบบ — ยืนยันแล้วว่าเป็น dead column)
    // Reconstruct ย้อนหลังจาก stock_movements: หา repack_consume/production_consume ที่เวลาใกล้เคียงกับตอนถุงนี้ถูกสร้าง
    // best-effort, ไม่ใช่ link ที่แน่นอน 100% — โชว์ทุก candidate ถ้าเจอมากกว่า 1 ไม่เดาเลือกให้
    if (!bag.cook_session_id && bag.source === 'web-process' && /\((repack|mix|kitchen)\)/.test(bag.notes || '') && bag.created_at) {
      try {
        const createdMs = new Date(bag.created_at).getTime()
        const winStart = new Date(createdMs - 120000).toISOString() // เผื่อ 2 นาทีก่อนหน้า (batch submit ใช้เวลาประมวลผล)
        const winEnd   = new Date(createdMs + 5000).toISOString()
        const isRepack = /\(repack\)/.test(bag.notes)
        // repack (แบ่งถุง) = SKU เดิม → filter item_id แม่นได้ · mix/kitchen = SKU เปลี่ยน → ค้นกว้างกว่า ไม่ filter item_id
        const mvUrl = `${SB}/rest/v1/stock_movements?select=ref_id,item_id,weight_g,occurred_at,movement_type`
          + `&movement_type=in.(repack_consume,production_consume)`
          + `&occurred_at=gte.${encodeURIComponent(winStart)}&occurred_at=lte.${encodeURIComponent(winEnd)}`
          + (isRepack ? `&item_id=eq.${bag.item_id}` : '')
          + `&order=occurred_at.desc&limit=20`
        const mvRes = await fetch(mvUrl, { headers: H })
        const candidates = mvRes.ok ? await mvRes.json() : []

        // sibling outputs จาก batch เดียวกัน (created_at ตรงเป๊ะ) — ใช้ช่วยกระทบยอดน้ำหนัก
        const siblings = await get('catch_weight', {
          select: 'id,weight_g,legacy_cw_row',
          created_at: `eq.${bag.created_at}`,
          item_id: `eq.${bag.item_id}`
        })
        const siblingList = Array.isArray(siblings) ? siblings : []
        const siblingTotalG = siblingList.reduce((s, r) => s + (Number(r.weight_g) || 0), 0)

        if (candidates.length > 0) {
          const refIds = [...new Set(candidates.map(c => c.ref_id))]
          const sourceBags = await get('catch_weight', {
            select: 'id,weight_g,lot_date,source,legacy_cw_row,items(name)',
            id: `in.(${refIds.join(',')})`
          })
          const srcById = {}
          ;(Array.isArray(sourceBags) ? sourceBags : []).forEach(s => { srcById[s.id] = s })

          const candRows = candidates.map(c => {
            const src = srcById[c.ref_id]
            if (!src) return ''
            const srcKg = ((Number(src.weight_g) || 0) / 1000).toFixed(3)
            const srcLot = src.lot_date ? fmtDate(src.lot_date.split('T')[0]) : '—'
            const label = src.legacy_cw_row || `#${String(src.id).substring(0,6)}`
            return `<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:4px 0;border-bottom:1px dashed var(--border)">
              <span>${escHtml(label)} · ${escHtml(src.items?.name || '—')} (${escHtml(src.source || '—')})</span>
              <span>${srcKg} กก. · รับเข้า ${srcLot}</span>
            </div>`
          }).filter(Boolean).join('')

          const siblingNote = siblingList.length > 1
            ? `<div style="font-size:.72rem;color:var(--muted);margin-top:4px">แบ่งเป็น ${siblingList.length} ถุงจากรอบเดียวกัน — รวม ${(siblingTotalG/1000).toFixed(3)} กก.</div>`
            : ''

          backwardHtml = `
            <div class="cook-sec" style="background:#FFF3E0;border:1.5px solid #FFCC80">
              <div class="cook-sec-label" style="color:#E65100">⬅️ ที่มา (reconstruct จาก stock_movements — best-effort${candidates.length > 1 ? `, พบ ${candidates.length} candidate` : ''})</div>
              ${candRows || '<div style="color:var(--muted);font-size:.8rem">หา source bag ไม่เจอ</div>'}
              ${siblingNote}
            </div>
          `
        } else {
          backwardHtml = `
            <div class="cook-sec" style="background:#f5f5f5">
              <div class="cook-sec-label">⬅️ ที่มา</div>
              <div style="font-size:.8rem;color:var(--muted)">ไม่พบ movement ต้นทางที่ match ได้ในช่วงเวลาใกล้เคียง (อาจเป็นข้อมูลเก่าก่อนมี tracking นี้)</div>
            </div>
          `
        }
      } catch(_) {}
    }

    // ── FORWARD: delivery (if bag is delivered or via delivery_lines) ──
    let deliveryInfo = null
    try {
      const dlUrl = `${SB}/rest/v1/delivery_lines?select=delivery_id,weight_g,deliveries(bill_no,date,branch,channel)&catch_weight_id=eq.${bag.id}&limit=5`
      const dlRes = await fetch(dlUrl, { headers: {...H, 'Accept-Profile': 'stock'} })
      if (dlRes.ok) {
        const dl = await dlRes.json()
        if (Array.isArray(dl) && dl.length > 0) deliveryInfo = dl[0]
      }
    } catch(_) {}

    if (deliveryInfo?.deliveries) {
      const d = deliveryInfo.deliveries
      forwardHtml = `
        <div class="cook-sec" style="background:#E8F5E9;border:1.5px solid #A5D6A7">
          <div class="cook-sec-label" style="color:#2E7D32">➡️ ปลายทาง (delivery)</div>
          <div style="font-size:.88rem"><b>${escHtml(d.bill_no || '—')}</b></div>
          <div style="font-size:.82rem;color:var(--muted);margin-top:3px">วันส่ง: ${d.date || '—'} · สาขา: ${escHtml(d.branch || '—')} · ช่องทาง: ${escHtml(d.channel || '—')}</div>
        </div>
      `
    } else if (bag.status === '🚚 Delivered' && bag.notes) {
      forwardHtml = `
        <div class="cook-sec" style="background:#E8F5E9;border:1.5px solid #A5D6A7">
          <div class="cook-sec-label" style="color:#2E7D32">➡️ ปลายทาง (delivery)</div>
          <div style="font-size:.82rem">${escHtml(bag.notes)}</div>
          <div style="font-size:.68rem;color:var(--muted);margin-top:3px">(จาก catch_weight.notes — ข้อมูลไม่อยู่ใน delivery_lines)</div>
        </div>
      `
    } else if (bag.status === '✅ In Stock') {
      forwardHtml = `
        <div class="cook-sec" style="background:#f5f5f5">
          <div class="cook-sec-label">➡️ ปลายทาง (delivery)</div>
          <div style="font-size:.82rem;color:var(--muted)">ยังอยู่ในสต๊อก — ยังไม่ส่งออก</div>
        </div>
      `
    } else {
      forwardHtml = `
        <div class="cook-sec" style="background:#f5f5f5">
          <div class="cook-sec-label">➡️ ปลายทาง (delivery)</div>
          <div style="font-size:.82rem;color:var(--muted)">สถานะ: ${escHtml(bag.status || '—')}</div>
        </div>
      `
    }

    // If this is raw (not cooked), show forward trace to any cook_sessions that consumed it
    let forwardCookHtml = ''
    if (!isCooked) {
      try {
        const ciRows = await get('cook_inputs', {
          select: 'session_id,catch_weight_ids,cook_sessions(id,session_date,shift,status,notes,created_at)',
          catch_weight_ids: `cs.{${bag.id}}`,
          limit: '5'
        })
        const ciList = Array.isArray(ciRows) ? ciRows : []
        if (ciList.length > 0) {
          const sessList = ciList.map(ci => {
            const s = ci.cook_sessions
            if (!s) return ''
            const dt = s.created_at ? new Date(s.created_at) : null
            const dtStr = dt ? `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}` : '—'
            return `<div style="font-size:.82rem;padding:4px 0;border-bottom:1px dashed var(--border)">
              <b>${escHtml(s.notes || s.id.substring(0,6))}</b> · ${dtStr} กะ${s.shift || '—'} · <span style="color:var(--muted)">${s.status}</span>
            </div>`
          }).join('')
          forwardCookHtml = `
            <div class="cook-sec" style="background:#E1F5FE;border:1.5px solid #81D4FA">
              <div class="cook-sec-label" style="color:#01579B">🔥 ใช้ตุ๋นใน</div>
              ${sessList}
            </div>
          `
        }
      } catch(_) {}
    }

    showCookModal(`<div class="modal-box">
      <div class="modal-title">🔍 Trace — ${escHtml(bagLabel)}</div>
      <div class="modal-sub">${escHtml(itemName)} · ${weightKg.toFixed(3)} กก. · ${escHtml(bag.status || '—')}</div>

      ${backwardHtml}
      ${forwardCookHtml}
      ${forwardHtml}

      <div class="modal-actions"><button class="btn-confirm" onclick="closeCookModal()">ปิด</button></div>
    </div>`)
  } catch(e) {
    showCookModal(`<div class="modal-box">
      <div class="modal-title">❌ Trace error</div>
      <div style="padding:12px;color:var(--red-light);font-size:.82rem">${escHtml(e.message)}</div>
      <div class="modal-actions"><button class="btn-cancel" onclick="closeCookModal()">ปิด</button></div>
    </div>`)
  }
}
