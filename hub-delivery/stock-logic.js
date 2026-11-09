// stock-logic.js — pure decision logic for the hub-delivery bag pickers.
//
// These functions hold the reconciliation rules that the "page-load snapshot drift"
// and "short-ship substitute" bugs all lived in. They are PURE (no DOM, no network,
// no globals, no mutation of their inputs) so they can be unit-tested with `node --test`
// — the local verification seam the rest of Stock V1 lacks. The browser callers keep the
// side effects (network refetch, bagCache warming, alerts, DOM); this file only decides.
//
// Dual-mode: loaded as a classic <script src> it defines browser globals; required from
// node it exports the same functions. Keep it dependency-free.

// Swap one item's slice of the page-load cwBags snapshot for a freshly-fetched live set.
// Returns a NEW array; does not mutate cwBags. Bags of other items are untouched.
function mergeFreshBags(cwBags, itemId, freshBags) {
  return cwBags.filter(b => b.item_id !== itemId).concat(freshBags)
}

// Bags of `itemId` that are still selectable for a draft: right item, not already used
// in this draft. `usedIds` is any iterable of bag ids (compared as strings).
function availableDraftBags(bags, itemId, usedIds) {
  const used = new Set([...usedIds].map(String))
  return bags.filter(b => b.item_id === itemId && !used.has(String(b.id)))
}

// For each bag pruned from a draft (no longer In Stock), assign a same-item replacement
// from a fresh In-Stock pool. FEFO: `freshInStock` is assumed ordered oldest-lot-first,
// and each bag is handed out at most once. Bags already in `usedIds` (surviving draft
// lines) are never reused.
//
// Pure — returns the decisions; the caller applies them:
//   additions  → objects ready to push into meat_lines
//   swapped    → { from, to, name, bag } for the review alert + bagCache warming
//   stillGone  → pruned bags with no available replacement (dropped from the note)
function reconcileSubstitutes(prunedBags, freshInStock, usedIds) {
  const used = new Set([...usedIds].map(String))
  const poolByItem = {}
  for (const b of (freshInStock || [])) {
    if (used.has(String(b.id))) continue   // already committed to this draft
    ;(poolByItem[String(b.item_id)] = poolByItem[String(b.item_id)] || []).push(b)
  }
  const additions = [], swapped = [], stillGone = []
  for (const p of (prunedBags || [])) {
    const repl = (poolByItem[String(p.item_id)] || []).shift()   // FEFO oldest; remove to avoid double-assign
    if (repl) {
      used.add(String(repl.id))
      additions.push({ item_id: p.item_id, bag_id: repl.id, name: p.name, weight_g: repl.weight_g, lot_date: repl.lot_date })
      swapped.push({ from: p.bag_id, to: repl.id, name: p.name, bag: repl })
    } else {
      stillGone.push(p)
    }
  }
  return { additions, swapped, stillGone }
}

// Idempotency fingerprint (issue #53): a stable string identifying "the same submit" so a
// lost-response retry of an identical payload reuses its key (server dedups), while any real
// change (bags/qty/dest/date) or a later deliberate re-delivery yields a different string and
// thus a fresh key. Order-independent for bags and nm lines.
function deliveryIdemFingerprint(dest, date, bagIds, nmLines) {
  const bags = (bagIds || []).map(Number).sort((a, b) => a - b)
  const nm = (nmLines || [])
    .map(w => `${w.item_id}:${w.qty}`)
    .sort()
  return JSON.stringify([dest || '', date || '', bags, nm])
}

// Duplicate-bag finder (2026-11-09 FS20261109-3: the same 2 bags were picked in two meat
// blocks of the same SKU → draft held 27 lines for 25 real bags → export blocked with an
// alert that only showed the two counts). `entries` = [{ bag_id, block }] in pick order;
// `block` is whatever label the caller shows staff (e.g. "รายการที่ 3", or null for a
// draft line). Returns one row per bag id seen more than once, with every block it sits
// in (in order, repeats kept so "รายการที่ 3, รายการที่ 3" still reads as a duplicate).
function findDuplicateBags(entries) {
  const byId = new Map()
  for (const e of entries || []) {
    const id = String(e.bag_id)
    if (!byId.has(id)) byId.set(id, [])
    byId.get(id).push(e.block ?? null)
  }
  const dups = []
  for (const [bag_id, blocks] of byId) {
    if (blocks.length > 1) dups.push({ bag_id, count: blocks.length, blocks })
  }
  return dups
}

// Keep the first line of each bag id (order preserved). Lines are draft meat_lines
// ({ bag_id, ... }); bag_id may be a number or a string — compared as strings.
function dedupeBagLines(lines) {
  const seen = new Set()
  return (lines || []).filter(l => {
    const id = String(l.bag_id)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

// What differs between the bags staff see selected on screen and the bags about to be
// sent: ids only on screen, ids only in the send list (each list distinct, as strings).
function bagSetDiff(screenIds, sendIds) {
  const screen = new Set([...(screenIds || [])].map(String))
  const send = new Set([...(sendIds || [])].map(String))
  return {
    onlyScreen: [...screen].filter(id => !send.has(id)),
    onlySend: [...send].filter(id => !screen.has(id)),
  }
}

// dual-mode export: commonjs for `node --test`, harmless no-op in the browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergeFreshBags, availableDraftBags, reconcileSubstitutes, deliveryIdemFingerprint,
    findDuplicateBags, dedupeBagLines, bagSetDiff }
}
