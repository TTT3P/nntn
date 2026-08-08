import { cleanup, render, screen, within } from "@testing-library/react";
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

test("renders the real recipe set as one operator worksheet", async () => {
  renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));

  expect(await screen.findByText("18 สูตร")).toBeVisible();
  expect(screen.getByRole("heading", { level: 2, name: "กรอกสูตรจากทีมครัว" })).toBeVisible();
  expect(screen.getByRole("region", { name: "สรุปข้อมูล Kitchen SOT" }))
    .toHaveClass("recipe-studio__summary");
  expect(screen.getByRole("navigation", { name: "คิวสูตร Kitchen SOT" }))
    .toHaveClass("recipe-studio__queue");
  expect(screen.getByRole("article", { name: /รายละเอียดสูตร/u }))
    .toHaveClass("recipe-studio__detail");
  expect(screen.getByRole("heading", { level: 3, name: "เลือกสูตร" })).toBeVisible();
  expect(screen.queryByText("SOURCE REVIEW · NO CONVERSION")).not.toBeInTheDocument();
  expect(screen.queryByText("01")).not.toBeInTheDocument();
  expect(screen.getByText("4 เมนูขาย + 14 สูตรประกอบ")).toBeVisible();
  expect(screen.getByText("16 รายการรอกรอก/เคาะ")).toBeVisible();
  expect(screen.getByText("13 ตัวขวาง")).toBeVisible();
  expect(screen.getAllByRole("button", { name: /revision/u })).toHaveLength(18);
});

test("filters the visible recipe queue without changing the selected raw recipe", async () => {
  renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));
  const user = userEvent.setup();

  const search = await screen.findByRole("searchbox", { name: "ค้นหาสูตร" });
  await user.type(search, "ผงคั่วพริกเกลือ");

  expect(screen.getByRole("button", { name: /ผงคั่วพริกเกลือ/u })).toBeVisible();
  expect(screen.queryByRole("button", { name: /ข้าวหน้าเนื้อยากินิกุ/u })).not.toBeInTheDocument();

  await user.clear(search);
  await user.click(screen.getByRole("button", { name: /ข้าวหน้าเนื้อยากินิกุ/u }));

  expect(screen.getByRole("heading", { level: 3, name: "ข้าวหน้าเนื้อยากินิกุ" })).toBeVisible();
  expect(screen.getByRole("status", { name: "สถานะสูตร" })).toHaveTextContent("DRAFT");
});

test("filters the queue by recipe type and canonical readiness without mutating the summary", async () => {
  renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));
  const user = userEvent.setup();
  const queue = await screen.findByRole("navigation", { name: "คิวสูตร Kitchen SOT" });

  await user.selectOptions(screen.getByLabelText("ประเภทสูตร"), "prepared_recipe");
  expect(within(queue).getAllByRole("button", { name: /revision/u })).toHaveLength(14);

  await user.selectOptions(screen.getByLabelText("ประเภทสูตร"), "all");
  await user.selectOptions(screen.getByLabelText("สถานะ"), "draft");
  expect(within(queue).getAllByRole("button", { name: /revision/u })).toHaveLength(13);
  expect(screen.getByText("18 สูตร")).toBeVisible();
});

test("groups the selected recipe into flat worksheet sections without hiding V5 controls", async () => {
  const document = parseKitchenSotDocument(fixture);
  renderFillSurfaceWithDocument(document);
  const firstItem = document.recipes[0]!.items[0]!;

  expect(await screen.findByText("แฟ้มสูตรครัว · เมนูขาย"))
    .toHaveClass("recipe-studio__folio-label");
  expect(await screen.findByRole("status", { name: "สถานะสูตร" }))
    .toHaveClass("recipe-studio__status", "is-ready");
  expect(screen.getByRole("heading", { name: "วัตถุดิบ" }).closest("section"))
    .toHaveClass("recipe-studio__section");
  expect(screen.getByLabelText(`หลักฐานต้นทาง — ${firstItem.item_name}`).closest("fieldset"))
    .toHaveClass("recipe-studio__item-row");
  expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" })).toBeVisible();
});

test("shows one plain-language kitchen question and keeps optional details closed by default", async () => {
  const document = parseKitchenSotDocument(fixture);
  renderFillSurfaceWithDocument(document);
  const item = document.recipes[0]!.items[0]!;

  const question = await screen.findByLabelText(
    `ทีมครัวใช้ ${item.item_name} เท่าไร? (ต้องกรอก)`,
  );
  const card = question.closest("fieldset");
  expect(card).not.toBeNull();
  const itemCard = within(card!);

  expect(question).toBeVisible();
  expect(itemCard.getByText(/ตอนนี้ใช้:/u)).toBeVisible();
  expect(itemCard.getByText("ตัวเลือกเพิ่มเติม (ไม่บังคับ)")).toBeVisible();
  expect(itemCard.getByLabelText("ปริมาณตอนเสิร์ฟ (ไม่บังคับ)")).not.toBeVisible();
  expect(itemCard.getByLabelText("ปริมาณสำหรับคิดต้นทุน (ไม่บังคับ)")).not.toBeVisible();
  expect(itemCard.getByLabelText(`หลักฐานต้นทาง — ${item.item_name}`)).not.toBeVisible();
  expect(itemCard.queryByText(/ค่าหน้าครัว|ฐานต้นทุน|สถานะการตัดสินใจ/u))
    .not.toBeInTheDocument();
});

test("shows the derived provenance gap without hardcoding recipe 159", async () => {
  const view = renderFillSurfaceWithDocument(parseKitchenSotDocument(fixture));

  await view.selectRecipe(159);

  expect(screen.getByText("ยังรอคำตอบจากทีมครัว")).toBeVisible();
  expect(screen.getByLabelText("ทีมครัวใช้ ข้าวญี่ปุ่นหุงสุก เท่าไร? (ต้องกรอก)"))
    .toHaveValue("");
  expect(screen.getByRole("status", { name: "สถานะสูตร" })).toHaveTextContent("DRAFT");
});

test("renders every source value in original order with raw safe deterministic evidence", async () => {
  const document = parseKitchenSotDocument(fixture);
  const item = document.recipes[0]!.items[0]!;
  item.source_values = {
    handwriting: "บรรทัดหนึ่ง\n  บรรทัดสอง <img src=x onerror=alert(1)>",
    structured: { second: 2, first: ["ดิบ", { nested: true }] },
    nullEvidence: null,
  };
  renderFillSurfaceWithDocument(document);

  const evidenceList = await screen.findByLabelText(`หลักฐานต้นทาง — ${item.item_name}`);
  const entries = [...evidenceList.querySelectorAll('[data-testid="sot-source-evidence"]')];
  expect(entries.map((entry) => entry.querySelector("dt")?.textContent)).toEqual([
    "handwriting",
    "structured",
    "nullEvidence",
  ]);
  expect(entries[0]!.querySelector("dd")?.textContent).toBe(
    "บรรทัดหนึ่ง\n  บรรทัดสอง <img src=x onerror=alert(1)>",
  );
  expect(entries[1]!.querySelector("dd")?.textContent).toBe(
    '{\n  "second": 2,\n  "first": [\n    "ดิบ",\n    {\n      "nested": true\n    }\n  ]\n}',
  );
  expect(entries[2]!.querySelector("dd")?.textContent).toBe("null");
  expect(entries[0]!.querySelector("img")).toBeNull();
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

  const ownerInput = screen.getByLabelText("ทีมครัวใช้ แป้งมันฮ่องกง เท่าไร? (ต้องกรอก)");
  const itemCard = within(ownerInput.closest("fieldset")!);
  expect(ownerInput).toHaveValue("");
  await user.type(ownerInput, "1 ช้อนโต๊ะ");
  expect(view.client.save).not.toHaveBeenCalled();
  await user.tab();
  await user.click(itemCard.getByText("ตัวเลือกเพิ่มเติม (ไม่บังคับ)"));
  await user.type(itemCard.getByLabelText("ปริมาณตอนเสิร์ฟ (ไม่บังคับ)"), "ใช้ต่อหม้อ");
  await user.tab();
  await user.type(itemCard.getByLabelText("ปริมาณสำหรับคิดต้นทุน (ไม่บังคับ)"), "คิดตามถุงจริง");
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

test("requires an explicitly updated decision note before accepting a method for untouched recipe 162", async () => {
  const user = userEvent.setup();
  const document = parseKitchenSotDocument(fixture);
  const view = renderFillSurfaceWithDocument(document);
  await view.selectRecipe(162);

  const method = screen.getByLabelText("วิธีทำจากหน้าครัว");
  const note = screen.getByLabelText("หมายเหตุขอบเขตวิธีทำ");
  const inheritedNote = document.recipes.find(({ recipe_id }) => recipe_id === 162)!
    .method_decision_note!;
  expect(note).toHaveValue(inheritedNote);

  await user.type(method, "คลุกส่วนผสมทั้งหมดให้เข้ากัน");
  await user.tab();

  expect(screen.getByRole("alert")).toHaveTextContent("ต้องอัปเดตหมายเหตุขอบเขตวิธีทำ");
  expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" })).toBeDisabled();

  await user.clear(note);
  await user.type(note, "ยังไม่ครอบคลุมการเก็บและผลผลิต");
  await user.tab();
  await user.click(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" }));

  expect(view.client.save.mock.calls[0]![0].recipes.find(({ recipe_id }) => recipe_id === 162))
    .toMatchObject({
      method_candidate_text: "คลุกส่วนผสมทั้งหมดให้เข้ากัน",
      method_selected_source: "owner_confirmation",
      method_decision_note: "ยังไม่ครอบคลุมการเก็บและผลผลิต",
    });
});

test("does not relabel an unchanged method when only its legacy decision note is edited", async () => {
  const user = userEvent.setup();
  const document = parseKitchenSotDocument(fixture);
  const recipe = document.recipes.find(({ recipe_id }) => recipe_id === 165)!;
  const view = renderFillSurfaceWithDocument(document);
  await view.selectRecipe(165);

  const note = screen.getByLabelText("หมายเหตุขอบเขตวิธีทำ");
  await user.clear(note);
  await user.type(note, "แก้เฉพาะหมายเหตุ");
  await user.tab();

  expect(screen.getByRole("alert")).toHaveTextContent("แก้หมายเหตุได้เมื่อแก้ไขวิธีทำพร้อมกัน");
  expect(note).toHaveValue(recipe.method_decision_note);
  expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" })).toBeDisabled();
  expect(view.client.save).not.toHaveBeenCalled();
});

test("restores a cleared prepopulated owner quantity and reports an accessible error", async () => {
  const user = userEvent.setup();
  const document = parseKitchenSotDocument(fixture);
  const view = renderFillSurfaceWithDocument(document);
  await view.selectRecipe(165);

  const owner = screen.getByLabelText("ทีมครัวใช้ ข้าวหอมมะลิหุงสุก เท่าไร? (ต้องกรอก)");
  expect(owner).toHaveValue("ข้าวหอมมะลิหุงสุก 180 กรัมต่อจาน");
  await user.clear(owner);
  await user.tab();

  expect(screen.getByRole("alert"))
    .toHaveTextContent("กรอกปริมาณที่ทีมครัวใช้ก่อน ระบบคืนค่าเดิมให้แล้ว");
  expect(owner).toHaveValue("ข้าวหอมมะลิหุงสุก 180 กรัมต่อจาน");
  expect(owner).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" })).toBeDisabled();
});

test("restores a cleared prepopulated method and reports an accessible error", async () => {
  const user = userEvent.setup();
  const document = parseKitchenSotDocument(fixture);
  const recipe = document.recipes.find(({ recipe_id }) => recipe_id === 165)!;
  const view = renderFillSurfaceWithDocument(document);
  await view.selectRecipe(165);

  const method = screen.getByLabelText("วิธีทำจากหน้าครัว");
  await user.clear(method);
  await user.tab();

  expect(screen.getByRole("alert")).toHaveTextContent("วิธีทำต้องไม่ว่าง");
  expect(method).toHaveValue(recipe.method_candidate_text);
  expect(method).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" })).toBeDisabled();
});

test("restores a cleared prepopulated yield and reports an accessible error", async () => {
  const user = userEvent.setup();
  const document = parseKitchenSotDocument(fixture);
  const recipeId = "candidate:prepared:ข้าวญี่ปุ่นหุงสุก";
  const recipe = document.recipes.find(({ recipe_id }) => recipe_id === recipeId)!;
  const view = renderFillSurfaceWithDocument(document);
  await view.selectRecipe(recipeId);

  const yieldInput = screen.getByLabelText("ผลผลิตจากหน้าครัว");
  await user.clear(yieldInput);
  await user.tab();

  expect(screen.getByRole("alert")).toHaveTextContent("ผลผลิตต้องไม่ว่าง");
  expect(yieldInput).toHaveValue(recipe.yield_candidate_text);
  expect(yieldInput).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง V5" })).toBeDisabled();
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
