# Brief · NNTN Web Redesign Spike v0.3 — Ops Console (Missing Hero)

## Context
Spike v0.2 ส่งมอบ 10 artifacts ครบทุก mobile operational surface + bug-fix protos
Live: https://ttt3p.github.io/nntn/spike/
Blueprint SoT: https://github.com/TTT3P/nntn/blob/main/BLUEPRINT.md

## ⚠️ Brand (OFFICIAL — paste exact values, do not interpret)

Source: `เนื้อในตำนาน_BRAND GUIDELINE.pdf` (§2.1 + §3)

**Colors (only 2):**
- Primary green: **`#005036`** · RGB(0, 80, 54) · CMYK(91, 41, 85, 42)
- Accent gold/terracotta: **`#D29568`** · RGB(210, 149, 104) · CMYK(16, 45, 64, 1)
- No third brand color. Do not invent.

**Typography:**
- English: **Crimson Text** (Bold/Semibold/Regular)
- Thai display: **Moh Luang** (Regular — headline heritage feel)
- Thai sans: **SOV_Station** (Bold + Book — sub + body)

**Logo rules (§1.7, 9 don'ts):** no rotate · no recolor · no outline · no disproportionate · no visual FX · no frame · no harmonious bg · no combine tagline · no modify parts
**Minimum:** 2cm stacked · 3cm horizontal
**Brand element:** diamond lattice pattern + standalone diamond ornament (4-point radial symmetry)

Asset paths: `~/Documents/Claude-Work/ไฟล์/AI-Strategy/brand identity/Brand Asset-20260413T061700Z-3-001.zip`

## Gap ที่ต้องปิด
ยังไม่มี "single-pane-of-glass" — **desktop-native ops console** ที่ไทน์ (เจ้าของร้าน) เปิดเช้ามา = เห็นสถานะร้านทั้งระบบในหน้าเดียว

v0.2 มี `platform-health-proto` แต่เป็น SRE monitoring · ไม่ใช่ business overview
v0.2 plan list `goal-dashboard.html` เป็น KEEP แต่ไม่ redesign

ต้อง draft **ใหม่ทั้งหน้า** ไม่ใช่ skin หน้าเก่า

## Deliverable
1 artifact: `ops-console-proto.html`
- vanilla HTML/CSS · Chart.js จาก CDN OK
- ใช้ `tokens.css` (แก้ไข่แล้วเป็น official hex) + component patterns ของ spike v0.2
- desktop-first (1440px canvas) · responsive down to 1024px laptop · ไม่ต้อง mobile
- Mock data hardcoded (ยังไม่ wire Supabase)

## User = เจ้าของร้าน (ไทน์) · Jobs-to-be-done เช้าละ 5 นาที
1. "วันนี้ขายไปกี่บาท · เทียบเมื่อวาน/week ago ดีขึ้นหรือแย่ลง"
2. "ของใกล้หมดไหม · SKU ไหนต้องสั่ง"
3. "มีอะไรรอผม approve อยู่"
4. "น้องทำอะไรตั้งแต่เช้า" (accountability)
5. "สัปดาห์นี้ยังถึงเป้าไหม" (goal progress)

## Layout scaffold (designer ตัดสินใจ layout จริง)

```
┌─ TOP BAR ───────────────────────────────────────────────┐
│  NNTN · ห้องควบคุม     วันนี้ 23 เม.ย. · ◆ 09:42        │
│  [ไทน์ ▾] [🔔 2]                                        │
├─ ROW 1 · KPI cards (4) ─────────────────────────────────┤
│ ยอดรวม · FS · Grab · Wongnai                           │
│ แต่ละการ์ด: ตัวเลขใหญ่ + Δ% vs เมื่อวาน + sparkline 7d │
├─ ROW 2 · Revenue graph ─────────────────────────────────┤
│ 7-14 วัน · stacked bar by channel · Chart.js           │
│ toggle: day/week/month                                  │
├─ ROW 3 · 3-col split ───────────────────────────────────┤
│ [Stock alerts]  [Pending approvals]  [Goal progress]   │
│  3 SKU ใกล้หมด  2 rows รอ approve    43% · 7d left     │
├─ ROW 4 · Activity feed (live-ish) ──────────────────────┤
│ 09:42 น้องแอน produce MT-019 × 8 bag                   │
│ 09:15 PO-241 received · 13 items                       │
│ 09:03 FS order #4821 dispensed                         │
│ [ดูทั้งหมด →]                                           │
└─────────────────────────────────────────────────────────┘
```

Sidebar left (60-80px icon rail หรือ 240px expanded):
🏠 Home · 📦 Stock · 🍳 Prep · 🚚 Ship · 📋 Count · 📊 Report · 🎯 Goals · ⚙️ Admin

## Visual
- Editorial + operational (ไม่ใช่ minimalist flat · ไม่ใช่ neon/gradient)
- Heritage feel via Moh Luang (Thai display) + Crimson Text (English heading) + SOV_Station (Thai body)
- Diamond ornament divider ระหว่าง sections OK (brand element §4.2)
- Dense info · high contrast · fast scan

## Chart style
- Chart.js 4.x CDN
- Grid สุขุม · gridline สีจาง
- Stacked bar: primary-500 / accent-500 / ink-400 (channel mapping)
- ไม่ใช้สีรุ้ง 7 สี · เลือก 3-4 สีจาก token

## References ให้ inspired (ไม่ clone)
- Linear Home
- Stripe Dashboard
- Shopify Admin (orders overview)
- Vercel project dashboard

## ส่งเมื่อเสร็จ
- ลง zip รวม `ops-console-proto.html` + update `tokens.css` ถ้าเพิ่ม chart color tokens
- ถ้าเพิ่ม component ใหม่ (เช่น sparkline card) → update `components.html` ด้วย
- Update `index.html` spike: เพิ่ม card Phase 4A · Ops Console

## Out of scope (อย่าทำ)
- Mobile version (v0.2 มี mobile ครบแล้ว)
- Wire Supabase จริง (mock data พอ)
- Sidebar expand/collapse interaction (static state ok)
- Admin inner pages (items/bom/config) — แยก brief
