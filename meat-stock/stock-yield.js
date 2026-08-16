// meat-stock/stock-yield.js — สต๊อกปัจจุบัน: yield analytics panel (per-item yield %,
// alerts). Split from stock-view.js (step 10). Called by loadStock (stock-view.js).

async function loadYieldAnalytics() {
  const el = document.getElementById('ya-content')
  if (!el) return
  try {
    const tday = today()
    const end = new Date()
    const start30 = new Date(end.getTime() - 29 * 86400000)
    const startStr = `${start30.getFullYear()}-${(start30.getMonth()+1).toString().padStart(2,'0')}-${start30.getDate().toString().padStart(2,'0')}`

    const rows = await get('v_cost_per_bag', {
      select: 'prod_date,item_id,item_name,raw_item_name,raw_kg,cooked_kg,yield_pct,bag_count,material_cost_per_bag',
      prod_date: `gte.${startStr}`,
      order: 'prod_date.desc',
      limit: '500'
    })
    const data = Array.isArray(rows) ? rows : []

    if (data.length === 0) {
      el.innerHTML = '<div style="padding:14px;color:var(--muted);font-size:.85rem">ยังไม่มีข้อมูลผลผลิตใน 30 วันล่าสุด</div>'
      return
    }

    // Today KPI
    const todayRows = data.filter(r => r.prod_date === tday)
    const todayRawKg = todayRows.reduce((s,r) => s + (Number(r.raw_kg)||0), 0)
    const todayCookedKg = todayRows.reduce((s,r) => s + (Number(r.cooked_kg)||0), 0)
    const todayYield = todayRawKg > 0 ? (todayCookedKg/todayRawKg*100) : null
    const todayBags = todayRows.reduce((s,r) => s + (Number(r.bag_count)||0), 0)
    const todaySessions = new Set(todayRows.map(r => `${r.prod_date}_${r.raw_item_name}`)).size

    // 7-day trend: daily aggregate
    const dayMap = {}
    data.forEach(r => {
      if (!dayMap[r.prod_date]) dayMap[r.prod_date] = { raw:0, cooked:0 }
      dayMap[r.prod_date].raw += Number(r.raw_kg) || 0
      dayMap[r.prod_date].cooked += Number(r.cooked_kg) || 0
    })
    const last7 = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end.getTime() - i * 86400000)
      const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`
      const m = dayMap[key]
      last7.push({
        date: key,
        label: `${d.getDate()}/${d.getMonth()+1}`,
        yieldPct: (m && m.raw > 0) ? (m.cooked/m.raw*100) : null
      })
    }
    const sparkMax = 100
    const sparkMin = 30
    const barsHtml = last7.map(d => {
      if (d.yieldPct == null) return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:28px">
        <div style="width:100%;height:1px;background:#e0e0e0"></div>
        <div style="font-size:.62rem;color:#bbb;margin-top:4px">${d.label}</div>
      </div>`
      const pctNorm = Math.max(0, Math.min(100, ((d.yieldPct - sparkMin) / (sparkMax - sparkMin)) * 100))
      const color = d.yieldPct < 50 ? '#c62828' : d.yieldPct < 70 ? '#f57f17' : '#2e7d32'
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:28px">
        <div style="font-size:.62rem;color:${color};font-weight:600;margin-bottom:2px">${d.yieldPct.toFixed(0)}</div>
        <div style="width:80%;height:${Math.max(4, pctNorm * 0.6)}px;background:${color};border-radius:2px"></div>
        <div style="font-size:.62rem;color:var(--muted);margin-top:4px">${d.label}</div>
      </div>`
    }).join('')

    // Items ranking (30d avg)
    const itemMap = {}
    data.forEach(r => {
      if (!itemMap[r.item_name]) itemMap[r.item_name] = { raw:0, cooked:0, n:0 }
      itemMap[r.item_name].raw += Number(r.raw_kg) || 0
      itemMap[r.item_name].cooked += Number(r.cooked_kg) || 0
      itemMap[r.item_name].n++
    })
    const itemYields = Object.entries(itemMap)
      .map(([name, m]) => ({ name, yieldPct: m.raw > 0 ? (m.cooked/m.raw*100) : 0, n: m.n }))
      .filter(r => r.n >= 1)
      .sort((a,b) => b.yieldPct - a.yieldPct)
    const top3 = itemYields.slice(0, 3)
    const bot3 = itemYields.slice(-3).reverse()

    const alertThreshold = 94.5
    const alertItems = itemYields.filter(r => r.yieldPct < alertThreshold && r.yieldPct > 0)

    const fmtItemRow = (r, rank, isBad) => `<tr>
      <td style="padding:4px 8px;font-size:.82rem">${rank}</td>
      <td style="padding:4px 8px;font-size:.82rem">${escHtml(r.name)}</td>
      <td style="padding:4px 8px;text-align:right;font-weight:600;color:${isBad?'#c62828':'#2e7d32'};font-size:.85rem">${r.yieldPct.toFixed(1)}%</td>
      <td style="padding:4px 8px;text-align:right;color:var(--muted);font-size:.75rem">${r.n} หม้อ</td>
    </tr>`

    const todayYieldColor = todayYield == null ? '#9e9e9e' : todayYield < 50 ? '#c62828' : todayYield < 70 ? '#f57f17' : '#2e7d32'
    const todayYieldEmoji = todayYield == null ? '—' : todayYield < 50 ? '🔴' : todayYield < 70 ? '🟡' : '🟢'

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
        <div style="background:#f5f5f5;padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:.68rem;color:var(--muted)">วันนี้</div>
          <div style="font-size:1.4rem;font-weight:700;color:${todayYieldColor}">${todayYield == null ? '—' : todayYield.toFixed(1)+'%'}</div>
          <div style="font-size:.68rem;color:var(--muted)">${todayYieldEmoji} yield</div>
        </div>
        <div style="background:#f5f5f5;padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:.68rem;color:var(--muted)">Input วันนี้</div>
          <div style="font-size:1.4rem;font-weight:700">${todayRawKg.toFixed(1)}</div>
          <div style="font-size:.68rem;color:var(--muted)">กก. raw</div>
        </div>
        <div style="background:#f5f5f5;padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:.68rem;color:var(--muted)">Output วันนี้</div>
          <div style="font-size:1.4rem;font-weight:700">${todayCookedKg.toFixed(1)}</div>
          <div style="font-size:.68rem;color:var(--muted)">${todayBags} ถุง</div>
        </div>
      </div>

      <div style="margin-bottom:14px">
        <div style="font-size:.72rem;color:var(--muted);margin-bottom:6px">📊 7-day yield trend (%)</div>
        <div style="display:flex;gap:3px;align-items:flex-end;height:72px;background:#fafafa;padding:6px;border-radius:6px;border:1px solid #eee">
          ${barsHtml}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div>
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">🏆 Top 3 (30d)</div>
          <table style="width:100%;border-collapse:collapse"><tbody>
            ${top3.length ? top3.map((r,i) => fmtItemRow(r, `#${i+1}`, false)).join('') : '<tr><td style="padding:6px;color:var(--muted);font-size:.78rem">—</td></tr>'}
          </tbody></table>
        </div>
        <div>
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:4px">⚠️ Bottom 3 (30d)</div>
          <table style="width:100%;border-collapse:collapse"><tbody>
            ${bot3.length ? bot3.map((r,i) => fmtItemRow(r, `#${i+1}`, true)).join('') : '<tr><td style="padding:6px;color:var(--muted);font-size:.78rem">—</td></tr>'}
          </tbody></table>
        </div>
      </div>

      ${alertItems.length > 0 ? `
      <div style="background:#FFF3E0;border:1px solid #FFB74D;border-radius:6px;padding:10px;margin-top:10px">
        <div style="font-size:.78rem;font-weight:700;color:#E65100;margin-bottom:6px">🔔 ${alertItems.length} รายการ yield &lt; ${alertThreshold}% (30d)</div>
        <div style="font-size:.75rem;color:#BF360C">${alertItems.slice(0,5).map(r => `${escHtml(r.name)} ${r.yieldPct.toFixed(1)}%`).join(' · ')}</div>
      </div>` : ''}

      <div style="font-size:.68rem;color:var(--muted);margin-top:10px;text-align:right">sessions วันนี้: ${todaySessions} · ข้อมูล ${data.length} rows (30d)</div>
    `
  } catch(e) {
    el.innerHTML = `<div style="padding:14px;color:var(--red-light);font-size:.82rem">❌ โหลด yield analytics ไม่ได้: ${escHtml(e.message)}</div>`
  }
}
