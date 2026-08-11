import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, test } from "vitest";
import catalogJson from "../../data/catalog/recipe-catalog-85.json";
import fixture from "../../data/fixtures/first-set.json";
import type { KitchenSotDraftClient } from "../../data/KitchenSotDraftClient";
import { parseRecipeCatalog } from "../../domain/catalog/recipeCatalog";
import type { CookbookSnapshot, RecipeVersion } from "../../domain/cookbook/types";
import { parseKitchenSotDocument } from "../../domain/sot/kitchenSotDocument";
import { PrototypeProvider } from "../../prototype/PrototypeProvider";
import { makeIngredientLine, makeRecipe, makeSnapshot, makeWorkStep } from "../../test/builders";
import { withOwnerConfirmedEggRecipe } from "../../test/ownerConfirmedEggRecipe";
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { KitchenSotDraftProvider, useKitchenSotDraft } from "../review/KitchenSotDraftProvider";
import { RecipeLibraryPage } from "./RecipeLibraryPage";

afterEach(cleanup);

function recipe(overrides: Partial<RecipeVersion>): RecipeVersion {
  return makeRecipe({
    recipeId: "base",
    recipeVersionId: `version-${String(overrides.recipeId ?? "base")}`,
    name: "สูตรพื้นฐาน",
    kind: "prepared_recipe",
    reviewState: "confirmed",
    methodText: "ทำตามขั้นตอน",
    workDocuments: {
      prep: { stage: "prep", scalable: true, ingredientLineKeys: [], steps: [makeWorkStep()] },
    },
    ...overrides,
  });
}

function librarySnapshot(): CookbookSnapshot {
  return makeSnapshot({ recipes: [
    recipe({ recipeId: 159, name: "ข้าวหน้าเนื้อยากินิกุ", kind: "sellable_menu", workDocuments: {
      service: { stage: "service", scalable: false, ingredientLineKeys: [], steps: [makeWorkStep({ stage: "service" })] },
    } }),
    recipe({ recipeId: "missing", name: "สูตรไม่มีวิธี", methodText: null, workDocuments: {} }),
    recipe({ recipeId: "prep", name: "สูตรเตรียมพร้อม", workDocuments: {
      prep: { stage: "prep", scalable: true, ingredientLineKeys: [], steps: [makeWorkStep()] },
    } }),
    recipe({ recipeId: "cook", name: "สูตรครัวปรุง", workDocuments: {
      cook: { stage: "cook", scalable: true, ingredientLineKeys: [], steps: [makeWorkStep({ stage: "cook" })] },
    } }),
    recipe({ recipeId: "sub", name: "สูตรย่อย", kind: "sub_recipe" }),
  ] });
}

function OwnerConfirmationEditor() {
  const draft = useKitchenSotDraft();
  return <>
    <button type="button" onClick={() => draft.applyEdit({
      kind: "item-owner-confirmation",
      recipeId: 159,
      lineKey: "ข้าวหน้าเนื้อยากินิกุ:ข้าวญี่ปุ่น",
      value: "180 กรัม",
      confirmedOn: "2026-08-07",
    })}>ยืนยันข้าวญี่ปุ่น</button>
    <button type="button" onClick={() => void draft.save()}>บันทึกทดสอบ</button>
    <output aria-label="สถานะบันทึกทดสอบ">{draft.saveState}</output>
  </>;
}

function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="ตำแหน่งปัจจุบัน">{location.pathname}{location.search}</output>;
}

function SearchHistoryControls() {
  const navigate = useNavigate();
  return <>
    <button type="button" onClick={() => navigate("/recipes?q=เกี๊ยว%207")}>ค้นหาเกี๊ยว</button>
    <button type="button" onClick={() => navigate(-1)}>ย้อนกลับ</button>
    <button type="button" onClick={() => navigate(1)}>ไปข้างหน้า</button>
  </>;
}

describe("RecipeLibraryPage", () => {
  test("opens as a simple read-first list without dashboard summary cards", () => {
    const recipes = parseRecipeCatalog(catalogJson).map((entry) => recipe({
      recipeId: entry.code,
      name: entry.name,
      kind: entry.kind,
      methodText: null,
      workDocuments: {},
    }));
    recipes.push(
      recipe({ recipeId: "candidate:prepared:ข้าวญี่ปุ่นหุงสุก", name: "ข้าวญี่ปุ่นหุงสุก", methodText: null, workDocuments: {} }),
      recipe({ recipeId: "candidate:prepared:ข้าวหอมมะลิหุงสุก", name: "ข้าวหอมมะลิหุงสุก", methodText: null, workDocuments: {} }),
    );
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: makeSnapshot({ recipes }) });

    expect(screen.getByRole("heading", { name: "สูตรอาหาร" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ดูง่าย", pressed: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "รายการย่อ", pressed: false })).toBeVisible();
    expect(screen.queryByLabelText("สรุปสูตรอาหาร")).not.toBeInTheDocument();
    expect(screen.getByText("87 สูตร")).toBeVisible();
    expect(screen.getAllByText("รอข้อมูล").length).toBeGreaterThan(0);
  });

  test("groups view controls after filters in keyboard order", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: librarySnapshot() });

    const searchbox = screen.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" });
    const filters = screen.getByRole("button", { name: "ตัวกรอง" });
    const viewGroup = screen.getByRole("group", { name: "รูปแบบการแสดงสูตร" });
    const readView = within(viewGroup).getByRole("button", { name: "ดูง่าย" });

    searchbox.focus();
    await user.tab();
    expect(filters).toHaveFocus();
    await user.tab();
    expect(readView).toHaveFocus();
  });

  test("includes the owner-confirmed egg recipe from the current document", async () => {
    const document = withOwnerConfirmedEggRecipe(parseKitchenSotDocument(fixture));
    const client: KitchenSotDraftClient = {
      load: async () => ({ document, origin: "v5-draft", sourcePath: "source", sourceSha256: "a".repeat(64), baseSha256: "b".repeat(64) }),
      save: async () => { throw new Error("not used"); },
    };
    render(<PrototypeProvider initialSnapshot={librarySnapshot()}><KitchenSotDraftProvider client={client}><MemoryRouter><RecipeLibraryPage /></MemoryRouter></KitchenSotDraftProvider></PrototypeProvider>);

    expect(await screen.findByRole("link", { name: /ไข่ข้น/ })).toBeVisible();
    expect(screen.getByText("19 สูตร")).toBeVisible();
  });

  test("reacts to confirmed kitchen data and keeps the plain status label", async () => {
    const user = userEvent.setup();
    const document = parseKitchenSotDocument(fixture);
    const client: KitchenSotDraftClient = {
      load: async () => ({ document, origin: "v4", sourcePath: "source", sourceSha256: "a".repeat(64), baseSha256: "b".repeat(64) }),
      save: async (submitted) => ({ document: submitted, sha256: "c".repeat(64), base_sha256: "c".repeat(64), generatedAt: submitted.generated_at, path: "draft.json" }),
    };
    render(<PrototypeProvider initialSnapshot={librarySnapshot()}><KitchenSotDraftProvider client={client}><MemoryRouter><RecipeLibraryPage /><OwnerConfirmationEditor /></MemoryRouter></KitchenSotDraftProvider></PrototypeProvider>);
    const row = (await screen.findByRole("link", { name: /ข้าวหน้าเนื้อยากินิกุ/ })).closest("li")!;
    expect(within(row).getByText("รอข้อมูล")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "ยืนยันข้าวญี่ปุ่น" }));
    expect(within(row).getByText("พร้อมใช้")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "บันทึกทดสอบ" }));
    expect(await screen.findByText("saved", { selector: "output" })).toBeVisible();
  });

  test("searches Thai names and never makes internal identities the primary label", async () => {
    const user = userEvent.setup();
    const snapshot = librarySnapshot();
    const before = structuredClone(snapshot);
    renderWithPrototype(<RecipeLibraryPage />, { snapshot });
    await user.type(screen.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" }), "  ยากินิกุ  ");
    expect(screen.getByRole("link", { name: /ข้าวหน้าเนื้อยากินิกุ/ })).toBeVisible();
    expect(screen.getByText("แสดง 1 จาก 5 สูตร")).toBeVisible();
    expect(snapshot).toEqual(before);
  });

  test("searches by the visible recipe code", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: makeSnapshot({ recipes: [
      recipe({ recipeId: "RCP-011", name: "แกงกะหรี่เนื้อ" }),
      recipe({ recipeId: "RCP-012", name: "ข้าวหน้าเนื้อ" }),
    ] }) });

    await user.type(screen.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" }), "rcp-012");

    expect(screen.getByRole("link", { name: /ข้าวหน้าเนื้อ/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /แกงกะหรี่เนื้อ/ })).not.toBeInTheDocument();
  });

  test("keeps spaces while typing a multi-word recipe search", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: makeSnapshot({ recipes: [
      recipe({ recipeId: "RCP-019", name: "เกี๊ยว 7 ชิ้น + น้ำจิ้ม" }),
      recipe({ recipeId: "RCP-020", name: "เกี๊ยวทอดเนื้อสับ" }),
    ] }) });
    const searchbox = screen.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" });

    await user.type(searchbox, "เกี๊ยว 7 ชิ้น");

    expect(searchbox).toHaveValue("เกี๊ยว 7 ชิ้น");
    expect(screen.getByRole("link", { name: /เกี๊ยว 7 ชิ้น \+ น้ำจิ้ม/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /เกี๊ยวทอดเนื้อสับ/ })).not.toBeInTheDocument();
  });

  test("synchronizes the raw search input on Back and Forward navigation", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<><RecipeLibraryPage /><SearchHistoryControls /></>, {
      route: "/recipes?q=แกง",
      snapshot: librarySnapshot(),
    });
    const searchbox = screen.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" });

    expect(searchbox).toHaveValue("แกง");
    await user.click(screen.getByRole("button", { name: "ค้นหาเกี๊ยว" }));
    expect(searchbox).toHaveValue("เกี๊ยว 7");
    await user.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
    expect(searchbox).toHaveValue("แกง");
    await user.click(screen.getByRole("button", { name: "ไปข้างหน้า" }));
    expect(searchbox).toHaveValue("เกี๊ยว 7");
  });

  test("shows the ingredient count on every recipe card", () => {
    const recipeWithIngredients = recipe({
      recipeId: "RCP-011",
      name: "แกงกะหรี่เนื้อ",
      lines: [
        makeIngredientLine({ lineKey: "beef", itemName: "เนื้อวัว" }),
        makeIngredientLine({ lineKey: "curry", itemName: "ผงกะหรี่" }),
      ],
    });
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: makeSnapshot({ recipes: [recipeWithIngredients] }) });

    const card = screen.getByRole("link", { name: /แกงกะหรี่เนื้อ/ }).closest("li")!;
    expect(within(card).getByText("ส่วนผสม 2 รายการ")).toBeVisible();
  });

  test("turns the recipe library into the Work entry point", () => {
    const recipeRow = recipe({ recipeId: "RCP-011", name: "แกงกะหรี่เนื้อ" });
    renderWithPrototype(<RecipeLibraryPage />, {
      route: "/recipes?mode=work",
      snapshot: makeSnapshot({ recipes: [recipeRow] }),
    });

    expect(screen.getByRole("heading", { name: "ใบงานครัว" })).toBeVisible();
    expect(screen.getByRole("link", { name: "เปิดใบงาน แกงกะหรี่เนื้อ" })).toHaveAttribute(
      "href", "/work/RCP-011?stage=all",
    );
  });

  test("turns the recipe library into Manage without read-density controls", () => {
    const recipeRow = recipe({ recipeId: "RCP-011", name: "แกงกะหรี่เนื้อ" });
    renderWithPrototype(<RecipeLibraryPage />, {
      route: "/recipes?mode=manage&view=compact",
      snapshot: makeSnapshot({ recipes: [recipeRow] }),
    });

    expect(screen.getByRole("heading", { name: "จัดการสูตร" })).toBeVisible();
    const table = screen.getByRole("table", { name: "รายการจัดการสูตร" });
    expect(within(table).getByRole("link", { name: "แก้ไข แกงกะหรี่เนื้อ" })).toHaveAttribute(
      "href", "/recipes/RCP-011/edit",
    );
    expect(screen.queryByRole("button", { name: "ดูง่าย" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "รายการย่อ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "รูปแบบการแสดงสูตร" })).not.toBeInTheDocument();
  });

  test("filters Manage by an allowlisted print collection key", () => {
    renderWithPrototype(<RecipeLibraryPage />, {
      route: "/recipes?mode=manage&collection=unassigned",
      snapshot: makeSnapshot({ recipes: [
        recipe({ recipeId: "RCP-SA", name: "ซอสในหมวด", category: "ซอสและน้ำจิ้ม" }),
        recipe({ recipeId: "RCP-OLD", name: "สูตรยังไม่จัดหมวด", category: "หมวดเดิมจากระบบเก่า" }),
      ] }),
    });

    expect(screen.getAllByRole("link", { name: "แก้ไข สูตรยังไม่จัดหมวด" })).toHaveLength(2);
    expect(screen.queryAllByRole("link", { name: "แก้ไข ซอสในหมวด" })).toHaveLength(0);
    expect(screen.getByText("แสดง 1 จาก 2 สูตร")).toBeVisible();
  });

  test("stores the view in the URL while preserving valid state and dropping unsupported parameters", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<><RecipeLibraryPage /><CurrentLocation /></>, {
      route: "/recipes?mode=work&q=แกง&kind=prepared_recipe&status=ready&stage=cook&junk=x",
      snapshot: librarySnapshot(),
    });

    await user.click(screen.getByRole("button", { name: "รายการย่อ" }));

    expect(screen.getByLabelText("ตำแหน่งปัจจุบัน")).toHaveTextContent(
      "/recipes?mode=work&view=compact&q=%E0%B9%81%E0%B8%81%E0%B8%87&kind=prepared_recipe&status=ready&stage=cook",
    );
  });

  test("keeps advanced filters collapsed until requested", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: librarySnapshot() });

    const disclosure = screen.getByRole("button", { name: "ตัวกรอง" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("ประเภทสูตร")).not.toBeInTheDocument();

    await user.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("ประเภทสูตร")).toBeVisible();
    expect(screen.getByLabelText("สถานะข้อมูล")).toBeVisible();
    expect(screen.getByLabelText("จุดงาน")).toBeVisible();
  });

  test("shows named removable chips and clear-all only for active filters", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<><RecipeLibraryPage /><CurrentLocation /></>, {
      route: "/recipes?kind=sellable_menu&status=ready&stage=service",
      snapshot: librarySnapshot(),
    });

    expect(screen.getByRole("button", { name: "ลบตัวกรอง เมนูขาย" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ลบตัวกรอง พร้อมใช้" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ลบตัวกรอง จัดเสิร์ฟ" })).toBeVisible();
    expect(screen.getByRole("button", { name: "ล้างตัวกรอง" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "ลบตัวกรอง เมนูขาย" }));
    expect(screen.queryByRole("button", { name: "ลบตัวกรอง เมนูขาย" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("ตำแหน่งปัจจุบัน")).toHaveTextContent(
      "/recipes?status=ready&stage=service",
    );

    await user.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
    expect(screen.queryByRole("button", { name: "ล้างตัวกรอง" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("ตำแหน่งปัจจุบัน")).toHaveTextContent("/recipes");
  });

  test.each([
    ["ประเภทสูตร", "sellable_menu", "ข้าวหน้าเนื้อยากินิกุ"],
    ["จุดงาน", "cook", "สูตรครัวปรุง"],
    ["สถานะข้อมูล", "waiting", "สูตรไม่มีวิธี"],
  ])("filters independently with %s", async (label, value, expectedName) => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: librarySnapshot() });
    await user.click(screen.getByRole("button", { name: "ตัวกรอง" }));
    await user.selectOptions(screen.getByLabelText(label), value);
    expect(screen.getByRole("link", { name: new RegExp(expectedName) })).toBeVisible();
  });

  test("shows an accurate empty state and clears every control", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: librarySnapshot() });
    await user.type(screen.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" }), "ไม่มีสูตรนี้");
    await user.click(screen.getByRole("button", { name: "ตัวกรอง" }));
    await user.selectOptions(screen.getByLabelText("ประเภทสูตร"), "sellable_menu");
    expect(screen.getByText("ไม่พบสูตรที่ตรงกับการค้นหา")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
    expect(screen.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" })).toHaveValue("");
    expect(screen.getByLabelText("ประเภทสูตร")).toHaveValue("all");
    expect(screen.getByText("แสดง 5 จาก 5 สูตร")).toBeVisible();
  });

  test("contains no migration or engineering vocabulary", () => {
    renderWithPrototype(<RecipeLibraryPage />, { snapshot: librarySnapshot() });
    expect(document.body).not.toHaveTextContent(/AI|Prototype|Mock|V[456]|schema|blocker|provenance|candidate|Supabase|snapshot/i);
  });
});
