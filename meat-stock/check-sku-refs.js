#!/usr/bin/env node
// SKU-reference drift guard.
//
// Every SKU hardcoded in the meat-stock maps (REPACK_MAP, SCRAP_MAP, PROC_OUTPUT_SKUS)
// must exist and be is_active=true in the item master. When a SKU is deactivated in the
// DB but a code map still points at it, the affected dropdown silently renders empty
// (root cause of the 2026-08-26 MT-054 → MT-040 merge bug). This check catches that class
// before it reaches production. Run it whenever an item SKU is deactivated/merged.
//
// Usage: node meat-stock/check-sku-refs.js   (needs network — reads the live item master)
// Exit 0 = clean, 1 = dead refs found, 2 = could not verify (network/parse).

const fs = require('node:fs')
const path = require('node:path')
const { REPACK_MAP, SCRAP_MAP } = require('./process-output.js')

const SB = 'https://emjqulzikpxorvpaaiww.supabase.co'
// public anon key (same one shipped in the client HTML). The guard reads the item master
// through public.v_active_skus — a minimal anon-readable (sku, is_active) projection added
// so the guard needs NO auth token or CI secret. items itself stays RLS-gated. On any fetch
// error the guard still fails closed (UNVERIFIED, exit 2) rather than a false all-clear.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtanF1bHppa3B4b3J2cGFhaXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTgzNDAsImV4cCI6MjA5MDYzNDM0MH0.BoslF10vIufPYucuHub_czSxzAhZ9u3nTDQjwgC7I5M'

// Collect every referenced SKU, tagged with where it came from (for a useful report).
function collectRefs() {
  const refs = []  // { sku, where }
  for (const [k, outs] of Object.entries(REPACK_MAP)) {
    refs.push({ sku: k, where: `REPACK_MAP input '${k}'` })
    ;(outs || []).forEach(o => refs.push({ sku: o, where: `REPACK_MAP['${k}'] output` }))
  }
  for (const [k, out] of Object.entries(SCRAP_MAP)) {
    refs.push({ sku: k, where: `SCRAP_MAP input '${k}'` })
    if (out) refs.push({ sku: out, where: `SCRAP_MAP['${k}'] trim` })
  }
  // PROC_OUTPUT_SKUS lives inline in index.html — extract the array-literal block.
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  const m = html.match(/PROC_OUTPUT_SKUS\s*=\s*\[([\s\S]*?)\]/)
  if (!m) throw new Error("could not find PROC_OUTPUT_SKUS array in index.html")
  const skus = [...m[1].matchAll(/'([A-Z]+-\d+)'/g)].map(x => x[1])
  skus.forEach(s => refs.push({ sku: s, where: 'PROC_OUTPUT_SKUS list' }))
  return refs
}

async function fetchItemMaster() {
  const res = await fetch(`${SB}/rest/v1/v_active_skus?select=sku,is_active`, {
    headers: { apikey: ANON, Authorization: 'Bearer ' + ANON }
  })
  if (!res.ok) throw new Error(`v_active_skus fetch ${res.status}: ${await res.text()}`)
  const rows = await res.json()
  if (rows.length >= 1000) console.warn('⚠️  item master hit the 1000-row cap — result may be truncated')
  const bySku = new Map()
  rows.forEach(r => bySku.set(r.sku, r.is_active))
  return bySku
}

async function main() {
  let refs, bySku
  try {
    refs = collectRefs()
    bySku = await fetchItemMaster()
  } catch (e) {
    console.error(`❌ ตรวจไม่ได้ (UNVERIFIED): ${e.message}`)
    process.exit(2)
  }

  const dead = []
  for (const r of refs) {
    if (!bySku.has(r.sku)) dead.push({ ...r, reason: 'ไม่มีใน item master' })
    else if (bySku.get(r.sku) === false) dead.push({ ...r, reason: 'is_active=false (ปิดแล้ว)' })
  }

  const uniqueRefs = new Set(refs.map(r => r.sku)).size
  if (dead.length === 0) {
    console.log(`✅ SKU-ref drift guard: สะอาด — ${uniqueRefs} SKU ใน map ทุกตัว active ใน item master`)
    process.exit(0)
  }
  console.error(`❌ SKU-ref drift guard: เจอ dead ref ${dead.length} จุด (ต้องแก้ map หรือเปิด SKU คืน):`)
  for (const d of dead) console.error(`   • ${d.sku} — ${d.reason}  @ ${d.where}`)
  process.exit(1)
}

main()
