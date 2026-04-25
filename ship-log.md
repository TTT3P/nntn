# Ship Log

> Latest ships at top · scan 5 วิรู้ว่าเพิ่ง ship อะไรไป · detail อยู่ใน BLUEPRINT.md §6 · commits ใน git log
>
> Append pattern: หลัง `git push` สำเร็จ · prepend 1 row · Discord notify ตามเดิม
>
> Format: `<DD/MM> · <commit> · <what> · <who> · <channels notified>`

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
