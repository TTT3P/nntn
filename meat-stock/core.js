// meat-stock/core.js — shared data-access + format helpers for the meat-stock page.
//
// Extracted verbatim from the page's inline <script> (monolith split · step 1).
// Loaded as a CLASSIC script (not a module) right before the inline script, so these
// bindings stay in the shared global scope — every tab keeps calling get()/getAll()/
// post()/countRows()/today()/fmtDate() exactly as before, no call-site changes.
// Must load AFTER auth.js, which patches window.fetch to inject the JWT.

const SB = 'https://emjqulzikpxorvpaaiww.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtanF1bHppa3B4b3J2cGFhaXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTgzNDAsImV4cCI6MjA5MDYzNDM0MH0.BoslF10vIufPYucuHub_czSxzAhZ9u3nTDQjwgC7I5M'
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const _rawGet = (path, params={}) =>
  fetch(`${SB}/rest/v1/${path}?${new URLSearchParams(params)}`, { headers: H }).then(r => r.json())

// Single-shot GET with a truncation guard: warns if the result exactly hits the
// requested limit (a silent-truncation smell). For loading a whole set, use getAll().
async function get(path, params={}) {
  const data = await _rawGet(path, params)
  if (Array.isArray(data) && params.limit && data.length === Number(params.limit)) {
    console.warn(`[nntn] get('${path}') returned exactly limit=${params.limit} rows — likely truncated. Use getAll() for full-set loads.`)
  }
  return data
}

// Paginated GET: loops past PostgREST's ~1000-row cap until the whole set is loaded.
// Deterministic order (default id.asc) so offset paging never skips/dupes rows.
async function getAll(path, params={}, pageSize=1000) {
  const base = { ...params }
  delete base.limit; delete base.offset
  if (!base.order) base.order = 'id.asc'
  const out = []
  for (let offset = 0; ; offset += pageSize) {
    const page = await _rawGet(path, { ...base, limit: pageSize, offset })
    if (!Array.isArray(page)) throw new Error(`getAll('${path}'): ${page && page.message ? page.message : 'bad response'}`)
    out.push(...page)
    if (page.length < pageSize) break
  }
  return out
}

// Cheap server-side count(*) via PostgREST count=exact header (load-completeness checks).
async function countRows(path, params={}) {
  try {
    const res = await fetch(`${SB}/rest/v1/${path}?${new URLSearchParams({ ...params, select:'id', limit:1 })}`,
      { headers: { ...H, Prefer:'count=exact' } })
    const total = (res.headers.get('content-range')||'').split('/')[1]
    return total ? Number(total) : null
  } catch { return null }
}

const post = (path, body) =>
  fetch(`${SB}/rest/v1/${path}`, { method: 'POST', headers: {...H, Prefer:'return=representation'}, body: JSON.stringify(body) })
  .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json(); })

function today() { return new Date().toISOString().split('T')[0] }
function fmtDate(d) { if(!d) return ''; const dt=new Date(d); return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()}` }
