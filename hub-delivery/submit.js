// hub-delivery/submit.js — submit delivery (saveDraftToCloud, submitDelivery),
// localStorage draft (save/clear + auto-save wiring), _hdToast/friendlyErr shared
// utils, _submitting/DRAFT_KEY state. Extracted from hub-delivery.html (split 6/6).

// ─── Submit ───────────────────────────────────────────────────────────────────
let _submitting = false

function _hdToast(msg, type) {
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:${type==='error'?'#c62828':'#2e7d32'};color:#fff;
    padding:10px 20px;border-radius:8px;font-size:.9rem;z-index:9999;max-width:90vw;text-align:center`
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3500)
}

function friendlyErr(msg) {
  if (msg.includes('42501') || msg.includes('403') || msg.includes('permission denied'))
    return 'ไม่มีสิทธิ์บันทึก — กรุณา login ใหม่แล้วลองอีกครั้ง'
  if (msg.includes('404')) return 'ไม่พบข้อมูล — กรุณารีเฟรชหน้าแล้วลองใหม่'
  // Strip raw JSON/code payload
  return msg.replace(/\s*—\s*\{.*\}[\s\S]*$/, '').replace(/\s*—\s*".*"$/, '')
}

async function saveDraftToCloud() {
  const date = document.getElementById('dl-date').value
  const bill = document.getElementById('dl-bill').value.trim()
  const dest = document.getElementById('dl-dest').value
  if (!date || !dest) { _hdToast('กรุณากรอกวันที่และปลายทางก่อน', 'error'); return }

  const meatLines = []
  Object.entries(meatSel).forEach(([n, s]) => {
    if (!s.itemId || s.selectedBags.size === 0) return
    const sel = document.getElementById(`mb-sku-${n}`)
    const name = sel?.options[sel?.selectedIndex]?.dataset?.name || ''
    s.selectedBags.forEach(id => {
      const b = bagCache[id]
      if (b) meatLines.push({ bag_id: id, item_id: s.itemId, name, weight_g: b.weight_g, lot_date: b.lot_date })
    })
  })

  const nmLines = []
  document.querySelectorAll('#nm-rows .nm-row-wrap').forEach(wrap => {
    const n = wrap.id.replace('nm-row-', '')
    const itemEl = document.getElementById(`nm-item-${n}`)
    const qtyEl  = document.getElementById(`nm-qty-${n}`)
    const unitEl = document.getElementById(`nm-unit-${n}`)
    if (!itemEl?.value) return
    const qty = parseFloat(qtyEl?.value) || 0
    if (qty <= 0) return
    const opt = itemEl.options[itemEl.selectedIndex]
    nmLines.push({ item_id: itemEl.value, name: opt?.dataset?.name || '', qty, unit: unitEl?.value || '' })
  })

  if (meatLines.length === 0 && nmLines.length === 0) {
    _hdToast('กรุณาเลือกถุงเนื้อหรือ Non-meat ก่อน', 'error'); return
  }

  const btn = document.getElementById('draft-btn')
  btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'

  try {
    const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
    const DH = { ...H, 'Authorization': 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
    const res = await fetch(`${SB}/rest/v1/delivery_drafts`, {
      method: 'POST',
      headers: { ...DH, Prefer: 'return=representation' },
      body: JSON.stringify([{
        bill_no: bill || null, branch: dest.includes('NT') ? 'NT' : dest.includes('FS') ? 'FS' : dest.includes('GB') ? 'GB' : dest,
        date, meat_lines: meatLines, nm_lines: nmLines,
        created_by: window.nntnCurrentUser || 'UNKNOWN', status: 'draft'
      }])
    })
    if (!res.ok) throw new Error(await res.text())
    _hdToast(`✅ บันทึก Draft แล้ว — ${meatLines.length} ถุง / ${nmLines.length} non-meat`)
  } catch(e) {
    _hdToast('❌ Draft ไม่สำเร็จ: ' + e.message, 'error')
  } finally {
    btn.disabled = false; btn.textContent = '💾 บันทึก Draft'
  }
}

async function submitDelivery() {
  if (_submitting) return
  const date = document.getElementById('dl-date').value
  const dest = document.getElementById('dl-dest').value
  const bill = document.getElementById('dl-bill').value.trim()

  if (!bill) { alert('กรุณาระบุเลขที่ใบนำส่ง'); return }
  if (!date) { alert('กรุณาเลือกวันที่ส่ง'); return }

  // (c) anti double-submit: claim the lock + disable the button BEFORE any async work
  //   (covers the draft-fetch + stock-guard await windows, not just the RPC). Every
  //   pre-RPC abort path below must call _release() so the lock never sticks.
  const btn = document.getElementById('submit-btn')
  _submitting = true
  btn.disabled = true
  const _release = () => { _submitting = false; btn.disabled = false }

  // Collect meat bags — if linked to a draft, refetch draft from DB as source of truth
  //   (prevents stale form vs draft desync when user edits draft in another tab)
  let allBagIds = []
  let nmOverride = null
  if (window._pendingDraftId) {
    try {
      const dTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
      const dH = { ...H, 'Authorization': 'Bearer ' + dTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
      const dRes = await fetch(`${SB}/rest/v1/delivery_drafts?id=eq.${window._pendingDraftId}&select=meat_lines,nm_lines`, { headers: dH })
      if (!dRes.ok) throw new Error('fetch draft failed')
      const dArr = await dRes.json()
      const fresh = dArr?.[0]
      if (!fresh) throw new Error('draft not found — may have been deleted')
      const draftBagIds = (fresh.meat_lines || []).map(m => String(m.bag_id))
      const formBagIds  = []
      Object.values(meatSel).forEach(s => s.selectedBags.forEach(id => formBagIds.push(String(id))))
      const draftSet = new Set(draftBagIds)
      const formSet  = new Set(formBagIds)
      const onlyForm  = formBagIds.filter(id => !draftSet.has(id))
      const onlyDraft = draftBagIds.filter(id => !formSet.has(id))
      if (onlyForm.length > 0 || onlyDraft.length > 0) {
        const lines = []
        if (onlyForm.length > 0)  lines.push(`• ในฟอร์มแต่ไม่อยู่ใน Draft (${onlyForm.length}): ${onlyForm.slice(0,10).join(', ')}${onlyForm.length>10?'…':''}`)
        if (onlyDraft.length > 0) lines.push(`• ใน Draft แต่ไม่อยู่ในฟอร์ม (${onlyDraft.length}): ${onlyDraft.slice(0,10).join(', ')}${onlyDraft.length>10?'…':''}`)
        const msg = `⚠️ Form กับ Draft ไม่ตรงกัน\n\n${lines.join('\n')}\n\n[ตกลง] = ใช้ Draft เป็นหลัก (ปลอดภัย · Draft คือสิ่งที่บันทึกไว้ล่าสุด)\n[ยกเลิก] = หยุด · ไปตรวจ Draft + Form เอง`
        if (!confirm(msg)) { _release(); return }
        // User chose draft → use draft as source + reload form to reflect
        allBagIds = draftBagIds.map(Number)
        nmOverride = fresh.nm_lines || null
        _hdToast(`✅ ใช้ Draft เป็นหลัก · ${draftBagIds.length} ถุง`)
      } else {
        // in sync — use draft's bag order but verified equal
        allBagIds = draftBagIds.map(Number)
      }
    } catch (e) {
      alert('❌ ตรวจ Draft ไม่สำเร็จ: ' + e.message + '\nยกเลิก submit เพื่อความปลอดภัย')
      _release(); return
    }
  } else {
    Object.values(meatSel).forEach(s => s.selectedBags.forEach(id => allBagIds.push(Number(id))))
  }
  // meat is optional — allow non-meat only delivery

  if (!checkMeatBagInvariant(allBagIds)) {
    const domChipCount = document.querySelectorAll('#meat-blocks .lot-chip.selected').length
    alert(`❌ ตรวจพบข้อมูลไม่ตรงกัน — หยุดส่งออกเพื่อความปลอดภัย\n\nถุงที่แสดงบนหน้าจอ: ${domChipCount} ถุง\nถุงที่กำลังจะส่งจริง: ${allBagIds.length} ถุง\n\nกรุณารีเฟรชหน้าแล้วเลือกถุงใหม่ (อย่าส่งออกจากสถานะนี้)`)
    _release(); return
  }

  // Collect + validate non-meat rows — ใช้ querySelectorAll แทน index loop
  const nmWithdrawals = []
  const overLimit = []
  document.querySelectorAll('#nm-rows .nm-row-wrap').forEach(wrap => {
    const n = wrap.id.replace('nm-row-', '')
    const itemEl = document.getElementById(`nm-item-${n}`)
    const qtyEl  = document.getElementById(`nm-qty-${n}`)
    const unitEl = document.getElementById(`nm-unit-${n}`)
    if (!itemEl?.value) return
    const qty = parseFloat(qtyEl?.value) || 0
    if (qty <= 0) return
    const opt    = itemEl.options[itemEl.selectedIndex]
    const sku    = opt?.dataset?.sku || ''
    const isMisc = sku.startsWith('MISC')
    const note   = document.getElementById(`nm-note-${n}`)?.value?.trim() || ''
    if (isMisc && !note) {
      overLimit.push(`• รายการพิเศษ: กรุณาระบุชื่อรายการ`)
      return
    }
    const name   = isMisc ? note : (opt?.dataset?.name || sku)
    const unit   = unitEl?.value || opt?.dataset?.unit || 'หน่วย'
    const avail  = isMisc ? null : (spStockBySku[sku] ?? 0)
    const chkNm  = window.nntnEnforceIntegerUnit(qty, unit, name)
    if (!chkNm.ok) { overLimit.push(chkNm.message); return }
    if (avail !== null && qty > avail) {
      overLimit.push(`• ${name}: เบิก ${qty} แต่มีอยู่ ${avail} ${unit}`)
    }
    nmWithdrawals.push({ item_id: itemEl.value, sku, name, unit, qty, avail, note: isMisc ? note : null })
  })

  if (overLimit.length > 0) {
    alert(`❌ เบิกเกินสต๊อก — ไม่สามารถส่งออกได้\n\n${overLimit.join('\n')}\n\nกรุณาแก้ไขจำนวนก่อน`)
    _release(); return
  }

  if (allBagIds.length === 0 && nmWithdrawals.length === 0) {
    alert('กรุณาเลือกถุงเนื้อ หรือเพิ่มรายการ Non-meat อย่างน้อย 1 รายการ')
    _release(); return
  }

  const bagCount = allBagIds.length
  const totalKg  = allBagIds.reduce((s, id) => s + (bagCache[id]?.weight_g || 0) / 1000, 0)
  const nmSummary = nmWithdrawals.length > 0
    ? `\nNon-meat: ${nmWithdrawals.length} รายการ`
    : ''
  if (!confirm(`ยืนยันส่งออก?\n\nบิล: ${bill}\nปลายทาง: ${dest}\nเนื้อ: ${bagCount} ถุง / ${totalKg.toFixed(3)} กก.${nmSummary}`)) {
    _logSubmit('hub_delivery.submit', 'cancel',
      { bill, dest, date, bag_count: bagCount, nm_count: nmWithdrawals.length },
      { ref_id: bill })
    _release(); return
  }

  // ── NM Stock Guard: re-fetch latest qty_on_hand ก่อน submit (กัน stale cache) ──
  if (nmWithdrawals.length > 0) {
    const nmSkus = [...new Set(nmWithdrawals.filter(w => !String(w.sku).startsWith('MISC')).map(w => w.sku))]
    if (nmSkus.length > 0) {
      const skuList = nmSkus.map(s => `"${s}"`).join(',')
      const stkRes = await fetch(`${SB}/rest/v1/v_stock_unified?sku=in.(${skuList})&select=sku,qty_on_hand`, { headers: H })
      if (stkRes.ok) {
        const fresh = await stkRes.json()
        const freshMap = {}
        fresh.forEach(r => { freshMap[r.sku] = parseFloat(r.qty_on_hand) || 0 })
        const nowOOS = nmWithdrawals.filter(w => !String(w.sku).startsWith('MISC') && w.qty > (freshMap[w.sku] ?? 0))
        if (nowOOS.length > 0) {
          alert(`❌ สต๊อกไม่พอ (เพิ่งถูกอัปเดต)\n\n${nowOOS.map(w => `• ${w.name}: เบิก ${w.qty} แต่มี ${freshMap[w.sku] ?? 0} ${w.unit}`).join('\n')}\n\nหน้าจะรีเฟรช`)
          location.reload()
          return
        }
      }
    }
  }

  // ── Stock Guard: ตรวจว่าทุกถุงยังเป็น In Stock อยู่จริง ──
  if (allBagIds.length > 0) {
    const checkIdList = allBagIds.map(id => `"${id}"`).join(',')
    const checkRes = await _fetchCatchWeightBatch(checkIdList, 'id,status', H)
    if (checkRes.ok) {
      const checkBags = await checkRes.json()
      const notInStock = checkBags.filter(b => b.status !== '✅ In Stock')
      if (notInStock.length > 0) {
        alert(`❌ ส่งออกไม่ได้\n\nพบ ${notInStock.length} ถุงที่ไม่ได้อยู่ใน In Stock (อาจถูกส่งออกไปแล้วโดย session อื่น)\n\nหน้าจะรีเฟรชเพื่อโหลดสต๊อกล่าสุด`)
        location.reload()
        return
      }
    }
  }

  // lock + btn.disabled already set at top of submitDelivery (anti double-submit)
  btn.textContent = '⏳ กำลังบันทึก...'

  const _auditPayload = {
    bill, dest, date,
    bag_count: bagCount,
    bag_ids:   allBagIds,
    nm_count:  nmWithdrawals.length,
    nm_skus:   nmWithdrawals.map(w => ({ sku: w.sku, qty: w.qty, unit: w.unit })),
    total_kg:  Number(totalKg.toFixed(3)),
    draft_id:  window._pendingDraftId || null
  }
  _logSubmit('hub_delivery.submit', 'attempt', _auditPayload, { ref_id: bill })

  // Once the RPC commits, the delivery is saved. Everything after that (banner, modal,
  // draft cleanup, redirect) is cosmetic — a throw there must NOT be reported as a submit
  // failure, or the user re-submits and creates a duplicate bill (see change-receipt
  // 2026-09-05: duplicate NT20260905-2 double-deducted stock).
  let _committed = false
  try {
    // Atomic RPC — deliveries + lines + catch_weight + stock_counts all-or-nothing
    const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
    const SH = { ...H, 'Authorization': 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
    // If draft-linked + override was chosen, use draft's nm_lines instead of form's
    const nmPayload = nmOverride
      ? nmOverride.map(w => ({
          item_id: w.item_id,
          qty:     w.qty,
          note:    w.note || null,
          is_misc: String(w.sku || '').startsWith('MISC'),
          avail:   w.avail ?? null
        }))
      : nmWithdrawals.map(w => ({
          item_id: w.item_id,
          qty:     w.qty,
          note:    w.note,
          is_misc: String(w.sku || '').startsWith('MISC'),
          avail:   w.avail
        }))
    const rpcRes = await fetch(`${SB}/rest/v1/rpc/submit_delivery`, {
      method: 'POST',
      headers: { ...SH, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_bill:     bill,
        p_branch:   dest.includes('NT') ? 'NT' : dest.includes('FS') ? 'FS' : dest.includes('GB') ? 'GB' : dest,
        p_date:     date,
        p_channel:  'hub-delivery',
        p_bag_ids:  allBagIds.map(id => Number(id)),
        p_nm_lines: nmPayload
      })
    })
    if (!rpcRes.ok) {
      const errText = await rpcRes.text()
      // Parse INSUFFICIENT_STOCK for specific SKU list (from check_stock_before_dispense trigger)
      // Format: "INSUFFICIENT_STOCK: <SKU> <name> — on hand <x>, trying to dispense <y>"
      if (errText.includes('INSUFFICIENT_STOCK')) {
        const matches = [...errText.matchAll(/INSUFFICIENT_STOCK: ([^—]+)— on hand ([\d.]+), trying to dispense ([\d.]+)/g)]
        const lines = matches.length > 0
          ? matches.map(m => `• ${m[1].trim()} — มี ${m[2]} เบิก ${m[3]}`).join('\n')
          : errText.split('INSUFFICIENT_STOCK:')[1]?.split('\\n')[0] || errText
        throw new Error(`❌ สต๊อกไม่พอ — เบิกเกินที่มี\n\n${lines}\n\nกรุณานับสต๊อกจริง + ปรับก่อนเบิก`)
      }
      // (b) P0001 "some bag IDs not found" — submit_delivery couldn't match one or more
      //   bag IDs to an In-Stock row (delivered/repacked by another session, or a stale
      //   draft submitted twice). Re-fetch the real status of the submitted bags, tell the
      //   user exactly which bag + its current status, then reload to clear the stale list.
      if (/bag ids? not found/i.test(errText) || errText.includes('some bag IDs')) {
        let detail = ''
        try {
          const idList = allBagIds.map(id => `"${id}"`).join(',')
          const sRes = await _fetchCatchWeightBatch(idList, 'id,bag_no,status', H)
          if (sRes.ok) {
            const rows = await sRes.json()
            const byId = {}; rows.forEach(r => { byId[String(r.id)] = r })
            const bad = allBagIds
              .map(id => byId[String(id)] || { id, bag_no: id, status: 'ไม่พบในระบบ' })
              .filter(r => r.status !== '✅ In Stock')
            if (bad.length > 0) {
              detail = '\n\n' + bad.map(r => `• ถุง #${r.bag_no ?? r.id} — สถานะ: ${r.status}`).join('\n')
            }
          }
        } catch (_) {}
        _logSubmit('hub_delivery.submit', 'fail', _auditPayload,
          { ref_id: bill, error_msg: 'P0001 some bag IDs not found' + detail })
        alert(`❌ ส่งออกไม่ได้ — ถุงบางถุงถูกส่งไปแล้ว / ไม่พร้อมส่ง${detail}\n\nหน้าจะรีเฟรชเพื่อโหลดสต๊อกล่าสุด แล้วลองใหม่อีกครั้ง`)
        location.reload()
        return
      }
      if (errText.includes('not In Stock') || errText.includes('Cannot deliver bag')) {
        throw new Error(`❌ DB ปฏิเสธ: มีถุงที่ไม่ได้อยู่ใน In Stock — รีเฟรชแล้วลองใหม่`)
      }
      if (errText.includes('duplicate key') && errText.includes('bill_no')) {
        throw new Error(`❌ เลขที่บิลนี้ซ้ำกับที่มีอยู่แล้ว — กรุณาเปลี่ยนเลขใบนำส่ง`)
      }
      throw new Error(`❌ บันทึกไม่สำเร็จ\nสาเหตุ: ${errText.slice(0, 300)}`)
    }

    // RPC committed on the server past this point — lock success so no post-success
    // throw can flip it back to a "failed" state that invites a duplicate re-submit.
    _committed = true

    _logSubmit('hub_delivery.submit', 'success', _auditPayload, { ref_id: bill })

    // Update local nm stock cache
    nmWithdrawals.forEach(w => {
      if (!String(w.sku || '').startsWith('MISC') && w.avail !== null) {
        spStockBySku[w.sku] = w.avail - w.qty
      }
    })

    btn.textContent = '✅ บันทึกแล้ว'

    // Reset history so next visit to tab fetches fresh data including this bill
    historyLoaded = false

    // Remove delivered bags from cwBags
    const deliveredSet = new Set(allBagIds)
    cwBags = cwBags.filter(b => !deliveredSet.has(String(b.id)))

    // Show success banner
    const nmLine = nmWithdrawals.length > 0
      ? ` | Non-meat <b>${nmWithdrawals.length} รายการ</b> อัปเดตสต๊อกแล้ว`
      : ''
    const successHtml = `<div class="success-banner">
      ✅ ส่งออกสำเร็จ! บิล: <b>${bill}</b> | ${dest}<br>
      เนื้อ <b>${bagCount} ถุง / ${totalKg.toFixed(3)} กก.</b>${nmLine}
    </div>`
    clearDraft()
    const _previewCard = document.getElementById('preview-card')
    if (_previewCard) _previewCard.insertAdjacentHTML('beforebegin', successHtml)
    else document.body.insertAdjacentHTML('afterbegin', successHtml)  // fallback: never let a null card throw
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // Submit-done modal + redirect to history (28/04 ไทน์ rule)
    if (window.nntnSubmitDone) {
      const nmDetail = nmWithdrawals.slice(0,4).map(w => `• ${w.name||w.sku} × ${w.qty}`).join('<br>')
      const nmMore = nmWithdrawals.length > 4 ? `<br>... และอีก ${nmWithdrawals.length-4} รายการ` : ''
      window.nntnSubmitDone({
        title: '🚚 ส่งออกสำเร็จ',
        summary: `บิล <strong>${bill}</strong> → ${dest}<br>เนื้อ <strong>${bagCount} ถุง</strong> · ${totalKg.toFixed(3)} กก.<br>${nmLine ? '<strong>'+nmWithdrawals.length+'</strong> รายการ non-meat:<br>'+nmDetail+nmMore : ''}`,
        eventType: 'delivery',
        delaySec: 4
      })
    }

    // B2 fix v2: delete ONLY the source draft by id (not by bill_no)
    // Reason: bill_no fallback was sweeping unrelated drafts (e.g., draft saved for tomorrow
    // with same bill_no got nuked when today's bill submitted). Trust _pendingDraftId only.
    // If state lost, leave orphan draft — user can clean manually via #drafts tab.
    if (window._pendingDraftId) {
      try {
        const freshTok = window.__nntnCurrentToken || localStorage.getItem('nntn_sb_token') || KEY
        const DH = { ...H, 'Authorization': 'Bearer ' + freshTok, 'Content-Profile': 'stock', 'Accept-Profile': 'stock' }
        await fetch(`${SB}/rest/v1/delivery_drafts?id=eq.${window._pendingDraftId}`, { method: 'DELETE', headers: DH })
        window._pendingDraftId = null
      } catch(_) {}
    }

    // Jump to history if this was from a draft
    if (window._pendingDraftId === null) {
      setTimeout(() => { historyLoaded = false; switchTab('history') }, 900)
    }

  } catch(e) {
    if (_committed) {
      // Delivery already committed — this is only a post-success UI error. Do NOT show ❌
      // or re-enable the button (that is what caused the duplicate re-submit). Refresh so
      // the user sees the real saved state.
      _logSubmit('hub_delivery.submit', 'post_success_ui_error', _auditPayload,
        { ref_id: bill, error_msg: String(e?.message || e).slice(0, 1000) })
      _hdToast('✅ บันทึกสำเร็จแล้ว — กำลังรีเฟรชหน้า', 'success')
      setTimeout(() => location.reload(), 1200)
      return
    }
    _logSubmit('hub_delivery.submit', 'fail', _auditPayload,
      { ref_id: bill, error_msg: String(e?.message || e).slice(0, 1000) })
    alert(`❌ บันทึกไม่สำเร็จ: ${friendlyErr(e.message)}`)
    btn.disabled = false
    btn.textContent = '🚛 บันทึกส่งออก'
  } finally {
    _submitting = false
  }
}

// ─── Draft (localStorage) ──────────────────────────────────────────────────────
const DRAFT_KEY = 'nntn_delivery_draft'

function saveDraft() {
  try {
    const draft = {
      ts:   Date.now(),
      date: document.getElementById('dl-date')?.value || '',
      dest: document.getElementById('dl-dest')?.value || '',
      bill: document.getElementById('dl-bill')?.value || '',
      meat: Object.entries(meatSel)
        .filter(([, s]) => s.itemId)
        .map(([, s]) => ({ itemId: s.itemId, bags: [...s.selectedBags] })),
      nm: []
    }
    document.querySelectorAll('#nm-rows .nm-row-wrap').forEach(wrap => {
      const n     = wrap.id.replace('nm-row-', '')
      const itemId = document.getElementById(`nm-item-${n}`)?.value
      const qty    = document.getElementById(`nm-qty-${n}`)?.value
      const unit   = document.getElementById(`nm-unit-${n}`)?.value
      const note = document.getElementById(`nm-note-${n}`)?.value || ''
      if (itemId) draft.nm.push({ itemId, qty: qty || '', unit: unit || '', note })
    })
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch(e) {}
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

// Auto-save on header changes
document.addEventListener('DOMContentLoaded', () => {
  ['dl-date','dl-bill'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', saveDraft)
  })
  document.getElementById('dl-dest')?.addEventListener('change', saveDraft)
  // Auto-save nm qty/unit via delegation
  document.getElementById('nm-rows')?.addEventListener('input', e => {
    if (e.target.matches('[id^="nm-qty-"],[id^="nm-unit-"]')) saveDraft()
  })
})
