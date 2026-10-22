import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import { env } from "node:process";
import { defineConfig } from "@playwright/test";

const host = "127.0.0.1";
const port = 4188;
const appBase = "/nntn-cookbook/";

function executable(candidate: string | undefined): string | undefined {
  if (candidate === undefined || candidate.length === 0) return undefined;
  try {
    accessSync(candidate, constants.X_OK);
    return candidate;
  } catch {
    return undefined;
  }
}

function detectSystemChrome(): string | undefined {
  const explicit = executable(env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
  if (explicit !== undefined) return explicit;

  for (const candidate of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ]) {
    const resolved = executable(candidate);
    if (resolved !== undefined) return resolved;
  }

  for (const directory of env.PATH?.split(delimiter) ?? []) {
    for (const binary of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
      const resolved = executable(join(directory, binary));
      if (resolved !== undefined) return resolved;
    }
  }
  return undefined;
}

const systemChrome = detectSystemChrome();
const wsEndpoint = env.PLAYWRIGHT_WS_ENDPOINT;
const wsUserAgent = env.PLAYWRIGHT_WS_USER_AGENT;
const connectOptions = wsEndpoint === undefined || wsEndpoint.length === 0
  ? undefined
  : {
      wsEndpoint,
      ...(wsUserAgent === undefined || wsUserAgent.length === 0
        ? {}
        : { headers: { "User-Agent": wsUserAgent } }),
    };

export default defineConfig({
  testDir: "./tests",
  testMatch: ["cookbook-draft-persistence.spec.ts", "recipe-studio-layout.local.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: "list",
  outputDir: "node_modules/.cache/playwright-local-results",
  webServer: {
    command: "npm --script-shell=/bin/sh run test:prepare:local-draft && NNTN_VAULT_ROOT=node_modules/.cache/cookbook-v5-e2e-vault npm --script-shell=/bin/sh run dev -- --host 127.0.0.1 --port 4188 --strictPort",
    url: "http://127.0.0.1:4188/nntn-cookbook/",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    baseURL: `http://${host}:${String(port)}${appBase}`,
    viewport: { width: 1440, height: 1000 },
    ...(connectOptions === undefined ? {} : { connectOptions }),
    ...(systemChrome === undefined ? {} : { launchOptions: { executablePath: systemChrome } }),
  },
});
