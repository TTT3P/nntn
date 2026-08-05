# NNTN CookingBook

Standalone, session-only local prototype for the NNTN intelligent cookbook module. It does not persist data or call Supabase, Storage, analytics, CDN, or any other production service.

## Local setup and run

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

Open the loopback URL printed by Vite. The configured application base is `/nntn-cookbook/`.

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
