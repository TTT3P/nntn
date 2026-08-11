import { defineConfig } from "@playwright/test";
import localConfig from "./playwright.local.config";

const port = 4189;

export default defineConfig({
  ...localConfig,
  testMatch: ["cookbook-v6-persistence.spec.ts"],
  outputDir: "node_modules/.cache/playwright-v6-local-results",
  webServer: {
    command: `node scripts/prepare-cookbook-v6-test-vault.mjs && NNTN_VAULT_ROOT=node_modules/.cache/cookbook-v6-e2e-vault ./node_modules/.bin/vite --host 127.0.0.1 --port ${String(port)} --strictPort`,
    url: `http://127.0.0.1:${String(port)}/nntn-cookbook/`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    ...localConfig.use,
    baseURL: `http://127.0.0.1:${String(port)}/nntn-cookbook/`,
  },
});
