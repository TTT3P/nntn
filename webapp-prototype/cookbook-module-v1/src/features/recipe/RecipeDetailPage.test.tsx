import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test } from "vitest";
import catalogJson from "../../data/catalog/recipe-catalog-85.json";
import crosswalkJson from "../../data/catalog/v5-recipe-crosswalk.json";
import fixture from "../../data/fixtures/first-set.json";
import type { CookbookDocumentClient } from "../../data/CookbookDocumentClient";
import type { KitchenSotDraftClient } from "../../data/KitchenSotDraftClient";
import type { CookbookSnapshot, RecipeIdentity } from "../../domain/cookbook/types";
import { migrateV5ToV6 } from "../../domain/cookbookV6/migrateV5ToV6";
import { parseRecipeCatalog } from "../../domain/catalog/recipeCatalog";
import { parseKitchenSotDocument } from "../../domain/sot/kitchenSotDocument";
import { PrototypeProvider } from "../../prototype/PrototypeProvider";
import { makeIngredientLine, makeRecipe, makeSnapshot } from "../../test/builders";
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { withOwnerConfirmedEggRecipe } from "../../test/ownerConfirmedEggRecipe";
import { CookbookDocumentProvider } from "../cookbook/CookbookDocumentProvider";
import { KitchenSotDraftProvider } from "../review/KitchenSotDraftProvider";
import { RecipeDetailPage } from "./RecipeDetailPage";
import { decodeRecipeIdentity, encodeRecipeIdentity } from "./recipeRoute";

afterEach(cleanup);

function renderDetail(snapshot: CookbookSnapshot, route: string) {
  return renderWithPrototype(
    <Routes><Route path="/recipes/:recipeId" element={<RecipeDetailPage />} /></Routes>,
    { snapshot, route },
  );
}

function renderMigratedDetail(route: string) {
  const document = migrateV5ToV6({
    catalog: parseRecipeCatalog(catalogJson),
    v5: withOwnerConfirmedEggRecipe(parseKitchenSotDocument(fixture)),
    crosswalk: crosswalkJson,
    v5Sha256: "9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7",
    catalogSha256: "9aa666169fc04774ba735894553d0a8f984f566f2004cbb2a315240cf0a00d66",
    generatedAt: "2026-08-10T00:00:00.000Z",
  });
  const client: CookbookDocumentClient = {
    load: async () => ({ document, baseSha256: "c".repeat(64), origin: "synthesized", path: "draft.json" }),
    save: async () => { throw new Error("not used"); },
  };
  const emptySnapshot = makeSnapshot({ recipes: [], media: [], stepMedia: [] });
  return render(
    <PrototypeProvider initialSnapshot={emptySnapshot}>
      <CookbookDocumentProvider client={client} mediaSnapshot={emptySnapshot}>
        <MemoryRouter initialEntries={[route]}>
          <Routes><Route path="/recipes/:recipeId" element={<RecipeDetailPage />} /></Routes>
        </MemoryRouter>
      </CookbookDocumentProvider>
    </PrototypeProvider>,
  );
}

describe("recipe identity route codec", () => {
  test.each<RecipeIdentity>([159, -2, "1", "candidate:สูตร/ไทย?x=1#ส่วน", "", "\ud800", "a|b~c", "RCP-011", "SRCP-018"])(
    "round-trips the exact identity %j without numeric/string collisions",
    (identity) => {
      expect(decodeRecipeIdentity(encodeRecipeIdentity(identity))).toEqual(identity);
    },
  );

  test("keeps numeric and numeric-looking string routes distinct", () => {
    expect(encodeRecipeIdentity(159)).toBe("159");
    expect(encodeRecipeIdentity("RCP-011")).toBe("RCP-011");
    expect(encodeRecipeIdentity(1)).not.toBe(encodeRecipeIdentity("1"));
    expect(decodeRecipeIdentity("s~not-hex")).toBeNull();
    expect(decodeRecipeIdentity("01")).toBeNull();
  });
});

function graphSnapshot(): CookbookSnapshot {
  const shared = makeRecipe({ recipeId: "shared", recipeVersionId: "shared-v1", name: "ซอสกลาง", kind: "prepared_recipe" });
  const vegetables = makeRecipe({
    recipeId: 157,
    recipeVersionId: "veg-v1",
    name: "ผัดผัก",
    kind: "prepared_recipe",
    lines: [makeIngredientLine({ lineKey: "veg-shared", itemName: "ซอสกลาง", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "shared" })],
  });
  const sauce = makeRecipe({
    recipeId: "candidate:sauce",
    recipeVersionId: "sauce-v1",
    name: "ซอสยากินิกุ",
    kind: "prepared_recipe",
    lines: [makeIngredientLine({ lineKey: "sauce-shared", itemName: "ซอสกลาง", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "shared" })],
  });
  const root = makeRecipe({
    recipeId: 159,
    recipeVersionId: "menu-v1",
    name: "ข้าวหน้าเนื้อยากินิกุ",
    kind: "sellable_menu",
    lines: [
      makeIngredientLine({ lineKey: "root-veg", itemName: "ผัดผัก", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: 157 }),
      makeIngredientLine({ lineKey: "root-sauce", itemName: "ซอสยากินิกุ", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "candidate:sauce" }),
      makeIngredientLine({ lineKey: "root-beef", itemName: "เนื้อพิคานย่า", itemKind: "direct_ingredient", ingredientId: 44, componentRecipeId: null, sourceText: "180 กรัม" }),
    ],
  });
  return makeSnapshot({ recipes: [root, vegetables, sauce, shared] });
}

describe("RecipeDetailPage", () => {
  test("opens a blank catalog recipe as a normal product page", () => {
    const blank = makeRecipe({
      recipeId: "RCP-011",
      recipeVersionId: "cookbook-v6:RCP-011",
      name: "ข้าวเนื้อสับคั่วน้ำปลาไข่ข้น",
      kind: "sellable_menu",
      reviewState: "blocked",
      lines: [],
      methodText: null,
      workDocuments: {},
    });
    renderDetail(makeSnapshot({ recipes: [blank] }), "/recipes/RCP-011");

    expect(screen.getByRole("heading", { name: "ข้าวเนื้อสับคั่วน้ำปลาไข่ข้น" })).toBeVisible();
    expect(screen.getByText("รอข้อมูล")).toBeVisible();
    expect(screen.getByRole("link", { name: "แก้ไขสูตร" })).toHaveAttribute("href", "/recipes/RCP-011/edit");
    expect(screen.getByText("ยังไม่มีรายการวัตถุดิบ")).toBeVisible();
    expect(screen.getByText("ยังไม่มีวิธีทำ")).toBeVisible();
    expect(screen.getAllByText("ทีมครัวเติมภายหลัง")).toHaveLength(3);
  });

  test("shows the owner-confirmed egg recipe without removed ingredients", async () => {
    const document = withOwnerConfirmedEggRecipe(parseKitchenSotDocument(fixture));
    const client: KitchenSotDraftClient = {
      load: async () => ({ document, origin: "v5-draft", sourcePath: "source", sourceSha256: "a".repeat(64), baseSha256: "b".repeat(64) }),
      save: async () => { throw new Error("not used"); },
    };
    render(
      <PrototypeProvider initialSnapshot={graphSnapshot()}>
        <KitchenSotDraftProvider client={client}>
          <MemoryRouter initialEntries={["/recipes/18"]}>
            <Routes><Route path="/recipes/:recipeId" element={<RecipeDetailPage />} /></Routes>
          </MemoryRouter>
        </KitchenSotDraftProvider>
      </PrototypeProvider>,
    );

    const heading = await screen.findByRole("heading", { name: "ไข่ข้น" });
    const article = heading.closest("article");
    expect(article).not.toBeNull();
    expect(within(article!).getByText("ไข่ไก่")).toBeVisible();
    expect(within(article!).getByText("รสดีก๋วยเตี๋ยวเข้มข้น")).toBeVisible();
    expect(within(article!).getByText("รอข้อมูล")).toBeVisible();
    expect(screen.queryByText("น้ำปลาทิพรส")).not.toBeInTheDocument();
    expect(screen.queryByText("ผงชูรส")).not.toBeInTheDocument();
  });

  test("uses the current source data to fail closed on incomplete recipes", async () => {
    const document = parseKitchenSotDocument(fixture);
    const client: KitchenSotDraftClient = {
      load: async () => ({ document, origin: "v4", sourcePath: "source", sourceSha256: "a".repeat(64), baseSha256: "b".repeat(64) }),
      save: async () => { throw new Error("not used"); },
    };
    render(
      <PrototypeProvider initialSnapshot={graphSnapshot()}>
        <KitchenSotDraftProvider client={client}>
          <MemoryRouter initialEntries={["/recipes/159"]}>
            <Routes><Route path="/recipes/:recipeId" element={<RecipeDetailPage />} /></Routes>
          </MemoryRouter>
        </KitchenSotDraftProvider>
      </PrototypeProvider>,
    );
    const header = (await screen.findByRole("heading", { name: "ข้าวหน้าเนื้อยากินิกุ" })).closest("header");
    expect(header).not.toBeNull();
    expect(within(header!).getByText("รอข้อมูล")).toBeVisible();
    expect(within(header!).queryByText("พร้อมใช้")).not.toBeInTheDocument();
  });

  test("links prepared ingredients and keeps direct ingredients as plain text", () => {
    renderDetail(graphSnapshot(), "/recipes/159");

    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "ผัดผัก" })).toHaveAttribute("href", "/recipes/157");
    expect(within(table).getByText("เนื้อพิคานย่า")).toBeVisible();
    expect(within(table).getByText("180 กรัม")).toBeVisible();
    expect(within(table).queryByRole("link", { name: "เนื้อพิคานย่า" })).not.toBeInTheDocument();
  });

  test("shows real RCP-021 method steps in canonical cook then service order", async () => {
    renderMigratedDetail("/recipes/RCP-021");
    await screen.findByRole("heading", { name: "ข้าวขยำเนื้อแดดเดียว" });
    const methodSection = screen.getByRole("heading", { name: "วิธีทำ" }).closest("section");
    expect(methodSection).not.toBeNull();
    expect(within(methodSection!).getAllByRole("listitem").map((item) => item.textContent).slice(0, 3)).toEqual([
      "ก่อนแพ็ค ตัดเนื้อให้เป็นชิ้นพอดีคำ ความยาวประมาณ 1.5 นิ้ว",
      "ทอดเนื้อแดดเดียว แล้วพักไว้",
      "ตักข้าวใส่กล่อง นำผักต่างๆ จัดวางไว้รอบๆ กล่อง แล้วโปะเนื้อที่เตรียมไว้ลงไป ยกเว้นกระเทียมกรอบ",
    ]);
  });

  test("links the print action to the current stable recipe identity", () => {
    const recipe = makeRecipe({ recipeId: "RCP-021", name: "ข้าวขยำเนื้อแดดเดียว" });
    renderDetail(makeSnapshot({ recipes: [recipe] }), "/recipes/RCP-021");

    expect(screen.getByRole("link", { name: "พิมพ์" })).toHaveAttribute(
      "href",
      "/print?recipe=RCP-021",
    );
  });

  test("resolves an encoded candidate identity exactly instead of coercing it to a number", () => {
    const stringRecipe = makeRecipe({ recipeId: "1", recipeVersionId: "string-v1", name: "สูตรรหัสข้อความ" });
    const numericRecipe = makeRecipe({ recipeId: 1, recipeVersionId: "numeric-v1", name: "สูตรรหัสตัวเลข" });
    renderDetail(makeSnapshot({ recipes: [numericRecipe, stringRecipe] }), `/recipes/${encodeRecipeIdentity("1")}`);
    expect(screen.getByRole("heading", { name: "สูตรรหัสข้อความ" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "สูตรรหัสตัวเลข" })).not.toBeInTheDocument();
  });

  test.each(["/recipes/404", "/recipes/s~broken"])("renders an accessible not-found error for %s", (route) => {
    renderDetail(graphSnapshot(), route);
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("heading", { name: "ไม่พบสูตรอาหาร" })).toBeVisible();
  });

  test("shows an accessible generic message when related recipe data is incomplete", () => {
    const broken = makeRecipe({
      recipeId: 7,
      name: "สูตรลิงก์เสีย",
      lines: [makeIngredientLine({ itemKind: "prepared_recipe", componentRecipeId: "missing" })],
    });
    renderDetail(makeSnapshot({ recipes: [broken] }), "/recipes/7");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("heading", { name: "เปิดสูตรอาหารไม่ได้" })).toBeVisible();
    expect(screen.getByText("ข้อมูลสูตรที่เกี่ยวข้องยังไม่ครบ")).toBeVisible();
  });

  test("lists related recipes once even when a shared recipe has two paths", () => {
    renderDetail(graphSnapshot(), "/recipes/159");
    const related = screen.getByRole("navigation", { name: "สูตรที่ใช้ร่วมกัน" });
    expect(within(related).getAllByRole("link", { name: "ซอสกลาง" })).toHaveLength(1);
  });

  test("contains no migration or engineering vocabulary", () => {
    renderDetail(graphSnapshot(), "/recipes/159");
    expect(document.body).not.toHaveTextContent(/AI|Prototype|Mock|V[456]|schema|blocker|provenance|candidate|Supabase|snapshot/i);
  });
});
