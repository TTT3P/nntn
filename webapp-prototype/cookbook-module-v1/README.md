# NNTN CookingBook

Standalone, session-only local prototype for the NNTN intelligent cookbook module. It does not persist data or call Supabase, Storage, analytics, CDN, or any other production service.

## Local setup and run

Prerequisites: Node.js 20 or newer, npm, and Google Chrome for the verified browser/print checks. Run these commands from `webapp-prototype/cookbook-module-v1/` in the isolated Cookbook worktree; do not run them from Stock V1 or the production checkout.

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173/nntn-cookbook/` (or the loopback port printed by Vite if 5173 is unavailable). Keep the terminal open while using the pilot, then press `Ctrl-C` to stop it. Nothing is deployed and a reload restores the versioned fixture.

### Pilot operator check

Before kitchen use, confirm this short flow in Chrome:

1. Search by recipe name for `ข้าวหน้าเนื้อตุ๋น`.
2. Open its dependency and confirm `เนื้อตุ๋น (ราดข้าว)` is reachable.
3. Open Source Review and confirm conflicts/missing values remain visible instead of being guessed.
4. Open Service print and confirm cooked rice is `180 กรัม`, not the `72 กรัม` raw-rice cost basis.
5. Export JSON and confirm the browser downloads a prototype snapshot; it is not a save, approval, or production write.

The pilot is local and session-only. Do not enter new authoritative recipe values, treat DEMO media as kitchen evidence, or use this module for production approval or persistence. Run the complete release and print gates in [the verification guide](../docs/COOKBOOK-V1-VERIFICATION.md) before accepting a new commit for pilot use.

To exercise the production bundle locally:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

## Commands

- `npm run dev` starts the local Vite development server.
- `npm test` runs the Vitest suite once.
- `npm run lint` runs ESLint.
- `npm run typecheck` checks TypeScript without emitting files.
- `npm run build` creates the production bundle in `dist/`.
- `npm run test:browser` runs the focused print geometry/capacity harness in headless Chrome.
- `npm run test:browser:export` runs the real JSON download and object-URL lifecycle harness.
- `npm run test:e2e` builds the app, starts an isolated loopback preview on port 4187, and runs the Playwright QA suite.

Browser evidence for V1 is empirical Chrome-only evidence. Playwright uses `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when supplied, otherwise detects common system Chrome/Chromium locations and only falls back to Playwright's bundled browser when one is already available. The test commands do not install or download a browser.

See [docs/HANDOFF.md](docs/HANDOFF.md) for scope, source precedence, limitations, and the separately gated future Supabase boundary.
