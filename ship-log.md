# Ship Log

> Latest ships at top · scan 5 วิรู้ว่าเพิ่ง ship อะไรไป · detail อยู่ใน BLUEPRINT.md §6 · commits ใน git log
>
> Append pattern: หลัง `git push` สำเร็จ · prepend 1 row · Discord notify ตามเดิม
>
> Format: `<DD/MM> · <commit> · <what> · <who> · <channels notified>`

---

## 2026-04-24

| Time | Commit | What | Channels |
|---|---|---|---|
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
