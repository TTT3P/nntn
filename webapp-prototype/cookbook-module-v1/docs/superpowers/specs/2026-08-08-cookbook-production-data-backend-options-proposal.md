# M6-PREP — ข้อเสนอทางเลือก Data Backend สำหรับ Cookbook ที่จะขึ้นใช้จริง

สถานะ: **รอ TINE ตัดสินใจ — ยังไม่อนุมัติ implementation หรือ deployment**  
วันที่: 2026-08-08  
ขอบเขต: Cookbook local pilot เท่านั้น  
นอกขอบเขต: Stock V1/V2, production Supabase เดิม, auth เดิม, deployment เดิม, MAW, CROO และ production data

ระดับความเสี่ยง: **R2 / สูง** เพราะทางเลือกถัดไปเกี่ยวข้องกับข้อมูลสูตรจริง, identity, network access, migration และ rollback แม้เอกสารรอบนี้จะไม่มี external mutation

ผู้อ่านและผู้ตัดสิน: **TINE**  
ขั้นถัดไปเพียงอย่างเดียว: ตอบคำถาม 12 ข้อในหัวข้อ 6 แล้วเลือกทาง A, B หรือ C  
เอกสารนี้ถือว่าเสร็จเมื่อ: TINE อ่านแล้วสามารถเลือกทิศทางหรือระบุข้อมูลที่ขาดได้โดยไม่ต้องย้อนอ่าน session ก่อนหน้า

## 1. สรุปสำหรับตัดสินใจ

Cookbook ตอนนี้ทำงานครบใน local pilot แต่ยังนำไฟล์ build ไปวางบนเว็บแล้วใช้ข้อมูลจริงไม่ได้ เพราะมีข้อจำกัดพร้อมกันสองชั้น:

1. endpoint อ่าน V4/V5 และบันทึก V5 ถูกสร้างโดย `configureServer` ของ Vite ซึ่งมีเฉพาะตอนรัน dev server;
2. production build ปิด `HttpKitchenSotDraftClient` ด้วย `import.meta.env.DEV` จึงกลับไปใช้ข้อมูล fixture/session-only แม้จะมี endpoint ภายนอกให้เรียกก็ตาม

GitHub Pages อย่างเดียวแก้ปัญหานี้ไม่ได้ เพราะเป็น static hosting สำหรับ HTML/CSS/JavaScript ไม่ใช่ write backend ([GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)).

ข้อเสนอมีสามทาง:

- **ทาง A — Private server บนเครื่องที่เปิดตลอดในร้าน:** ใกล้ระบบปัจจุบันที่สุดและรักษาไฟล์ V4/V5 แบบ byte-exact ได้ง่าย แต่ความพร้อมใช้ขึ้นกับเครื่อง ไฟ และอินเทอร์เน็ต/เครือข่ายร้าน
- **ทาง B — Managed document gateway แยกจาก V1 (แนะนำ):** static React app + serverless API + database ที่เก็บ V4/V5 เป็นเอกสารทั้งฉบับ เหมาะกับมือถือ หลายผู้ใช้ และยังใช้ได้เมื่อเครื่อง TINE ปิด โดยไม่ต้อง normalize สูตรหรือแตะ Stock V1
- **ทาง C — Separate managed Postgres/Supabase project:** รองรับ revision/audit และสิทธิ์ละเอียดในอนาคตได้มากที่สุด แต่งานและความเสี่ยงสูงเกินความจำเป็นสำหรับการทำ first draft ให้ครบในตอนนี้

**คำแนะนำเริ่มต้น:** เลือกทาง B โดยเก็บ V5 เป็น JSON document หนึ่งฉบับพร้อม SHA-256 ต่อไปก่อน ไม่แยก recipe/item เป็นหลายตารางในรอบนี้ และให้ environment ทั้งหมดแยกจาก Stock V1/V2 โดยเด็ดขาด

ถ้า TINE มีเครื่อง Mac mini/NAS/PC ที่เปิดตลอดอยู่แล้ว และยอมรับว่าเว็บใช้ได้เฉพาะผู้ที่อยู่ใน private network ทาง A เป็น pilot จริงที่เร็วกว่าได้ แต่ไม่ควรรันจาก laptop ของ TINE เพราะเมื่อปิดเครื่อง เว็บและข้อมูลจะหายจากการเข้าถึงทันที

## 2. ของจริงที่ระบบทำอยู่ตอนนี้

### 2.1 เส้นทางข้อมูล

```text
React UI
  -> KitchenSotDraftProvider
  -> KitchenSotDraftClient.load()/save()
  -> /__cookbook/v4 และ /__cookbook/v5-draft
  -> Vite configureServer middleware
  -> ~/tt3p/vault/nntn/Operations/CookBook/sot/...
```

ไฟล์สำคัญ:

- `src/data/KitchenSotDraftClient.ts` — interface ฝั่ง browser และ HTTP contract
- `src/features/review/KitchenSotDraftProvider.tsx` — canonical editable state, dirty state และ stale handling
- `dev/cookbookSotPlugin.ts` — checksum gate, transition validation, lock, atomic rename และ filesystem allowlist
- `vite.config.ts` — ผูก middleware กับ local vault
- `src/app/App.tsx` — เปิด data client เฉพาะ `import.meta.env.DEV`

### 2.2 Invariant ที่ผ่าน verification แล้วและต้องรักษา

- V4 เป็น source frozen แบบ byte-exact; backend ต้องไม่เปิด write route ให้ V4
- V4 ต้องผ่าน SHA-256 ก่อน serve หรือใช้เป็น baseline
- V5 ใช้ schema และ key order เดิม; ห้าม normalize, convert unit หรือ reconstruct จาก lossy projection
- ทุก save ต้องตรวจ `If-Match` และ `base_sha256`; stale writer ต้องได้ `409 STALE_DRAFT`
- transition validation ต้องเทียบ V4, V5 ก่อนหน้า และ V5 ใหม่
- write ต้องไม่ทำให้ผู้อ่านเห็นไฟล์/record ครึ่งฉบับ
- read/validation error ต้อง fail closed; ห้าม fallback ไป fixture แล้วแสดงว่าเป็นข้อมูลจริง
- Work, Print, Library, Detail และ Recipe Studio ต้องอ่าน raw-derived readiness เดียวกัน
- `cost_basis_text` ต้องไม่หลุดไปเอกสารครัว

### 2.3 Artifact ข้อมูล ณ วันที่เขียนข้อเสนอ

- V4 source SHA-256: `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`
- real V5 draft SHA-256: `2a715ce11bbc9cc58ce46bd89afc2b2d01dfaa7d91d92ced52beb9b605a7ce05`
- ปริมาณวัตถุดิบตัดสินครบ 126/126 รายการ
- สูตรพร้อมใช้ 11/18; blocker ที่เหลือเป็นวิธีทำ/ขั้นตอนครัว ไม่ใช่ backend defect

## 3. Seam ที่ควรรักษา

ไม่ควรให้หน้า React รู้ว่าเอกสารอยู่บน filesystem, D1 หรือ Postgres ให้รักษา interface เดิม:

```ts
interface KitchenSotDraftClient {
  load(): Promise<LoadedKitchenSotDraft>;
  save(document: KitchenSotDocument, baseSha256: string): Promise<SotSaveResponse>;
}
```

สิ่งที่เปลี่ยนตามทางเลือกคือ adapter หลัง HTTP endpoint เท่านั้น ส่วน edit logic, raw validation, readiness, Work และ Print ต้องไม่เปลี่ยนความหมาย

HTTP contract ควรคงเดิมเพื่อจำกัด blast radius:

- `GET /__cookbook/v5-draft`
- `GET /__cookbook/v4` เมื่อ V5 ยังไม่มี
- `PUT /__cookbook/v5-draft` พร้อม `If-Match` และ `base_sha256`
- error code เดิม เช่น `DRAFT_NOT_FOUND`, `SOURCE_CHECKSUM_MISMATCH`, `STALE_DRAFT`, `INVALID_DRAFT`

Production build ต้องเปลี่ยนจากการเช็ค `import.meta.env.DEV` เป็น explicit runtime/build configuration ที่ fail closed เช่น `local-filesystem`, `managed-api` หรือ `fixture-demo`; ห้าม production default ไป `fixture-demo` โดยเงียบ

## 4. ทางเลือก

### ทาง A — Private Cookbook server บนเครื่องที่เปิดตลอด

#### รูปแบบ

```text
มือถือ/แท็บเล็ตครัว
  -> private HTTPS/LAN
  -> Cookbook Node server บน Mac mini/NAS/PC ของร้าน
       -> serve dist/
       -> serve /__cookbook/*
       -> V4 frozen file + V5 draft file + backups
```

นำ request handler ออกจาก Vite plugin มาอยู่ใน production server adapter แล้วให้ Vite plugin เรียก adapter เดียวกันตอน dev ห้ามเปิด Vite dev server เป็น production server

การเข้าถึงแบบ private สามารถทำผ่าน LAN reverse proxy หรือ private overlay เช่น Tailscale Serve ซึ่ง proxy local service ผ่าน HTTPS ภายใน tailnet และใช้ access-control rules ของ tailnet ได้ ([Tailscale Serve documentation](https://tailscale.com/docs/features/tailscale-serve)). เครื่อง host ต้องออนไลน์อยู่เสมอ; เอกสาร Tailscale ระบุชัดว่าการเข้าถึง local service ผูกกับอุปกรณ์ที่รัน service อยู่

#### ผลต่อ V5 write path

- เปลี่ยนน้อยที่สุด: ใช้ exact file bytes, file lock, `If-Match`, validation และ atomic rename แบบปัจจุบัน
- หลายคนเปิดพร้อมกันได้ แต่ยังเป็น whole-document optimistic concurrency: คนที่ save ทีหลังบน baseline เก่าจะถูกปฏิเสธและต้อง reload/กรอกใหม่ ไม่มี automatic merge
- backup ควร copy V5 หลัง save สำเร็จไปยัง directory ที่ backend เขียนเพิ่มอย่างเดียว หรือระบบ backup ของเครื่อง โดยไม่เปลี่ยนไฟล์ current

#### ความปลอดภัยของ V4

- เก็บ V4 path เดิม read-only และตรวจ manifest เดิมก่อนทุก read/save
- service account ของ Cookbook ไม่มีสิทธิ์เขียน directory V4
- expose เฉพาะสอง endpoint เดิม; ไม่มี generic file endpoint

#### มือถือและความพร้อมใช้

- เปิดจากมือถือได้เมื่ออยู่ LAN/tailnet ที่กำหนด
- ถ้าใช้ tailnet ผู้ใช้/มือถือแต่ละเครื่องต้องถูกเพิ่มและควบคุมสิทธิ์
- ถ้า host ปิด, ไฟดับ หรือ service ตาย เว็บอ่าน/เขียนข้อมูลจริงไม่ได้
- ถ้ารันบน laptop TINE คำตอบของคำถาม “เครื่อง TINE ปิดแล้วยังใช้ได้ไหม” คือ **ไม่ได้**

#### งานโดยประมาณ

ขนาด **M — 4 ถึง 7 engineer-days** ไม่รวมการซื้อ/เตรียมเครื่อง:

1. แยก production handler ออกจาก Vite plugin โดยรักษา test เดิม
2. production client/config ที่ fail closed
3. static serving, SPA routing และ HTTPS/private access
4. service startup/restart, backup, logs และ health check
5. cross-device, concurrent-save, power/restart และ PDF acceptance

#### ข้อดี

- เปลี่ยน persistence semantics น้อยที่สุด
- V4 frozen และ V5 byte shape รักษาง่ายที่สุด
- ข้อมูลไม่ต้องออกจากอุปกรณ์ของร้าน
- ไม่มี migration database

#### ข้อเสีย

- ร้านต้องเป็นเจ้าของ uptime, backup, patching และ recovery
- single host เป็น single point of failure
- remote access และ onboarding มือถือมีงานปฏิบัติการ
- ไม่เหมาะถ้าไม่มีอุปกรณ์เปิดตลอด

### ทาง B — Managed document gateway แยกจาก V1 (แนะนำ)

#### รูปแบบตัวอย่าง

```text
มือถือ/แท็บเล็ต/คอม
  -> HTTPS + identity gate
  -> Cookbook Worker/API (separate project/domain)
       -> static React assets
       -> /__cookbook/* validation routes
       -> managed database
            v4_source: exact bytes + immutable SHA
            v5_current: exact bytes + current SHA
```

ตัวอย่าง platform คือ Cloudflare Worker + Static Assets + D1 แต่ architecture นี้ไม่ผูกขาด provider. Cloudflare รองรับการ deploy static assets และ Worker logic เป็น deployment unit เดียว และ route API ผ่าน Worker ก่อน static assets ได้ ([Workers Static Assets documentation](https://developers.cloudflare.com/workers/static-assets/)). D1 รองรับ prepared statements และ transactional batches; write ของเราควรใช้ conditional SQL update กับ SHA เดิมเพื่อให้ lost update กลายเป็น `STALE_DRAFT` ([D1 Database documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/)).

#### Data model ขั้นต่ำ — ยังไม่ใช่ revision system

```text
cookbook_documents
  document_key       'v4-source' | 'v5-current'
  document_bytes     exact UTF-8 JSON bytes
  sha256             SHA-256 of document_bytes
  source_sha256      V4 lineage SHA
  generated_at       timestamp from validated document
  updated_at         backend timestamp
  updated_by         authenticated identity
```

V4 row ถูก seed ครั้งเดียวจาก exact bytes และ backend ไม่มี update route. V5 ใช้ one-row conditional update:

```sql
UPDATE cookbook_documents
SET document_bytes = ?, sha256 = ?, updated_at = ?, updated_by = ?
WHERE document_key = 'v5-current' AND sha256 = ?;
```

ถ้า affected rows ไม่เท่ากับ 1 ให้ตอบ `409 STALE_DRAFT`. Backend ต้อง parse และรัน transition validation ก่อน conditional update ห้ามให้ browser เขียน database โดยข้าม validator

#### ผลต่อ V5 write path

- browser contract เดิมแทบทั้งหมด
- เปลี่ยน backend adapter จาก filesystem เป็น database
- stale guard ยังทำงานระดับเอกสารทั้งฉบับเหมือนเดิม; ยังไม่มี merge
- write เป็น conditional database update; ไม่ใช้ filesystem lock หรือ rename
- exact bytes/SHA ใน response ต้องเป็น bytes ที่ persist จริง ไม่ใช่ SHA ของ object ก่อน serialize

#### ความปลอดภัยของ V4

- V4 exact bytes อยู่ใน record แยกและไม่มี update/delete endpoint
- backend เทียบ SHA กับ expected frozen SHA ก่อน serve และก่อน validate V5
- migration gate ต้องพิสูจน์ว่า downloaded V4 bytes hash ตรง `09e5...f1d`
- ห้ามวาง V4/V5 เป็น public static asset ถ้าข้อมูลสูตรต้องจำกัดผู้เข้าถึง

#### มือถือและความพร้อมใช้

- เปิดจากมือถือผ่าน HTTPS ได้โดยไม่ขึ้นกับเครื่อง TINE
- ผู้ใช้หลายคนอ่านพร้อมกันได้; editor สองคน save ชนกันจะมีเพียงคนแรกผ่าน
- availability ขึ้นกับ managed provider และอินเทอร์เน็ตของร้าน
- ควรมีหน้า read-only cached/offline warning สำหรับเหตุขัดข้อง แต่ offline editing/merge ไม่ควรแอบรวมใน milestone นี้

#### Auth/authorization

ขั้นต่ำต้องมีสอง role:

- `viewer`: เปิด Library/Work/Print ได้ แต่ `PUT` ไม่ได้
- `editor`: ใช้ Recipe Studio และ `PUT` ได้

อาจเพิ่ม `owner/admin` ภายหลังสำหรับ user management แต่ห้ามให้ browser ถือ secret หรือ service credential. Identity gate ต้องป้องกันทั้ง static app และ API; backend ต้องตรวจ identity ซ้ำก่อน `PUT` ไม่ใช่อาศัยแค่ซ่อนปุ่ม

#### งานโดยประมาณ

ขนาด **L — 7 ถึง 12 engineer-days** หลัง TINE เลือก provider/account/auth:

1. แยก validation core ออกจาก Node filesystem adapter ให้รันบน managed runtime
2. schema/migration สำหรับ exact document bytes และ hashes
3. production client/config, auth gate และ role enforcement
4. V4/V5 byte-exact import + verification + rollback artifact
5. isolated CI/staging, concurrent-save and failure injection
6. mobile actual-app, PDF, restart/provider outage และ cutover rehearsal

#### ข้อดี

- ใช้ได้เมื่อเครื่อง TINE ปิด
- มือถือเข้าถึงง่ายกว่าและไม่ต้องดูแลเครื่อง server ในร้าน
- แยก static app/API/data เป็น environment ใหม่โดยไม่แตะ V1 ได้
- รักษา V5 document model เดิม; ไม่บังคับทำ revision/normalized schema ตอนนี้

#### ข้อเสีย

- ต้องเลือก provider, domain, account owner, identity และค่าใช้จ่าย
- validator ปัจจุบันใช้ Node/filesystem assumptions บางส่วน ต้องแยก core อย่างระวัง
- อินเทอร์เน็ตล่มจะเข้าข้อมูลจริงไม่ได้หากไม่มี read-only offline strategy
- operational ownership เปลี่ยนจาก “ไฟล์ใน vault” เป็น “cloud account + migration + backup”

### ทาง C — Separate managed Postgres/Supabase project

#### รูปแบบ

ใช้ project ใหม่ที่สร้างเพื่อ Cookbook เท่านั้น ห้ามใช้ project/schema/table/keys ของ Stock V1/V2. ระยะแรกยังเก็บ V4/V5 เป็น JSON/text document row ได้ แล้วค่อยออกแบบ revision tables เมื่อ first draft จบและ TINE เริ่มแก้สูตรจากการใช้งานจริง

Supabase รองรับ Postgres, Auth และ Row Level Security; เอกสารทางการกำหนดให้ table ใน exposed schema ต้องเปิด RLS และให้สิทธิ์เท่าที่จำเป็น ([Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security), [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)). Service-role credential ห้ามอยู่ใน browser

#### ผลต่อ V5 write path

- แบบปลอดภัยที่สุดคือให้ browser เรียก Edge Function/server endpoint ซึ่งรัน validator และ conditional update ไม่ให้ browser update JSON row ตรง
- ใช้ `WHERE sha256 = base_sha256` หรือ transaction/RPC เพื่อรักษา stale guard
- ถ้าเริ่ม normalize recipe/item ทันที จะขยาย migration, ordering, mixed ID, low-noise diff และ readiness risk มากเกิน first-draft scope

#### ความปลอดภัยของ V4

- separate immutable table/row, revoke update/delete จาก application roles
- exact byte column + frozen SHA; RLS อย่างเดียวไม่แทน checksum verification
- migrations และ service keys อยู่ใน separate repo/environment secrets

#### งานโดยประมาณ

ขนาด **XL — 12 ถึง 20 engineer-days** สำหรับ document-row version ที่มี auth/RLS/API/backup/cutover ครบ; มากกว่านี้ถ้ารวม revision history หรือ normalized ingredients:

1. separate project, schema, migrations, RLS, Auth และ secret ownership
2. validation function/adapter และ conditional concurrency
3. import/rollback/audit
4. production client, roles และ UI session handling
5. integration/security/restore/mobile/PDF verification

#### ข้อดี

- เหมาะกับ revision history, audit, reporting และ granular permissions ในอนาคต
- identity/RLS/database tooling อยู่ใน ecosystem เดียว
- ใช้ได้เมื่อเครื่อง TINE ปิด

#### ข้อเสีย

- งานและ security surface ใหญ่ที่สุด
- เสี่ยงกระทบ V1 สูงมากหากไม่แยก project/account/keys/CI อย่างเด็ดขาด
- ชวนให้รีบ normalize หรือทำ revision ก่อน first draft เสร็จ
- ต้องออกแบบ migration, rollback, RLS และ backup ก่อนแตะ production ใด ๆ

## 5. ตารางเปรียบเทียบ

| เกณฑ์ | A: เครื่องร้าน private | B: managed document gateway | C: separate Postgres |
|---|---|---|---|
| มือถือหน้าเตา | ได้ใน LAN/tailnet | ได้ผ่าน HTTPS | ได้ผ่าน HTTPS |
| ใช้เมื่อเครื่อง TINE ปิด | ได้เฉพาะถ้า host เป็นเครื่องอื่นที่เปิดตลอด | ได้ | ได้ |
| หลายคน save พร้อมกัน | stale guard ทั้งเอกสาร | atomic conditional update ทั้งเอกสาร | conditional update/transaction |
| automatic merge | ไม่มี | ไม่มี | ไม่มีจนกว่าจะออกแบบเพิ่ม |
| รักษา V4 byte-exact | ง่ายที่สุด | ได้ถ้าเก็บ exact bytes + SHA | ได้ถ้าเก็บ exact bytes + SHA |
| เปลี่ยน frontend | เล็ก | เล็กถึงกลาง | กลาง |
| งาน operations | ร้านดูแลเครื่อง/backup | ดูแล cloud account/config | ดูแล project/schema/RLS/migrations |
| ความเสี่ยงต่อ V1 | ต่ำถ้าแยก host/domain/repo | ต่ำถ้าแยก project/domain | สูงขึ้น; ต้องแยก Supabase project เด็ดขาด |
| ขนาดงาน | M: 4–7 วัน | L: 7–12 วัน | XL: 12–20 วัน |
| เหมาะกับตอนนี้ | ได้ถ้ามีเครื่องเปิดตลอด | **เหมาะสุด** | เก็บไว้เมื่อ revision/audit ชัด |

ตัวเลขเป็น engineering estimate คร่าว ๆ ไม่รวม procurement, vendor approval, domain/identity setup ที่รอ TINE หรือเวลารอ physical kitchen acceptance

## 6. สิ่งที่ TINE ต้องตัดสินใจก่อนเขียน implementation plan

ตอบทุกข้อเป็นลายลักษณ์อักษร:

1. **Backend path:** A, B หรือ C?
2. **Availability:** ต้องใช้ได้เมื่อเครื่อง/เน็ตของ TINE ปิดหรือไม่? ถ้าใช่ ทาง A ต้องมีเครื่องร้านที่เปิดตลอด
3. **Access area:** เฉพาะ Wi‑Fi ร้าน/private tailnet หรือเปิดผ่านอินเทอร์เน็ต?
4. **Hosting isolation:** ยืนยันว่าจะใช้ domain/project/repository/deploy pipeline แยกจาก Stock V1/V2 หรือไม่?
5. **ผู้ดู:** ใครบ้างที่เปิด Library, Work และ Print ได้?
6. **ผู้แก้:** ใครบ้างที่ใช้ Recipe Studio และบันทึก V5 ได้? ระยะแรกให้ TINE คนเดียวหรือมีหัวหน้าครัวด้วย?
7. **Identity:** ยอมรับการ login แบบใด—private-device membership, email one-time code, Google Workspace หรือบัญชีเฉพาะ?
8. **Conflict policy:** whole-document stale guard แบบปัจจุบันเพียงพอหรือจำเป็นต้อง merge รายสูตร? คำแนะนำรอบแรกคือคง stale guard และจำกัด editor
9. **Data owner:** ใครเป็นเจ้าของ cloud/device account, domain, secret, backup และการกู้คืน?
10. **Outage behavior:** เมื่อ backend/อินเทอร์เน็ตล่ม ให้ปิดทั้งแอป, เปิด read-only จาก snapshot ล่าสุด หรือมีเอกสารพิมพ์สำรอง?
11. **Revision boundary:** ยืนยันว่า milestone นี้เก็บ `v5-current` ฉบับเดียวก่อน และ revision history เป็น milestone หลัง first draft ครบ?
12. **Pilot devices:** Chrome บน Android/iPhone/iPad รุ่นใดบ้างที่ต้องผ่าน actual-device acceptance?

หากข้อ 1–7 ยังไม่ตอบ ห้ามเริ่ม backend implementation เพราะจะเปลี่ยน architecture, security และ operations คนละแบบ

## 7. ความเสี่ยงต่อของเดิมและวิธีแยก

### Stock V1/V2 production

ความเสี่ยงหลักไม่ใช่โค้ด Cookbook โดยตรง แต่คือใช้ infrastructure ร่วมแล้ว deploy/migrate ผิดเป้า:

- ห้ามใช้ Supabase project เดิม, schema เดิม, service keys เดิม หรือ migration pipeline เดิม
- ห้าม publish Cookbook เข้า branch/path ของ Stock V1 โดยยังไม่มี isolated rollback
- ห้ามแก้ shared auth/nav/domain cookies ของ V1 เพื่อให้ Cookbook login ได้
- ห้ามให้ Cookbook CI มี production credential ของ Stock
- ควรใช้ชื่อ project, domain, secret และ environment ที่ขึ้นต้น `cookbook-` ชัดเจน

### V4 frozen

- migration ต้องเริ่มจาก copy exact bytes; ห้าม parse แล้ว reserialize เพื่อสร้าง canonical cloud copy
- ก่อน cutover และหลัง restore ต้องตรวจ SHA-256 เทียบ frozen value
- backend ไม่มี V4 write/delete route
- application/editor role ไม่มี permission แก้ V4
- rollback ต้องคืนได้ทั้ง app version และ V5 current โดยไม่แตะ V4

### Real V5

- export exact V5 bytes + SHA ก่อน migration
- import ไป staging แล้ว compare SHA ก่อนเปิด app
- shadow read ต้องพิสูจน์ 18 recipes, readiness, blockers, candidate text และ PDF เท่ากับ local artifact
- ห้ามให้ automated tests ชี้ real production V5; ใช้ isolated database/namespace เท่านั้น
- ถ้า cutover fail ให้กลับ local pilot read/write path ได้โดยไม่เขียนสองที่พร้อมกัน

### Auth และข้อมูลสูตร

- ข้อมูลสูตรไม่ควรถูกวางเป็น public static JSON โดยไม่ได้ตัดสินใจเรื่องผู้เข้าถึง
- UI visibility ไม่ใช่ authorization; `PUT` ต้องตรวจ role ที่ backend
- secret/service credential ห้ามฝังใน Vite bundle
- logs ห้ามบันทึก full recipe document โดย default; บันทึก request ID, user, old/new SHA, timestamp และ result ก็พอ

## 8. Acceptance gate ก่อนขึ้นจริง

ไม่ว่าตัดสินใจทางใด ต้องผ่านอย่างน้อย:

1. production build อ่าน real backend จริง ไม่ใช่ fixture/session-only
2. มือถือที่ TINE ระบุเปิด Library, Work และ Print ได้
3. viewer ถูกปฏิเสธเมื่อ `PUT`; editor ที่ถูกต้อง save ได้
4. สองแท็บ/สองเครื่อง save จาก baseline เดียวกัน: หนึ่งผ่าน หนึ่งได้ `409 STALE_DRAFT`
5. V4 cloud/host bytes SHA ตรง frozen SHA และไม่มี write route
6. V5 ก่อน/หลัง migration SHA ตรงกัน; ไม่มี key reorder/normalize noise
7. restart host/provider แล้วอ่าน V5 เดิมได้
8. backup restore rehearsal คืน V5 ที่มี SHA ที่ระบุได้
9. Work/Print/Recipe Studio อ่าน 18 สูตรและ readiness เดียวกัน
10. A5/A4 PDF actual-app gates เขียว ไม่มี blank tail, clipping หรือ app UI
11. network/security test ยืนยันไม่มี request ไป Stock V1/V2, production Supabase เดิม, analytics หรือ external media
12. rollback rehearsal สำเร็จก่อน production cutover
13. independent verifier อนุมัติ artifact identity, migration evidence และ safety boundary
14. TINE อนุมัติ deployment แยกต่างหากหลังเห็น staging demo

## 9. ลำดับงานที่เสนอหลัง TINE เคาะ

นี่เป็นลำดับสำหรับวางแผนเท่านั้น ยังไม่อนุญาตให้ลงมือ:

1. เขียน architecture decision record จากคำตอบ 12 ข้อ
2. ทำ implementation plan และ threat/data-migration review
3. แยก validation core กับ backend adapter โดยล็อก behavior ด้วย test เดิม
4. สร้าง isolated staging environment ที่ไม่มี credential/route ของ V1
5. import exact V4/V5 bytes และพิสูจน์ hashes
6. รัน cross-device/concurrency/PDF/security/restore gates
7. staging demo ให้ TINE
8. ขอ deployment approval แยกต่างหาก
9. จำกัด editor ระยะแรก แล้วเก็บ feedback จากครัว
10. หลัง first draft ใช้จริงจึงออกแบบ revision history และ structural edit ops

## 10. ข้อเสนอคำตอบสั้นสำหรับ TINE

ถ้าต้องตัดสินใจเพียงทิศทางเดียวตอนนี้:

> เลือก **managed document gateway แยก project/domain จาก Stock V1/V2** เก็บ V4/V5 เป็น exact JSON document พร้อม SHA และใช้ stale guard เดิม ให้ครัวอ่าน/พิมพ์ได้แต่จำกัด editor ช่วงแรก ไม่ normalize สูตร ไม่ทำ revision และไม่แตะ production เดิม จนกว่า staging + migration + rollback จะผ่านและ TINE อนุมัติ deploy แยกอีกครั้ง

ถ้า TINE ต้องการ private-only และมีเครื่องที่เปิดตลอดในร้านอยู่แล้ว:

> เลือก **private Cookbook server บนเครื่องร้าน** เป็นขั้นกลาง โดยห้ามใช้ laptop TINE เป็น host ถ้าต้องการให้ครัวใช้ได้ตลอด และต้องยอมรับภาระ backup/uptime ของเครื่องร้าน

## 11. สิ่งที่เอกสารนี้ไม่ได้อนุมัติ

- ไม่อนุมัติ deploy หรือ publish
- ไม่อนุมัติสร้าง cloud/local backend
- ไม่อนุมัติสร้าง/แก้ Supabase project, table, RLS, Auth หรือ Storage
- ไม่อนุมัติแก้ Stock V1/V2 หรือ production data
- ไม่อนุมัติ commit M4/M5/M6
- ไม่อนุมัติ revision system หรือ structural recipe edit ops
- ไม่เปลี่ยนสถานะ V4/V5 หรือความพร้อมของสูตรใด
