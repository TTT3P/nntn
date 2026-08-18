import { afterEach, describe, expect, test, vi } from "vitest";

interface ConfigUse {
  connectOptions?: {
    wsEndpoint: string;
    headers?: Record<string, string>;
  };
  launchOptions?: {
    executablePath?: string;
  };
}

async function loadUse(configPath: string): Promise<ConfigUse> {
  vi.resetModules();
  const module = await import(configPath) as { default: { use?: ConfigUse } };
  return module.default.use ?? {};
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe.each([
  ["default", "../playwright.config"],
  ["local", "../playwright.local.config"],
])("%s Playwright config remote connection", (_label, configPath) => {
  test("preserves local launch selection when the websocket endpoint is absent", async () => {
    vi.stubEnv("PLAYWRIGHT_WS_ENDPOINT", "");
    vi.stubEnv("PLAYWRIGHT_WS_USER_AGENT", "");

    const use = await loadUse(configPath);

    expect(use.connectOptions).toBeUndefined();
    if (use.launchOptions !== undefined) {
      expect(use.launchOptions.executablePath).toBeTruthy();
    }
  });

  test("connects to the exact opt-in endpoint with the caller-supplied User-Agent", async () => {
    vi.stubEnv("PLAYWRIGHT_WS_ENDPOINT", "ws://127.0.0.1:3999/session-token");
    vi.stubEnv("PLAYWRIGHT_WS_USER_AGENT", "caller-playwright-version");

    const use = await loadUse(configPath);

    expect(use.connectOptions).toEqual({
      wsEndpoint: "ws://127.0.0.1:3999/session-token",
      headers: { "User-Agent": "caller-playwright-version" },
    });
  });
});
