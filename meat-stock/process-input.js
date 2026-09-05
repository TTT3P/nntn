// meat-stock/process-input.js — แปรรูป: input rows/bag chips, sum/yield/scrap, submit.
// Split from process.js (step 9). Classic <script src>; state in process-output.js.

function addProcInput() {
  procInputCount++
  const n = procInputCount
  // Curated list: SKU หลัก + เศษเนื้อ (category=meat_trim)
  const MAIN_PROC_SKUS = ['MT-028','MT-004','MT-046','MT-019','MT-035','MT-059','SP-206','SP-101','SP-036','SP-037','SP-087','SP-020','SP-031','SP-038']  // MT-046 เพิ่ม 26/07 (route B input สำหรับ [75G]ชายโครงตุ๋น) · MT-059 น่องลายตุ๋น(หั่น) เพิ่ม 29/08 (input Lv.2 → 75G/150G)
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
  // ปกติ แปรรูป/แบ่งถุง = ไม่เพิ่มมวล → Output ≤ Input. แต่ ตุ๋น = ดูดน้ำ/น้ำซุป น้ำหนัก
  // เพิ่มเกิน 100% ได้จริง (05/09 TINE: เคส เศษน่องกรอบ → น่องกรอบตุ๋น). เดิม HARD BLOCK > 110%
  // ทำให้กระบวนการดูดน้ำทำงานไม่ได้ พนักงานติด. เปลี่ยนเป็น WARN + confirm: เตือนแรงให้เช็ค
  // ว่าเลือกถุงต้นทางครบไหม (เคส สามชั้นตุ๋น 14/08 ถุงใหม่ไม่โผล่ → เลือกไม่ครบ → yield เพี้ยน)
  // แล้วให้ยืนยันเองถ้าครบจริง. Trade-off: เปิดช่องให้กดข้ามได้อีกครั้ง — ต้องอาศัยพนักงานเช็ค.
  const _inKg  = inputBags.reduce((s,b) => s + (b.kg || 0), 0)
  const _outKg = outputRows.reduce((s,r) => s + r.weight_g/1000, 0)
               + scrapRows.reduce((s,r) => s + r.weight_g/1000, 0)
  const _yPct  = _inKg > 0 ? (_outKg / _inKg * 100) : 0
  if (_inKg > 0 && _yPct > 110) {
    if (!confirm(`⚠️ Output หนักกว่า Input — หลุดมาตรฐาน (Yield ${_yPct.toFixed(0)}%, ปกติ ≤ 110%)\n\n`
      + `Input (ถุงต้นทางที่เลือก): ${_inKg.toFixed(3)} กก. · ${inputBags.length} ถุง\n`
      + `Output (ผลผลิต + เศษ): ${_outKg.toFixed(3)} กก.\n\n`
      + `เช็คก่อน: เลือกถุงต้นทางครบทุกใบที่ใช้จริงหรือยัง?\n`
      + `• ยังไม่ครบ → กด Cancel แล้วเลือกให้ครบ (ถ้าถุงไม่โผล่ → แจ้ง admin)\n`
      + `• ครบแล้ว (เช่น ตุ๋นดูดน้ำ น้ำหนักเพิ่มจริง) → กด OK เพื่อยืนยันส่ง`)) return
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
