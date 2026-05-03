# Ship Log

> Latest ships at top · scan 5 วิรู้ว่าเพิ่ง ship อะไรไป · detail อยู่ใน BLUEPRINT.md §6 · commits ใน git log
>
> Append pattern: หลัง `git push` สำเร็จ · prepend 1 row · Discord notify ตามเดิม
>
> Format: `<DD/MM> · <commit> · <what> · <who> · <channels notified>`

---

## 03/05 09:50 · T-LOT3283 · historical anomaly cleanup (Option B · 4 sm rows append)

Ticket T-LOT3283 (COO brief 03/05 09:34 · ไทน์ approve B 09:49) · nntn-platform · #aim · #coo
- **Goal:** ปิด per-lot balance invariant {0,1} ของ lots 3283/3284 (MT-019 เนื้อสดหมักนุ่ม cook_session 2983b206 22-25/04 · pre-RC2 anomaly)
- **Yesterday's gap:** sm 4512/4513 (02/05 fix) ใส่ qty + ref_id ถูก แต่ลืม set lot_id field → per-lot invariant ไม่ปิด · item-level OK
- **Try Option A first (failed):** apply_migration with `SET LOCAL app.allow_sm_mutation='on'` + UPDATE sm 4512/4513.lot_id → success=true แต่ verify lot_id ยัง NULL → discovered `sm_block_mutation` BEFORE ROW trigger bug (`RETURN NULL` instead of `RETURN NEW` · silent cancel)
- **Pivot to Option B (TINE pick):** insert 4 sm rows pure append-only:
  - sm 4699 lot_id=3283 +1 count_adjust_up · close per-lot
  - sm 4700 lot_id=3284 +1 count_adjust_up · close per-lot
  - sm 4701 (no lot_id) -1 count_adjust_down · offset 4512
  - sm 4702 (no lot_id) -1 count_adjust_down · offset 4513
- **End state:** lot 3283 balance = 0 (4 rows) ✓ · lot 3284 balance = 0 (4 rows) ✓ · MT-019 item sm_net unchanged · system divergence = 0 ✓
- **Bug discovered (deferred):** GitHub issue #6 https://github.com/TTT3P/nntn/issues/6 · `sm_block_mutation BEFORE ROW returns NULL · silent cancel · bypass mechanism broken` · P3 · Phase 4 backlog · also flag verify B10 revert_close_pot บน sm.lot_id (อาจ silent no-op เช่นกัน)

## 02/05 16:05 · PICANHA bundle · OP1 + OP3 + OP4 ship · OP2 skipped

Squad-tier bundle · Platform lead · cross-room (CookingBook · Sales) · nntn-platform · #platform · #coo
- **OP1** INSERT public.items SP-212 'พิคานย่าไทย (สด)' · id `f4ec61df-a6ca-4a95-a7c5-ad73c56cfeab` · meat/raw · qty_per_pack=1 cost=250 yield=0.9 is_bom_eligible=true · CB unblocked → ใส่ bom_items + cb_ingredient_id=153
- **OP2** SKIPPED · CB verdict A · B3 stock cascade (deploy 29/04) sufficient · cost-cascade NEW = ticket แยก CB-Phase3-cost-cascade
- **OP3** Migration `salesops_menu_aliases_v2_20260502` · `sales_ops.menu_aliases` (V2 supersedes menu_rcp_mapping V1) · 15 cols · 5 indexes · 1 trigger
  - Schema: M:1 alias→rcp_code · platform CHECK enum · branch_id NULL=ทุกสาขา · `menu_name_norm` GENERATED (lower+btrim) · size_modifier nullable · confidence enum · hits_count + last_seen_at สำหรับ analytics
  - Partial UNIQUE (platform, COALESCE(branch,''), name_norm, COALESCE(size,'')) WHERE is_active · 3 lookup indexes · updated_at trigger
  - V1 ไม่ drop (1 seed row คงไว้) · CB ตัดสินใจตอน wire เสร็จ · RLS รอ followup
- **OP4** Platform-side NO-OP · `RCP-TBD-STEAK-PICANHA` ไม่มี ref ใน DB ทั้ง cookingbook.recipes / public.bom_items / sales_ops.menu_rcp_mapping · Sales wire ผ่าน menu_aliases V2 ตามขั้น

## 02/05 15:43 · B9 MERGED · `5b7e8ff` · loadDraft re-validate live (PR #2)

PR https://github.com/TTT3P/nntn/pull/2 · merged main · nntn-platform · QA review nntn-qa · #platform · #aim · #coo
- **Manifest เช้า 02/05:** draft FS NT20260502-1 ส่งไม่ได้ — 5 ถุงเนื้อสดหมักนุ่ม (cw 4156-4161) ค้างใน meat_lines แต่ status เป็น 🚚 Delivered แล้วโดยบิล NT20260501-1 (12:15 BKK)
- **Root cause incident:** บิล NT20260501-1 คนกรอก 5 ถุงเนื้อสดหมักนุ่ม แต่ของจริง 10 ถุง · อีก 5 ถุงค้างใน FS draft → trigger `prevent_deliver_if_not_in_stock` ขัด submit ถูกต้อง
- **Manual fix:** `rpc_delivery_reverse` 10 ถุง (4153-4162) คืน In Stock · sm_id 4341-4350 · บิล NT20260501-1 เหลือ items อื่นไม่กระทบ · น้องส่ง FS20260502-1 สำเร็จ 10:33 BKK
- **Layer-1 fix:** `submitDraft()` ใน hub-delivery.html — ก่อน rebuild form, query live `catch_weight.status` ทุก bag, prune ถุง !=`✅ In Stock`, alert popup, PATCH `delivery_drafts.meat_lines` ให้ draft สะอาดสำหรับ reload ครั้งหน้า
- **QA verdict (nntn-qa):** GO · code clean · no side-effects บน FS submit/stock-dispense/count-adjust · SQL injection safe (Number.isFinite filter)
- **CI note:** failure on PR = preexisting `auth.setup.js` login redirect timeout (main red 3 runs prior) · NOT B9 regression · followup task issued to nntn-platform (P2 · CI baseline restore)
- **Diagnose miss caught:** Platform initial claim "1 fail = NT-20260418-01" ผิด · จริง = auth.setup.js · QA จับได้ · feedback ส่ง Platform แล้ว
- **Out of scope (carry):** Layer-2 (soft-lock reservation) + Layer-3 (Supabase Realtime) — รอประเมินถ้าเคสซ้ำ
- **Status:** ✅ MERGED · GitHub Pages deploy auto · B9 closed

## 01/05 · B10 root cause #2 · cw_emit_sm_status idempotent (balance check)

Migration `b10rc2_cw_emit_sm_status_idempotent_balance_check_20260501` · nntn-platform · #platform
- **Why:** session cancel/re-attach pattern (✅→❌→✅→❌) ทำให้ trigger emit consume ซ้ำ · root cause ของ B10 drift
- **Idempotency:** ก่อน insert ตรวจ `SUM(sm.qty_delta) WHERE lot_id=NEW.id`
  - Forward (qty=-1): skip if balance ≤ 0 (already terminal)
  - Reverse (qty=+1): skip if balance ≥ 1 (already restored)
- **Invariant enforced:** balance ∈ {0, 1} per lot
- **Pre-flight:** 433/433 In Stock cw มี balance=1 · 2162/2164 not-In-Stock มี balance=0 · 2 historical anomalies (lots 3283/3284) แยก ticket
- **Test 3 scenarios (rolled back · lot 3801):** S1 first execute emit ✅ · S2 cancel+re-attach skip second ✅ · S3 revert+re-execute emit ✅
- **Normal flow ไม่กระทบ:** delivery_reverse · first consume · re-execute หลัง compensating refund ทำงานครบ

---

## 01/05 · B10 follow-up · revert_close_pot bypass sm_block_mutation (FK SET NULL)

Migration `b10_revert_close_pot_bypass_sm_mutation_for_fk_setnull_20260501` · nntn-platform · #platform
- **Root cause ที่ patch แรกพลาด:** HTTP 400 "append_only" จาก UI ปุ่ม "↩️ ย้อนหม้อ" ไม่ใช่จาก code · แต่จาก FK `stock_movements.lot_id` = `ON DELETE SET NULL` → DELETE cw ทำให้ implicit UPDATE sm.lot_id=NULL → ตรง `sm_block_mutation`
- **Fix:** RPC ใช้ bypass GUC ของ `block_sm_mutation`: `set_config('app.allow_sm_mutation','on',true)` LOCAL ก่อน DELETE cw · auto-reset ตอน commit
- **Order:** insert compensating disposal sm ก่อน → enable bypass → DELETE cw (FK SET NULL ไม่ block) → DELETE cook_outputs → UPDATE cook_sessions
- **Frontend:** ไม่แก้ · เรียก `/rpc/revert_close_pot` signature เดิม
- **Pending live test:** ไทน์กดปุ่ม UI 1 ครั้ง confirm end-to-end

---

## 01/05 · B10 drift fix · เอ็นแก้วตุ๋น revert_close_pot

Migration `b10_drift_fix_revert_close_pot_compensating_sm_20260501` · nntn-platform · #platform #aim
- **Issue:** input miscount session f087e89e (1.4kg recorded vs 2 ถุง actual) · ไทน์ revert+re-execute ผ่าน UI · revert_close_pot DELETE cw → orphan sm + cw_emit_sm_status ยิง consume ซ้ำตอน re-attach = drift
- **Drift before:** MT-033 +4 ถุง 2607g over · SP-025 lot 3339 consumed 3x · lot 3475 2x
- **Fix Step 1:** insert 7 compensating sm (4 disposal MT-033 + 3 count_adjust_up SP-025 lot 3339×2 + lot 3475×1) · sm append-only respected
- **Fix Step 2:** patch `revert_close_pot` RPC · INSERT compensating disposal sm BEFORE DELETE cw · returns `compensating_sm` count
- **QA verify:** sm = cw reality 100% (MT-033 4ถุง 2607g · SP-025 1ถุง 2610g)
- **Pending separate ticket:** `cw_emit_sm_status` idempotency (ยิง consume ซ้ำตอน session cancel/re-attach · root cause #2 untouched)

---

## 01/05 · Phase 4A-6 design spike sync

5 new protos (admin-items · admin-bom · sales-ops · stock-dispense · pkg-cascade) + frame-template + block-library (12 components · WC mix pattern) + page-block-matrix · ATUM-style log · Inline SVG charts

---

## 01/05 · resource-model v1 · Open Q6 activity-events-TTL DECIDED · ALL 6 CLOSED ✅

`NNTN-Vault/System/architecture/resource-model-v1.md` §Open Q6 + §ActivityEvent + footer updated
- Activity log = **D partition by month · no TTL · ไม่ลบ**
- `PARTITION BY RANGE (created_at)` monthly · pg_cron auto-create partition เดือนถัดไป
- Index per partition: `(resource_type, resource_id, created_at DESC)` + `(actor_id, created_at DESC)`
- Backfill 3,658 rows → partitions
- ETA 1 วัน · trigger หลัง Day 7 spec freeze
- Sub-question Q6.1: apply same pattern กับ `stock_movements` ด้วยไหม (open · pending)

**ALL 6 OPEN QUESTIONS CLOSED**: Q1 freeze=user-signal · Q2 multi-tenancy=defer · Q3 repack=first-class · Q4 actor=rename(forward-only) · Q5 BOM=cookingbook canonical · Q6 activity=partition no-TTL

**Day 7 review (08/05)**: spec freeze go/no-go · criterion = น้องไม่เจอบัค ≥ 14 วัน + #aim/#alerts clean

**Migration backlog Day 8+** (3.5 วัน total · scheduling pending COO):
- Q3 repack_sessions table (1d)
- Q4 actor rename forward-only (0.5d · ไทน์ confirmed)
- Q5 DROP public.bom_items (1d · need CookingBook approve)
- Q6 partition activity_events monthly (1d)

---

## 01/05 · resource-model v1 · Open Q5 recipe-ownership DECIDED + Q4 confirm

`NNTN-Vault/System/architecture/resource-model-v1.md` §Open Q5 + §8 + §3 updated
- Recipe ownership = **A** · `cookingbook.bom_items` = canonical SOT · DROP `public.bom_items` (329) + `bom_items_archive_20260414_herbal`
- Plan: audit refs (sm_cascade_bundle · RPCs) → repoint → optional view bridge → pre-flight (R12) → DROP → QA 17 tests + cascade B3 verify
- Reason: CookingBook = canonical per CLAUDE.md · single SOT prevent drift
- Cross-room coordination: CookingBook room approve schema stable ก่อน drop public copy
- ETA 1 วัน · trigger หลัง Day 7 spec freeze · urgent ถ้าไทน์ flag

**Q4 forward-only confirmed by ไทน์**: sm 367 row คงเดิม (audit truth) · downstream 1,742 row update · ใหม่ใช้ 'im' จาก migrate-day · proceed apply ได้เมื่อ schedule

---

## 01/05 · resource-model v1 · Open Q4 actor-normalization DECIDED

`NNTN-Vault/System/architecture/resource-model-v1.md` §Open Q4 + §9 Actor updated
- Actor normalization = **B-pragmatic** · rename `AIM` → `im` · ไม่ build PIN/OAuth ตอนนี้
- **Live audit (01/05)** rows กระทบ: cw 873 · aim_outbox 379 (287+92) · stock_counts 490 (380+110)
- ⚠️ **sm 367 rows BLOCKED** by `sm_block_mutation` (append-only) → migration = **forward-only**
  - Downstream tables (cw · aim_outbox · stock_counts) update
  - sm history คงเดิม (audit truth) · row ใหม่ใช้ `im` ตั้งแต่ migrate
- Update: frontend constants · webhook payload · handler.js · AIM trigger default
- Trigger re-open Q4: ถ้าคน 2 join AIM device → build login layer ตอนนั้น
- ETA 0.5 วัน · รอไทน์ confirm forward-only OK ก่อน apply

---

## 01/05 · resource-model v1 · Open Q3 repack-as-entity DECIDED

`NNTN-Vault/System/architecture/resource-model-v1.md` §Open Q3 + §5 updated
- Repack-as-entity = **A first-class table** · สร้าง `public.repack_sessions`
- Schema: id uuid · created_at · created_by · source_bag_id · reason · status · note
- FK: `cw.repack_session_id` → `repack_sessions(id)` ON DELETE RESTRICT
- Migration: CREATE → backfill (synthesize 1 row per distinct cw value) → ADD FK → update `rpc_repack_execute`
- ETA 1 วัน · trigger หลัง Day 7 review (spec freeze) หรือก่อนถ้าไทน์ urgent
- Reason: pattern consistency (cook/count มี table แล้ว) · ATUM audit ต้อง session entity · 50 < 1000 row tech-debt scaling

---

## 01/05 · resource-model v1 · Open Q2 multi-tenancy DECIDED

`NNTN-Vault/System/architecture/resource-model-v1.md` §Open Questions Q2 updated
- Multi-tenancy = **B defer** · ไม่เพิ่ม `org_id` ตอนนี้
- Trigger: รอ customer ที่ 2 confirmed → design migration จาก real customer
- Pivot path ถ้า SaaS: backfill `org_id='nntn'` ทุก core table ตอนนั้น (ยอม cost)
- Reason: 1 tenant · เพิ่ม field ตอนนี้ = 10-15% schema cost ไม่ test จริง · design from-real ตรงกว่าเดา
- RLS implication: scope `authenticated` ปัจจุบันพอ · ไม่ต้อง multi-tenant aware

---

## 01/05 · resource-model v1 · Open Q1 freeze criterion DECIDED

`NNTN-Vault/System/architecture/resource-model-v1.md` §Open Questions Q1 updated
- Freeze criterion = **E user-signal driven** (ไม่ใช่ dev count)
  - น้องหน้างานไม่เจอบัคติดต่อกัน ≥ 14 วัน
  - cross-check `#aim` + `#alerts` ไม่มี alert ใหม่ช่วงเดียวกัน
- Reason: real-world > schema-change count · 14d ครอบ 2 weekly cycle · catch edge case · short enough เริ่ม Phase 0 ได้
- Trigger: criterion ผ่าน → freeze proposal → Phase 0 OpenAPI generation start

---

## 01/05 · resource-model v1 draft (control-plane spec · 9 entities)

`NNTN-Vault/System/architecture/resource-model-v1.md` (vault · ไม่ใช่ repo file)
- Day 1-2 Track A ของ Hybrid plan (decision D · 30/04)
- 9 entities: Item · Bag · Movement · Count · Session · Delivery · PurchaseOrder · Recipe · Actor + cross-cutting (ActivityEvent · AIM Outbox)
- pull จริงจาก Supabase project `emjqulzikpxorvpaaiww` schema state · 11 RPCs cataloged · all triggers/policies mapped
- ATUM-style activity log surface matrix · WooCommerce REST verb mapping · markdown-only (ไม่ generate code)
- 6 architectural open questions escalated: freeze criterion · multi-tenancy · repack as entity · actor normalization · recipe ownership · activity_events TTL
- Update protocol: enforce ผ่าน /pre-flight (ทุก DDL/RPC change ต้อง update spec same commit)

---

## 30/04 · stock-history default range = last 30 วัน

`stock-history.html` · เปลี่ยน default date range
- ก่อน: from + to = today → ไม่เจอประวัติเพราะวันนี้ยังไม่มี movement
- หลัง: from = today−30 · to = today · (?from=/?to= URL params override)
- เพิ่ม helper `daysAgoBKK(n)` (BKK timezone)
- T-STOCK-HISTORY-DEFAULT-RANGE

---

## 30/04 · count-sheet-weekly fill A4 (rows + fonts scaled up)

`count-sheet-weekly.html` · ขยายให้เต็มพื้นที่ A4 landscape · ยังลง 1 หน้า
- **Screen**: tbody tr 36px · font 13px (col-item/lot.new) · 12px (lot summary) · col widths 150/200/56/56
- **Print**: tbody tr 25px · font 11px base · col widths 130/175/50/50 · margin 6mm
- **Math** (A4 landscape margin 6mm = ~749px usable): sheet-header 50 + thead 3 rows × 22 = 66 + 24 rows × 25 = 600 + legend 14 → ~730px ✅
- Lot summary ยัง single-line nowrap ellipsis · ไม่ขยาย row height
- T-COUNT-SHEET-WEEKLY-FILL-A4

---

## 30/04 · count-sheet-weekly REDESIGN-A (compact 2-row per SKU)

`count-sheet-weekly.html` · full redesign · ไทน์ approve Option A
- **1 SKU = 2 rows** เท่านั้น (rowspan=2 บน name td)
  - Row 1: ชื่อ SKU | Lot summary cell (multi-lot stacked · 1 lot/บรรทัด) | 7 days รับ/เบิก
  - Row 2: 'ผลิตใหม่' label + ช่องเขียน | 7 days
- **Lot summary**: `DD/MM · NN ถุง · ★/★ FIFO` · FIFO ส้ม pill · ★ ตั้งไว้ amber
- **Empty stock**: '— ไม่มีสต็อก —' italic
- **Print**: A4 landscape margin 8mm · font 10px · 12 SKU × 2 row = 24 data rows + header → ลง 1 หน้าสบาย
- ลบ pad row · global maxLots · rowsPerItem patterns ที่ไม่ต้องใช้แล้ว
- T-COUNT-SHEET-WEEKLY-REDESIGN-A

---

## 30/04 · count-sheet-weekly polish v3 (pad borderless + A4 fit)

`count-sheet-weekly.html` · 2 fixes
- **Pad row borderless**: `.col-lot.pad` ใส่ `border-top-color/bottom-color: transparent` · pad rows ในคอลัมน์ Lot ดูต่อเนื่องเป็นช่องว่างเดียว · เส้น separator ระหว่าง SKU ยังคงอยู่
- **A4 landscape 1 page**: `@media print` บีบ font-size 8px · ลด padding td 1px 3px · col widths compact · `@page A4 landscape margin: 6mm` · 12 SKU × 4 row พิมพ์ลง 1 ใบ
- T-COUNT-SHEET-WEEKLY-POLISH-V3

---

## 30/04 · count-sheet-weekly layout v2 (uniform rows + clean pad)

`count-sheet-weekly.html` · 3 fixes
- **Global maxLots**: ใช้ `rows.reduce((m,r)=>Math.max(m,r.lots.length),0)` · uniform rowsPerItem ทุก SKU (ไม่ใช่ per-item)
- **Padding row**: class ใหม่ `.col-lot.pad` · background `#fff` · ไม่มี text/italic/border คู่ · empty-stock first row ยังเป็น `.empty` ("— ไม่มีสต็อก —")
- **Header "รายการ"**: ยืนยัน TH รายการ `rowspan=2` มีอยู่แล้ว
- T-COUNT-SHEET-WEEKLY-LAYOUT-FIX-V2

---

## 30/04 · count-sheet-weekly layout fix

`count-sheet-weekly.html` · sort + fixed row layout
- **Sort**: by portion size [75g] → [100g] → [500g] → ชื่อไทย (extract `[<n>G]` prefix)
- **Fixed row count**: ทุก SKU = maxLots+1 row (lot1/lot2/.../ผลิตใหม่) · pad ว่างถ้า lot ไม่ครบ
- **Bug fix**: เดิม empty-stock SKU เขียน name td โดยไม่มี rowspan → ผลิตใหม่ row ของ SKU ถัดไปขยับ column → ป้าย "ผลิตใหม่" โผล่ผิด SKU ([75G]พิคานย่า-ออส, [100G]พิคานย่า-ออส, [75G]เนื้อกิวด้ง, [500g]ลูกชิ้นเนื้อ)
- name td ใช้ `rowspan=rowsPerItem` ทุก SKU · grid วัน 1-7 alignment ตรง
- T-COUNT-SHEET-WEEKLY-LAYOUT-FIX

---

## 30/04 · count-sheet-weekly show-all SKU (incl. qty=0)

`count-sheet-weekly.html` · ลบ checkbox 'แสดงเฉพาะที่มีสต๊อก' · แสดงทุก SKU meat_portioned active เสมอ (12 rows)
- SKU qty=0 → แถวขึ้น · ช่อง Lot = "— ไม่มีสต็อก —" · น้องนับ "0" ยืนยันได้
- เหตุผล: ของหมดจริง vs ลืมนับ ต่างกัน · ลืมนับ = blind spot ที่ทำ divergence
- T-COUNT-SHEET-WEEKLY-SHOW-ALL

---

## 30/04 · count-sheet-weekly dynamic SKU list

`count-sheet-weekly.html` · ลบ hardcoded whitelist 12 SKU · query `items WHERE item_category='meat_portioned' AND is_active=true ORDER BY sku`
- ก่อน: hardcoded list · ถ้า SKU ใหม่ flag meat_portioned ต้อง edit code
- หลัง: 12 rows dynamic (MT-007/008/009/011/014/018/020/030/037/039/040/043) · ทุก [75g/100g/500g] portioned active โผล่อัตโนมัติ
- Stock impact: น้องนับ weekly ครบ · ลด divergence จาก SKU ตกหล่น
- T-COUNT-SHEET-WEEKLY-PORTIONED-FIX

---

## 30/04 · MT-040 category fix (data-only · no commit)

UPDATE `items.item_category` non_meat → meat_portioned · sku MT-040 [75G]เนื้อตุ๋น
- Scan portion-prefix `[xxxG]` SKUs · เจอ stale 1 row (MT-040)
- หลัง fix: 12/12 portion SKUs = meat_portioned ครบ
- /stock meat category=processed จะเห็นครบ · T-CATEGORY-STALE-FIX

---

## 30/04 · submit_log Phase A · audit defense layer

`hub-delivery.html` instrument 4 hooks (attempt/success/fail/cancel) → `stock.submit_log`
- Best-effort fire-and-forget · ไม่ block submit flow
- Captures: actor (jwt email) · device · payload (bill/dest/bag_ids/nm) · ref_id=bill_no · error_msg
- Append-only trigger guard already in place · RLS authenticated insert+read
- Wave 2 direct main commit · COO formal approve T-SUBMIT-LOG-PHASE-A
- Phase B (count-sheet/stock-form/dispense/meat-stock) · Phase C (viewer page) · queued


## 2026-04-28

| Time | Commit | What | Channels |
|---|---|---|---|
| ~11:35 ICT (30/04) | hotfix P1 · regression | **T-BILL-DISPLAY-REVERSED hotfix** · Tab ประวัติ crash "Could not find a relationship between delivery_lines and catch_weight in the schema cache" · root cause: PostgREST นิ้น schema cache ไม่ resolve nested join cross-schema (stock.delivery_lines → public.catch_weight) แม้ FK exists (fk_delivery_lines_catch_weight) · Fix: ลบ catch_weight(status) จาก nested select · เพิ่ม separate fetch /rest/v1/catch_weight?id=in.(...) chunked 200/batch · merge JS-side ผ่าน cwStatus dict · reverse badge logic ใช้ cwStatus[l.catch_weight_id] แทน l.catch_weight.status · ไม่กระทบ relationship dependency | — |
| ~11:25 ICT (30/04) | UI · hub-delivery history badge | **T-BILL-DISPLAY-REVERSED** · hub-delivery.html tab ประวัติ · เพิ่ม reverse status check (ดู cw.status=In Stock) · บิลที่ all-reversed → 🔄 REVERSED badge + strikethrough + opacity 0.55 · partial → ⚠️ partial N/M badge · normal เหมือนเดิม · เพิ่ม catch_weight(status) ใน select · ไม่กระทบ logic submit/edit · NT20260429-4 ที่ reverse เช้านี้จะโชว์ badge | — |
| ~11:10 ICT (30/04) | data hotfix · 1 UPDATE | **MT-039 category fix** · `[500g]ลูกชิ้นเนื้อ` item_category=non_meat (stale · ผิด) → meat_portioned · 1 row · /stock meat category=🌭 แปรรูป จะแสดงแล้ว (qty=0 · ❌ หมด) | — |
| ~10:50 ICT (30/04) | service v4 · 4-way meat | **T-STOCK-CMD-V2 BUG#1 fix** · meat 3-way → 4-way · meat_processed = meat_portioned only (10 SKU มี [xxxG]) · เพิ่ม 🪓 เศษ/เนื้อตัดแต่ง = meat_trim (4 SKU: MT-012/015/021/042) · re-register guild (status 200) · pid reload ready · MT-021 display name flag เป็น tech-debt | #platform |
| ~10:30 ICT (30/04) | service v3 · /stock subcommands | **T-STOCK-CMD-V2 DONE** · /stock มี 3 subcommand (meat/non-meat/sku) · meat 3-way (raw/cooked/processed · 50 SKU · 2,006 chars · ใต้ 4096 limit) · non-meat overview 9 sub-cats (seasoning 59 · packaging 32 · consumable 29 · spice 26 · vegetable 26 · pkg 16 · noodle 11 · srcp 5 · misc 1) drill ผ่าน category choice · LINE-copyable format · qty=0 = ❌ หมด · CW items แสดง 'X ถุง · Yก.' · stock_counts items แสดง 'X unit' · re-register guild scope · service reload pid 17589 ready | #platform |
| ~09:50 ICT (30/04) | data ops · reverse+resend NT4 → FS2 | **T-NT4-REVERSE-AND-FS-RESEND** · NT20260429-4 ตัดผิด (น้อง NT submit ทั้งบิลที่ไทน์ hold ไว้ใน draft FS-1) · Step1 reverse 10 ถุง MT-019 (cw 3913-3922) ผ่าน rpc_delivery_reverse loop · ทุกถุง 🚚 Delivered → ✅ In Stock · Step2 submit_delivery FS20260429-2 5 ถุง (3913-3917 · 2,521g) สาขา FS · delivery id 7d48a376 · 5 ถุงเหลือ (3918-3922 · 2,503g) ค้าง HQ warehouse B · NT branch จะขาด MT-019 ที่เคยส่ง 29/04 (ของจริงน้องอาจใช้ไป — ไทน์ยอมรับ correction · จะคุย NT ภายหลัง) | #aim · #platform |
| ~09:30 ICT (30/04) | data ops · prune draft P1 | **T-HUB-DELIVERY-DRAFT-STALE fix** · draft FS20260429-1 (`c37e481a`) hold 5 ถุง MT-019 (3913-3917) ที่ session อื่นส่งออกไปแล้ว 18:46 ICT 29/04 → form mismatch · ส่งออกไม่ได้ · UPDATE draft meat_lines ตัด 5 stale ออก (22→17 bags) · 17 ถุงที่เหลือ verify status=In Stock ครบ · ไทน์ refresh hub-delivery แล้วส่งออกได้ทันที · NEW BUG B9 cross-session draft staleness — ยังต้อง code fix hub-delivery.html ตรวจ status ตอน load draft + auto-prune+warn | #platform |
| ~09:10 ICT (30/04) | bugfix · embed format | **/stock no-arg embed 500 fix** · multi-embed รวม > 6000 char limit (171 SKU on hand · 100+ chars/category) → Discord PATCH webhook 500 · refactor เป็น single embed description-based · budget 3800 chars · format `\`SKU\` name · **qty**` group by type→tier · overflow → "+N SKU เพิ่มเติม" footer · dry-run live data: 3820 chars · 62 truncated · safe under 4096 desc + 6000 combined | #platform |
| ~07:30 ICT (30/04) | bugfix · DELETE collision | **/stock collision fix** · พบ /stock register ทั้ง CROO (id 1495763335533039654 · no handler) + add bot (id 1499225675968544839 · มี handler) · Discord autocomplete แสดง 2 ตัว → ผู้ใช้ pick CROO ได้ = 'did not respond' · DELETE CROO copy (HTTP 204) → เหลือเฉพาะ add bot · handler pid 5453 ยัง ready · CROO ยังมี 9 stale slash (count/deliver/dispose/po/recon/tag-bom/transfer/withdraw/reverse-delivery) — flag ให้ COO ตัดสินใจ scope แยก | #platform |
| ~07:00 ICT (30/04) | install · service running | **T-STOCK-CMD-INSTALL DONE** · /stock handler installed on add bot#6960 · npm install ✅ · register-commands.js --guild 1491083079102632198 → cmd id 1499225675968544839 (status 201) · launchctl load plist · pid 5453 · `[ready] logged in as add bot#6960` · 3 RPC paths verified via PostgREST (MT-004 row · ZZ-999 empty · snapshot ok=true) · ไม่ชนกับ MCP CROO · พร้อมรับ /stock จากผู้ใช้ Discord | #platform · #aim |
| ~05:00 ICT (29/04) | non-code ship · service v2 | **T-STOCK-CMD-004 DONE** · /stock handler ย้ายไป **add bot#6960** (app 1491088338613174313 · token DISCORD_TOKEN ใน ~/.config/nntn/.env) แทน CROO · ไม่ชน MCP · run คู่ได้ · `register-commands.js` script เพิ่มมา (one-shot REST POST · global หรือ --guild scope) · /stock no-arg = rpc_stock_snapshot grouped by type→tier · /stock <sku> = rpc_stock_by_sku single embed · BLUEPRINT §5 backlog resolved | #platform · #aim |
| ~04:30 ICT (29/04) | non-code ship · service | **T-STOCK-CMD-001 DONE** · Discord slash `/stock <sku>` handler (CROO bot) · `~/Documents/Claude-Work/services/discord-stock-cmd/{handler.js,package.json,README.md}` + launchd plist · uses `rpc_stock_by_sku` (return: sku/name/qty/unit) · defer ack + 8s abort + green/red embed · ⚠️ token conflict MVP = manual stop MCP ก่อน start · tech-debt (a) dedicated CROO-cmd bot ใน backlog | #platform · #aim |
| ~03:50 ICT (29/04) | data hotfix · 2 UPDATE | **Bug fix · เปิดหม้อตุ๋น ไม่มีช่องกรอกเศษ** · UI logic ถูก (อ่าน byproduct_item_id) · data ขาด/stale → fix items: SP-024→MT-042 (ริ้วขาว→เศษริ้วขาว), SP-037→MT-015 (สะโพก→เศษเนื้อสะโพก · was MT-038 deprecated) · byproduct_required=true ทั้งคู่ · UI จะแสดงช่องเศษอัตโนมัติ | #platform |
| ~03:35 ICT (29/04) | data ops · `rpc_delivery_reverse(3746)` | **REVERSE** FS20260428-2 line MT-004 ชายโครงตุ๋น 580g · cw 3746: 🚚 Delivered → ✅ In Stock · sm #3516 `delivery_reverse +1` (customer→B) · MT-004 In Stock 10→11 · sm_net=11 (sync) | #platform |
| ~03:00 ICT (29/04) | data ops · UPDATE cw_id 3801 lot_date | **METADATA ม้ามตุ๋น** · lot_date=24/02/2026 (production) · date_recorded=24/04/2026 (receive) · ใช้ column ที่มีอยู่แล้ว · ไม่มี schema change · sm trail ไม่กระทบ | — |
| ~02:55 ICT (29/04) | data ops · UPDATE cw_id 3801 weight | **CORRECTION ม้ามตุ๋น** · 213 = น้ำหนัก ไม่ใช่ SKU code (ไทน์ confirm) · weight 264→213g · B8 trigger emit sm #3398 `adjust qty=0` อัตโนมัติ ✅ · In Stock 4 ถุง · sm_net=4 (sync) | #platform |
| ~02:50 ICT (29/04) | data ops · INSERT cw_id 3801 | **ADD STOCK** · MT-036 ม้ามตุ๋น 1 ถุง · พี่ทาย via ไทน์ · lot_date 24/04 · weight=264g (avg) · warehouse B · trigger emit sm `po_receive +1` (sm #3397) · MT-036 In Stock 3→4 · sm_net=4 (sync) | #platform |
| ~02:30 ICT (29/04) | non-code ship · 2 skills | **Wave 1 skill dev DONE** · `/pre-flight` (schema audit shortcut · S) + `/qa-run` (Playwright fast-run · S) · written `~/.claude/skills/{pre-flight,qa-run}/SKILL.md` · loaded ใน skills list ทั้งคู่ · ลด overhead ตอน apply_migration และ pre-push QA | #platform-test |
| ~02:00 ICT (29/04) | migration `b3_bundle_cascade_pkg009_20260429` | **B3 closed** · bundle cascade trigger `sm_cascade_bundle` · linked items.cb_recipe_id 4 SKU + insert bom_items 3 rows recipe 110 + trigger ผ่าน items↔bom_items.sub_recipe_id · depth-guard 5 (GUC) · live-test PKG-009 dispense → cascade PKG-001/002/003 ✅ · reversal verified net=0 | #platform |
| ~01:30 ICT (29/04) | migration `b8_fix_cw_weight_adjust_emit_sm_20260429` | **B8 closed** · trigger `cw_emit_sm_weight_adjust` AFTER UPDATE OF weight_g · emit `adjust` (qty_delta=0 · absolute weight) เฉพาะ status='✅ In Stock' · live-test lot 3800 ผ่าน · BOM spec PKG-009 ได้แล้ว → B3 queued ต่อ | #platform |
| ~00:35 ICT (29/04) | docs only | **B1 + B2 closed formally** · B1 fix landed 23/04 (`b1_fix_emit_sm_receive_delta`) · B2 fix in `hub-delivery.html:2446` · verified `v_sm_cw_divergence` non-meat clean (1/28 SKU divergent = MT-019 meat path, unrelated) · CLAUDE.md + BLUEPRINT §2/§5 updated | #platform |
| ~17:00 ICT | `8d88fb8` | stock-form: reload current_stock after submit · fix "ใส่เลขแล้วสต๊อกไม่เปลี่ยน" UX bug | #aim |
| ~16:30 ICT | `a4aaca3` | meat-stock ปรับยอด modal: ตัดออก rewired to `rpc_disposal` (was broken — table `stock_adjustments` ไม่มี · PGRST205) | #aim |
| ~14:30 ICT | `ea69683` | meat-stock: add MT-035 to MAIN_PROC_SKUS · เลือกเนื้อน่องลายตุ๋นเป็น input ได้ | — |
| ~14:00 ICT | `b16d4a8` + `d135ab0` | new MT-045 'เนื้อน่องลายตุ๋น (เนื้อตุ๋น)' + REPACK_MAP `MT-035 → ['MT-035','MT-045']` (split-self · pattern เดียว MT-004) | #aim |
| ~13:00 ICT | DB migration `cup500ml_metadata_finalize_and_reconcile_12sets` | SP-210/SP-211 ถ้วยคราฟท์ 500ml ตัว+ฝา · 1 ลัง K-TOPS = 6 ชุด · 999 บ. · SP-058/SP-183 metadata sync เหมือนกัน · reconcile 12 ชุดที่อิมรับใส่ผิด SKU 1000ml | #aim · #platform |
| ~10:30 ICT | `ea1814d` | count-sheet print button shift left (right 20→140) · ไม่ทับกับปุ่ม "ออกจากระบบ" | — |

## 2026-04-27

| Time | Commit | What | Channels |
|---|---|---|---|
| ~21:00 ICT | `c0eda39` | unit guard · `auth.js` `nntnIsDecimalUnit/nntnEnforceIntegerUnit` helpers · stock-dispense + po-receive · integer units (ถุง/แผง/ชุด/ขวด) ห้ามมี decimal | #platform |
| ~10:20 ICT | migration `phase2_aim_outbox_digest_for_stock_counts` | Phase 2 outbox + cron `nntn-aim-outbox-drain` (every 1 min) · non-meat 12 SKU = 1 grouped Discord msg | #platform |
| ~10:00 ICT | migration `aim_stock_counts_trigger_fix_recv_qty_and_trim_scale` | Fix `aim_stock_counts_trigger` regex `รับ X` (rpc_receive_universal format) + `trim_scale()` numeric · trailing zeros fixed | #platform |

---

## 2026-04-25

| Time | Commit | What | Channels |
|---|---|---|---|
| ~17:40 ICT | `f4cc284` | HR wireframes 3 หน้า (attendance form · dashboard · config) · mock data · spec in vault | #platform · #coo |
| ~17:30 ICT | `e39a6f5` | Phase B step 3 inline help banners + BLUEPRINT §6 refresh | — |
| ~17:00 ICT | `092cb0e` | Phase B step 2 confirm dialog + yield sanity warn | — |
| ~16:45 ICT | `821fbdb` | Phase B step 1 audit identity (USER · channel) | — |
| ~16:30 ICT | migration `phase_a_audit_views_and_divergence_check` | v_user_actions_daily + v_sm_cw_divergence + cron daily 23:00 | #platform |
| ~16:00 ICT | migration `aim_cw_status_summary_v3` | statement-level UPDATE trigger · 1 msg/SKU | #platform |
| ~15:30 ICT | `d9804c6` | MT-044 เนื้อโกเบ + REPACK_MAP MT-004 → [MT-004, MT-044] | #aim |
| ~15:00 ICT | `2486282` | scrap auto-pick via SCRAP_MAP | — |
| ~14:30 ICT | `79b55d8` | scrap row → dropdown + INSERT CW (was text-only) | — |
| ~14:00 ICT | `e9803ff` | po-receive block MT items (in-house repack-only) | — |
| ~10:30 ICT | migration `phase_c_weekly_digest` | weekly digest cron Sunday 20:00 | #platform |
| ~00:40 ICT | `7ba5947` | Cleanup: 5 historical migration SQL (05-06/04 already applied) removed · verified tables/views exist | #platform · #coo |
| ~00:35 ICT | `467dcf2` | guide.html v2 shipped · sticky FAB + flow diagrams + gradient header | #platform · #coo |

## 2026-04-24

| Time | Commit | What | Channels |
|---|---|---|---|
| ~23:05 ICT | migration `fs_menu_sync_20260424_opt1_21ops` | FS menu sync · 21 ops (Option 1 · skip RCP-009) · 4 updates + 1 deactivate + 18 inserts · single transaction · QA 128/128 | #platform · #coo |
| ~22:50 ICT | `a1e3c16` | BLUEPRINT header + §6 +3 entries + §2 salesops-poc mock | — |
| ~22:30 ICT | `2b1a70f` | stock-dispense: guard catch_weight + fix log UUID display | — |
| ~22:10 ICT | `8d699af` | admin-sop: normalize 'กระ'↔'กะ' | — |
| ~21:55 ICT | `2953e2a` | sop: update stale anon key (3 files) | — |
| ~00:25 ICT | `0b91514` | BLUEPRINT §2 + §6 update · +3 SOP pages · sales-ops LoC fix · +2 decisions | #platform |
| ~00:20 ICT | `deb4222` | QA test · cookingbook nav wiring (1/1 pass) | — |
| ~00:18 ICT | `371416b` | cookingbook/index · wire 3 SOP nav cards · role-gated fail-open | #coo reply |

## 2026-04-23

| Time | Commit | What | Channels |
|---|---|---|---|
| late PM | `866c531` | SOP MVP · `cookingbook.sop_steps` (7-state) + bucket `sop-covers` + 3 pages (admin-sop · sop-review · print-recipe) + hub card · QA 27/27 | #coo · #cookingbook · #platform |
| eve | `5fae97c` | sales-ops rebuild · live Supabase + 6-breakpoint responsive · data-driven anomaly · brand #005036 exact · 312→1286 LoC · QA 44/44 | #coo · #sales-ops · #platform |

## Non-code ship (infra · memory · skill)

| Date | What | Location |
|---|---|---|
| 24/04 | Layer 4 OS-sync hook upgraded · warn→hard block (exit 2) + bypass mechanism | `~/.claude/hooks/post-skill-write-os-sync.py` |
| 24/04 | Layer 3 PreAgent skill guard deployed · 13-skill SKILL_MAP · block on match | `~/.claude/hooks/preagent-skill-guard.py` |
| 24/04 | tool-watcher skill shipped · normalized via skill-creator · 20-tool registry seeded | `~/.claude/skills/tool-watcher/` + `NNTN-Vault/System/ai-tools-registry.md` |
| 24/04 | NNTN-OS.html §5 + §7 + §8 updated (tool-watcher + Layer 3/4 cards + paths) | `NNTN-Vault/System/NNTN-OS.html` |
| 24/04 | 3 feedback memories · ship-dont-bounce · notify-platform-blueprint · evolve-with-new-tools | `~/.claude/projects/.../memory/` |

---

## How to read

- **Latest 2-3 days** ที่ด้านบน · quick scan
- **Detail:** open BLUEPRINT.md §6 (same decisions · fuller context)
- **Commit SHA** · `git show <sha>` สำหรับ diff
- **Channels:** Discord IDs อยู่ใน Obsidian daily log หรือ Discord history

---

## Append rule (manual for now)

1. ทันทีหลัง `git push` → prepend row ใน section วันนี้
2. ถ้าวันใหม่ → add new `## YYYY-MM-DD` section on top
3. Non-code ships (skill · hook · memory · doc) → เพิ่มใน "Non-code ship" table
4. Commit pattern: `docs: ship-log +<entry>` · or bundle กับ code commit · keep log up to date
5. Future: hook to auto-append on push
