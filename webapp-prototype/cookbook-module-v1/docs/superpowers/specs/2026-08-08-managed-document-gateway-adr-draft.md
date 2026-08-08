# ADR Draft — Managed Document Gateway สำหรับ Cookbook Production

สถานะ: **Partially accepted / D5–D7 ปิดแล้ว; D8–D10, D12 และ D13 ยังรอ**
วันที่: 2026-08-08  
ผู้ตัดสิน: TINE  
ความเสี่ยง: **R2 / สูง**  
ขอบเขต: Cookbook เท่านั้น  
เอกสารต้นทาง: [M6-PREP production backend options](./2026-08-08-cookbook-production-data-backend-options-proposal.md)

## 1. Decision summary

TINE เลือก **ทาง B — managed document gateway** สำหรับ Cookbook ที่จะขึ้นใช้จริง โดยมีผลตัดสินแล้วดังนี้:

1. ระบบต้องใช้ได้เมื่อเครื่องหรืออินเทอร์เน็ตส่วนตัวของ TINE ปิด;
2. ผู้ใช้เข้าแอปผ่าน HTTPS ไม่จำกัดเฉพาะ LAN;
3. project, domain, repository, deployment pipeline, credentials และข้อมูลต้องแยกจาก Stock V1/V2 โดยเด็ดขาด;
4. ระยะแรกเก็บ V4/V5 เป็นเอกสารทั้งฉบับ และมี `v5-current` เพียงฉบับเดียว;
5. revision history, automatic merge และการ normalize สูตรเป็นงานหลัง first draft ครบ ไม่รวมใน decision นี้;
6. ช่วงพัฒนาและตรวจรับ ผู้ดูและผู้แก้คือ **TINE คนเดียว**;
7. owner identity เป็น single-account gate ด้วยวิธีที่ง่ายที่สุดและยังปลอดภัย เช่น email one-time code;
8. **ห้ามสร้าง role/permission model ตอนนี้**; ออกแบบ seam ให้เพิ่มภายหลังได้ แต่ห้ามสร้าง role table, role editor หรือ policy engine รอไว้ก่อน;
9. การปล่อยใช้แบ่งเป็นสองจังหวะ: จังหวะ 1 ครัวอ่าน/พิมพ์เท่านั้น และจังหวะ 2 จึงเปิดให้พนักงานแก้เมื่อมี revision, structural edit ops และระบบสิทธิ์จริง

Decision นี้เลือก **รูปแบบสถาปัตยกรรมและ single-owner access** แล้ว แต่ยังไม่ได้เลือก provider/account owner, outage behavior หรือ actual-device matrix จึงยังไม่อนุญาตให้สร้าง backend หรือ deploy

### Artifact baseline ตอนรับ decision

- branch HEAD: `f1a8fa089a1fd1dfb6cd7ffb8d6775ffb9b77c20`
- tracked M4+M5 diff SHA-256: `84a83af50dc15937b59e3800ad1c2435e3c219dad8f3a000886dce05a5fd8e49`
- frozen V4 source SHA-256: `09e5d64dc54fcd2103769088310d9028fe8317b11243c70341574465ed246f1d`
- real V5 current SHA-256: `2a715ce11bbc9cc58ce46bd89afc2b2d01dfaa7d91d92ced52beb9b605a7ce05`

ค่าเหล่านี้เป็น read-only baseline สำหรับตรวจว่าเอกสารรอบนี้ไม่เปลี่ยน source หรือ draft จริง ไม่ใช่ migration approval

## 2. Context

Local pilot ปัจจุบันอ่านและเขียนข้อมูลผ่านเส้นทางนี้:

```text
React UI
  -> KitchenSotDraftProvider
  -> KitchenSotDraftClient.load()/save()
  -> /__cookbook/v4 และ /__cookbook/v5-draft
  -> Vite configureServer middleware
  -> V4/V5 files ใน vault ของเครื่อง TINE
```

เส้นทางนี้ใช้จริงเฉพาะ Vite dev server. Production build ปัจจุบันปิด `HttpKitchenSotDraftClient` ด้วย `import.meta.env.DEV` และกลับไปใช้ fixture/session-only ดังนั้น static deployment อย่างเดียวจะไม่มีข้อมูลจริงและบันทึก V5 ไม่ได้

## 3. Accepted architecture direction

รูปแบบเป้าหมายระดับสูง:

```text
มือถือ/แท็บเล็ต/คอม
  -> HTTPS + single-account identity gate ของ TINE
  -> Cookbook owner surface + document gateway ใน environment แยก
       -> GET /__cookbook/v4
       -> GET /__cookbook/v5-draft
       -> PUT /__cookbook/v5-draft
       -> managed document store
            v4-source: exact immutable bytes + frozen SHA
            v5-current: exact bytes + current SHA
```

Provider ยังไม่ถูกเลือก. Cloudflare Workers + Static Assets + D1 เป็นตัวอย่างที่เหมาะกับรูปแบบนี้ แต่ **ไม่ถือว่าได้รับอนุมัติ** จาก ADR ฉบับนี้

### Proposed Phase-1 access shape — รอ TINE รับ implementation plan

ไม่แนะนำ anonymous internet surface เพราะเป็นการเปิดสูตรร้านสู่สาธารณะโดยไม่จำเป็น. รูปแบบที่เสนอสำหรับจังหวะ 1 คือ:

```text
owner surface
  -> TINE email one-time-code session
  -> Library / Work / Print / Recipe Studio
  -> GET + PUT

kitchen view surface
  -> managed device session ที่ยังรอ D13
  -> Library / Work / Print เท่านั้น
  -> GET only; ไม่มี Recipe Studio และ backend ปฏิเสธ PUT ทุกกรณี
```

สอง surface เป็น fixed deployment capabilities ไม่ใช่ระบบ role. ไม่มี role table, user administration หรือ permission editor. Kitchen staff ไม่มี account ในจังหวะ 1. อายุ session ของอุปกรณ์ครัวและวิธีต่ออายุเมื่อ TINE ไม่อยู่ยังเป็น D13; ห้ามถือว่า owner email one-time-code session ตอบโจทย์นี้โดยอัตโนมัติ. Owner และ kitchen surface ต้องแยกด้วย trusted deployment route/hostname policy ไม่ใช่ซ่อนปุ่มหรือเชื่อ `Origin` จาก browser อย่างเดียว

ข้อเสนอนี้เป็น baseline ของ implementation plan จังหวะ 1. หาก TINE ต้องการ anonymous read หรือให้พนักงาน login เอง ต้องแก้ ADR ก่อน execution

## 4. Invariants ที่ decision นี้รับไว้

### 4.1 V4 frozen

- นำเข้า V4 ด้วย exact bytes ห้าม parse แล้ว reserialize ก่อนเก็บ
- SHA-256 ต้องตรง frozen source ก่อน serve และก่อน validate V5
- ไม่มี V4 update/delete route
- application role ทุกชนิดไม่มีสิทธิ์แก้ V4
- ห้ามแก้ chmod, manifest หรือไฟล์ V4 ต้นทางเพื่อรองรับ migration

### 4.2 V5 write semantics

- V5 เป็น JSON document ทั้งฉบับ ไม่แยก recipe/item เป็นตารางใน milestone แรก
- `source_values`, mixed number/string IDs, key order, blocker history และ raw Thai text ต้องคงเดิม
- save ต้องส่งทั้ง `If-Match` และ `base_sha256`; สองค่าต้องตรงกัน
- backend ตรวจ transition จาก V4 และ V5 ปัจจุบันก่อน persist
- write ต้องเป็น atomic compare-and-swap จาก current SHA
- ถ้า baseline เก่า ให้ตอบ `409 STALE_DRAFT`; ห้าม last-write-wins
- SHA ที่ตอบกลับต้องคำนวณจาก exact bytes ที่ persist จริง
- ยังไม่มี automatic merge; editor ที่แพ้ stale race ต้อง reload

### 4.3 Frontend seam

รักษา interface เดิม:

```ts
interface KitchenSotDraftClient {
  load(): Promise<LoadedKitchenSotDraft>;
  save(document: KitchenSotDocument, baseSha256: string): Promise<SotSaveResponse>;
}
```

Production ต้องเลือก adapter ด้วย explicit configuration และ fail closed. ห้าม production กลับไป fixture/session-only โดยเงียบ

### 4.4 Isolation จาก Stock

- ไม่ใช้ Supabase project, schema, keys, Auth, domain หรือ CI/CD ของ Stock V1/V2
- ไม่แก้ shared auth/nav/cookie ของ Stock เพื่อให้ Cookbook ใช้งานได้
- Cookbook environment ไม่มี production credential ของ Stock
- staging และ automated tests ใช้ข้อมูลแยก ห้ามชี้ real V5

## 5. Access and release decisions

### 5.1 Closed decisions

| ID | Decision |
|---|---|
| D5 | ก่อนปล่อยใช้ ผู้ดูคือ TINE คนเดียว; จังหวะ 1 ครัวดูได้ผ่าน controlled kitchen view surface |
| D6 | ผู้แก้คือ TINE คนเดียว; พนักงานแก้ไม่ได้ในจังหวะ 1 |
| D7 | single-account identity gate; ใช้วิธีง่ายที่สุดที่ยังปลอดภัย เช่น email one-time code |

### 5.2 Two-stage release

#### จังหวะ 1 — ครัวดูและพิมพ์ได้ แต่แก้ไม่ได้

ปล่อยได้เมื่อครบทุกข้อ:

1. สูตรทั้ง 18 แสดงข้อมูลปฏิบัติครบและไม่มี unresolved blocker/decision ที่ทำให้เอกสารใดเป็น DRAFT; owner N/A ใช้ได้เฉพาะเมื่อบันทึกตามกฎเดิม;
2. managed gateway เปิดจากมือถือหน้าเตาได้จริงโดยไม่พึ่งเครื่อง TINE;
3. kitchen view surface ไม่มี Recipe Studio และ `PUT /__cookbook/v5-draft` ถูกปฏิเสธที่ backend;
4. A5 จากเครื่องพิมพ์จริงในร้านผ่าน ไม่มีข้อความตัด หน้าเปล่า หรือ app UI;
5. อุปกรณ์ครัวอ่าน/พิมพ์ต่อได้หลัง session expiry/renewal หนึ่งรอบโดยไม่ต้องให้ TINE ออก OTP หรือมาอยู่หน้าเครื่อง;
6. TINE อนุมัติ staging และ deployment แยกหลังเห็นหลักฐานครบ

#### จังหวะ 2 — พนักงานแก้ได้

ถูกเลื่อนออกจาก M6 และต้องมีอย่างน้อย:

- revision/audit ที่ย้อนกลับได้และระบุผู้แก้;
- structural edit ops สำหรับเพิ่ม/ลบ/เปลี่ยนชื่อวัตถุดิบและ dependency;
- role/permission model และ user lifecycle;
- migration/rollback และ acceptance ชุดใหม่

เหตุผล: ทันทีที่คนอื่นแก้ได้ ระบบต้องตอบว่าใครแก้อะไรและย้อนกลับอย่างไร. จังหวะ 1 ทำให้ได้ feedback หน้าเตาเร็วโดยไม่เปิด write risk ให้พนักงาน

### 5.3 Open decisions — ห้ามเดาแทน TINE

| ID | Decision ที่ยังค้าง | ทำไมยังบล็อก |
|---|---|---|
| D8 | whole-document stale guard เพียงพอสำหรับ TINE คนเดียวหรือไม่ | ไม่บล็อก pure refactor แต่บล็อกการรับรอง concurrency contract ขั้นสุดท้าย |
| D9 | provider และใครเป็นเจ้าของ account, domain, secret, backup และ recovery | บล็อก cloud resource, staging และ operational handoff |
| D10 | เมื่อ backend/อินเทอร์เน็ตล่ม ให้ปิด, read-only cache หรือใช้เอกสารพิมพ์สำรอง | บล็อก outage acceptance และ cutover |
| D12 | อุปกรณ์/เบราว์เซอร์และเครื่องพิมพ์จริงรุ่นใดต้องผ่าน | บล็อก final actual-device GO |
| D13 | kitchen device session มีอายุเท่าใดและต่ออายุอย่างไรเมื่อ TINE ไม่อยู่ | บล็อก unattended-availability contract, Access configuration และ final GO |

D5–D7 ไม่ใช่ blockers แล้ว. D9 เป็น hard blocker ก่อนสร้าง resource; D10, D12 และ D13 เป็น hard blockers ก่อน final GO. D8 ต้องปิดก่อนยืนยัน concurrency contract แต่ไม่จำเป็นต่อการแยก portable core. D13 ต้องระบุทั้งตัวเลข session lifetime และ renewal path; ห้ามใช้ค่า default ของ provider เป็นคำตอบ

## 6. Consequences

### Positive

- ครัวใช้ผ่านมือถือได้โดยไม่ขึ้นกับเครื่อง TINE
- รักษา local pilot semantics และ low-noise V5 ได้
- แยกความเสี่ยงจาก Stock V1/V2
- เลื่อน revision/normalized schema ออกไปจนมีข้อมูลการใช้งานจริง

### Negative

- ต้องมี cloud account owner, identity, authorization, backup และ incident ownership
- whole-document stale guard ป้องกันข้อมูลทับกัน แต่ไม่รวมการแก้ของสองคนให้อัตโนมัติ
- อินเทอร์เน็ตหรือ provider ล่มจะกระทบการเข้าถึง เว้นแต่ TINE เลือก read-only outage mode
- validator และ persistence logic ที่รวมอยู่ใน Vite plugin ต้องแยกก่อนสร้าง managed adapter

## 7. Rejected or deferred alternatives

- **Static GitHub Pages อย่างเดียว:** ไม่มี write backend และ production build ปัจจุบันไม่โหลด V4/V5 จริง
- **Vite dev server เป็น production:** lifecycle, security และ filesystem assumptions ไม่เหมาะกับ production
- **เครื่อง TINE เป็น host:** ขัดกับเหตุผลหลักที่ต้องใช้ได้เมื่อ TINE ไม่อยู่
- **ใช้ Stock production Supabase เดิม:** ขัด isolation decision และเพิ่ม blast radius ต่อระบบที่มีผู้ใช้จริง
- **browser เขียน database ตรง:** ข้าม server-side transition validator และเสี่ยงเปิด V4/V5 เกินสิทธิ์
- **normalize ทุก recipe/item ตอนนี้:** เพิ่ม migration/order/identity/readiness risk โดยยังไม่มีประโยชน์ที่ first draft ต้องใช้

## 8. Work classification ณ ตอนนี้

### ทำได้ในรอบเอกสารนี้

- บันทึก ADR จาก decision ที่เคาะแล้ว
- ออกแบบ seam ระหว่าง portable validation core กับ persistence adapters
- ระบุ regression tests ที่ต้องล็อก behavior
- ระบุ implementation tasks ที่ไม่ขึ้นกับ identity และ tasks ที่ถูก block

### ปลดล็อกทางการออกแบบแล้ว แต่ยังต้องรอ TINE อนุมัติ coding แยกต่างหาก

- แยก pure parsing/transition validation/deterministic serialization ออกจาก Vite handler
- สร้าง in-memory adapter และ reusable contract tests
- ให้ filesystem adapter เดิมผ่าน contract suite โดย behavior ไม่เปลี่ยน
- ออกแบบ single-account identity adapter โดยไม่มี role model
- แยก owner surface กับ kitchen GET-only surface เป็น fixed capabilities
- เขียน implementation plan จังหวะ 1 ที่ไม่รวม revision/edit-ops/roles

รายการเหล่านี้ **ยังไม่ได้รับอนุญาตให้ลงมือในรอบนี้** และต้องมี regression baseline ก่อน refactor

### ยัง blocked จริง

- **D8:** final concurrency acceptance และการตัดสินว่า stale guard เดิมเพียงพอหรือไม่
- **D9:** provider/account/domain, managed resource/schema, secrets, backup owner และ recovery owner
- **D10:** outage UX, cached-read policy และ cutover/rollback acceptance
- **D12:** actual mobile/browser/printer matrix และ final evidence
- **D13:** kitchen-device session lifetime, renewal owner/mechanism และ expiry-cycle evidence ตอน TINE ไม่อยู่

ไม่มีข้อใดอนุญาต cloud/backend/deploy ในรอบเอกสารนี้

## 9. Rollback principle

ก่อน cutover ต้อง export exact local V5 bytes + SHA และเก็บ local pilot ให้เปิดกลับได้. ห้าม dual-write. ถ้า staging/cutover fail ให้ rollback app configuration กลับ local pilot และ restore V5 current จาก artifact ที่ตรวจ SHA แล้ว โดยไม่แตะ V4

## 10. Done when

ADR ฉบับนี้พร้อมเปลี่ยนจาก `Partially accepted` เป็น `Accepted` เมื่อ:

1. TINE รับหรือแก้ proposed owner/kitchen surface ใน implementation plan;
2. D8–D10, D12 และ D13 มีคำตอบพร้อม acceptance owner;
3. provider และ account owner ถูกเลือก;
4. independent reviewer ยืนยันว่า decision ไม่เปิดเส้นทางแตะ Stock V1/V2, ไม่ทำให้ V4 เขียนได้ และ kitchen surface เขียน V5 ไม่ได้;
5. TINE อนุมัติ ADR ฉบับสมบูรณ์และ implementation plan ก่อน coding

## 11. Non-authorization

ADR ฉบับนี้ไม่อนุมัติ commit, cloud resource, backend implementation, Supabase change, auth integration, production data access, deployment หรือการแก้ V4/V5
