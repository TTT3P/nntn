// Unit tests for the pure hub-delivery decision logic. Run: `node --test hub-delivery/`
// This is the local verification seam — no browser, no network, no Supabase.
const test = require('node:test')
const assert = require('node:assert/strict')
const { mergeFreshBags, availableDraftBags, reconcileSubstitutes } = require('./stock-logic')

const bag = (id, item, lot, g = 75) => ({ id, item_id: item, lot_date: lot, weight_g: g })

test('mergeFreshBags: swaps only the target item, keeps other items', () => {
  const snapshot = [bag(1, 'A', '2026-08-01'), bag(2, 'A', '2026-08-02'), bag(3, 'B', '2026-08-01')]
  const fresh = [bag(9, 'A', '2026-08-26')]
  const out = mergeFreshBags(snapshot, 'A', fresh)
  assert.deepEqual(out.map(b => b.id).sort(), [3, 9])          // stale A dropped, B kept, fresh A in
  assert.equal(out.some(b => b.item_id === 'B'), true)
})

test('mergeFreshBags: empty fresh clears a sold-out item; does not mutate input', () => {
  const snapshot = [bag(1, 'A', '2026-08-01'), bag(3, 'B', '2026-08-01')]
  const out = mergeFreshBags(snapshot, 'A', [])
  assert.deepEqual(out.map(b => b.id), [3])
  assert.equal(snapshot.length, 2)                              // original untouched
})

test('availableDraftBags: right item, excludes already-used (string/number safe)', () => {
  const bags = [bag(1, 'A', 'd'), bag(2, 'A', 'd'), bag(3, 'B', 'd')]
  const out = availableDraftBags(bags, 'A', new Set([1]))       // used id as NUMBER
  assert.deepEqual(out.map(b => b.id), [2])                     // #1 used, #3 wrong item
})

test('availableDraftBags: empty when everything used', () => {
  const bags = [bag(1, 'A', 'd')]
  assert.deepEqual(availableDraftBags(bags, 'A', ['1']), [])
})

test('reconcileSubstitutes REGRESSION: pruned bag gets a same-item replacement', () => {
  // 2026-08-26 short-ship: prune removed the delivered bag but never substituted one,
  // so the item silently vanished from the printed note while stock existed.
  const pruned = [{ item_id: 'MT', bag_id: 39, name: 'ลูกชิ้นเนื้อ' }]
  const fresh = [bag(20188, 'MT', '2026-08-25'), bag(20189, 'MT', '2026-08-25')]
  const r = reconcileSubstitutes(pruned, fresh, new Set())
  assert.equal(r.stillGone.length, 0)                          // no longer silently dropped
  assert.equal(r.additions.length, 1)
  assert.equal(r.additions[0].bag_id, 20188)                   // FEFO oldest of the pool
  assert.equal(r.swapped[0].from, 39)
  assert.equal(r.swapped[0].to, 20188)
})

test('reconcileSubstitutes: FEFO order and no double-assign across two pruned bags', () => {
  const pruned = [{ item_id: 'MT', bag_id: 1, name: 'x' }, { item_id: 'MT', bag_id: 2, name: 'x' }]
  const fresh = [bag(100, 'MT', '2026-08-20'), bag(101, 'MT', '2026-08-21')]   // asc = FEFO
  const r = reconcileSubstitutes(pruned, fresh, new Set())
  assert.deepEqual(r.additions.map(a => a.bag_id), [100, 101]) // each pruned gets a distinct bag
  assert.equal(r.stillGone.length, 0)
})

test('reconcileSubstitutes: skips a replacement already committed to the draft', () => {
  const pruned = [{ item_id: 'MT', bag_id: 1, name: 'x' }]
  const fresh = [bag(100, 'MT', '2026-08-20'), bag(101, 'MT', '2026-08-21')]
  const r = reconcileSubstitutes(pruned, fresh, new Set(['100']))  // 100 already used
  assert.equal(r.additions[0].bag_id, 101)                     // must skip 100
})

test('reconcileSubstitutes: no stock for that item -> stillGone, nothing added', () => {
  const pruned = [{ item_id: 'MT', bag_id: 1, name: 'x' }]
  const r = reconcileSubstitutes(pruned, [bag(100, 'OTHER', 'd')], new Set())
  assert.equal(r.additions.length, 0)
  assert.deepEqual(r.stillGone.map(p => p.bag_id), [1])
})

test('reconcileSubstitutes: mixed — one swapped, one gone; inputs not mutated', () => {
  const pruned = [{ item_id: 'A', bag_id: 1, name: 'a' }, { item_id: 'B', bag_id: 2, name: 'b' }]
  const fresh = [bag(100, 'A', 'd')]                           // only A has stock
  const r = reconcileSubstitutes(pruned, fresh, new Set())
  assert.deepEqual(r.swapped.map(s => s.to), [100])
  assert.deepEqual(r.stillGone.map(p => p.bag_id), [2])
  assert.equal(pruned.length, 2)                               // pure: originals intact
  assert.equal(fresh.length, 1)
})
