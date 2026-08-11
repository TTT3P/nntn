import { Buffer } from "node:buffer";
import { expect, test } from "./browser-guards";

type ObjectUrlEvent = { type: "create" | "revoke"; url: string; at: number };

test("finds the Thai menu, opens its related recipes, and previews the 180 gram service pack", async ({ page }) => {
  await page.goto("./#/recipes");
  await expect(page.getByRole("heading", { name: "สูตรอาหาร" })).toBeVisible();

  await page.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" }).fill("ข้าวหน้าเนื้อตุ๋น");
  await page.getByRole("link", { name: /^ข้าวหน้าเนื้อตุ๋น(?:\s|$)/u }).click();
  await expect(page.getByRole("navigation", { name: "สูตรที่ใช้ร่วมกัน" })
    .getByRole("link", { name: "เนื้อตุ๋น (ราดข้าว)", exact: true })).toBeVisible();

  await page.goto("./#/print");
  await page.getByRole("checkbox", { name: "ข้าวหน้าเนื้อตุ๋น · RCP-071" }).check();
  await page.locator("details.print-advanced > summary").click();
  await page.getByRole("combobox", { name: /^จุดงาน/u }).selectOption("service");

  await expect(page.getByRole("row", { name: /ข้าวหอมมะลิหุงสุก\s+180 กรัม/u })).toBeVisible();
  await expect(page.getByRole("row", { name: /72 กรัม/u })).toHaveCount(0);
  await expect(page.getByText("จัดเสิร์ฟหน้าร้าน").first()).toBeVisible();
});

test("downloads the current Cookbook JSON before revoking its object URL", async ({ page }) => {
  await page.addInitScript(() => {
    const scope = globalThis as typeof globalThis & {
      __snapshotDownloadUrlEvents?: ObjectUrlEvent[];
    };
    const events: ObjectUrlEvent[] = [];
    const nativeCreate = URL.createObjectURL.bind(URL);
    const nativeRevoke = URL.revokeObjectURL.bind(URL);
    scope.__snapshotDownloadUrlEvents = events;
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

  await page.goto("./#/recipes");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "ดาวน์โหลดข้อมูล" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("nntn-cookbook.json");

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    schemaVersion?: unknown;
    recipes?: unknown;
    recipes?: unknown[];
  };
  expect(exported.schemaVersion).toBe("6.0.0");
  expect(exported.recipes).toHaveLength(87);

  const eventsBeforeCleanup = await page.evaluate(() => {
    const scope = globalThis as typeof globalThis & {
      __snapshotDownloadUrlEvents?: ObjectUrlEvent[];
    };
    return scope.__snapshotDownloadUrlEvents ?? [];
  });
  expect(eventsBeforeCleanup.map((event) => event.type)).toEqual(["create"]);

  await expect.poll(async () => page.evaluate(() => {
    const scope = globalThis as typeof globalThis & {
      __snapshotDownloadUrlEvents?: ObjectUrlEvent[];
    };
    return scope.__snapshotDownloadUrlEvents ?? [];
  })).toHaveLength(2);
  const eventsAfterCleanup = await page.evaluate(() => {
    const scope = globalThis as typeof globalThis & {
      __snapshotDownloadUrlEvents?: ObjectUrlEvent[];
    };
    return scope.__snapshotDownloadUrlEvents ?? [];
  });
  expect(eventsAfterCleanup.map((event) => event.type)).toEqual(["create", "revoke"]);
  expect(eventsAfterCleanup[1]?.url).toBe(eventsAfterCleanup[0]?.url);
  expect((eventsAfterCleanup[1]?.at ?? 0) - (eventsAfterCleanup[0]?.at ?? 0)).toBeGreaterThanOrEqual(900);
});
