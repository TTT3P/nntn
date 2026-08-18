import { test as browserTest, expect } from "@playwright/test";
import {
  installStrictPageGuard,
  isAllowedLoopbackHttpUrl,
} from "./browser-guards";

const allowedUrls = [
  "http://127.0.0.1:4187/nntn-cookbook/",
  "https://LOCALHOST./path",
  "http://[::1]:4187/path",
  "http://[0:0:0:0:0:0:0:1]/path",
];

const rejectedUrls = [
  "http://localhost.example.com/",
  "http://127.0.0.1.example.com/",
  "http://user@localhost/",
  "https://[::2]/",
  "https://example.com/",
  "ftp://localhost/file",
  "not a URL",
];

for (const url of allowedUrls) {
  browserTest(`accepts canonical loopback URL ${url}`, () => {
    expect(isAllowedLoopbackHttpUrl(url)).toBe(true);
  });
}

for (const url of rejectedUrls) {
  browserTest(`rejects non-loopback or non-HTTP URL ${url}`, () => {
    expect(isAllowedLoopbackHttpUrl(url)).toBe(false);
  });
}

browserTest("catches delayed boundary failures before listener teardown", async ({ page }) => {
  await page.goto("./#/recipes");
  await page.route("**/late-404", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.route("**/late-fail", (route) => route.abort("connectionfailed"));
  await page.route("**/late-post", (route) => route.fulfill({ status: 204 }));
  await page.route("**/late-supabase", (route) => route.fulfill({ status: 200, body: "ok" }));
  await page.route("**/late-redirect", (route) => route.fulfill({
    status: 302,
    headers: { location: "https://external.example/redirected" },
  }));
  await page.route("https://external.example/**", (route) => route.fulfill({ status: 200, body: "ok" }));

  const guard = installStrictPageGuard(page);
  try {
    await page.evaluate(() => {
      window.setTimeout(() => {
        void fetch("./late-404").catch(() => undefined);
        void fetch("./late-fail").catch(() => undefined);
        void fetch("./late-redirect").catch(() => undefined);
        void fetch("./late-post", { method: "POST", body: "payload" }).catch(() => undefined);
        void fetch("./late-supabase").catch(() => undefined);
        console.warn("late synthetic warning");
        window.setTimeout(() => {
          throw new Error("late synthetic page error");
        }, 0);
        const image = document.createElement("img");
        image.alt = "late broken synthetic image";
        image.src = "data:image/png;base64,broken";
        document.body.append(image);
      }, 50);
    });

    await guard.drain();
    let caught: unknown;
    try {
      await guard.assertClean();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = caught instanceof Error ? caught.message : "";
    for (const expected of [
      "HTTP 404",
      "failed request",
      "external request",
      "disallowed method",
      "request body",
      "forbidden service request",
      "console warning",
      "page error",
      "broken image",
    ]) {
      expect(message).toContain(expected);
    }
  } finally {
    guard.detach();
  }
});
