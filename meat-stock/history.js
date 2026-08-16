// meat-stock/history.js — ประวัติรับเนื้อ tab (loadHistory + PO group toggle).
// Extracted from the inline script (monolith split · step 2). Classic <script src>,
// globals shared; core.js helpers + page state (items/escHtml) resolved at call time.

async function loadHistory() {
  const list = document.getElementById('history-list')
  list.innerHTML = '<div class="loading">กำลังโหลด...</div>'
  try {
    const dateEl = document.getElementById('history-date')
    const filterDate = dateEl?.value || today()
    const rows = await get('catch_weight', {
      select: 'id,weight_g,lot_date,warehouse,status,notes,items(sku,name)',
      source: 'eq.web-receive',
      date_recorded: `eq.${filterDate}`,
      order: 'id.desc',
      limit: 200
    })
    if (!rows.length) {
      list.innerHTML = '<div style="text-align:center;color:var(--muted);padding:24px">ยังไม่มีรายการ</div>'
      return
    }

    // Group by notes (PO)
    const groups = {}
    const groupOrder = []
    rows.forEach(r => {
      const po = r.notes || '(ไม่มี PO)'
      if (!groups[po]) { groups[po] = { rows:[], date: r.lot_date }; groupOrder.push(po) }
      groups[po].rows.push(r)
    })

    list.innerHTML = groupOrder.map((po, gi) => {
      const g = groups[po]
      const totalKg = g.rows.reduce((s, r) => s + (r.weight_g||0), 0) / 1000
      const totalBags = g.rows.length

      // Group by SKU inside PO
      const skuMap = {}
      g.rows.forEach(r => {
        const sku = r.items?.sku || '?'
        if (!skuMap[sku]) skuMap[sku] = { name: r.items?.name||'', bags:0, kg:0, warn:false }
        skuMap[sku].bags++
        skuMap[sku].kg += (r.weight_g||0) / 1000
        if (r.weight_g < 100) skuMap[sku].warn = true
      })

      const skuRows = Object.entries(skuMap).map(([sku, s]) =>
        `<div class="po-sku-row">
          <span class="po-sku">${sku}</span>
          <span class="po-name">${s.name}</span>
          <span class="po-bags">${s.bags} ถุง</span>
          <span class="po-kg">${s.kg.toFixed(3)} กก.${s.warn?' ⚠️':''}</span>
        </div>`
      ).join('')

      return `
      <div class="po-group">
        <div class="po-header" onclick="togglePO(${gi})">
          <span class="po-toggle" id="po-toggle-${gi}">▶</span>
          <span class="po-title">${po}</span>
          <span class="po-meta">
            <span><b>${Object.keys(skuMap).length}</b> ชนิด</span>
            <span><b>${totalBags}</b> ถุง</span>
            <span><b>${totalKg.toFixed(3)}</b> กก.</span>
            <span>${fmtDate(g.date)}</span>
          </span>
        </div>
        <div class="po-body" id="po-body-${gi}">${skuRows}</div>
      </div>`
    }).join('')

    // Auto-open first group (วันนี้)
    togglePO(0)

  } catch(e) {
    list.innerHTML = `<div style="color:var(--red-light);padding:12px">โหลดไม่ได้: ${e.message}</div>`
  }
}

function togglePO(gi) {
  const header = document.querySelector(`#po-body-${gi}`)?.previousElementSibling
  const body   = document.getElementById(`po-body-${gi}`)
  const toggle = document.getElementById(`po-toggle-${gi}`)
  if (!body) return
  const open = body.classList.toggle('show')
  if (header) header.classList.toggle('open', open)
  if (toggle) toggle.textContent = open ? '▼' : '▶'
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b,i) =>
    b.classList.toggle('active', ['receive','produce','process','stock','history'][i]===name))
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.getElementById('page-'+name).classList.add('active')
  if(name==='stock')   loadStock()
  if(name==='produce') loadKanban()
  if(name==='process') {
    // Always refresh stock + initialize kitchen mode UI (onload doesn't auto-fire change event)
    loadStock().then(() => {
      onProcTypeChange()
      const procInputs = document.getElementById('proc-inputs')
      if (procInputs && procInputs.children.length === 0) {
        addProcInput()
      } else {
        procInputs?.querySelectorAll('select[id^="proc-item-sel-"]').forEach(sel => {
          if (sel.options.length <= 1) {
            procInputs.innerHTML = ''
            procInputCount = 0
            addProcInput()
          }
        })
      }
    })
  }
  if(name==='history') {
    const el = document.getElementById('history-date')
    if (el && !el.value) el.value = today()
    loadHistory()
  }
}
