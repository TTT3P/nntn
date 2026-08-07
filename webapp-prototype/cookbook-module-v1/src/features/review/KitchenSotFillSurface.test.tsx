import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import fixture from "../../data/fixtures/first-set.json";
import type {
  KitchenSotDraftClient,
  LoadedKitchenSotDraft,
} from "../../data/KitchenSotDraftClient";
import { KitchenSotHttpError } from "../../data/KitchenSotDraftClient";
import {
  parseKitchenSotDocument,
  type KitchenSotDocument,
  type RecipeIdentity,
} from "../../domain/sot/kitchenSotDocument";
import { KitchenSotDraftProvider } from "./KitchenSotDraftProvider";
import { KitchenSotFillSurface } from "./KitchenSotFillSurface";

const sourcePath = "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function loadedDraft(document: KitchenSotDocument): LoadedKitchenSotDraft {
  return {
    document,
    origin: "v4",
    sourcePath,
    sourceSha256: "a".repeat(64),
    baseSha256: "b".repeat(64),
  };
}

type TestClient = KitchenSotDraftClient & {
  load: ReturnType<typeof vi.fn<KitchenSotDraftClient["load"]>>;
  save: ReturnType<typeof vi.fn<KitchenSotDraftClient["save"]>>;
};

function makeClient(document: KitchenSotDocument): TestClient {
  return {
    load: vi.fn(async () => loadedDraft(document)),
    save: vi.fn(async (submitted) => ({
      document: submitted,
      sha256: "c".repeat(64),
      base_sha256: "c".repeat(64),
      generatedAt: submitted.generated_at,
      path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
    })),
  };
}

function renderFillSurfaceWithDocument(document: KitchenSotDocument) {
  const client = makeClient(document);
  render(
    <KitchenSotDraftProvider client={client}>
      <KitchenSotFillSurface />
    </KitchenSotDraftProvider>,
  );
  return {
    client,
    async selectRecipe(recipeId: RecipeIdentity) {
      const recipe = document.recipes.find(({ recipe_id }) => recipe_id === recipeId);
      if (!recipe) throw new Error(`Unknown test recipe ${String(recipeId)}`);
      const escapedName = recipe.recipe_name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      await userEvent.click(await screen.findByRole("button", { name: new RegExp(escapedName, "u") }));
    },
  };
}

test("renders all real recipes and derives the accepted snapshot counts", async () => {
  renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));

  expect(await screen.findByText("18 สูตร")).toBeVisible();
  expect(screen.getByText("4 เมนูขาย + 14 สูตรประกอบ")).toBeVisible();
  expect(screen.getByText("16 รายการรอกรอก/เคาะ")).toBeVisible();
  expect(screen.getByText("13 ตัวขวาง")).toBeVisible();
  expect(screen.getAllByRole("button", { name: /revision/u })).toHaveLength(18);
});

test("shows the derived provenance gap without hardcoding recipe 159", async () => {
  const view = renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));

  await view.selectRecipe(159);

  expect(screen.getByText("ข้อมูลยืนยันเจ้าของไม่ครบ")).toBeVisible();
  expect(screen.getByLabelText("ค่าหน้าครัว — ข้าวญี่ปุ่นหุงสุก")).toHaveValue("");
  expect(screen.getByRole("status", { name: "สถานะสูตร" })).toHaveTextContent("DRAFT");
});

test.each([2, 160, 9, 161, 162])("renders missing method recipe %s as editable DRAFT", async (recipeId) => {
  const view = renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));

  await view.selectRecipe(recipeId);

  expect(screen.getByLabelText("วิธีทำจากหน้าครัว")).toHaveValue("");
  expect(screen.getByRole("status", { name: "สถานะสูตร" })).toHaveTextContent("DRAFT");
});

test("renders all 13 blocker messages byte-for-byte", async () => {
  const document = parseKitchenSotDocument(fixture);
  const view = renderFillSurfaceWithDocument(document);

  for (const recipe of document.recipes.filter(({ blockers }) => blockers.length > 0)) {
    await view.selectRecipe(recipe.recipe_id);
    expect(screen.getAllByTestId("sot-blocker").map((node) => node.textContent))
      .toEqual(recipe.blockers.map(({ message }) => message));
  }
});

test("keeps recipe 28 DRAFT after its unrelated blocker is resolved", async () => {
  const document = parseKitchenSotDocument(fixture);
  document.recipes.find(({ recipe_id }) => recipe_id === 28)!.blockers[0]!.resolved = true;
  const view = renderFillSurfaceWithDocument(document);

  await view.selectRecipe(28);

  expect(screen.getByRole("status", { name: "สถานะสูตร" })).toHaveTextContent("DRAFT");
  expect(screen.getAllByText(/needs_review/u)).toHaveLength(7);
});

test("writes owner-confirmed item fields and optional raw notes only after blur", async () => {
  const user = userEvent.setup();
  const document = parseKitchenSotDocument(fixture);
  const view = renderFillSurfaceWithDocument(document);
  await view.selectRecipe(164);

  const ownerInput = screen.getByLabelText("ค่าหน้าครัว — แป้งมันฮ่องกง");
  expect(ownerInput).toHaveValue("");
  await user.type(ownerInput, "1 ช้อนโต๊ะ");
  expect(view.client.save).not.toHaveBeenCalled();
  await user.tab();
  await user.type(screen.getByLabelText("หมายเหตุปริมาณเสิร์ฟ — แป้งมันฮ่องกง"), "ใช้ต่อหม้อ");
  await user.tab();
  await user.type(screen.getByLabelText("ฐานต้นทุน — แป้งมันฮ่องกง"), "คิดตามถุงจริง");
  await user.tab();
  await user.click(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" }));

  const submitted = view.client.save.mock.calls[0]![0];
  const item = submitted.recipes.find(({ recipe_id }) => recipe_id === 164)!.items
    .find(({ item_name }) => item_name === "แป้งมันฮ่องกง")!;
  expect(item).toMatchObject({
    candidate_text: "1 ช้อนโต๊ะ",
    selected_source: "owner_confirmation",
    decision_status: "confirmed_by_owner",
    serving_note: "ใช้ต่อหม้อ",
    cost_basis_text: "คิดตามถุงจริง",
  });
  expect(item.source_values.owner_confirmation).toBe("1 ช้อนโต๊ะ");
  expect(item.decision_note).toMatch(/เจ้าของยืนยันวันที่ \d{4}-\d{2}-\d{2}/u);
});

test("writes method with its required decision note and raw yield", async () => {
  const user = userEvent.setup();
  const document = parseKitchenSotDocument(fixture);
  document.recipes.find(({ recipe_id }) => recipe_id === 162)!.method_decision_note = null;
  const view = renderFillSurfaceWithDocument(document);
  await view.selectRecipe(162);

  await user.type(screen.getByLabelText("วิธีทำจากหน้าครัว"), "คลุกให้เข้ากันแล้วเก็บในกล่องปิด");
  await user.tab();
  expect(screen.getByText("ต้องกรอกหมายเหตุขอบเขตวิธีทำก่อนบันทึกวิธีทำ")).toBeVisible();
  await user.type(screen.getByLabelText("หมายเหตุขอบเขตวิธีทำ"), "ยังไม่ครอบคลุมอายุการเก็บ");
  await user.tab();
  await user.type(screen.getByLabelText("ผลผลิตจากหน้าครัว"), "1 กล่องต่อแบตช์");
  await user.tab();
  await user.click(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" }));

  const recipe = view.client.save.mock.calls[0]![0].recipes
    .find(({ recipe_id }) => recipe_id === 162)!;
  expect(recipe).toMatchObject({
    method_candidate_text: "คลุกให้เข้ากันแล้วเก็บในกล่องปิด",
    method_selected_source: "owner_confirmation",
    method_decision_note: "ยังไม่ครอบคลุมอายุการเก็บ",
    yield_candidate_text: "1 กล่องต่อแบตช์",
  });
});

test("requires an explicit owner-N/A reason for an empty-method blocker", async () => {
  const user = userEvent.setup();
  const document = parseKitchenSotDocument(fixture);
  const view = renderFillSurfaceWithDocument(document);
  await view.selectRecipe(2);

  expect(screen.getByRole("checkbox", { name: /ปิดตัวขวางตามวิธีปกติ/u })).toBeDisabled();
  const ownerNa = screen.getByRole("checkbox", { name: /เจ้าของยืนยันว่าไม่ต้องมีวิธีทำ/u });
  expect(ownerNa).toBeDisabled();
  await user.type(screen.getByLabelText(/เหตุผล N\/A/u), "รายการนี้เป็นเพียงรายการรวมวัตถุดิบ");
  expect(ownerNa).toBeEnabled();
  await user.click(ownerNa);
  await user.click(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" }));

  const blocker = view.client.save.mock.calls[0]![0].recipes
    .find(({ recipe_id }) => recipe_id === 2)!.blockers[0]!;
  expect(blocker).toMatchObject({
    resolved: true,
    resolved_note: "เจ้าของยืนยันว่าไม่ต้องมีวิธีทำ (N/A): รายการนี้เป็นเพียงรายการรวมวัตถุดิบ",
  });
  expect(blocker.message).toBe(document.recipes.find(({ recipe_id }) => recipe_id === 2)!.blockers[0]!.message);
});

test("shows success, stale reload guidance, and safe save errors without fallback data", async () => {
  const user = userEvent.setup();
  const document = parseKitchenSotDocument(fixture);
  const view = renderFillSurfaceWithDocument(document);
  await view.selectRecipe(162);
  const saveButton = screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" });
  expect(saveButton).toBeDisabled();

  await user.type(screen.getByLabelText("ผลผลิตจากหน้าครัว"), "2 กล่อง");
  await user.tab();
  expect(saveButton).toBeEnabled();
  await user.click(saveButton);
  expect(await screen.findByRole("status", { name: "สถานะการบันทึก" })).toHaveTextContent(
    "kitchen-sot-first-set-v5-draft.json",
  );

  view.client.save.mockRejectedValueOnce(new KitchenSotHttpError(409, "STALE_DRAFT"));
  await user.clear(screen.getByLabelText("ผลผลิตจากหน้าครัว"));
  await user.type(screen.getByLabelText("ผลผลิตจากหน้าครัว"), "3 กล่อง");
  await user.tab();
  await user.click(saveButton);
  expect(await screen.findByRole("alert")).toHaveTextContent("โหลดหน้าใหม่");
  expect(screen.getByRole("heading", { name: "ผงคั่วพริกเกลือ" })).toBeVisible();
});
