import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const host = "127.0.0.1";
const port = 4176;
const origin = `http://${host}:${port}`;
const systemBrowsers = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter((candidate) => typeof candidate === "string" && existsSync(candidate));

async function connectOrLaunchBrowser() {
  const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT;
  if (typeof wsEndpoint === "string" && wsEndpoint.length > 0) {
    const userAgent = process.env.PLAYWRIGHT_WS_USER_AGENT;
    return chromium.connect(wsEndpoint, {
      ...(typeof userAgent === "string" && userAgent.length > 0
        ? { headers: { "User-Agent": userAgent } }
        : {}),
    });
  }
  return chromium.launch({
    headless: true,
    ...(systemBrowsers[0] ? { executablePath: systemBrowsers[0] } : {}),
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = await createServer({
  logLevel: "error",
  server: { host, port, strictPort: true },
});
await server.listen();

let browser;
try {
  browser = await connectOrLaunchBrowser();
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const externalRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== origin) externalRequests.push(request.url());
  });
  await page.addInitScript(() => {
    const events = [];
    const nativeCreate = URL.createObjectURL.bind(URL);
    const nativeRevoke = URL.revokeObjectURL.bind(URL);
    globalThis.__snapshotDownloadUrlEvents = events;
    URL.createObjectURL = (blob) => {
      const url = nativeCreate(blob);
      events.push({ type: "create", url, at: performance.now() });
      return url;
    };
    URL.revokeObjectURL = (url) => {
      events.push({ type: "revoke", url, at: performance.now() });
      nativeRevoke(url);
    };
  });

  await page.goto(`${origin}/nntn-cookbook/`);
  await page.getByRole("heading", { name: "คลังสูตรอาหาร" }).waitFor();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export prototype snapshot" }).click(),
  ]);
  assert(
    download.suggestedFilename() === "cookbook-prototype-snapshot.json",
    `unexpected download filename: ${download.suggestedFilename()}`,
  );
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  assert(exported.schemaVersion === "cookbook-prototype-v1", "downloaded JSON schema mismatch");
  assert(Array.isArray(exported.recipes) && exported.recipes.length > 0, "downloaded JSON missing recipes");
  assert(
    exported.media.every((asset) => asset.exportWarning === "binary-not-included"),
    "session media warning missing from browser download",
  );

  const beforeGraceEvents = await page.evaluate(() => globalThis.__snapshotDownloadUrlEvents);
  assert(beforeGraceEvents.length === 1 && beforeGraceEvents[0].type === "create", `URL revoked before download consumption: ${JSON.stringify(beforeGraceEvents)}`);
  await page.waitForTimeout(1_100);
  const events = await page.evaluate(() => globalThis.__snapshotDownloadUrlEvents);
  assert(events.length === 2, `expected one create and one revoke: ${JSON.stringify(events)}`);
  assert(events[0].type === "create" && events[1].type === "revoke", `unexpected URL lifecycle: ${JSON.stringify(events)}`);
  assert(events[0].url === events[1].url, `revoked wrong download URL: ${JSON.stringify(events)}`);
  assert(events[1].at - events[0].at >= 900, `download URL grace period too short: ${JSON.stringify(events)}`);
  assert(await page.locator('a[download="cookbook-prototype-snapshot.json"]').count() === 0, "download anchor leaked into document");
  assert(externalRequests.length === 0, `unexpected external requests: ${externalRequests.join(", ")}`);
} finally {
  await browser?.close();
  await server.close();
}
