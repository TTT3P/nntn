import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type {
  KitchenSotDraftClient,
  LoadedKitchenSotDraft,
} from "../../data/KitchenSotDraftClient";
import type { CookbookDocumentClient } from "../../data/CookbookDocumentClient";
import fixture from "../../data/fixtures/first-set.json";
import type { CookbookSnapshot, RecipeVersion, WorkStage } from "../../domain/cookbook/types";
import type { CookbookV6Document } from "../../domain/cookbookV6/types";
import { FixtureCookbookRepository } from "../../data/FixtureCookbookRepository";
import {
  parseKitchenSotDocument,
  type KitchenSotDocument,
} from "../../domain/sot/kitchenSotDocument";
import { PrototypeContext, type PrototypeContextValue } from "../../prototype/PrototypeProvider";
import { makeIngredientLine, makeMediaAsset, makeRecipe, makeSnapshot, makeStepMediaLink, makeWorkStep } from "../../test/builders";
import { withOwnerConfirmedEggRecipe } from "../../test/ownerConfirmedEggRecipe";
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { encodeRecipeIdentity } from "../recipe/recipeRoute";
import { KitchenSotDraftProvider } from "../review/KitchenSotDraftProvider";
import { CookbookDocumentProvider } from "../cookbook/CookbookDocumentProvider";
import { resolveWorkStageDraft, WorkStagePage } from "./WorkStagePage";

afterEach(cleanup);
afterAll(() => vi.restoreAllMocks());

let firstSet: CookbookSnapshot;
beforeAll(async () => {
  firstSet = await new FixtureCookbookRepository().loadSnapshot();
});

function renderWork(options: { snapshot: CookbookSnapshot; route: string }) {
  return renderWithPrototype(
    <Routes><Route path="/work/:recipeId" element={<WorkStagePage />} /></Routes>,
    options,
  );
}

function loadedKitchenSotDraft(document: KitchenSotDocument): LoadedKitchenSotDraft {
  return {
    document,
    origin: "v5-draft",
    sourcePath: "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json",
    sourceSha256: "a".repeat(64),
    baseSha256: "b".repeat(64),
  };
}

function prototypeContext(snapshot: CookbookSnapshot): PrototypeContextValue {
  return {
    snapshot,
    dirty: false,
    persistence: "session",
    dispatch: () => ({ ok: true }),
    createSessionObjectUrl: () => "blob:unused",
    releaseSessionObjectUrl: () => undefined,
    isSessionObjectUrl: () => false,
  };
}

function renderWithKitchenSotDocument(
  document: KitchenSotDocument,
  route: string,
  clientOverride?: KitchenSotDraftClient,
) {
  const client: KitchenSotDraftClient = clientOverride ?? {
    load: vi.fn(async () => loadedKitchenSotDraft(document)),
    save: vi.fn(async (submitted) => ({
      document: submitted,
      sha256: "c".repeat(64),
      base_sha256: "c".repeat(64),
      generatedAt: submitted.generated_at,
      path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
    })),
  };
  return render(
    <PrototypeContext.Provider value={prototypeContext(firstSet)}>
      <KitchenSotDraftProvider client={client}>
        <MemoryRouter initialEntries={[route]}>
          <Routes><Route path="/work/:recipeId" element={<WorkStagePage />} /></Routes>
        </MemoryRouter>
      </KitchenSotDraftProvider>
    </PrototypeContext.Provider>,
  );
}

function v6WorkDocument(): CookbookV6Document {
  return {
    schemaVersion: "6.0.0",
    generatedAt: "2026-08-10T00:00:00.000Z",
    derivedFrom: { v5Path: "internal", v5Sha256: "a".repeat(64), catalogSha256: "b".repeat(64) },
    recipes: [
      {
        recipeId: "SRCP-001", code: "SRCP-001", name: "ซอสเตรียม", kind: "prepared_recipe",
        category: "ซอส", active: true, reviewState: "confirmed_by_owner", sourceLocators: [],
        yieldText: "", operationalNotes: [], methodDecisionNote: "",
        ingredients: [{
          lineId: "dep-line", name: "น้ำ", kind: "ingredient", amountText: "10", unitText: "กรัม",
          sourceDisplayText: "10 กรัม", ingredientId: null, componentRecipeId: null, servingNote: "",
          costBasisText: "ห้ามแสดงต้นทุนลับ", decisionStatus: "confirmed", selectedSource: null, active: true,
        }],
        methodSteps: [{ stepId: "dep-step", stage: "prep", instruction: "ผสมซอส", order: 1 }],
        blockers: [], workDocuments: { prep: { stage: "prep", scalable: true, ingredientLineIds: ["dep-line"], stepIds: ["dep-step"] } },
        parentRecipeIds: ["RCP-001"], lineage: { source: "catalog", sourceRecipeId: null },
      },
      {
        recipeId: "RCP-001", code: "RCP-001", name: "เมนูทดสอบ", kind: "sellable_menu",
        category: "เมนู", active: true, reviewState: "confirmed_by_owner", sourceLocators: [],
        yieldText: "", operationalNotes: [], methodDecisionNote: "",
        ingredients: [
          {
            lineId: "rice", name: "ข้าวสุก", kind: "ingredient", amountText: "199", unitText: "กรัม",
            sourceDisplayText: "199 กรัม", ingredientId: null, componentRecipeId: null, servingNote: "ตัก 199 กรัม",
            costBasisText: "ห้ามแสดงต้นทุนลับ", decisionStatus: "confirmed", selectedSource: null, active: true,
          },
          {
            lineId: "removed-dep", name: "ซอสเตรียม", kind: "prepared_recipe", amountText: "1", unitText: "ชุด",
            sourceDisplayText: "1 ชุด", ingredientId: null, componentRecipeId: "SRCP-001", servingNote: "",
            costBasisText: "", decisionStatus: "removed_by_editor", selectedSource: null, active: false,
          },
        ],
        methodSteps: [{ stepId: "service-step", stage: "service", instruction: "จัดจาน", order: 1 }],
        blockers: [], workDocuments: { service: { stage: "service", scalable: false, ingredientLineIds: ["rice", "removed-dep"], stepIds: ["service-step"] } },
        parentRecipeIds: [], lineage: { source: "catalog", sourceRecipeId: null },
      },
    ],
  };
}

function renderWithCookbookDocument(document: CookbookV6Document, route: string) {
  const client: CookbookDocumentClient = {
    load: vi.fn(async () => ({ document, baseSha256: "c".repeat(64), origin: "v6-draft" as const, path: "internal" })),
    save: vi.fn(),
  };
  return render(
    <PrototypeContext.Provider value={prototypeContext(firstSet)}>
      <CookbookDocumentProvider client={client} mediaSnapshot={firstSet}>
        <MemoryRouter initialEntries={[route]}>
          <Routes><Route path="/work/:recipeId" element={<WorkStagePage />} /></Routes>
        </MemoryRouter>
      </CookbookDocumentProvider>
    </PrototypeContext.Provider>,
  );
}

const rawRecipes = parseKitchenSotDocument(fixture).recipes.map((recipe) => ({
  recipeId: recipe.recipe_id,
  recipeName: recipe.recipe_name,
}));

function document(stage: WorkStage, lineKey: string, instruction: string) {
  return {
    stage,
    scalable: stage !== "service",
    ingredientLineKeys: [lineKey],
    steps: [makeWorkStep({ stepId: `${lineKey}:${stage}`, stage, instruction })],
  };
}

function stagedRecipe(overrides: Partial<RecipeVersion> = {}): RecipeVersion {
  const line = makeIngredientLine({ lineKey: "root-line", sourceText: "1 ช้อนโต๊ะ\nห้ามแปลงหน่วย" });
  return makeRecipe({
    recipeId: 37,
    recipeVersionId: "root-v1",
    name: "เมนูหลัก",
    kind: "sellable_menu",
    lines: [line],
    workDocuments: {
      prep: document("prep", line.lineKey, "เตรียมของ"),
      cook: document("cook", line.lineKey, "ปรุงอาหาร"),
      service: document("service", line.lineKey, "จัดเสิร์ฟ"),
    },
    ...overrides,
  });
}

describe("WorkStagePage", () => {
  test("prefers the current cookbook projection and keeps removed dependencies and cost basis out", async () => {
    const view = renderWithCookbookDocument(v6WorkDocument(), "/work/RCP-001?stage=all");

    expect(await screen.findByText("199 กรัม")).toBeVisible();
    expect(screen.queryByRole("heading", { level: 4, name: "ซอสเตรียม" })).not.toBeInTheDocument();
    expect(view.container).not.toHaveTextContent("ห้ามแสดงต้นทุนลับ");
  });

  test("keeps technical implementation language out of normal work copy", async () => {
    const view = renderWithCookbookDocument(v6WorkDocument(), "/work/RCP-001?stage=all");
    await screen.findByRole("heading", { level: 2, name: "เมนูทดสอบ" });

    expect(view.container.textContent).not.toMatch(/\b(?:AI|Prototype|Mock|V4|V5|V6|schema|source|review|blocker|provenance|candidate|Supabase|gateway|snapshot|local[- ]session|session)\b/iu);
    expect(view.container).toHaveTextContent("พร้อมใช้");
  });

  test("uses the loaded V5 candidate text instead of the stale read projection", async () => {
    const document = parseKitchenSotDocument(fixture);
    const rice = document.recipes.find(({ recipe_id }) => recipe_id === 165)!.items
      .find(({ item_name }) => item_name === "ข้าวหอมมะลิหุงสุก")!;
    rice.candidate_text = "199 กรัม ฉบับล่าสุด";

    renderWithKitchenSotDocument(document, "/work/165?stage=service");

    expect(await screen.findByText("199 กรัม ฉบับล่าสุด")).toBeVisible();
    expect(screen.queryByText("180 กรัม")).not.toBeInTheDocument();
    expect(screen.queryByText("72 กรัม")).not.toBeInTheDocument();
  });

  test("renders the owner-confirmed egg recipe as a two-item DRAFT without invented steps", async () => {
    const document = withOwnerConfirmedEggRecipe(parseKitchenSotDocument(fixture));
    renderWithKitchenSotDocument(document, "/work/18?stage=all");

    const article = await screen.findByRole("article", { name: "ไข่ข้น" });
    expect(within(article).getByText("ข้อมูลยังไม่ครบ")).toBeVisible();
    expect(within(article).getAllByRole("row")).toHaveLength(3);
    expect(within(article).getByRole("row", { name: "ไข่ไก่ 2 ฟอง" })).toBeVisible();
    expect(within(article).getByRole("row", {
      name: "รสดีก๋วยเตี๋ยวเข้มข้น ครึ่งช้อนชา (2.5g)",
    })).toBeVisible();
    expect(within(article).getByText("ยังไม่มีวิธีทำไข่ข้นที่เจ้าของหรือครัวยืนยัน"))
      .toBeVisible();
    expect(article.querySelector("ol")).toBeNull();
    expect(within(article).queryByRole("row", { name: /น้ำปลาทิพรส/u }))
      .not.toBeInTheDocument();
    expect(within(article).queryByRole("row", { name: /ผงชูรส/u }))
      .not.toBeInTheDocument();
  });

  test.each(rawRecipes)(
    "opens raw recipe $recipeId ($recipeName) with its mixed identity preserved",
    async ({ recipeId, recipeName }) => {
      renderWithKitchenSotDocument(
        parseKitchenSotDocument(fixture),
        `/work/${encodeRecipeIdentity(recipeId)}?stage=all`,
      );

      expect(await screen.findByRole("heading", { level: 2, name: recipeName })).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  test("keeps provenance-incomplete recipe 159 DRAFT through the shared raw predicate", async () => {
    renderWithKitchenSotDocument(parseKitchenSotDocument(fixture), "/work/159?stage=all");

    const article = await screen.findByRole("article", { name: "ข้าวหน้าเนื้อยากินิกุ" });
    expect(within(article).getByText("ข้อมูลยังไม่ครบ")).toBeVisible();
    expect(within(article).queryByText("พร้อมใช้")).not.toBeInTheDocument();
  });

  test("shows only exact unresolved blocker messages from the raw document", async () => {
    const document = parseKitchenSotDocument(fixture);
    const recipe = document.recipes.find(({ recipe_id }) => recipe_id === 164)!;
    const blocker = recipe.blockers[0]!;

    const unresolved = renderWithKitchenSotDocument(document, "/work/164?stage=prep");
    expect(await screen.findByText(blocker.message)).toBeVisible();
    expect(screen.queryByText("สูตรมีตัวขวางที่ยังไม่ปิด")).not.toBeInTheDocument();
    unresolved.unmount();

    blocker.resolved = true;
    blocker.resolved_note = "เจ้าของยืนยันแล้ว";
    blocker.resolved_at = "2026-08-08T00:00:00.000Z";
    renderWithKitchenSotDocument(document, "/work/164?stage=prep");
    await screen.findByRole("heading", { level: 2, name: recipe.recipe_name });
    expect(screen.queryByText(blocker.message)).not.toBeInTheDocument();
  });

  test("shows recipe 2 operational facts and method scope verbatim", async () => {
    renderWithKitchenSotDocument(parseKitchenSotDocument(fixture), "/work/2?stage=all");

    const article = await screen.findByRole("article", { name: "น้ำซุปก๋วยเตี๋ยว V3" });
    expect(within(article).getByText("ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70"))
      .toBeVisible();
    expect(within(article).getByText("ขอบเขตสูตรนี้เป็นน้ำซุปเท่านั้น ไม่รวมขั้นตอนลงเนื้อ"))
      .toBeVisible();
    expect(within(article).getByText(
      "DOCX V3 ระบุรายการส่วนผสมแต่ไม่มีลำดับวิธีปรุงน้ำซุป; ตัดวิธีเก่าที่มีขั้นตอนลงเนื้อออกตามขอบเขตที่เจ้าของยืนยัน",
    )).toBeVisible();
  });

  test("excludes a removed dependency document while retaining an active use of the same recipe", async () => {
    const removed = renderWithKitchenSotDocument(
      parseKitchenSotDocument(fixture),
      "/work/156?stage=all",
    );

    await screen.findByRole("heading", { level: 2, name: "ซอสยากินิกุ" });
    expect(screen.queryByRole("heading", { level: 4, name: "ซอสอเนกประสงค์" }))
      .not.toBeInTheDocument();
    expect(removed.container.querySelectorAll("tbody tr")).toHaveLength(11);
    expect(screen.queryByRole("row", { name: /ซอสอเนกประสงค์/u }))
      .not.toBeInTheDocument();
    removed.unmount();

    const active = renderWithKitchenSotDocument(
      parseKitchenSotDocument(fixture),
      "/work/157?stage=all",
    );

    expect(await screen.findByRole("heading", { level: 4, name: "ซอสอเนกประสงค์" }))
      .toBeVisible();
    expect(active.container.querySelectorAll("tbody tr")).toHaveLength(14);
  });

  test("shows exact prep yield and method note for Japanese rice", async () => {
    const recipeId = encodeRecipeIdentity("candidate:prepared:ข้าวญี่ปุ่นหุงสุก");
    renderWithKitchenSotDocument(
      parseKitchenSotDocument(fixture),
      `/work/${recipeId}?stage=prep`,
    );

    const article = await screen.findByRole("article", { name: "ข้าวญี่ปุ่นหุงสุก" });
    expect(within(article).getByText("ข้าวหุงสุก 180 กรัม ต่อข้าวสารดิบ 72 กรัม"))
      .toBeVisible();
    expect(within(article).getByText(
      "เรียบเรียงจากคำบอกของครัวเท่าที่ได้รับ โดยไม่เติมเวลา โปรแกรมหม้อ หรือวิธีพักข้าว",
    )).toBeVisible();
  });

  test("shows exact Service serving note while excluding kitchen cost basis", async () => {
    renderWithKitchenSotDocument(parseKitchenSotDocument(fixture), "/work/159?stage=service");

    const article = await screen.findByRole("article", { name: "ข้าวหน้าเนื้อยากินิกุ" });
    expect(within(article).getByText("ตักข้าวหุงสุก 180 กรัม")).toBeVisible();
    expect(within(article).queryByText("ข้าวสารญี่ปุ่นดิบ 72 กรัม")).not.toBeInTheDocument();
    expect(article).not.toHaveTextContent("ฐานต้นทุนต่อที่");
  });

  test.each([2, 160, 9, 161, 162])(
    "renders missing-method recipe %s as a non-empty DRAFT without invented steps",
    async (recipeId) => {
      const document = parseKitchenSotDocument(fixture);
      const recipe = document.recipes.find(({ recipe_id }) => recipe_id === recipeId)!;

      renderWithKitchenSotDocument(
        document,
        `/work/${encodeRecipeIdentity(recipeId)}?stage=all`,
      );

      const article = await screen.findByRole("article", { name: recipe.recipe_name });
      expect(within(article).getByText("ข้อมูลยังไม่ครบ")).toBeVisible();
      expect(within(article).getAllByRole("row").length).toBeGreaterThan(1);
      expect(article.querySelector("ol")).toBeNull();
    },
  );

  test("renders recipe 162 with four ingredient rows and zero invented steps", async () => {
    renderWithKitchenSotDocument(parseKitchenSotDocument(fixture), "/work/162?stage=all");

    const article = await screen.findByRole("article", { name: "ผงคั่วพริกเกลือ" });
    expect(within(article).getAllByRole("row")).toHaveLength(5);
    expect(article.querySelector("ol")).toBeNull();
  });

  test("fails closed when a raw readiness map has no entry for a projected recipe", () => {
    const recipe = stagedRecipe({ blockers: [] });
    const snapshot = makeSnapshot({ recipes: [recipe] });

    expect(resolveWorkStageDraft(recipe, snapshot, new Map())).toBe(true);
    expect(resolveWorkStageDraft(recipe, snapshot, new Map([[recipe.recipeId, false]])))
      .toBe(false);
  });

  test("fails closed when the raw Kitchen SOT document cannot load", async () => {
    const client: KitchenSotDraftClient = {
      load: vi.fn(async () => { throw new Error("RAW_LOAD_FAILED"); }),
      save: vi.fn(),
    };
    renderWithKitchenSotDocument(
      parseKitchenSotDocument(fixture),
      "/work/165?stage=service",
      client,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "โหลดร่าง Kitchen SOT ไม่สำเร็จ: Error",
    );
    expect(screen.queryByRole("heading", { level: 2, name: "ข้าวหน้าเนื้อตุ๋น" }))
      .not.toBeInTheDocument();
  });

  test.each([
    ["numeric", "/work/404?stage=all"],
    ["encoded string", `/work/${encodeRecipeIdentity("candidate:missing")}?stage=all`],
  ])("classifies an absent %s selected root as a route-level not-found", (_kind, route) => {
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route,
    });

    expect(screen.getByRole("alert")).toHaveAccessibleName("เปิดจุดงานไม่ได้");
    expect(screen.getByText("รหัสสูตรไม่ถูกต้องหรือไม่มีอยู่ในคลังสูตร")).toBeVisible();
    expect(screen.queryByText("สร้างเอกสารจุดงานไม่ได้")).not.toBeInTheDocument();
  });

  test("shows only service steps and the 180 gram cooked rice portion", () => {
    renderWork({
      snapshot: firstSet,
      route: "/work/165?stage=service",
    });
    expect(screen.getByText("ข้าวหอมมะลิหุงสุก")).toBeVisible();
    expect(screen.getByText("180 กรัม")).toBeVisible();
    expect(screen.queryByText("72 กรัม")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "จัดเสิร์ฟหน้าร้าน" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "ครัวปรุง / BOM" })).not.toBeInTheDocument();
  });

  test("defaults a missing stage to all and labels stages in operational order", () => {
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37",
    });
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["ผลิตซอสและของเตรียม", "ครัวปรุง / BOM", "จัดเสิร์ฟหน้าร้าน"]);
  });

  test("accepts exact numeric and string identities and preserves them in stage links", () => {
    const numeric = stagedRecipe({ recipeId: 1, recipeVersionId: "numeric" });
    const textual = stagedRecipe({ recipeId: "1", recipeVersionId: "text", name: "สูตรข้อความ" });
    renderWork({
      snapshot: makeSnapshot({ recipes: [numeric, textual] }),
      route: `/work/${encodeRecipeIdentity("1")}?stage=prep`,
    });
    expect(screen.getByRole("heading", { level: 2, name: "สูตรข้อความ" })).toBeVisible();
    expect(screen.getByRole("link", { name: "ครัวปรุง / BOM" })).toHaveAttribute(
      "href",
      `/work/${encodeRecipeIdentity("1")}?stage=cook`,
    );
  });

  test.each(["invalid", "", "PREP", "prep&stage=cook", "prep&extra=1", "all&extra=1"])(
    "rejects invalid explicit stage query %s",
    (stage) => {
      renderWork({
        snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
        route: `/work/37?stage=${stage}`,
      });
      expect(screen.getByRole("alert")).toHaveAccessibleName("จุดงานไม่ถูกต้อง");
      expect(screen.getByRole("link", { name: "ดูทุกจุดงาน" })).toHaveAttribute("href", "/work/37?stage=all");
    },
  );

  test("rejects a query containing only an unrelated parameter", () => {
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?extra=1",
    });
    expect(screen.getByRole("alert")).toHaveAccessibleName("จุดงานไม่ถูกต้อง");
  });

  test("updates the selected stage through accessible navigation", async () => {
    const user = userEvent.setup();
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?stage=prep",
    });

    await user.click(screen.getByRole("link", { name: "ครัวปรุง / BOM" }));

    expect(screen.getByRole("heading", { level: 3, name: "ครัวปรุง / BOM" })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 3, name: "ผลิตซอสและของเตรียม" })).not.toBeInTheDocument();
  });

  test("renders dependency-first recipes once and never projects unrelated recipes", () => {
    const dependency = stagedRecipe({
      recipeId: "dep",
      recipeVersionId: "dep-v1",
      name: "สูตรเตรียมก่อน",
      kind: "prepared_recipe",
      lines: [makeIngredientLine({ lineKey: "dep-line", sourceText: "2 ช้อนชา" })],
      workDocuments: { prep: document("prep", "dep-line", "ทำสูตรเตรียม") },
    });
    const root = stagedRecipe({
      lines: [makeIngredientLine({ lineKey: "root-dep", itemKind: "prepared_recipe", componentRecipeId: "dep", ingredientId: null })],
      workDocuments: { prep: document("prep", "root-dep", "ประกอบเมนู") },
    });
    const unrelated = stagedRecipe({ recipeId: 99, recipeVersionId: "other", name: "สูตรนอกกราฟ" });
    renderWork({
      snapshot: makeSnapshot({ recipes: [root, unrelated, dependency] }),
      route: "/work/37?stage=prep",
    });

    const recipeHeadings = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
    expect(recipeHeadings).toEqual(["สูตรเตรียมก่อน", "เมนูหลัก"]);
    expect(screen.queryByText("สูตรนอกกราฟ")).not.toBeInTheDocument();
  });

  test("does not render empty stages and explains an explicitly selected unmapped stage", () => {
    const recipe = stagedRecipe({ workDocuments: { cook: document("cook", "root-line", "ทอด") } });
    const all = renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=all",
    });
    expect(screen.getByRole("heading", { name: "ครัวปรุง / BOM" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "ผลิตซอสและของเตรียม" })).not.toBeInTheDocument();
    all.unmount();

    renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=service",
    });
    expect(screen.getByText("เมนูนี้ไม่มีขั้นตอนในจุดงานที่เลือก")).toBeVisible();
  });

  test("renders exact source fields without conversion and separates DRAFT from media gaps", () => {
    const recipe = stagedRecipe({
      blockers: ["ยืนยันวิธีทอด"],
      lines: [makeIngredientLine({ lineKey: "root-line", sourceText: null, sourceValue: 1.5, sourceUnit: "ช้อนโต๊ะ (เดิม)" })],
      workDocuments: { prep: document("prep", "root-line", "เตรียม") },
    });
    const before = structuredClone(recipe);
    renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=prep",
    });
    expect(screen.getByText("1.5 ช้อนโต๊ะ (เดิม)")).toBeVisible();
    expect(screen.getByText("ข้อมูลยังไม่ครบ")).toBeVisible();
    expect(screen.getByText("ยืนยันวิธีทอด")).toBeVisible();
    expect(screen.getByText("รูปขั้นตอนไม่ครบ")).toBeVisible();
    expect(recipe).toEqual(before);
  });

  test("surfaces malformed identities and graph/projection failures as named errors", () => {
    const malformed = renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/01?stage=all",
    });
    expect(screen.getByRole("alert")).toHaveAccessibleName("เปิดจุดงานไม่ได้");
    malformed.unmount();

    const root = stagedRecipe({
      lines: [makeIngredientLine({ lineKey: "missing", itemKind: "prepared_recipe", componentRecipeId: "unknown", ingredientId: null })],
    });
    renderWork({
      snapshot: makeSnapshot({ recipes: [root] }),
      route: "/work/37?stage=all",
    });
    expect(screen.getByRole("alert")).toHaveAccessibleName("สร้างเอกสารจุดงานไม่ได้");
    expect(screen.getByRole("alert")).toHaveTextContent("ข้อมูลสูตรที่เกี่ยวข้องยังไม่ครบ");
  });

  test("keeps an unknown reachable component classified as a document error", () => {
    const root = stagedRecipe({
      lines: [makeIngredientLine({ lineKey: "unknown-component", itemKind: "prepared_recipe", componentRecipeId: "candidate:missing", ingredientId: null })],
    });
    renderWork({
      snapshot: makeSnapshot({ recipes: [root] }),
      route: "/work/37?stage=all",
    });

    expect(screen.getByRole("alert")).toHaveAccessibleName("สร้างเอกสารจุดงานไม่ได้");
    expect(screen.queryByText("เปิดจุดงานไม่ได้")).not.toBeInTheDocument();
  });

  test("surfaces work-document integrity errors without partial output", () => {
    const recipe = stagedRecipe();
    recipe.workDocuments.prep!.stage = "cook";
    renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=prep",
    });
    expect(screen.getByRole("alert")).toHaveAccessibleName("สร้างเอกสารจุดงานไม่ได้");
    expect(screen.getByRole("alert")).toHaveTextContent("ข้อมูลสูตรที่เกี่ยวข้องยังไม่ครบ");
    expect(screen.queryByRole("heading", { name: "ผลิตซอสและของเตรียม" })).not.toBeInTheDocument();
  });

  test("rejects duplicate selected identities before mixing recipe revisions", () => {
    const first = stagedRecipe({ recipeVersionId: "root-v1", name: "ชื่อ revision แรก" });
    const second = stagedRecipe({ recipeVersionId: "root-v2", name: "ชื่อ revision สอง" });
    renderWork({
      snapshot: makeSnapshot({ recipes: [first, second] }),
      route: "/work/37?stage=all",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("ข้อมูลสูตรที่เกี่ยวข้องยังไม่ครบ");
    expect(screen.queryByText("ชื่อ revision แรก")).not.toBeInTheDocument();
    expect(screen.queryByText("ชื่อ revision สอง")).not.toBeInTheDocument();
  });

  test("rejects duplicate version IDs in the reachable graph but ignores unreachable duplicates", () => {
    const dependency = stagedRecipe({ recipeId: "dep", recipeVersionId: "shared-v1", name: "สูตรย่อย" });
    const root = stagedRecipe({
      recipeVersionId: "shared-v1",
      lines: [makeIngredientLine({ lineKey: "root-dep", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "dep" })],
      workDocuments: { prep: document("prep", "root-dep", "ประกอบ") },
    });
    const unreachableA = stagedRecipe({ recipeId: 90, recipeVersionId: "outside-v1" });
    const unreachableB = stagedRecipe({ recipeId: 91, recipeVersionId: "outside-v1" });
    renderWork({
      snapshot: makeSnapshot({ recipes: [root, dependency, unreachableA, unreachableB] }),
      route: "/work/37?stage=prep",
    });

    expect(screen.getByRole("alert")).toHaveTextContent("ข้อมูลสูตรที่เกี่ยวข้องยังไม่ครบ");
  });

  test("turns malformed projected render values into a named alert without partial output", () => {
    const recipe = stagedRecipe();
    recipe.lines[0]!.itemName = { hostile: true } as never;
    renderWork({
      snapshot: makeSnapshot({ recipes: [recipe] }),
      route: "/work/37?stage=prep",
    });

    expect(screen.getByRole("alert")).toHaveAccessibleName("สร้างเอกสารจุดงานไม่ได้");
    expect(screen.getByRole("alert")).toHaveTextContent("ข้อมูลสูตรที่เกี่ยวข้องยังไม่ครบ");
    expect(screen.queryByRole("heading", { name: "ผลิตซอสและของเตรียม" })).not.toBeInTheDocument();
  });

  test("does not introduce a nested main landmark", () => {
    const view = renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?stage=prep",
    });
    expect(view.container.querySelector("main")).toBeNull();
  });

  test("renders a media editor for each visible projected step", () => {
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?stage=prep",
    });

    expect(screen.getByRole("group", { name: "รูปของขั้นตอน เตรียมของ" })).toBeVisible();
    expect(screen.getByText("เพิ่มรูปภายหลัง")).toBeVisible();
    expect(screen.queryByText(/แก้ไขชั่วคราว/u)).not.toBeInTheDocument();
  });

  test("edits media through a visible work step without changing readiness status", async () => {
    const user = userEvent.setup();
    renderWork({
      snapshot: makeSnapshot({
        recipes: [stagedRecipe()],
        media: [makeMediaAsset({ mediaId: "prep-photo", caption: "ภาพเตรียม", altText: "ภาพเตรียมของ" })],
        stepMedia: [makeStepMediaLink({ stepId: "root-line:prep", mediaId: "prep-photo", reviewNeeded: true })],
      }),
      route: "/work/37?stage=prep",
    });

    expect(screen.getByText("รูปควรตรวจใหม่")).toBeVisible();
    expect(screen.getByText("พร้อมใช้")).toBeVisible();
    expect(screen.queryByText("ข้อมูลยังไม่ครบ")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("ชนิดรูป"), "final");
    await user.selectOptions(screen.getByLabelText("ภาชนะ"), "plate");
    expect(screen.getByLabelText("ชนิดรูป")).toHaveValue("final");
    expect(screen.getByLabelText("ภาชนะ")).toHaveValue("plate");
    expect(screen.getByText("พร้อมใช้")).toBeVisible();
  });

  test("previews a local file from the visible stage editor", async () => {
    const user = userEvent.setup();
    renderWork({
      snapshot: makeSnapshot({ recipes: [stagedRecipe()] }),
      route: "/work/37?stage=prep",
    });

    await user.upload(
      screen.getByLabelText("เลือกรูป"),
      new File(["preview"], "station-prep.png", { type: "image/png" }),
    );

    expect(screen.getByAltText("ตัวอย่าง station-prep.png")).toBeVisible();
    expect(screen.getByText("รูปนี้อยู่เฉพาะ session และจะหายเมื่อ reload")).toBeVisible();
    expect(screen.getByText("พร้อมใช้")).toBeVisible();
  });
});
