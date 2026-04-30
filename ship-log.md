# Ship Log

> Latest ships at top · scan 5 วิรู้ว่าเพิ่ง ship อะไรไป · detail อยู่ใน BLUEPRINT.md §6 · commits ใน git log
>
> Append pattern: หลัง `git push` สำเร็จ · prepend 1 row · Discord notify ตามเดิม
>
> Format: `<DD/MM> · <commit> · <what> · <who> · <channels notified>`

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
