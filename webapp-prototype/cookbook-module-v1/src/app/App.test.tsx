import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import type { CookbookRepository } from "../data/CookbookRepository";
import fixture from "../data/fixtures/first-set.json";
import type {
  KitchenSotDraftClient,
  LoadedKitchenSotDraft,
} from "../data/KitchenSotDraftClient";
import { parseKitchenSotDocument } from "../domain/sot/kitchenSotDocument";
import { makeRecipe, makeSnapshot, makeWorkStep } from "../test/builders";
import { App } from "./App";

declare const process: {
  getBuiltinModule(name: "node:fs"): {
    readFileSync(path: string, encoding: "utf8"): string;
  };
};

const { readFileSync } = process.getBuiltinModule("node:fs");
const appStyles = readFileSync("src/app/styles.css", "utf8");

afterEach(() => {
  cleanup();
  window.location.hash = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function makeRepository(snapshot = makeSnapshot()): CookbookRepository {
  return {
    capabilities: {
      persistence: "session",
      mediaUpload: false,
      production: false,
    },
    loadSnapshot: vi.fn(async () => snapshot),
    saveSessionSnapshot: vi.fn(async () => ({
      persisted: false as const,
      scope: "session" as const,
    })),
  };
}

function makeDraftClient(): KitchenSotDraftClient {
  const document = parseKitchenSotDocument(fixture);
  return {
    load: vi.fn(async () => ({
      document,
      origin: "v4" as const,
      sourcePath: "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json" as const,
      sourceSha256: "a".repeat(64),
      baseSha256: "b".repeat(64),
    })),
    save: vi.fn(),
  };
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

test("labels the app as an explicit read-only session prototype without a draft client", async () => {
  const repository = makeRepository();

  render(<App repository={repository} draftClient={null} />);
  expect(screen.getByRole("heading", { name: "CookingBook" })).toBeInTheDocument();
  expect(screen.getByText("Prototype · ข้อมูลเฉพาะเครื่อง")).toBeInTheDocument();
  expect(
    screen.getByText(/รีเซ็ตเมื่อโหลดหน้าใหม่/),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "คลังสูตรอาหาร" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Export prototype snapshot" })).toBeVisible();
  expect(screen.getByText(/session file binaries are not included/i)).toBeVisible();
});

test("labels Recipe Studio as locally durable while other prototype pages remain session-only", async () => {
  const client = makeDraftClient();
  render(<App repository={makeRepository()} draftClient={client} />);

  expect(
    screen.getByText(
      "Recipe Studio บันทึกลง V5 draft ในเครื่อง · รูปและหน้าทดลองอื่นยังอยู่เฉพาะเซสชัน",
    ),
  ).toBeVisible();
  expect(screen.queryByText(/รีเซ็ตเมื่อโหลดหน้าใหม่/)).not.toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "คลังสูตรอาหาร" }),
  ).toBeInTheDocument();
  expect(client.load).toHaveBeenCalledTimes(1);
});

test("fails closed instead of showing fixture READY while the local raw draft is loading", async () => {
  const projectedReady = makeRecipe({ recipeId: 159, name: "ข้าวหน้าเนื้อยากินิกุ" });
  const client: KitchenSotDraftClient = {
    load: vi.fn(() => new Promise<LoadedKitchenSotDraft>(() => undefined)),
    save: vi.fn(),
  };

  render(
    <App
      repository={makeRepository(makeSnapshot({ recipes: [projectedReady] }))}
      draftClient={client}
    />,
  );

  expect(await screen.findByText("กำลังโหลดร่าง Kitchen SOT…")).toBeVisible();
  expect(screen.queryByText("พร้อมใช้งาน")).not.toBeInTheDocument();
  expect(client.load).toHaveBeenCalledTimes(1);
});

test("fails closed instead of showing fixture READY when the local raw draft cannot load", async () => {
  const projectedReady = makeRecipe({ recipeId: 159, name: "ข้าวหน้าเนื้อยากินิกุ" });
  const client: KitchenSotDraftClient = {
    load: vi.fn(async () => { throw new Error("raw draft unavailable"); }),
    save: vi.fn(),
  };

  render(
    <App
      repository={makeRepository(makeSnapshot({ recipes: [projectedReady] }))}
      draftClient={client}
    />,
  );

  expect(await screen.findByRole("alert")).toHaveTextContent("โหลดร่าง Kitchen SOT ไม่สำเร็จ");
  expect(screen.queryByText("พร้อมใช้งาน")).not.toBeInTheDocument();
  expect(client.load).toHaveBeenCalledTimes(1);
});

test("keeps responsive layout rules scoped away from projected and Print Center shells", () => {
  const responsiveStart = appStyles.indexOf("@media (max-width: 48rem)");
  expect(responsiveStart).toBeGreaterThan(-1);
  const responsiveStyles = appStyles.slice(responsiveStart);

  expect(responsiveStyles).not.toContain(".app-shell");
  expect(responsiveStyles).not.toContain(".recipe-page");
  expect(responsiveStyles).not.toContain(".print-center");
  expect(appStyles).not.toContain("@media print");
});

test("sets the accepted minimum interaction sizes for Recipe Studio controls", () => {
  expect(appStyles).toMatch(
    /\.sot-edit-grid input,\s*\.sot-edit-grid textarea,\s*\.sot-save-bar button\s*\{[^}]*min-height:\s*3rem;/u,
  );
  expect(appStyles).toMatch(
    /\.sot-blocker label\s*\{[^}]*min-height:\s*2\.75rem;/u,
  );
});

test("downloads the current provider snapshot without revoking its active media preview URL", async () => {
  const user = userEvent.setup();
  window.location.hash = "#/work/1?stage=prep";
  const repository = makeRepository(makeSnapshot({
    recipes: [makeRecipe({
      workDocuments: {
        prep: {
          stage: "prep",
          scalable: true,
          ingredientLineKeys: [],
          steps: [makeWorkStep({ stepId: "upload-step" })],
        },
      },
    })],
  }));
  let clickedDownload: { href: string; download: string } | undefined;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clickedDownload = { href: this.href, download: this.download };
  });
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const storageGet = vi.spyOn(Storage.prototype, "getItem");
  const storageSet = vi.spyOn(Storage.prototype, "setItem");

  render(<App repository={repository} draftClient={null} />);
  await screen.findByRole("heading", { name: "สูตรทดสอบ", level: 2 });
  await user.upload(
    screen.getByLabelText("เลือกรูป"),
    new File(["binary-content-must-not-be-exported"], "updated-photo.png", { type: "image/png" }),
  );
  expect(screen.getByAltText("ตัวอย่าง updated-photo.png")).toHaveAttribute("src", "blob:test-media-1");

  act(() => screen.getByRole("button", { name: "Export prototype snapshot" }).click());

  expect(clickedDownload).toEqual({
    href: "blob:test-media-2",
    download: "cookbook-prototype-snapshot.json",
  });
  const downloadBlob = vi.mocked(URL.createObjectURL).mock.calls[1]![0] as Blob;
  const json = await readBlob(downloadBlob);
  const exported = JSON.parse(json);
  expect(exported.schemaVersion).toBe("cookbook-prototype-v1");
  expect(exported.media).toEqual([
    expect.objectContaining({
      caption: "updated-photo.png",
      url: "blob:test-media-1",
      localSessionOnly: true,
      exportWarning: "binary-not-included",
    }),
  ]);
  expect(json).not.toContain("binary-content-must-not-be-exported");
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  await new Promise((resolve) => window.setTimeout(resolve, 1_050));
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-media-2");
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:test-media-1");
  expect(screen.getByRole("status")).toHaveTextContent("ดาวน์โหลด snapshot แล้ว");
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(storageGet).not.toHaveBeenCalled();
  expect(storageSet).not.toHaveBeenCalled();
});

test("reports download URL creation failure without crashing the active route", async () => {
  const user = userEvent.setup();
  vi.mocked(URL.createObjectURL).mockImplementationOnce(() => {
    throw new Error("download URL unavailable");
  });
  render(<App repository={makeRepository()} draftClient={null} />);
  await screen.findByRole("heading", { name: "คลังสูตรอาหาร" });

  await user.click(screen.getByRole("button", { name: "Export prototype snapshot" }));

  expect(screen.getByRole("alert")).toHaveTextContent("Error: download URL unavailable");
  expect(screen.getByRole("heading", { name: "คลังสูตรอาหาร" })).toBeVisible();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
});

test("revokes only the download URL when anchor click fails", async () => {
  const user = userEvent.setup();
  vi.mocked(URL.createObjectURL).mockReturnValueOnce("blob:download-failure");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementationOnce(() => {
    throw new Error("anchor click failed");
  });
  render(<App repository={makeRepository()} draftClient={null} />);
  await screen.findByRole("heading", { name: "คลังสูตรอาหาร" });

  await user.click(screen.getByRole("button", { name: "Export prototype snapshot" }));

  expect(screen.getByRole("alert")).toHaveTextContent("Error: anchor click failed");
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:download-failure");
  expect(screen.getByRole("heading", { name: "คลังสูตรอาหาร" })).toBeVisible();
});

test("surfaces Blob construction and URL revocation failures without route crashes", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("Blob", class FailingBlob {
    constructor() {
      throw new Error("Blob construction failed");
    }
  });
  render(<App repository={makeRepository()} draftClient={null} />);
  await screen.findByRole("heading", { name: "คลังสูตรอาหาร" });

  await user.click(screen.getByRole("button", { name: "Export prototype snapshot" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Error: Blob construction failed");
  expect(URL.createObjectURL).not.toHaveBeenCalled();

  vi.unstubAllGlobals();
  vi.mocked(URL.createObjectURL).mockReturnValueOnce("blob:revoke-failure");
  vi.mocked(URL.revokeObjectURL).mockImplementationOnce(() => {
    throw new Error("revoke failed");
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementationOnce(() => undefined);
  vi.useFakeTimers();
  act(() => screen.getByRole("button", { name: "Export prototype snapshot" }).click());
  await act(() => vi.advanceTimersByTime(1_000));

  expect(screen.getByRole("alert")).toHaveTextContent("Error: revoke failed");
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:revoke-failure");
  expect(screen.getByRole("heading", { name: "คลังสูตรอาหาร" })).toBeVisible();
});

test("keeps rapid download URLs independent and releases each after its grace period even after unmount", async () => {
  vi.mocked(URL.createObjectURL)
    .mockReturnValueOnce("blob:download-one")
    .mockReturnValueOnce("blob:download-two");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  const view = render(<App repository={makeRepository()} draftClient={null} />);
  await screen.findByRole("heading", { name: "คลังสูตรอาหาร" });
  const button = screen.getByRole("button", { name: "Export prototype snapshot" });

  vi.useFakeTimers();
  act(() => {
    button.click();
    button.click();
  });

  expect(document.querySelectorAll('a[download="cookbook-prototype-snapshot.json"]')).toHaveLength(0);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  view.unmount();
  act(() => vi.advanceTimersByTime(999));
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:download-one");
  expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:download-two");
});

test.each([
  () => Object.create(null),
  () => Symbol("secret-control-\u0000"),
  () => ({
    toString() {
      throw new Error("must not coerce");
    },
    [Symbol.toPrimitive]() {
      throw new Error("must not coerce");
    },
  }),
  () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    return revoked.proxy;
  },
])("renders a safe generic diagnostic for hostile non-Error throws", async (makeThrownValue) => {
  const user = userEvent.setup();
  vi.stubGlobal("Blob", class HostileBlob {
    constructor() {
      throw makeThrownValue();
    }
  });
  render(<App repository={makeRepository()} draftClient={null} />);
  await screen.findByRole("heading", { name: "คลังสูตรอาหาร" });

  await user.click(screen.getByRole("button", { name: "Export prototype snapshot" }));

  expect(screen.getByRole("alert")).toHaveTextContent("Unknown error");
  expect(screen.getByRole("heading", { name: "คลังสูตรอาหาร" })).toBeVisible();
  expect(screen.getByRole("alert").textContent).not.toContain("secret-control");
});
