# Design Draft — แยก Kitchen SOT Validation Core ออกจาก Backend Adapter

สถานะ: **Proposed / design-only / ยังไม่อนุมัติ implementation**  
วันที่: 2026-08-08  
ผู้อ่านและผู้ตัดสิน: TINE และ implementation reviewer  
ความเสี่ยง: **R2 / สูง** เพราะผิดพลาดแล้วอาจทำให้ V4/V5 lineage, stale guard หรือ byte shape เสีย  
Decision ที่รองรับ: [Managed document gateway ADR draft](./2026-08-08-managed-document-gateway-adr-draft.md)

## 1. Outcome

ทำให้ invariant ของ Kitchen SOT อยู่ใน portable deep module เดียว ขณะที่ local filesystem และ managed document store เป็น adapters คนละตัวที่ใช้ behavior เดียวกัน

ผลที่ต้องได้เมื่อ refactor ได้รับอนุมัติในอนาคต:

- local pilot ทำงานและตอบ error เหมือนเดิม;
- managed backend ไม่ copy business validation ไปเขียนซ้ำ;
- V4 checksum, V5 transition, deterministic bytes และ stale guard ถูกทดสอบผ่าน interface เดียว;
- filesystem-specific path/lock/rename logic ไม่หลุดเข้า managed runtime;
- owner single-account identity gate และ kitchen-device access adapter สามารถเสียบเพิ่มโดยไม่แก้ domain validation และไม่ต้องสร้าง role model; kitchen session semantics ยังรอ D13

## 2. Current implementation facts

### 2.1 ของที่แยกอยู่แล้ว

- `src/domain/sot/kitchenSotDocument.ts` — parse document shape, mixed ID types, readiness และ summary
- `src/domain/sot/kitchenSotEdits.ts` — explicit edits, canonical key order และ V5 metadata
- `src/domain/sot/kitchenSotValidation.ts` — validate V4 → V5 และ V5 → V5 transition
- `src/domain/sot/kitchenSotTransport.ts` — endpoint paths และ request/response types
- `src/data/KitchenSotDraftClient.ts` — browser interface `load()/save()` และ HTTP response validation

โมดูลเหล่านี้ส่วนใหญ่ไม่พึ่ง filesystem และเป็นฐานของ portable core ได้

### 2.2 ของที่ยังรวมกันใน `dev/cookbookSotPlugin.ts`

ไฟล์เดียวรับผิดชอบหลายเรื่อง:

1. HTTP route/method dispatch และ status/error mapping;
2. request body limit และ `If-Match` parsing;
3. V4 path allowlist, symlink defense, manifest read และ checksum;
4. V5 file read, filesystem lock, atomic temporary write และ rename;
5. current-base selection และ stale precondition;
6. existing draft validation และ submitted transition validation;
7. deterministic JSON serialization และ SHA response

ข้อ 3–4 เป็น filesystem adapter implementation. ข้อ 5–7 เป็น behavior ที่ managed adapter ต้องใช้เหมือนกัน จึงควรอยู่หลัง seam กลาง ไม่ควร copy ไป Worker/Function ใหม่

## 3. Proposed module map

```text
React UI
  -> KitchenSotDraftClient interface                     existing seam
       -> HttpKitchenSotDraftClient adapter              browser transport
            -> owner or kitchen-view HTTP handler        fixed route/auth/body/status
                 -> KitchenSotGateway module             portable orchestration core
                      -> KitchenSotDocumentStore interface  persistence seam
                           -> FilesystemDocumentStore adapter
                           -> ManagedDocumentStore adapter
```

มีสอง adapters จริง — filesystem และ managed store — ดังนั้น persistence seam ไม่ใช่ abstraction สมมติ

### 3.1 `KitchenSotGateway` deep module

Interface ที่เสนอ:

```ts
interface KitchenSotGateway {
  readSource(): Promise<SotReadResponse>;
  readCurrentDraft(): Promise<SotReadResponse>;
  saveDraft(intent: SaveDraftIntent): Promise<SotSaveResponse>;
}

interface SaveDraftIntent {
  ifMatchSha256: string | null;
  bodyBaseSha256: string | null;
  document: unknown;
}
```

Interface มีเพียงสาม operations ตาม transport contract เดิม. Gateway implementation ซ่อน:

- parse submitted/existing documents;
- verify V4 frozen SHA/lineage;
- verify header/body preconditions;
- validate existing draft จาก fresh V4;
- validate submitted transition จาก current baseline;
- deterministic serialize `JSON.stringify(document, null, 2) + "\n"`;
- hash exact serialized bytes;
- request atomic compare-and-swap ผ่าน store;
- map core failures เป็น named error codes เดิม

HTTP handler ไม่ควรรู้ recipe schema หรือ filesystem path. Store ไม่ควรรู้ HTTP status หรือ Recipe Studio state

### 3.2 `KitchenSotDocumentStore` persistence seam

Interface ที่เสนอ:

```ts
interface StoredKitchenSotArtifact {
  bytes: Uint8Array;
  sha256: string;
}

interface CompareAndSwapDraft {
  expectedBaseSha256: string;
  nextBytes: Uint8Array;
  nextSha256: string;
}

type CompareAndSwapResult =
  | { kind: "saved"; stored: StoredKitchenSotArtifact }
  | { kind: "stale" };

interface KitchenSotDocumentStore {
  readFrozenSource(): Promise<StoredKitchenSotArtifact>;
  readCurrentDraft(): Promise<StoredKitchenSotArtifact | null>;
  compareAndSwapDraft(command: CompareAndSwapDraft): Promise<CompareAndSwapResult>;
}
```

Store interface ไม่รับ parsed object เพื่อป้องกัน adapter reserialize เอง. Exact bytes และ SHA เป็น persistence contract

`readFrozenSource()` ไม่มี write counterpart. การ seed/import V4 เป็น migration operation แยกจาก runtime interface

`compareAndSwapDraft()` ต้อง atomic. ห้ามทำ `read -> compare -> unconditional write` ใน adapter เพราะสอง request อาจผ่านพร้อมกัน

### 3.3 HTTP adapter

HTTP adapter รับผิดชอบเฉพาะ:

- exact route และ method allowlist;
- request-size limit;
- parse `If-Match` syntax;
- ตรวจ owner single-account identity ของ TINE หรือ kitchen-device credential ตาม fixed surface;
- owner surface อนุญาต GET/PUT ส่วน kitchen view surface มีเฉพาะ GET และตอบ `METHOD_NOT_ALLOWED` เมื่อ PUT;
- เรียก gateway;
- map named error เป็น status และ `{ code }`;
- ไม่ส่ง internal path, stack, document body หรือ provider error ให้ browser

Error contract ที่ต้องรักษา:

| Code | HTTP | ความหมาย |
|---|---:|---|
| `DRAFT_NOT_FOUND` | 404 | ยังไม่มี V5 current |
| `METHOD_NOT_ALLOWED` | 405 | method ไม่อยู่ใน exact-route contract |
| `SOURCE_CHECKSUM_MISMATCH` | 409 | V4 bytes ไม่ตรง frozen SHA |
| `STALE_DRAFT` | 409 | current SHA ไม่ตรง baseline |
| `PAYLOAD_TOO_LARGE` | 413 | body เกิน limit |
| `INVALID_DRAFT` | 422 | parse, lineage หรือ transition ไม่ผ่าน |
| `PRECONDITION_REQUIRED` | 428 | ขาด header/body precondition |
| `WRITE_FAILED` | 500 | persistence ล้มและไม่ยืนยันว่าบันทึกสำเร็จ |

ไม่มี role lookup หรือ permission table. Identity provider อาจจัดการ unauthenticated redirect/401 ที่ edge; application contract เดิมยังใช้ `METHOD_NOT_ALLOWED` เพื่อ fail closed เมื่อ kitchen view surface ถูกเรียกด้วย PUT. Provider-specific auth response ต้องระบุหลัง D9 ปิด และ kitchen-device lifetime/renewal ต้องระบุหลัง D13 ปิด

### 3.4 Filesystem adapter

ย้าย behavior เดิมโดยไม่ลดความปลอดภัย:

- resolve เฉพาะ V4 manifest/source และ V5 draft path ที่อนุญาต;
- reject symlink/ancestor/path escape;
- read exact bytes;
- lock ข้าม handler instances;
- temporary file แบบ exclusive create;
- `fsync` แล้ว atomic rename;
- cleanup เฉพาะ temp/lock inode ที่ request เป็นเจ้าของ;
- compare current byte SHA ภายใน lock ก่อน write

Vite plugin เหลือเพียง wiring: สร้าง filesystem adapter + gateway + HTTP handler ใน `configureServer`

### 3.5 Managed adapter — design constraint เท่านั้น

Managed adapter ในอนาคตต้อง:

- อ่าน exact V4/V5 bytes จาก record แยก;
- ทำ conditional update ที่ระดับ datastore ด้วย `expectedBaseSha256`;
- ถือว่า affected rows ไม่เท่ากับ 1 คือ stale หรือ write failure ตามผลที่ datastore ยืนยันได้;
- ส่ง exact stored bytes/SHA กลับให้ gateway ตรวจ;
- ไม่มี V4 update/delete operation ใน runtime role;
- ไม่ log document bytes โดย default

Provider-specific schema, SQL, SDK และ auth integration ยังถูก block โดย D9; kitchen-device session configuration และ renewal ถูก block โดย D13

## 4. Data flow

### 4.1 Read V5

```text
HTTP GET V5
  -> verify TINE owner session or D13 kitchen-device session on the selected fixed surface
  -> store.readFrozenSource()
  -> gateway verifies exact V4 SHA and parses V4
  -> store.readCurrentDraft()
  -> if null: DRAFT_NOT_FOUND
  -> gateway parses V5 and validates V4 -> V5
  -> respond document + source lineage + current byte SHA
```

### 4.2 First save from V4

```text
HTTP PUT V5
  -> body/header preconditions
  -> read + verify V4
  -> no V5 current, so current base = V4 SHA
  -> parse submitted document
  -> validate V4 -> submitted V5
  -> deterministic serialize + SHA
  -> store.compareAndSwapDraft(expected = V4 SHA)
  -> return persisted bytes/SHA receipt
```

Store ต้องนิยาม first-write CAS โดยอะตอมมิก: บันทึกได้ต่อเมื่อ V5 ยังไม่มีและ expected SHA เท่ากับ V4 SHA

### 4.3 Subsequent save

```text
HTTP PUT V5
  -> read + verify V4 and current V5
  -> validate existing V4 -> current V5
  -> require If-Match == body base == current V5 byte SHA
  -> validate current V5 -> submitted V5
  -> deterministic serialize + SHA
  -> store CAS from current SHA to next bytes
  -> CAS stale => 409; CAS saved => receipt
```

## 5. Behavior-lock test map

### 5.1 Pure domain tests — ต้องผ่านโดยไม่แก้ expected behavior

| Test file | Behavior ที่ล็อก |
|---|---|
| `src/domain/sot/kitchenSotDocument.test.ts` | parse, mixed identity, readiness และ derived summary |
| `src/domain/sot/kitchenSotEdits.test.ts` | dirty edits, raw strings, canonical item/blocker order, metadata |
| `src/domain/sot/kitchenSotValidation.test.ts` | immutable fields, provenance, method/N/A, blocker history, transitive order, V4/V5 transition |

### 5.2 Browser client tests — interface เดิมต้องคง

`src/data/KitchenSotDraftClient.test.ts` ต้องล็อก:

- GET V5 ก่อนและ fallback V4 เฉพาะ `DRAFT_NOT_FOUND`;
- origin/source/base SHA validation;
- PUT ส่ง `If-Match` และ `base_sha256` ตรงกัน;
- response SHA ทุกค่าเป็น 64-hex;
- network/server failures ไม่รั่ว path หรือ response body

### 5.3 Gateway contract suite ใหม่ — เพิ่มเมื่อ coding ได้รับอนุมัติ

สร้าง reusable suite ที่รันกับ in-memory store และ filesystem adapter ก่อน แล้วรันกับ managed adapter ภายหลัง:

1. serve verified V4 และ V5-missing;
2. reject V4 checksum mismatch ทั้ง read และ save;
3. reject parseable-but-invalid existing V5;
4. reject missing/disagreeing preconditions โดยไม่ mutate store;
5. reject invalid transition โดยไม่ mutate store;
6. first save ใช้ V4 SHA เป็น expected base;
7. subsequent save ใช้ current V5 byte SHA;
8. two saves from one base: หนึ่ง saved หนึ่ง stale;
9. exact persisted bytes hash เท่ากับ response SHA;
10. optional field edit permutations produce byte-identical output;
11. store failure ไม่รายงาน success และ previous bytes ยัง authoritative;
12. V4 runtime interface ไม่มี write/delete operation

### 5.4 Filesystem-only tests — ห้ามย้ายไป generic suite แล้วลบทิ้ง

คง test ใน `dev/cookbookSotPlugin.test.ts` สำหรับ:

- hostile non-exact paths;
- symlinked V4/V5 directories และ ancestors;
- path allowlist;
- exclusive temp ownership;
- cross-handler lock serialization;
- live/stale/replaced lock ownership;
- rename failure และ byte-preserving rollback;
- cleanup ที่ไม่ลบ replacement file ของ process อื่น

เทสต์เหล่านี้พิสูจน์ filesystem adapter เท่านั้น ไม่ควรถูกบังคับให้ managed adapter เลียนแบบ filesystem

### 5.5 Provider/UI/E2E tests — ต้องผ่านหลัง refactor

| Test file / command | Claim |
|---|---|
| `src/features/review/KitchenSotDraftProvider.test.tsx` | loading/error/save/stale state และ canonical raw state |
| `tests/cookbook-draft-persistence.spec.ts` | reload persistence, Work/Print projection และ stale second page |
| `npm run test:e2e` | production-like preview surfaces ไม่ถอยหลัง |
| browser/PDF gates | A5/A4 page count, MediaBox, no clipping, no app UI |

E2E ทุกชุดต้องใช้ isolated store/vault. ห้ามชี้ real V5

## 6. Implementation waves หลังได้รับอนุมัติ coding

### Wave 0 — Evidence baseline

- บันทึก current test counts และ hashes
- รัน full sequential gate
- ยืนยัน V4 5/5 และ real V5 SHA โดย read-only

### Wave 1 — Portable core + in-memory contract

- เพิ่ม deterministic serializer/hash helper ที่ runtime-neutral
- เพิ่ม `KitchenSotGateway`
- เพิ่ม in-memory store เพื่อรัน gateway contract suite
- ไม่เปลี่ยน App, Vite routes หรือ filesystem persistence

### Wave 2 — Filesystem adapter replacement

- ย้าย path/lock/write logic หลัง `KitchenSotDocumentStore`
- ให้ Vite plugin wire modules ใหม่
- รัน generic contract + filesystem attack/race tests + full gates
- byte output ต้องตรง baseline

Wave 1–2 เป็น behavior-preserving refactor และเริ่มได้ทางเทคนิคโดยไม่รู้ identity provider แต่ **ยังต้องรอคำสั่ง coding แยกต่างหาก**

### Wave 3 — Managed adapter and production transport

ถูก block จน D9, D13 และ provider/account owner ชัดเจน:

- provider schema/resources;
- atomic managed CAS;
- single-account identity verification โดยไม่มี role model;
- kitchen-device credential/session lifetime และ renewal mechanism ตาม D13;
- owner GET/PUT surface และ kitchen GET-only surface;
- production config ที่ fail closed;
- isolated staging import

### Wave 4 — Migration, recovery and actual-device proof

ถูก block จน D10, D12 และ D13 ชัดเจน:

- exact V4/V5 import;
- backup/restore and rollback rehearsal;
- outage behavior;
- mobile/browser/PDF acceptance;
- independent verification;
- TINE staging demo และ deployment approval แยก

## 7. Work that must not begin now

- install provider SDK หรือเพิ่ม dependency;
- create Worker, database, Supabase project, domain, secret หรือ cloud account;
- add login UI/token storage;
- write provider-specific SQL/schema;
- change `App.tsx` production runtime selection;
- import/copy real V4/V5 ไป external system;
- deploy, commit หรือแก้ HANDOFF เป็น GO

## 8. Failure and rollback rules

- ทุก rejected save ต้อง leave-current-authoritative: current bytes/SHA ไม่เปลี่ยน
- ถ้า write outcome ไม่แน่ชัด ให้ fail closed และ reload current state ห้ามรายงาน saved
- refactor wave ใดทำ byte output ต่างจาก baseline ให้หยุดและ revert เฉพาะ wave นั้น
- ห้าม dual-write local + managed เพื่อ “กันพลาด”; ใช้ explicit single writer และ verified rollback artifact
- V4 checksum mismatch ปิดทั้ง read/save data path จนกู้ exact frozen bytes ไม่ใช่ repair/normalize ใน runtime

## 9. Acceptance for this design draft

เอกสารนี้พร้อมให้ TINE review เมื่อ:

1. current responsibilities และ proposed seams อ้างอิงไฟล์จริง;
2. portable core มี interface เล็กและซ่อน invariant ที่ adapters ต้องใช้ร่วมกัน;
3. filesystem-only defenses ไม่ถูกลดทอน;
4. managed adapter ไม่มี provider assumption ที่ยังไม่เคาะ และ access design ไม่มี role model;
5. test map ครอบ core, adapter, browser client, UI และ actual-app E2E;
6. start-now / wait-for-decision work แยกชัด;
7. ไม่มี implementation, commit, cloud mutation หรือ real-data mutation จากเอกสารนี้

## 10. Open review questions

คำถามเหล่านี้สำหรับ review หลัง TINE ตอบ D8–D10, D12 และ D13 ไม่ต้องตอบเพื่อเก็บเอกสาร draft:

1. provider ใดเป็นเจ้าของ identity gate, static assets, gateway และ datastore?
2. D13 กำหนด kitchen-device session lifetime เป็นเท่าใด และอุปกรณ์ต่ออายุอย่างไรโดยไม่ต้องมี TINE?
3. outage mode ต้องมี read-only cached snapshot หรือใช้เอกสารพิมพ์สำรอง?
4. provider ที่เลือกมี atomic conditional write และ exact byte storage แบบใด?
5. actual mobile/browser/printer matrix มีรุ่นใดบ้าง?

## 11. Non-authorization

Design draft นี้ไม่อนุมัติ implementation plan, code change, dependency, managed resource, auth, migration, deploy, commit หรือการแตะ V4/V5 จริง
