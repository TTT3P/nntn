// meat-stock/stock-adjust.js — สต๊อกปัจจุบัน: loss/gain adjust modal (dir/type/reason,
// submit) + modal state (_adjBag/LOSS_REASONS/GAIN_REASONS). Split from stock.js.

// ── Modal state ─────────────────────────────────────────
let _adjBag = null, _adjDir = 'loss', _adjType = 'weight'

const LOSS_REASONS = ['เสีย','หาย','นับไม่ครบ','หมดอายุ','อื่นๆ']
const GAIN_REASONS = ['ดูดน้ำซุป','ถุงตกค้าง','แก้ไขข้อมูล','อื่นๆ']

function openAdjModal(bag) {
  _adjBag = bag
  _adjDir = 'loss'
  _adjType = 'weight'
  const nm = bag.items?.name || bag.item_name || '?'
  const cw = bag.legacy_cw_row || '#'+String(bag.id).substring(0,6)
  const lot = bag.lot_date ? fmtDate(bag.lot_date.split('T')[0]) : '?'
  const wt = ((parseFloat(bag.weight_g)||0)/1000).toFixed(3)
  document.getElementById('adj-bag-info').textContent = `${nm} | ${cw} | lot ${lot} | ${wt} กก.`
  setAdjDir('loss')
  setAdjType('weight')
  document.getElementById('adj-delta-g').value = ''
  document.getElementById('adj-note').value = ''
  document.getElementById('adj-modal').classList.add('open')
}

function closeAdjModal(e) {
  if (e && e.target !== document.getElementById('adj-modal')) return
  document.getElementById('adj-modal').classList.remove('open')
}

function setAdjDir(dir) {
  _adjDir = dir
  document.getElementById('adj-dir-loss').className = 'radio-btn' + (dir==='loss'?' selected-loss':'')
  document.getElementById('adj-dir-gain').className = 'radio-btn' + (dir==='gain'?' selected-gain':'')
  const reasons = dir==='loss' ? LOSS_REASONS : GAIN_REASONS
  document.getElementById('adj-reason-label').textContent = dir==='loss' ? 'เหตุผล (loss)' : 'เหตุผล (งอก)'
  document.getElementById('adj-reason-chips').innerHTML = reasons.map(r=>
    `<button class="reason-chip" onclick="toggleReason(this)">${r}</button>`
  ).join('')
}

function toggleReason(el) {
  document.querySelectorAll('#adj-reason-chips .reason-chip').forEach(c=>c.classList.remove('selected'))
  el.classList.add('selected')
}

function setAdjType(type) {
  _adjType = type
  document.getElementById('adjt-weight').className = 'adj-type-btn' + (type==='weight'?' selected':'')
  document.getElementById('adjt-remove').className = 'adj-type-btn' + (type==='remove'?' selected':'')
  document.getElementById('adj-weight-input').style.display = type==='weight' ? 'block' : 'none'
}

async function submitAdj() {
  if (!_adjBag) return
  const reason = document.querySelector('#adj-reason-chips .reason-chip.selected')?.textContent || ''
  if (!reason) { alert('เลือกเหตุผลก่อน'); return }
  const note = document.getElementById('adj-note').value.trim()
  const btn = document.querySelector('#adj-modal .btn-confirm')
  btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'

  try {
    let deltaG = 0
    let newStatus = null

    if (_adjType === 'remove') {
      newStatus = _adjDir === 'loss' ? 'lost' : 'adjusted'
      deltaG = _adjDir === 'loss' ? -(parseFloat(_adjBag.weight_g)||0) : (parseFloat(_adjBag.weight_g)||0)
    } else {
      const raw = parseFloat(document.getElementById('adj-delta-g').value)
      if (!raw || isNaN(raw)) { alert('ระบุน้ำหนักที่ปรับ'); btn.disabled=false; btn.textContent='✅ ยืนยันปรับยอด'; return }
      deltaG = _adjDir === 'loss' ? -Math.abs(raw) : Math.abs(raw)
    }

    // 1. (removed: stock_adjustments table doesn't exist · 28/04 bug fix)
    //    Audit trail comes from sm + cw status history instead.

    // 2. PATCH catch_weight ตาม adjType
    if (_adjType === 'remove') {
      // ตัดออก → ใช้ rpc_disposal (เพื่อ emit compensating sm + ตั้ง status=Disposed อัตโนมัติ)
      const dr = await fetch(`${SB}/rest/v1/rpc/rpc_disposal`, {
        method: 'POST',
        headers: {...H, 'Content-Type':'application/json'},
        body: JSON.stringify({
          p_actor: (window.nntnCurrentUser || 'UNKNOWN') + ' · adj-' + _adjDir,
          p_reason: reason + (note ? ' · ' + note : ''),
          p_cw_ids: [_adjBag.id]
        })
      })
      if (!dr.ok) throw new Error(`rpc_disposal: ${await dr.text()}`)
    } else {
      // ปรับน้ำหนัก → อัปเดต weight_g จริง
      const newWeightG = Math.max(0, (parseFloat(_adjBag.weight_g) || 0) + deltaG)
      const pr = await fetch(`${SB}/rest/v1/catch_weight?id=eq.${_adjBag.id}`, {
        method: 'PATCH',
        headers: {...H, Prefer:'return=minimal'},
        body: JSON.stringify({ weight_g: newWeightG })
      })
      if (!pr.ok) throw new Error(`PATCH weight: ${await pr.text()}`)
    }

    document.getElementById('adj-modal').classList.remove('open')
    await loadStock() // reload
    if (window.nntnSubmitDone) {
      window.nntnSubmitDone({
        title: '⚙️ ปรับยอดสำเร็จ',
        summary: `<strong>${_adjDir==='loss'?'ลด':'เพิ่ม'}</strong> ${Math.abs(deltaG)} g · เหตุ: ${reason}${note ? '<br>หมายเหตุ: '+note : ''}<br>ถุง #${_adjBag.id}`,
        eventType: _adjType === 'remove' ? 'dispense' : 'count',
        delaySec: 3
      })
    } else { alert(`✅ บันทึกแล้ว: ${_adjDir==='loss'?'ลด':'เพิ่ม'} ${Math.abs(deltaG)}g (${reason})`) }

  } catch(e) {
    console.error(e)
    alert('❌ เกิดข้อผิดพลาด: ' + e.message)
  } finally {
    btn.disabled=false; btn.textContent='✅ ยืนยันปรับยอด'
  }
}
