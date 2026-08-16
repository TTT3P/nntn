// meat-stock/receive.js — รับเนื้อสด tab (add/remove/renumber rows, bag/sum calc, submit).
// Extracted from the inline script (monolith split · step 3). Classic <script src>,
// globals shared; uses items/recvItemCount + core.js helpers at call time.

function addRecvItem() {
  recvItemCount++
  const n = recvItemCount
  const rawItems = items.filter(i => i.category==='meat_raw' || i.category==='meat_fresh' || i.category==='meat' || (!i.category && !i.name.includes('ตุ๋น')))
  const opts = rawItems.map(i=>`<option value="${i.id}">${i.name}</option>`).join('')

  const div = document.createElement('div')
  div.className = 'card'; div.id = `recv-item-${n}`
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="card-title" style="margin:0">รายการที่ ${n}</div>
      ${n>1?`<button class="btn-danger" onclick="removeRecvItem(this)">✕</button>`:''}
    </div>
    <div class="row3">
      <div><label>ประเภทเนื้อ</label>
        <select onchange="updateRecvBags(${n})">${opts||'<option>โหลดไม่ได้</option>'}</select>
      </div>
      <div><label>วัน Lot</label><input type="date" value="${today()}" id="recv-lot-${n}"></div>
      <div><label>จำนวนถุง</label>
        <input type="number" id="recv-bags-${n}" min="1" value="1" oninput="updateRecvBags(${n})">
      </div>
    </div>
    <div id="recv-bag-rows-${n}"></div>
    <div class="sum-row">รวม: <b id="recv-sum-${n}">0.000</b> กก.</div>
  `
  document.getElementById('recv-items').appendChild(div)
  updateRecvBags(n)
  renumberRecvItems()
}

function removeRecvItem(btn) {
  btn.closest('.card').remove()
  renumberRecvItems()
}

function renumberRecvItems() {
  document.querySelectorAll('#recv-items .card').forEach((card, idx) => {
    const titleEl = card.querySelector('.card-title')
    if (titleEl) titleEl.textContent = `รายการที่ ${idx + 1}`
  })
}

function updateRecvBags(n) {
  const cnt = parseInt(document.getElementById(`recv-bags-${n}`)?.value) || 1
  const cont = document.getElementById(`recv-bag-rows-${n}`)
  if (!cont) return
  // Keep existing values
  const existing = []
  cont.querySelectorAll('input[type=number]').forEach(i => existing.push(i.value))
  cont.innerHTML = ''
  for (let i=1; i<=cnt; i++) {
    const row = document.createElement('div'); row.className='bag-row'
    row.innerHTML = `
      <div class="bag-no">${i}</div>
      <input type="number" placeholder="กรัม" min="1"
             value="${existing[i-1]||''}"
             oninput="updateRecvSum(${n})" style="text-align:right">
      <div class="bag-kg" id="recv-bkg-${n}-${i}">—</div>
      <div></div>
    `
    cont.appendChild(row)
  }
  updateRecvSum(n)
}

function updateRecvSum(n) {
  const cont = document.getElementById(`recv-bag-rows-${n}`)
  let total = 0
  cont.querySelectorAll('input[type=number]').forEach((inp, idx) => {
    const g = parseFloat(inp.value)||0
    const kg = g/1000
    total += kg
    const kgEl = document.getElementById(`recv-bkg-${n}-${idx+1}`)
    if (kgEl) {
      if (g <= 0) {
        kgEl.innerHTML = '—'
      } else if (g < 500) {
        kgEl.innerHTML = `<span style="color:#E65100;font-weight:700">${kg.toFixed(3)} กก. ⚠️ น้อยมาก</span>`
      } else {
        kgEl.textContent = kg.toFixed(3) + ' กก.'
        kgEl.style.color = ''
      }
    }
  })
  document.getElementById(`recv-sum-${n}`).textContent = total.toFixed(3)
}

async function submitReceive() {
  const date = document.getElementById('recv-date').value
  const bill = document.getElementById('recv-bill').value.trim()
  if (!date) { alert('กรุณาเลือกวันที่รับเข้า'); return }

  const rows = []
  const cards = document.querySelectorAll('#recv-items .card')
  for (const card of cards) {
    const sel   = card.querySelector('select')
    const lotEl = card.querySelector('input[type=date]')
    const bagInputs = card.querySelectorAll('.bag-row input[type=number]')
    if (!sel || !lotEl) continue
    const item_id = sel.value
    const lot_date = lotEl.value || date

    bagInputs.forEach((inp, idx) => {
      const g = parseFloat(inp.value)
      if (!g || g <= 0) return
      // UX #3: Weight unit sanity guards
      if (g < 50 && !confirm(`⚠️ ถุงที่ ${idx+1}: ${g} กรัม = ${(g/1000).toFixed(3)} กก. เบามากผิดปกติ\n\nน้องอาจกรอกเป็น "กก." โดยบังเอิญ? (5 กก. ต้องกรอก 5000)\n\nOK = บันทึกต่อ · Cancel = แก้ไข`)) return
      if (g > 15000 && !confirm(`⚠️ ถุงที่ ${idx+1}: ${g} กรัม = ${(g/1000).toFixed(3)} กก. หนักผิดปกติ\n\nยืนยัน? OK = บันทึก · Cancel = แก้ไข`)) return
      rows.push({
        item_id,
        lot_date,
        bag_no:       idx + 1,
        weight_g:     g,
        warehouse:    'A',
        status:       '✅ In Stock',
        date_recorded: date,
        notes:        bill || null,
        source:       'web-receive'
      })
    })
  }

  if (rows.length === 0) { alert('กรุณากรอกน้ำหนักอย่างน้อย 1 ถุง'); return }

  const btn = document.querySelector('#page-receive .btn-primary')
  btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'

  const res = await fetch(`${SB}/rest/v1/catch_weight`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify(rows)
  })

  btn.disabled = false; btn.textContent = '✅ บันทึกรับเนื้อสด'

  if (res.ok) {
    const total = rows.reduce((s,r) => s + r.weight_g, 0)
    document.getElementById('recv-items').innerHTML = ''
    recvItemCount = 0
    addRecvItem()
    loadStock()
    if (window.nntnSubmitDone) {
      window.nntnSubmitDone({
        title: '🥩 รับเนื้อสดสำเร็จ',
        summary: `บันทึก <strong>${rows.length} ถุง</strong> / ${(total/1000).toFixed(3)} กก.`,
        eventType: 'create_bag',
        delaySec: 3
      })
    } else { alert(`✅ บันทึกสำเร็จ ${rows.length} ถุง / ${(total/1000).toFixed(3)} กก.`) }
  } else {
    const err = await res.text()
    alert('❌ บันทึกไม่สำเร็จ: ' + err)
  }
}
