import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import type { CookbookDocumentClient } from "../../data/CookbookDocumentClient";
import type { CookbookV6Document } from "../../domain/cookbookV6/types";
import { makeSnapshot } from "../../test/builders";
import { CookbookDocumentProvider } from "../cookbook/CookbookDocumentProvider";
import { RecipeEditor } from "./RecipeEditor";

const v6Document: CookbookV6Document = {
  schemaVersion: "6.0.0",
  generatedAt: "2026-08-10T00:00:00.000Z",
  derivedFrom: { v5Path: "draft.json", v5Sha256: "a".repeat(64), catalogSha256: "b".repeat(64) },
  recipes: [{
    recipeId: "RCP-010",
    code: "RCP-010",
    name: "ข้าวเนื้อสับคั่วน้ำปลาไข่ข้น",
    kind: "sellable_menu",
    category: "หมวดเดิมจากระบบเก่า",
    active: true,
    reviewState: "",
    sourceLocators: [],
    yieldText: "",
    operationalNotes: [],
    methodDecisionNote: "",
    ingredients: [],
    methodSteps: [],
    blockers: [],
    workDocuments: {},
    parentRecipeIds: [],
    lineage: { source: "catalog", sourceRecipeId: null },
  }, {
    recipeId: "RCP-011",
    code: "RCP-011",
    name: "ข้าวหน้าเนื้อ",
    kind: "sellable_menu",
    category: "เมนูข้าว",
    active: true,
    reviewState: "",
    sourceLocators: [],
    yieldText: "1 จาน",
    operationalNotes: [],
    methodDecisionNote: "",
    ingredients: [{
      lineId: "rice",
      name: "ข้าวสวย",
      kind: "ingredient",
      amountText: "1",
      unitText: "ถ้วย",
      sourceDisplayText: "1 ถ้วย",
      ingredientId: "ING-RICE",
      componentRecipeId: null,
      servingNote: "",
      costBasisText: "",
      decisionStatus: "",
      selectedSource: null,
      active: true,
    }, {
      lineId: "beef",
      name: "เนื้อวัว",
      kind: "ingredient",
      amountText: "120",
      unitText: "กรัม",
      sourceDisplayText: "120 กรัม",
      ingredientId: "ING-BEEF",
      componentRecipeId: null,
      servingNote: "",
      costBasisText: "",
      decisionStatus: "",
      selectedSource: null,
      active: true,
    }],
    methodSteps: [{
      stepId: "wash",
      stage: "prep",
      instruction: "ล้างข้าว",
      order: 1,
    }, {
      stepId: "stir",
      stage: "cook",
      instruction: "ผัดเนื้อ",
      order: 2,
    }],
    blockers: [],
    workDocuments: {
      prep: { stage: "prep", scalable: true, ingredientLineIds: ["rice"], stepIds: ["wash"] },
      cook: { stage: "cook", scalable: false, ingredientLineIds: ["rice", "beef"], stepIds: ["stir"] },
    },
    parentRecipeIds: [],
    lineage: { source: "catalog", sourceRecipeId: null },
  }, {
    recipeId: "SRCP-014",
    code: "SRCP-014",
    name: "ซอสยากินิกุ",
    kind: "prepared_recipe",
    category: "ซอส",
    active: true,
    reviewState: "",
    sourceLocators: [],
    yieldText: "",
    operationalNotes: [],
    methodDecisionNote: "",
    ingredients: [],
    methodSteps: [],
    blockers: [],
    workDocuments: {},
    parentRecipeIds: [],
    lineage: { source: "catalog", sourceRecipeId: null },
  }, {
    recipeId: "SRCP-099",
    code: "SRCP-099",
    name: "ซอสที่ปิดใช้งาน",
    kind: "prepared_recipe",
    category: "ซอส",
    active: false,
    reviewState: "",
    sourceLocators: [],
    yieldText: "",
    operationalNotes: [],
    methodDecisionNote: "",
    ingredients: [],
    methodSteps: [],
    blockers: [],
    workDocuments: {},
    parentRecipeIds: [],
    lineage: { source: "catalog", sourceRecipeId: null },
  }, {
    recipeId: "RCP-012",
    code: "RCP-012",
    name: "เมนูที่ใช้ซอสยากินิกุ",
    kind: "sellable_menu",
    category: "เมนูข้าว",
    active: true,
    reviewState: "",
    sourceLocators: [],
    yieldText: "",
    operationalNotes: [],
    methodDecisionNote: "",
    ingredients: [{
      lineId: "line-sauce",
      name: "ซอสยากินิกุ",
      kind: "prepared_recipe",
      amountText: "1",
      unitText: "ช้อนโต๊ะ",
      sourceDisplayText: "1 ช้อนโต๊ะ",
      ingredientId: null,
      componentRecipeId: "SRCP-014",
      servingNote: "",
      costBasisText: "",
      decisionStatus: "",
      selectedSource: null,
      active: true,
    }],
    methodSteps: [],
    blockers: [],
    workDocuments: {},
    parentRecipeIds: [],
    lineage: { source: "catalog", sourceRecipeId: null },
  }],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderEditor(save = vi.fn<CookbookDocumentClient["save"]>(async (submitted) => ({
  document: submitted,
  sha256: "d".repeat(64),
  base_sha256: "d".repeat(64),
  generatedAt: submitted.generatedAt,
  path: "draft.json",
})), recipeId = "RCP-010") {
  const client: CookbookDocumentClient = {
    load: vi.fn(async () => ({ document: v6Document, baseSha256: "c".repeat(64), origin: "synthesized" as const, path: "draft.json" })),
    save,
  };
  render(
    <CookbookDocumentProvider client={client} mediaSnapshot={makeSnapshot({ recipes: [], media: [], stepMedia: [] })}>
      <MemoryRouter initialEntries={[`/recipes/${recipeId}/edit`]}>
        <Link to="/print">ศูนย์พิมพ์ทดสอบ</Link>
        <Routes>
          <Route path="/recipes/:recipeId/edit" element={<RecipeEditor />} />
          <Route path="/recipes/:recipeId" element={<h1>หน้ารายละเอียดสูตร</h1>} />
          <Route path="/print" element={<h1>หน้าศูนย์พิมพ์</h1>} />
        </Routes>
      </MemoryRouter>
    </CookbookDocumentProvider>,
  );
  return { save };
}

test("preserves a legacy category until a standard print collection is selected", async () => {
  const user = userEvent.setup();
  renderEditor();

  const category = await screen.findByRole("combobox", { name: "หมวดหมู่" });
  expect(category).toHaveValue("หมวดเดิมจากระบบเก่า");
  expect(within(category).getByRole("option", { name: "หมวดเดิมจากระบบเก่า" })).toBeVisible();

  await user.selectOptions(category, "ซอสและน้ำจิ้ม");

  expect(category).toHaveValue("ซอสและน้ำจิ้ม");
});

test("shows current workstage counts and saves ingredient print membership", async () => {
  const user = userEvent.setup();
  const { save } = renderEditor(undefined, "RCP-011");

  expect(await screen.findByText("ใช้จัดกลุ่มสูตรในศูนย์พิมพ์ ไม่ได้กำหนดจุดงาน")).toBeVisible();
  expect(screen.getByRole("heading", { name: "จุดงานและการพิมพ์" })).toBeVisible();
  expect(screen.getByText("วัตถุดิบ 1 รายการ · ขั้นตอน 1 ขั้น")).toBeVisible();

  const riceStages = screen.getByRole("group", { name: "พิมพ์วัตถุดิบนี้ในใบงาน รายการ 1" });
  const prep = within(riceStages).getByRole("checkbox", { name: "เตรียม" });
  const cook = within(riceStages).getByRole("checkbox", { name: "ปรุง" });
  const service = within(riceStages).getByRole("checkbox", { name: "จัดเสิร์ฟ" });
  expect(prep).toBeChecked();
  expect(cook).toBeChecked();
  expect(service).not.toBeChecked();

  await user.click(prep);
  await user.click(cook);
  expect(within(riceStages).getByText("ยังไม่อยู่ในใบงาน — รายการนี้จะไม่ถูกพิมพ์")).toBeVisible();
  await user.click(service);
  expect(screen.getByText("วัตถุดิบ 0 รายการ · ขั้นตอน 1 ขั้น")).toBeVisible();
  expect(screen.getByText("วัตถุดิบ 1 รายการ · ขั้นตอน 1 ขั้น")).toBeVisible();
  expect(screen.getByText("วัตถุดิบ 1 รายการ · ขั้นตอน 0 ขั้น")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));

  const savedRecipe = vi.mocked(save).mock.calls[0]![0].recipes.find(({ recipeId }) => recipeId === "RCP-011");
  expect(savedRecipe?.workDocuments.prep?.ingredientLineIds).not.toContain("rice");
  expect(savedRecipe?.workDocuments.cook?.ingredientLineIds).not.toContain("rice");
  expect(savedRecipe?.workDocuments.service?.ingredientLineIds).toEqual(["rice"]);
});

test("requires an explicit workstage for a new method step", async () => {
  const user = userEvent.setup();
  const { save } = renderEditor(undefined, "RCP-011");

  const firstStage = await screen.findByLabelText("จุดงานของขั้นตอน ขั้นตอน 1");
  expect(firstStage).toHaveValue("prep");
  expect(screen.getByText("ขั้นตอนนี้จะพิมพ์ในใบงาน “เตรียม”")).toBeVisible();

  await user.click(screen.getByRole("button", { name: "เพิ่มขั้นตอน" }));
  await user.type(screen.getByLabelText("วิธีทำ ขั้นตอน 3"), "จัดใส่จาน");
  const newStage = screen.getByLabelText("จุดงานของขั้นตอน ขั้นตอน 3");
  expect(newStage).toHaveValue("");
  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));

  expect(screen.getByRole("alert")).toHaveTextContent("เลือกจุดงานของขั้นตอนที่ 3");
  expect(save).not.toHaveBeenCalled();

  await user.selectOptions(newStage, "service");
  expect(screen.getByText("ขั้นตอนนี้จะพิมพ์ในใบงาน “จัดเสิร์ฟ”")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));

  const savedRecipe = vi.mocked(save).mock.calls[0]![0].recipes.find(({ recipeId }) => recipeId === "RCP-011");
  expect(savedRecipe?.methodSteps[2]).toMatchObject({ instruction: "จัดใส่จาน", stage: "service" });
});

test("fills a blank recipe with an ingredient, a standard unit and a method step", async () => {
  const user = userEvent.setup();
  const { save } = renderEditor();
  expect(await screen.findByRole("heading", { name: "แก้ไขสูตร" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: "เพิ่มวัตถุดิบ" }));
  await user.type(screen.getByLabelText("ชื่อวัตถุดิบ รายการ 1"), "น้ำมันรำข้าว");
  await user.type(screen.getByLabelText("ปริมาณ รายการ 1"), "2");
  await user.selectOptions(screen.getByLabelText("หน่วย รายการ 1"), "ช้อนโต๊ะ");
  await user.click(screen.getByRole("button", { name: "เพิ่มขั้นตอน" }));
  await user.type(screen.getByLabelText("วิธีทำ ขั้นตอน 1"), "ตั้งกระทะให้ร้อน");
  await user.selectOptions(screen.getByLabelText("จุดงานของขั้นตอน ขั้นตอน 1"), "prep");
  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));

  expect(save).toHaveBeenCalledTimes(1);
  const saved = vi.mocked(save).mock.calls[0]![0];
  expect(saved.recipes[0]?.ingredients[0]).toMatchObject({
    name: "น้ำมันรำข้าว",
    amountText: "2",
    unitText: "ช้อนโต๊ะ",
    sourceDisplayText: "2 ช้อนโต๊ะ",
  });
  expect(saved.recipes[0]?.methodSteps[0]).toMatchObject({ instruction: "ตั้งกระทะให้ร้อน" });
});

test("keeps blank optional fields and a custom kitchen unit verbatim", async () => {
  const user = userEvent.setup();
  const { save } = renderEditor();
  await screen.findByRole("heading", { name: "แก้ไขสูตร" });
  await user.click(screen.getByRole("button", { name: "เพิ่มวัตถุดิบ" }));
  await user.type(screen.getByLabelText("ชื่อวัตถุดิบ รายการ 1"), "ไข่ไก่");
  await user.type(screen.getByLabelText("ปริมาณ รายการ 1"), "2");
  await user.selectOptions(screen.getByLabelText("หน่วย รายการ 1"), "__custom__");
  await user.type(screen.getByLabelText("หน่วยอื่น รายการ 1"), "ฟองใหญ่");
  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));

  const saved = vi.mocked(save).mock.calls[0]![0];
  expect(saved.recipes[0]?.ingredients[0]?.unitText).toBe("ฟองใหญ่");
  expect(saved.recipes[0]?.yieldText).toBe("");
});

test("reorders rows and allows a pending removal to be undone", async () => {
  const user = userEvent.setup();
  renderEditor();
  await screen.findByRole("heading", { name: "แก้ไขสูตร" });
  await user.click(screen.getByRole("button", { name: "เพิ่มวัตถุดิบ" }));
  await user.type(screen.getByLabelText("ชื่อวัตถุดิบ รายการ 1"), "รายการแรก");
  await user.click(screen.getByRole("button", { name: "เพิ่มวัตถุดิบ" }));
  await user.type(screen.getByLabelText("ชื่อวัตถุดิบ รายการ 2"), "รายการสอง");
  await user.click(screen.getByRole("button", { name: "ย้ายวัตถุดิบรายการ 2 ขึ้น" }));
  expect(screen.getByLabelText("ชื่อวัตถุดิบ รายการ 1")).toHaveValue("รายการสอง");

  await user.click(screen.getByRole("button", { name: "ลบวัตถุดิบรายการ 1" }));
  const removed = screen.getByRole("group", { name: "แถววัตถุดิบ รายการ 1" });
  expect(within(removed).getByText("รอลบเมื่อบันทึก")).toBeVisible();
  await user.click(within(removed).getByRole("button", { name: "เลิกทำ" }));
  expect(within(removed).queryByText("รอลบเมื่อบันทึก")).not.toBeInTheDocument();
});

test("does not expose internal migration language", async () => {
  renderEditor();
  await screen.findByRole("heading", { name: "แก้ไขสูตร" });
  expect(document.body).not.toHaveTextContent(/AI|Prototype|Mock|V[456]|schema|blocker|provenance|candidate|Supabase|snapshot/i);
});

test("keeps save disabled until the recipe has a real unsaved change", async () => {
  const user = userEvent.setup();
  renderEditor();
  const saveButton = await screen.findByRole("button", { name: "บันทึกสูตร" });
  expect(saveButton).toBeDisabled();

  const name = screen.getByLabelText("ชื่อสูตร");
  await user.type(name, " เพิ่ม");
  expect(saveButton).toBeEnabled();
  await user.clear(name);
  await user.type(name, "ข้าวเนื้อสับคั่วน้ำปลาไข่ข้น");
  expect(saveButton).toBeDisabled();
});

test("selects a real prepared recipe dependency before saving an active prepared line", async () => {
  const user = userEvent.setup();
  const { save } = renderEditor();
  await screen.findByRole("heading", { name: "แก้ไขสูตร" });
  await user.click(screen.getByRole("button", { name: "เพิ่มวัตถุดิบ" }));
  await user.selectOptions(screen.getByLabelText("ประเภทวัตถุดิบ รายการ 1"), "prepared_recipe");
  expect(screen.getByLabelText("สูตรเตรียม รายการ 1")).toBeRequired();
  expect(screen.getByLabelText("สูตรเตรียม รายการ 1")).not.toHaveTextContent("ซอสที่ปิดใช้งาน");

  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));
  expect(screen.getByRole("alert")).toHaveTextContent("กรุณาเลือกสูตรเตรียม");
  expect(save).not.toHaveBeenCalled();

  await user.selectOptions(screen.getByLabelText("สูตรเตรียม รายการ 1"), "SRCP-014");
  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));
  const saved = vi.mocked(save).mock.calls[0]![0];
  expect(saved.recipes[0]?.ingredients[0]).toMatchObject({
    name: "ซอสยากินิกุ",
    kind: "prepared_recipe",
    componentRecipeId: "SRCP-014",
    active: true,
  });
});

test("does not deactivate a prepared recipe that an active recipe still uses", async () => {
  const user = userEvent.setup();
  const { save } = renderEditor(undefined, "SRCP-014");
  await screen.findByRole("heading", { name: "แก้ไขสูตร" });
  await user.click(screen.getByLabelText("เปิดใช้งานสูตร"));
  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));

  expect(screen.getByRole("alert")).toHaveTextContent("สูตรนี้ยังถูกใช้งานในสูตรอื่น");
  expect(save).not.toHaveBeenCalled();
});

test("edits recipe code and recipe and ingredient active states", async () => {
  const user = userEvent.setup();
  const { save } = renderEditor();
  await screen.findByRole("heading", { name: "แก้ไขสูตร" });
  await user.clear(screen.getByLabelText("รหัสสูตร"));
  await user.type(screen.getByLabelText("รหัสสูตร"), "RCP-011-NEW");
  await user.click(screen.getByLabelText("เปิดใช้งานสูตร"));
  await user.click(screen.getByRole("button", { name: "เพิ่มวัตถุดิบ" }));
  await user.type(screen.getByLabelText("ชื่อวัตถุดิบ รายการ 1"), "น้ำปลา");
  await user.click(screen.getByLabelText("ใช้งานวัตถุดิบ รายการ 1"));
  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));

  const saved = vi.mocked(save).mock.calls[0]![0];
  expect(saved.recipes[0]).toMatchObject({ code: "RCP-011-NEW", active: false });
  expect(saved.recipes[0]?.ingredients[0]).toMatchObject({ name: "น้ำปลา", active: false });
});

test("blocks cancel and other SPA links while changes are unsaved", async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  renderEditor();
  await screen.findByRole("heading", { name: "แก้ไขสูตร" });
  await user.selectOptions(screen.getByLabelText("หมวดหมู่"), "ซอสและน้ำจิ้ม");

  await user.click(screen.getByRole("link", { name: "ยกเลิก" }));
  expect(screen.getByRole("heading", { name: "แก้ไขสูตร" })).toBeVisible();
  await user.click(screen.getByRole("link", { name: "ศูนย์พิมพ์ทดสอบ" }));
  expect(screen.getByRole("heading", { name: "แก้ไขสูตร" })).toBeVisible();
  expect(confirm).toHaveBeenCalledTimes(2);

  confirm.mockReturnValue(true);
  await user.click(screen.getByRole("link", { name: "ยกเลิก" }));
  expect(screen.getByRole("heading", { name: "หน้ารายละเอียดสูตร" })).toBeVisible();
});

test("restores HashRouter history when Back or Forward is rejected", async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
  renderEditor();
  await screen.findByRole("heading", { name: "แก้ไขสูตร" });
  await user.selectOptions(screen.getByLabelText("หมวดหมู่"), "ซอสและน้ำจิ้ม");

  window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: -1 } }));

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(go).toHaveBeenCalledWith(1);
});
