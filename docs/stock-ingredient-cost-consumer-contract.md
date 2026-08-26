# Stock → Cookbook · Ingredient Cost Read-Only Consumer Contract (SOT-side record)

> สร้าง: 2026-08-23 10:56 ICT · v1.0 · Owner: NNTN Stock (TINE)
> Status: **CONFIRMED both sides** (nntn ↔ cookbook, 2026-08-23)
> ที่มา/หลักฐาน: TTT3P/nntn#31 (E0 decision, comment 5381346990) · #34 connector spec
> `nntn-cookbook/docs/superpowers/specs/2026-08-12-nntn-stock-connector-purchase-pack-design.md`
> MAW exchange local:nntn ↔ local:cookbook 2026-08-23 · verified live vs Supabase `emjqulzikpxorvpaaiww`

เอกสารนี้ = บันทึกฝั่ง **Stock owner** ของ read-only consumer contract ที่ cookbook ใช้ดึง
ingredient/purchasing cost facts โดย **ไม่แชร์ DB identity กับ Stock และไม่ถือ Stock ownership**.
หลักการกำกับ: **ยึด system MODEL (#34 contract) ไม่ใช่ raw data** — Stock fields = evidence
กำกวม ไม่ใช่ costing contract (spec §2). TINE directive 2026-08-23.

---

## 1. SOT identity + receipt

- **System:** Supabase project `nntn-nonmeat-stock` (ref `emjqulzikpxorvpaaiww`), schema `public`.
- **Authoritative table:** `public.items` (35 cols · 319 rows / 255 active / 165 bom_eligible / 209 มีราคา / 173 มี cb_ingredient_id / 19 มี notes).
- **Supplier/purchasing:** `item_suppliers` (item_id, supplier_id, is_preferred) + `suppliers`; PO facts `purchase_orders` / `purchase_order_items`.
- **Revision/receipt:** items **ไม่มี** checksum/revision token — มีแค่ `updated_at` (timestamptz) + `actor_id` (server actor, default `current_setting('app.actor')`). ⚠ model §4.1 ต้องการ source checksum/revision → connector ต้อง **compute เองตอน capture** (hash payload). **GAP.**

## 2. Field → model mapping (evidence · flag ตาม spec §2)

| Model concept (#34) | Stock field | หมายเหตุ / flag |
|---|---|---|
| identity | sku · name · brand · category · type/item_category · is_active | category = operational grouping **ไม่ใช่** ingredient identity (non-goal §9) |
| purchaseUnitLabel | `unit` / `purchase_unit` | commercial label (แกลลอน/ขวด/ถุง/กก. — 25 distinct). ⚠ label ≠ standard measure (§2.2) |
| netContentQuantity | `qty_per_pack` | ⚠ dimension (kg vs L) **ไม่เก็บแยก** (§2.1) → pending |
| netContentUnit | — | **ไม่มี field** (ฝังใน `pack_size` free-text หรือ implied). GAP |
| (ประกอบ) | `pack_size` (free text) · `unit_weight_g` (mass/unit hint) | เช่น SP-243 = 4680 g |
| price | `price_per_pack` / `cost_per_pack` · `purchase_price_per_kg` | purchase_price_per_kg ใช้ใน `v_cost_per_bag` (meat yield) |
| currency | — | **ไม่มี field**, THB implicit. GAP |
| effectiveAt / recordedAt | `updated_at` / `created_at` เท่านั้น | **ไม่มี effective time แยก**. GAP |
| sourceReference | `notes` (free-text, 19/319) + `actor_id` | ⚠ ไม่ structured. GAP |
| approvalState | — | ฝั่ง Stock ไม่มี → **cookbook ต้อง land ทุกค่าเป็น `pending`** (§4.3/§6) |
| conversion/yield | `yield_pct` (default 1.0 ⚠ §2.4 → pending) · yield_expected_min/max · bom_unit_type (default g) · unit_weight_g | **ไม่มี** density · volume↔mass · kitchen-measure — model ห้าม infer (§4.4) |
| supplier | `supplier` (free text) + `item_suppliers.is_preferred` + `suppliers` | ไม่มี auto cheapest-pick (§9) |
| mapping hint | `cb_ingredient_id` (173/319) + `cb_recipe_id` | ⚠ **candidate เท่านั้น** — §4.2 ต้อง cookbook approve explicit |

## 3. Read-only consumer contract (§3.3 / §4.1)

- Route = **staged read-only connector, snapshot-import ก่อน**. cookbook capture **Connector Source Record** immutable:
  `{ source system, source stock item id = items.id (uuid), computed revision/checksum, captured_at, unmodified payload, adapter_version }`.
  re-import bytes เดิม = idempotent; bytes เปลี่ยน = evidence ใหม่ ไม่ rewrite (§4.1).
- **Read surface วันนี้:** `public.items` (filter is_bom_eligible/active) เป็น source payload.
- **⚠ ข้อควรระวังสำคัญ (correction 2026-08-23):** ใน Stock DB เดียวกันมี **legacy schema `cookingbook.*`** อยู่จริง — views `cookingbook.ingredients` (บน public.items WHERE is_bom_eligible + cb_ingredient_id), `cookingbook.recipe_costs`, `cookingbook.srcp_cost_recursive` + tables recipes/bom_items/tier_pricing/control_params. **นี่คือ shared-DB-identity coupling ที่ #34 §1 + §3.2 ปฏิเสธ** ("without sharing database identity with Stock"). new cookbook (hvrww `COOKBOOK MASTER` project) **ห้าม consume ผ่าน views พวกนี้** — legacy cookingbook.* = ของเก่าที่ #34 ออกแบบมาแทน ไม่ใช่ contract surface. → ใช้ snapshot connector เท่านั้น.
- ไม่ share DB identity · ไม่ write Stock · ไม่มี service-role/browser credential (§9, done-when#5). access = read-only.
- ทุก fact ที่ import → land เป็น `pending` Cost Observation; qty dimension กำกวม / ไม่มี effectiveAt / ไม่มี conversion = **FAIL CLOSED** (§6) ห้าม auto-approve.

## 4. Known gaps / exclusions

**GAPS** (model ต้องการ, data ไม่มี): (a) revision/checksum token · (b) explicit netContentUnit / qty dimension · (c) currency · (d) effectiveAt↔recordedAt แยก · (e) structured provenance (19 notes free-text) · (f) density & volume↔mass & kitchen-measure conversion · (g) yield_pct default ambiguity · (h) formal stale policy = ไม่มี · (i) approvalState ฝั่ง source = ไม่มี.

**EXCLUSIONS** (non-goal §9): ไม่ write/แก้ schema Stock · ไม่มี live creds/connection · category ≠ ingredient identity · ไม่ universal gram · ไม่ purchasing/receiving/valuation · ไม่ auto supplier/cheapest.

## 5. Boundary + agreement (CONFIRMED)

**nntn owner-set boundary:** อันนี้ = read-only SOT evidence + contract mapping เท่านั้น.
build live connector (E1 code + E2 test) = **DEFERRED** ตาม TINE owner decision 2026-08-22
(#31 E0, comment 5381346990) — build เมื่อ Food Cost live หลัง #32 **และ** ความถี่ราคามือคุ้ม
automate, และต้องเป็น tracer/production-grade (dev-standard 2.3.8) ไม่ใช่ prototype.
**ห้าม mutate Stock** โดยไม่มี TINE deploy word แยก.

**cookbook CONFIRMED (2026-08-23):**
1. ทุก imported Stock price/pack/yield fact → land เป็น pending จนกว่า cookbook review approve; ambiguous dimension/effective time/provenance = fail closed.
2. cb_ingredient_id = candidate-not-approved · ไม่ auto-bind Recipe/Ingredient/Stock identity.
3. acceptance ปัจจุบันไม่ต้องมี live connector; E1/E2 deferred หลัง #32 + owner automation-value decision.
4. cookbook รักษา snapshot-import / read-only / no-Stock-write boundaries; integration map แยก "source completeness" ออกจาก "Cookbook-approved cost readiness".

---
*Companion thread: COSTING + SELLING PRICE guideline (nntn-codex → cookbook, 3/3 + source map, 2026-08-23) — คนละ thread, ต้นทุน/ราคาขาย ไม่ใช่ ingredient-cost SOT นี้.*
