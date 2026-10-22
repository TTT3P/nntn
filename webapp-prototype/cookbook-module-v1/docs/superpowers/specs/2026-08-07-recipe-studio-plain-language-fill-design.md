# Recipe Studio Plain-Language Fill Design

**Date:** 2026-08-07
**Status:** Approved by TINE
**Scope:** Recipe Studio item-entry UX in the Cookbook local pilot

## Problem

The current item card exposes internal concepts such as `ค่าหน้าครัว`, `หมายเหตุปริมาณเสิร์ฟ`, `ฐานต้นทุน`, source names, and decision statuses. TINE reported that the screen is difficult to understand and cannot be used without explanation.

The user's actual job is simpler: ask the kitchen team how much of an ingredient they use, then record the answer without converting the kitchen unit.

## Chosen Design

Each ingredient card presents one primary question:

> ทีมครัวใช้เท่าไร?

The field accepts the same raw text already stored by the V5 `item-owner-confirmation` edit, with examples such as `30 กรัมต่อจาน`, `1 ทัพพี`, or `ครึ่งช้อนโต๊ะ`. The current candidate is introduced as `ตอนนี้ใช้:` rather than by a schema-oriented label.

Everything not needed for the common path moves into a native `details` disclosure labelled `ตัวเลือกเพิ่มเติม (ไม่บังคับ)`. It is closed by default and contains:

- source evidence and technical decision state;
- `ปริมาณตอนเสิร์ฟ` with help text explaining that it is used only when serving quantity differs;
- `ปริมาณสำหรับคิดต้นทุน` with help text explaining that it is used only when the costing quantity differs.

The disclosure remains keyboard and screen-reader accessible without custom JavaScript.

## Content Rules

- User-facing labels use task language, not schema language.
- Required and optional fields are explicit.
- Help text contains a concrete example where useful.
- Error text tells the user what to do next.
- Source keys and decision values may remain visible only inside the optional technical disclosure because they are preserved evidence.
- No copy implies that the data is published to production.

Approved labels:

| Existing copy | Replacement |
| --- | --- |
| `ค่าที่ใช้แสดง` | `ตอนนี้ใช้` |
| `ค่าหน้าครัว — {item}` | `ทีมครัวใช้ {item} เท่าไร? (ต้องกรอก)` |
| `หมายเหตุปริมาณเสิร์ฟ — {item}` | `ปริมาณตอนเสิร์ฟ (ไม่บังคับ)` |
| `ฐานต้นทุน — {item}` | `ปริมาณสำหรับคิดต้นทุน (ไม่บังคับ)` |
| `ค่าหน้าครัวต้องไม่ว่าง ระบบคืนค่าเดิมแล้ว` | `กรอกปริมาณที่ทีมครัวใช้ก่อน ระบบคืนค่าเดิมให้แล้ว` |
| `ข้อมูลยืนยันเจ้าของไม่ครบ` | `ยังรอคำตอบจากทีมครัว` |

## V5 Invariants

This is a presentation-only redesign. It must not change:

- raw `owner_confirmation`, `serving_note`, or `cost_basis_text` values;
- `KitchenSotEdit` variants or payloads;
- blur-to-commit behavior;
- decision notes, selected source, or decision status mapping;
- canonical readiness or blocker rules;
- raw-document persistence, validation, concurrency, key order, or middleware;
- V4 bytes or checksum.

Existing accessible labels used by tests may be updated only together with explicit regression changes proving the new user language and the same submitted edit payload.

## Interaction and States

- The primary quantity field is always visible.
- Optional fields and technical evidence are closed by default.
- Existing optional values remain discoverable and editable after opening the disclosure.
- A provenance gap is shown as `ยังรอคำตอบจากทีมครัว` near the primary field.
- Locked/saving behavior remains unchanged.
- Validation errors appear next to the primary field and move focus semantics through the existing `aria-describedby` relationship.

## Acceptance

1. An ingredient card shows only the ingredient name, current quantity, and `ทีมครัวใช้ {ชื่อวัตถุดิบ} เท่าไร?` in its default state.
2. The strings `ค่าหน้าครัว`, `ฐานต้นทุน`, `selected_source`, and `decision_status` do not appear in the default visible item card.
3. Opening `ตัวเลือกเพิ่มเติม (ไม่บังคับ)` reveals source evidence and the two optional fields.
4. Editing the primary field emits the same `item-owner-confirmation` payload and V5 leaf changes as before.
5. Editing either optional field emits the same existing edit payload as before.
6. Empty primary input restores the previous value and shows the approved plain-language error.
7. All M1 unit, lint, typecheck, build, browser, default E2E, and local-draft gates remain required.
8. V4 checksum remains unchanged and no real V5 draft is created by verification.

## Out of Scope

- Method, yield, blocker, Print Center, or Work-stage redesign.
- Recipe content changes or unit conversion.
- Stock V1/V2, Supabase, authentication, production data, deployment, MAW, or CROO.

## Stop Condition

The change is complete when the default item-entry path can be understood without schema knowledge, optional data remains available behind a clear disclosure, V5 edit bytes are unchanged for equivalent input, and all available verification gates pass with any environment-only browser gap stated explicitly.
