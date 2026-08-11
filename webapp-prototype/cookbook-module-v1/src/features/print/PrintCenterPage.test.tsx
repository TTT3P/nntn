import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { FixtureCookbookRepository } from "../../data/FixtureCookbookRepository";
import type { CookbookDocumentClient } from "../../data/CookbookDocumentClient";
import type {
  KitchenSotDraftClient,
  LoadedKitchenSotDraft,
} from "../../data/KitchenSotDraftClient";
import type { CookbookSnapshot } from "../../domain/cookbook/types";
import type { CookbookV6Document } from "../../domain/cookbookV6/types";
import { buildMediaIndex, buildPrintPlan } from "../../domain/print/printPlanner";
import {
  parseKitchenSotDocument,
  type KitchenSotDocument,
} from "../../domain/sot/kitchenSotDocument";
import { projectWorkDocuments } from "../../domain/work/workDocuments";
import {
  makeIngredientLine,
  makeMediaAsset,
  makeRecipe,
  makeSnapshot,
  makeStepMediaLink,
  makeWorkStep,
} from "../../test/builders";
import { withOwnerConfirmedEggRecipe } from "../../test/ownerConfirmedEggRecipe";
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { PrototypeContext, type PrototypeContextValue } from "../../prototype/PrototypeProvider";
import fixture from "../../data/fixtures/first-set.json";
import { KitchenSotDraftProvider } from "../review/KitchenSotDraftProvider";
import { CookbookDocumentProvider } from "../cookbook/CookbookDocumentProvider";
import { PrintCenterPage } from "./PrintCenterPage";
import { WorkstationCard } from "./WorkstationCard";

let firstSet: CookbookSnapshot;

beforeAll(async () => {
  firstSet = await new FixtureCookbookRepository().loadSnapshot();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function serviceRecipe(overrides: Parameters<typeof makeRecipe>[0] = {}) {
  return makeRecipe({
    recipeId: 165,
    recipeVersionId: "service-v1",
    name: "ข้าวหน้าเนื้อตุ๋น",
    kind: "sellable_menu",
    lines: [
      makeIngredientLine({
        lineKey: "rice",
        itemName: "ข้าวหอมมะลิหุงสุก",
        sourceText: "180 กรัม",
      }),
    ],
    methodText: "จัดเสิร์ฟตามขั้นตอน",
    workDocuments: {
      service: {
        stage: "service",
        scalable: false,
        ingredientLineKeys: ["rice"],
        steps: [makeWorkStep({
          stepId: "service-v1:service:1",
          stage: "service",
          instruction: "จัดข้าวลงจานตามต้นฉบับ",
        })],
      },
    },
    ...overrides,
  });
}

function renderWithRawSnapshot(snapshot: CookbookSnapshot) {
  const context: PrototypeContextValue = {
    snapshot,
    dirty: false,
    persistence: "session",
    dispatch: () => ({ ok: true }),
    createSessionObjectUrl: () => "blob:unused",
    releaseSessionObjectUrl: () => undefined,
    isSessionObjectUrl: () => false,
  };
  return render(
    <PrototypeContext.Provider value={context}>
      <MemoryRouter><PrintCenterPage initialRecipeIds={[165]} /></MemoryRouter>
    </PrototypeContext.Provider>,
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

function renderWithKitchenSotDocument(
  document: KitchenSotDocument,
  initialRecipeIds: number[],
) {
  const client: KitchenSotDraftClient = {
    load: vi.fn(async () => loadedKitchenSotDraft(document)),
    save: vi.fn(async (submitted) => ({
      document: submitted,
      sha256: "c".repeat(64),
      base_sha256: "c".repeat(64),
      generatedAt: submitted.generated_at,
      path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
    })),
  };
  const context: PrototypeContextValue = {
    snapshot: firstSet,
    dirty: false,
    persistence: "session",
    dispatch: () => ({ ok: true }),
    createSessionObjectUrl: () => "blob:unused",
    releaseSessionObjectUrl: () => undefined,
    isSessionObjectUrl: () => false,
  };
  return render(
    <PrototypeContext.Provider value={context}>
      <KitchenSotDraftProvider client={client}>
        <MemoryRouter><PrintCenterPage initialRecipeIds={initialRecipeIds} /></MemoryRouter>
      </KitchenSotDraftProvider>
    </PrototypeContext.Provider>,
  );
}

function v6PrintDocument(): CookbookV6Document {
  return {
    schemaVersion: "6.0.0",
    generatedAt: "2026-08-10T00:00:00.000Z",
    derivedFrom: { v5Path: "internal", v5Sha256: "a".repeat(64), catalogSha256: "b".repeat(64) },
    recipes: [{
      recipeId: "RCP-001", code: "RCP-001", name: "เมนูทดสอบ", kind: "sellable_menu",
      category: "เมนู", active: true, reviewState: "confirmed_by_owner", sourceLocators: [],
      yieldText: "", operationalNotes: [], methodDecisionNote: "",
      ingredients: [{
        lineId: "rice", name: "ข้าวสุก", kind: "ingredient", amountText: "199", unitText: "กรัม",
        sourceDisplayText: "199 กรัม", ingredientId: null, componentRecipeId: null, servingNote: "ตัก 199 กรัม",
        costBasisText: "ห้ามแสดงต้นทุนลับ", decisionStatus: "confirmed", selectedSource: null, active: true,
      }],
      methodSteps: [{ stepId: "service-step", stage: "service", instruction: "จัดจาน", order: 1 }],
      blockers: [], workDocuments: { service: { stage: "service", scalable: false, ingredientLineIds: ["rice"], stepIds: ["service-step"] } },
      parentRecipeIds: [], lineage: { source: "catalog", sourceRecipeId: null },
    }],
  };
}

function renderWithCookbookDocument(document: CookbookV6Document) {
  const client: CookbookDocumentClient = {
    load: vi.fn(async () => ({ document, baseSha256: "c".repeat(64), origin: "v6-draft" as const, path: "internal" })),
    save: vi.fn(),
  };
  return render(
    <PrototypeContext.Provider value={{
      snapshot: firstSet, dirty: false, persistence: "session", dispatch: () => ({ ok: true }),
      createSessionObjectUrl: () => "blob:unused", releaseSessionObjectUrl: () => undefined,
      isSessionObjectUrl: () => false,
    }}>
      <CookbookDocumentProvider client={client} mediaSnapshot={firstSet}>
        <MemoryRouter><PrintCenterPage initialRecipeIds={["RCP-001"]} /></MemoryRouter>
      </CookbookDocumentProvider>
    </PrototypeContext.Provider>,
  );
}

describe("PrintCenterPage", () => {
  test("presents the three output intents and controlled print collections", () => {
    renderWithPrototype(<PrintCenterPage />, {
      snapshot: makeSnapshot({
        recipes: [
          { ...serviceRecipe({ recipeId: "RCP-156", name: "ซอสยากินิกุ", kind: "prepared_recipe" }), category: "ซอสและน้ำจิ้ม" },
          { ...serviceRecipe({ recipeId: "RCP-069", name: "ข้าวหน้าเนื้อยากินิกุ", kind: "sellable_menu" }), category: "เมนูอาหาร" },
        ],
      }),
    });

    expect(screen.getByRole("button", { name: /A4 สูตรเต็ม/u })).toBeVisible();
    expect(screen.getByRole("button", { name: /A5 ใบงาน/u })).toBeVisible();
    expect(screen.getByRole("button", { name: /พิมพ์เป็นเล่ม/u })).toBeVisible();
    expect(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด ซอสและน้ำจิ้ม 1 สูตร" })).toBeVisible();
    expect(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด เมนูอาหาร 1 สูตร" })).toBeVisible();
  });

  test("selects every sauce recipe with one collection action", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<PrintCenterPage />, {
      snapshot: makeSnapshot({
        recipes: [
          { ...serviceRecipe({ recipeId: "RCP-SA", recipeVersionId: "sauce-a-v1", name: "ซอส ก", kind: "prepared_recipe" }), category: "ซอสและน้ำจิ้ม" },
          { ...serviceRecipe({ recipeId: "RCP-SB", recipeVersionId: "sauce-b-v1", name: "ซอส ข", kind: "prepared_recipe" }), category: "ซอสและน้ำจิ้ม" },
          { ...serviceRecipe({ recipeId: "RCP-M", recipeVersionId: "menu-a-v1", name: "เมนู ก", kind: "sellable_menu" }), category: "เมนูอาหาร" },
        ],
      }),
    });

    await user.click(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด ซอสและน้ำจิ้ม 2 สูตร" }));

    expect(screen.getByRole("checkbox", { name: "ซอส ก · RCP-SA" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "ซอส ข · RCP-SB" })).toBeChecked();
    expect(screen.getByText("เลือกแล้ว 2 สูตร")).toBeVisible();
  });

  test("searches by public code and keeps a visible selected-set summary", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<PrintCenterPage />, {
      snapshot: makeSnapshot({
        recipes: [
          serviceRecipe({ recipeId: "RCP-021", name: "ข้าวขยำเนื้อแดดเดียว" }),
          serviceRecipe({ recipeId: "RCP-069", name: "ข้าวหน้าเนื้อยากินิกุ" }),
        ],
      }),
    });

    await user.type(screen.getByRole("searchbox", { name: "ค้นหาสูตร" }), "RCP-021");
    expect(screen.getByRole("checkbox", { name: "ข้าวขยำเนื้อแดดเดียว · RCP-021" })).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "ข้าวหน้าเนื้อยากินิกุ · RCP-069" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "ข้าวขยำเนื้อแดดเดียว · RCP-021" }));
    expect(screen.getByText("เลือกแล้ว 1 สูตร")).toBeVisible();
    expect(screen.getByText("ข้าวขยำเนื้อแดดเดียว", { selector: ".print-selected-chip" })).toBeVisible();
  });

  test("booklet defaults to reference-only and includes dependency pages only when selected", async () => {
    const user = userEvent.setup();
    const sauce = serviceRecipe({
      recipeId: "RCP-156",
      recipeVersionId: "sauce-v1",
      name: "ซอสยากินิกุ",
      kind: "prepared_recipe",
    });
    const menu = serviceRecipe({
      recipeId: "RCP-069",
      recipeVersionId: "menu-v1",
      name: "ข้าวหน้าเนื้อยากินิกุ",
      lines: [makeIngredientLine({
        lineKey: "sauce",
        itemName: "ซอสยากินิกุ",
        itemKind: "prepared_recipe",
        componentRecipeId: "RCP-156",
        sourceText: "30 กรัม",
      })],
    });
    renderWithPrototype(<PrintCenterPage initialRecipeIds={["RCP-069"]} />, {
      snapshot: makeSnapshot({ recipes: [menu, sauce] }),
    });

    await user.click(screen.getByRole("button", { name: /พิมพ์เป็นเล่ม/u }));
    expect(document.querySelectorAll(".cookbook-page--recipe")).toHaveLength(1);
    expect(document.querySelector(".workstation-sheet, .two-up-sheet")).toBeNull();

    await user.selectOptions(screen.getByLabelText("สูตรประกอบ"), "include");
    expect(document.querySelectorAll(".cookbook-page--recipe")).toHaveLength(2);
    expect(screen.getByRole("article", { name: "ซอสยากินิกุ" })).toBeVisible();
  });

  test("selects the exact recipe from a detail-page print deeplink", () => {
    const selected = serviceRecipe({
      recipeId: "RCP-021",
      recipeVersionId: "cookbook-v6:RCP-021",
      name: "ข้าวขยำเนื้อแดดเดียว",
    });
    const other = serviceRecipe({
      recipeId: "RCP-022",
      recipeVersionId: "cookbook-v6:RCP-022",
      name: "ข้าวหน้าเนื้ออีกสูตร",
    });

    renderWithPrototype(<PrintCenterPage />, {
      snapshot: makeSnapshot({ recipes: [other, selected] }),
      route: "/print?recipe=RCP-021",
    });

    expect(screen.getByRole("checkbox", { name: "ข้าวขยำเนื้อแดดเดียว · RCP-021" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "ข้าวหน้าเนื้ออีกสูตร · RCP-022" })).not.toBeChecked();
    expect(screen.getAllByRole("article", { name: /ข้าวขยำเนื้อแดดเดียว/u }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("article", { name: /ข้าวหน้าเนื้ออีกสูตร/u })).not.toBeInTheDocument();
  });

  test("decodes a non-public stable identity from the print query without selecting a collision", () => {
    const stringRecipe = serviceRecipe({ recipeId: "1", recipeVersionId: "string-v1", name: "สูตรรหัสข้อความ" });
    const numericRecipe = serviceRecipe({ recipeId: 1, recipeVersionId: "number-v1", name: "สูตรรหัสตัวเลข" });

    renderWithPrototype(<PrintCenterPage />, {
      snapshot: makeSnapshot({ recipes: [numericRecipe, stringRecipe] }),
      route: "/print?recipe=s~0031",
    });

    expect(screen.getByRole("checkbox", { name: "สูตรรหัสข้อความ" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "สูตรรหัสตัวเลข" })).not.toBeChecked();
  });

  test("ignores an invalid print recipe query", () => {
    renderWithPrototype(<PrintCenterPage />, {
      snapshot: makeSnapshot({ recipes: [serviceRecipe()] }),
      route: "/print?recipe=s~broken",
    });

    expect(screen.getByRole("checkbox", { name: "ข้าวหน้าเนื้อตุ๋น" })).not.toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("เลือกอย่างน้อยหนึ่งสูตร");
  });

  test("prefers the current cookbook projection and excludes cost basis", async () => {
    const view = renderWithCookbookDocument(v6PrintDocument());

    expect(await screen.findByText("199 กรัม")).toBeVisible();
    expect(view.container).not.toHaveTextContent("ห้ามแสดงต้นทุนลับ");
  });

  test("keeps technical implementation language out of normal print copy", async () => {
    const view = renderWithCookbookDocument(v6PrintDocument());
    await screen.findByRole("heading", { name: "ศูนย์การพิมพ์" });

    expect(view.container.textContent).not.toMatch(/\b(?:AI|Prototype|Mock|V4|V5|V6|schema|source|review|blocker|provenance|candidate|Supabase|gateway|snapshot|local[- ]session|session)\b/iu);
    expect(view.container).toHaveTextContent("สถานะสูตร: พร้อมใช้");
  });

  test("uses the loaded V5 raw document instead of the stale read projection", async () => {
    const document = parseKitchenSotDocument(fixture);
    const rice = document.recipes.find(({ recipe_id }) => recipe_id === 165)!.items
      .find(({ item_name }) => item_name === "ข้าวหอมมะลิหุงสุก")!;
    rice.candidate_text = "199 กรัม ฉบับล่าสุด";

    renderWithKitchenSotDocument(document, [165]);

    expect(await screen.findByText("199 กรัม ฉบับล่าสุด")).toBeVisible();
    expect(screen.queryByText("180 กรัม")).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(18);
  });

  test("prints the owner-confirmed egg recipe as one non-empty DRAFT card", async () => {
    const document = withOwnerConfirmedEggRecipe(parseKitchenSotDocument(fixture));
    renderWithKitchenSotDocument(document, [18]);

    expect(await screen.findByRole("article", { name: /ไข่ข้น/u })).toBeVisible();
    expect(screen.getAllByRole("checkbox")).toHaveLength(19);
    const cards = await screen.findAllByRole("article", {
      name: /ไข่ข้น · ครัวปรุง/u,
    });
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(within(card).getByText("สถานะสูตร: ข้อมูลยังไม่ครบ")).toBeVisible();
    expect(within(card).getByText("2 ฟอง")).toBeVisible();
    expect(within(card).getByText("ครึ่งช้อนชา (2.5g)")).toBeVisible();
    expect(card.querySelectorAll(".workstation-steps > li")).toHaveLength(0);
    expect(within(card).queryByRole("row", { name: /น้ำปลาทิพรส/u }))
      .not.toBeInTheDocument();
    expect(within(card).queryByRole("row", { name: /ผงชูรส/u }))
      .not.toBeInTheDocument();
  });

  test("does not print a removed dependency but still prints the same recipe where it remains active", async () => {
    const removed = renderWithKitchenSotDocument(
      parseKitchenSotDocument(fixture),
      [156],
    );

    await screen.findByRole("heading", { name: "ศูนย์การพิมพ์" });
    expect(screen.queryByRole("article", { name: /ซอสอเนกประสงค์/u }))
      .not.toBeInTheDocument();
    removed.unmount();

    renderWithKitchenSotDocument(parseKitchenSotDocument(fixture), [157]);

    expect(await screen.findByRole("article", { name: /ซอสอเนกประสงค์/u }))
      .toBeVisible();
  });

  test("keeps provenance-incomplete recipe 159 DRAFT through the shared raw predicate", async () => {
    renderWithKitchenSotDocument(parseKitchenSotDocument(fixture), [159]);

    const cards = await screen.findAllByRole("article", { name: /ข้าวหน้าเนื้อยากินิกุ/u });
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(within(card).getByText("สถานะสูตร: ข้อมูลยังไม่ครบ")).toBeVisible();
      expect(within(card).queryByText("สถานะสูตร: พร้อมใช้"))
        .not.toBeInTheDocument();
    }
  });

  test("prints each unresolved raw blocker message without rewriting it", async () => {
    const document = parseKitchenSotDocument(fixture);
    const message = document.recipes.find(({ recipe_id }) => recipe_id === 164)!.blockers[0]!.message;

    renderWithKitchenSotDocument(document, [164]);

    expect((await screen.findAllByText(message)).length).toBeGreaterThan(0);
    expect(globalThis.document.querySelectorAll(".workstation-sheet")).toHaveLength(7);
  });

  test("prints recipe 2 operational facts and method scope verbatim", async () => {
    renderWithKitchenSotDocument(parseKitchenSotDocument(fixture), [2]);

    const cards = await screen.findAllByRole("article", {
      name: /น้ำซุปก๋วยเตี๋ยว V3 · ผลิตซอสและของเตรียม/u,
    });
    expect(cards).toHaveLength(2);
    expect(screen.getByText("ใช้น้ำเปล่าประมาณ 50 ลิตร ต่อหม้อเบอร์ 70"))
      .toBeVisible();
    expect(screen.getByText("ขอบเขตสูตรนี้เป็นน้ำซุปเท่านั้น ไม่รวมขั้นตอนลงเนื้อ"))
      .toBeVisible();
    expect(screen.getByText(
      "DOCX V3 ระบุรายการส่วนผสมแต่ไม่มีลำดับวิธีปรุงน้ำซุป; ตัดวิธีเก่าที่มีขั้นตอนลงเนื้อออกตามขอบเขตที่เจ้าของยืนยัน",
    )).toBeVisible();
    for (const card of cards) {
      expect(card.querySelector(".workstation-card__body"))
        .toHaveClass("workstation-card__body--without-steps");
    }
  });

  test("prints Service serving notes without exposing kitchen cost basis", async () => {
    renderWithKitchenSotDocument(parseKitchenSotDocument(fixture), [159]);

    const cards = await screen.findAllByRole("article", {
      name: /ข้าวหน้าเนื้อยากินิกุ · จัดเสิร์ฟหน้าร้าน/u,
    });
    expect(cards.length).toBeGreaterThan(0);
    expect(within(cards[0]!).getByText("ตักข้าวหุงสุก 180 กรัม")).toBeVisible();
    for (const card of cards) {
      expect(within(card).queryByText("ข้าวสารญี่ปุ่นดิบ 72 กรัม")).not.toBeInTheDocument();
      expect(card).not.toHaveTextContent("ฐานต้นทุนต่อที่");
    }
  });

  test.each([2, 160, 9, 161, 162])(
    "renders missing-method recipe %s as printable DRAFT sheets",
    async (recipeId) => {
      const document = parseKitchenSotDocument(fixture);
      const recipe = document.recipes.find(({ recipe_id }) => recipe_id === recipeId)!;

      renderWithKitchenSotDocument(document, [recipeId]);

      const cards = await screen.findAllByRole("article", {
        name: new RegExp(`${recipe.recipe_name} · ผลิตซอสและของเตรียม`, "u"),
      });
      expect(cards).toHaveLength(recipeId === 2 ? 2 : 1);
      expect(within(cards[0]!).getByText("สถานะสูตร: ข้อมูลยังไม่ครบ")).toBeVisible();
    },
  );

  test("defaults to an automatic A5 workstation recommendation", () => {
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, { snapshot: firstSet });

    expect(screen.getByText("จัดชุดใบงาน A5 หรือ A4 สำหรับพิมพ์หน้าครัว")).toBeVisible();
    expect(document.querySelectorAll(".workstation-sheet")).toHaveLength(10);
    const sheet = document.querySelector(".workstation-sheet");
    expect(sheet).toHaveAttribute("data-page-name", "workstation");
    expect(sheet).toHaveAttribute("data-sheet-size", "210mm × 148mm");
  });

  test("uses name-first multi-selection and disables printing with no selection", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<PrintCenterPage />, {
      snapshot: makeSnapshot({
        recipes: [
          serviceRecipe({ recipeId: 2, recipeVersionId: "z-v1", name: "สูตร ข" }),
          serviceRecipe({ recipeId: 1, recipeVersionId: "a-v1", name: "สูตร ก" }),
        ],
      }),
    });

    const choices = screen.getAllByRole("checkbox");
    expect(choices.map((choice) => choice.parentElement?.textContent)).toEqual([
      "สูตร ก",
      "สูตร ข",
    ]);
    expect(screen.getByRole("button", { name: "พิมพ์ชุดที่เลือก" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "สูตร ก" }));
    expect(screen.getByRole("button", { name: "พิมพ์ชุดที่เลือก" })).toBeEnabled();
  });

  test("filters the pack to service documents", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, { snapshot: firstSet });

    await user.selectOptions(screen.getByLabelText("จุดงาน"), "service");

    expect(screen.getAllByText("จัดเสิร์ฟหน้าร้าน").length).toBeGreaterThan(0);
    expect(screen.queryByText("ผลิตซอสและของเตรียม")).not.toBeInTheDocument();
  });

  test("forces service multiplier to one while all-stage service facts stay per serving", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, {
      snapshot: makeSnapshot({ recipes: [serviceRecipe()] }),
    });

    await user.clear(screen.getByLabelText("ตัวคูณการผลิต"));
    await user.type(screen.getByLabelText("ตัวคูณการผลิต"), "5");
    expect(screen.getByText("ตัวคูณ 1 · ต่อหนึ่งเสิร์ฟ")).toBeVisible();
    expect(screen.getByText("180 กรัม")).toBeVisible();
    expect(screen.queryByText("72 กรัม")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("จุดงาน"), "service");
    expect(screen.getByLabelText("ตัวคูณการผลิต")).toHaveValue(1);
    expect(screen.getByLabelText("ตัวคูณการผลิต")).toBeDisabled();
  });

  test("reports an accessible multiplier error and does not render a mixed preview", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, {
      snapshot: makeSnapshot({ recipes: [serviceRecipe()] }),
    });

    await user.clear(screen.getByLabelText("ตัวคูณการผลิต"));
    await user.type(screen.getByLabelText("ตัวคูณการผลิต"), "1.5");

    expect(screen.getByRole("alert")).toHaveTextContent("ตัวคูณต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป");
    expect(document.querySelector(".workstation-sheet, .two-up-sheet")).toBeNull();
    expect(screen.getByRole("button", { name: "พิมพ์ชุดที่เลือก" })).toBeDisabled();
  });

  test("renders ordered images and complete operational annotations beside one step", () => {
    const recipe = serviceRecipe();
    const stepId = recipe.workDocuments.service!.steps[0].stepId;
    const snapshot = makeSnapshot({
      recipes: [recipe],
      media: [
        makeMediaAsset({ mediaId: "media-c", altText: "ภาพสาม", caption: "ภาพปิดงาน" }),
        makeMediaAsset({
          mediaId: "media-a",
          altText: "ภาพหนึ่ง",
          caption: "DEMO — ภาพเริ่มงาน",
          reviewState: "sample",
          measurementAnnotation: "180 กรัม",
        }),
        makeMediaAsset({ mediaId: "media-b", altText: "ภาพสอง", caption: "ภาพตรวจงาน" }),
      ],
      stepMedia: [
        makeStepMediaLink({ stepId, mediaId: "media-c", order: 3, role: "final", vessel: "delivery_box" }),
        makeStepMediaLink({ stepId, mediaId: "media-a", order: 1, role: "before", vessel: "plate" }),
        makeStepMediaLink({ stepId, mediaId: "media-b", order: 2, role: "checkpoint", vessel: "cup_1oz" }),
      ],
    });

    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, { snapshot });

    const step = screen.getByText("จัดข้าวลงจานตามต้นฉบับ").closest("li");
    expect(step).not.toBeNull();
    expect(within(step!).getAllByRole("img").map((image) => image.getAttribute("alt"))).toEqual([
      "ภาพหนึ่ง",
      "ภาพสอง",
      "ภาพสาม",
    ]);
    expect(within(step!).getByText("ภาพตัวอย่าง · ยังไม่ยืนยัน")).toBeVisible();
    expect(within(step!).getByText("ก่อนทำ")).toBeVisible();
    expect(within(step!).getByText("DEMO — ภาพเริ่มงาน")).toBeVisible();
    expect(within(step!).getByText("180 กรัม")).toBeVisible();
    expect(within(step!).getByText("จาน")).toBeVisible();
  });

  test("prefixes canonical sample media with the configured Vite base path", () => {
    vi.stubEnv("BASE_URL", "/nntn-cookbook/");
    const recipe = serviceRecipe();
    const stepId = recipe.workDocuments.service!.steps[0].stepId;
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, {
      snapshot: makeSnapshot({
        recipes: [recipe],
        media: [makeMediaAsset({
          mediaId: "base-aware",
          url: "/sample-media/service-delivery-layout.svg",
          altText: "ภาพผ่าน base path",
        })],
        stepMedia: [makeStepMediaLink({ stepId, mediaId: "base-aware" })],
      }),
    });

    expect(screen.getByAltText("ภาพผ่าน base path")).toHaveAttribute(
      "src",
      "/nntn-cookbook/sample-media/service-delivery-layout.svg",
    );
  });

  test.each([
    "//external.example/",
    "///external.example/",
    "https://external.example/",
    "/bad\\path/",
    "/bad%2fpath/",
    "/bad?query/",
    "/bad#fragment/",
    "/bad\u0000control/",
    "/../traversal/",
  ])("fails closed instead of rendering media for invalid base %s", (base) => {
    vi.stubEnv("BASE_URL", base);
    const recipe = serviceRecipe();
    const stepId = recipe.workDocuments.service!.steps[0].stepId;
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, {
      snapshot: makeSnapshot({
        recipes: [recipe],
        media: [makeMediaAsset({
          mediaId: "invalid-base",
          url: "/sample-media/service-delivery-layout.svg",
          altText: "ห้ามสร้างคำขอภายนอก",
        })],
        stepMedia: [makeStepMediaLink({ stepId, mediaId: "invalid-base" })],
      }),
    });

    expect(screen.queryByAltText("ห้ามสร้างคำขอภายนอก")).not.toBeInTheDocument();
  });

  test("renders text-only work without blank media frames or placeholders", () => {
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, {
      snapshot: makeSnapshot({ recipes: [serviceRecipe()] }),
    });

    const step = screen.getByText("จัดข้าวลงจานตามต้นฉบับ").closest("li");
    expect(step).not.toBeNull();
    expect(within(step!).queryByRole("img")).not.toBeInTheDocument();
    expect(within(step!).queryByText(/เพิ่มรูป|placeholder|กรอบรูป/i)).not.toBeInTheDocument();
    expect(step).toHaveClass("workstation-step--text-only");
  });

  test("surfaces an oversized planner error in Thai without partial pages", () => {
    const recipe = serviceRecipe({
      workDocuments: {
        service: {
          stage: "service",
          scalable: false,
          ingredientLineKeys: ["rice"],
          steps: [makeWorkStep({
            stepId: "oversized:service:1",
            stage: "service",
            instruction: "ยาว".repeat(500),
          })],
        },
      },
    });

    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, {
      snapshot: makeSnapshot({ recipes: [recipe] }),
    });

    expect(screen.getByRole("heading", { name: "สร้างตัวอย่างพิมพ์ไม่ได้" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("ขั้นตอนยาวเกินพื้นที่ A5");
    expect(document.querySelector(".workstation-sheet, .two-up-sheet")).toBeNull();
    expect(screen.getByRole("heading", { name: "ศูนย์การพิมพ์" })).toBeVisible();
  });

  test("surfaces an over-capacity ingredient document without clipped or partial sheets", () => {
    const ingredients = Array.from({ length: 60 }, (_, index) => makeIngredientLine({
      lineKey: `ingredient-${index + 1}`,
      itemName: `วัตถุดิบ ${index + 1}`,
      sourceText: `${index + 1} กรัม`,
    }));
    const recipe = serviceRecipe({
      lines: ingredients,
      workDocuments: {
        service: {
          stage: "service",
          scalable: false,
          ingredientLineKeys: ingredients.map((line) => line.lineKey),
          steps: [makeWorkStep({
            stepId: "many-ingredients:service:1",
            stage: "service",
          })],
        },
      },
    });

    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, {
      snapshot: makeSnapshot({ recipes: [recipe] }),
    });

    expect(screen.getByRole("alert")).toHaveTextContent("เนื้อหาส่วนวัตถุดิบเกินพื้นที่ A5");
    expect(document.querySelector(".workstation-sheet, .two-up-sheet")).toBeNull();
  });

  test("fails closed in Thai when the snapshot recipe container is malformed", () => {
    renderWithRawSnapshot(makeSnapshot({ recipes: null as never }));

    expect(screen.getByRole("heading", { name: "ศูนย์การพิมพ์" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("ข้อมูลสูตรสำหรับศูนย์การพิมพ์ไม่ถูกต้อง");
    expect(document.querySelector(".workstation-sheet, .two-up-sheet")).toBeNull();
  });

  test("contains a hostile declared getter error without leaking it from render", () => {
    const hostile = new Proxy({}, {
      getPrototypeOf() {
        throw new Error("prototype trap");
      },
    });
    const snapshot = makeSnapshot() as CookbookSnapshot;
    Object.defineProperty(snapshot, "recipes", {
      enumerable: true,
      get() {
        throw hostile;
      },
    });

    renderWithRawSnapshot(snapshot);

    expect(screen.getByRole("heading", { name: "ศูนย์การพิมพ์" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("ข้อมูลสูตรสำหรับศูนย์การพิมพ์ไม่ถูกต้อง");
  });

  test("captures render-used snapshot fields once before sorting and planning", () => {
    const recipe = serviceRecipe();
    let recipesReads = 0;
    let nameReads = 0;
    Object.defineProperty(recipe, "name", {
      enumerable: true,
      get() {
        nameReads += 1;
        return nameReads === 1 ? "ชื่อที่จับครั้งเดียว" : null;
      },
    });
    const snapshot = makeSnapshot() as CookbookSnapshot;
    Object.defineProperty(snapshot, "recipes", {
      enumerable: true,
      get() {
        recipesReads += 1;
        return recipesReads === 1 ? [recipe] : null;
      },
    });

    renderWithRawSnapshot(snapshot);

    expect(screen.getByRole("heading", { name: "ชื่อที่จับครั้งเดียว" })).toBeVisible();
    expect(recipesReads).toBe(1);
    expect(nameReads).toBe(1);
  });

  test("rejects duplicate recipe identity before ambiguous choices or React keys", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithRawSnapshot(makeSnapshot({
      recipes: [
        serviceRecipe({ recipeVersionId: "duplicate-a" }),
        serviceRecipe({ recipeVersionId: "duplicate-b", name: "ชื่ออีกชุด" }),
      ],
    }));

    expect(screen.getByRole("alert")).toHaveTextContent("พบรหัสสูตรซ้ำในชุดข้อมูลศูนย์การพิมพ์");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(document.querySelector(".workstation-sheet, .two-up-sheet")).toBeNull();
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("same key");
    consoleError.mockRestore();
  });

  test("renders odd two-up tails as one remaining slot with A4 physical data", async () => {
    const user = userEvent.setup();
    const recipes = [1, 2, 3].map((recipeId) => serviceRecipe({
      recipeId,
      recipeVersionId: `recipe-${recipeId}-v1`,
      name: `สูตร ${recipeId}`,
      workDocuments: {
        service: {
          stage: "service",
          scalable: false,
          ingredientLineKeys: ["rice"],
          steps: [makeWorkStep({
            stepId: `recipe-${recipeId}:service:1`,
            stage: "service",
          })],
        },
      },
    }));
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[1, 2, 3]} />, {
      snapshot: makeSnapshot({ recipes }),
    });

    await user.selectOptions(screen.getByLabelText("แม่แบบ"), "two-up");

    const sheets = Array.from(document.querySelectorAll(".two-up-sheet"));
    expect(sheets).toHaveLength(2);
    expect(sheets[0]).toHaveAttribute("data-page-name", "two-up");
    expect(sheets[0]).toHaveAttribute("data-sheet-size", "210mm × 297mm");
    expect(sheets.map((sheet) => sheet.querySelectorAll(".workstation-card").length)).toEqual([2, 1]);
  });

  test("does not render unsafe or dangling media URLs", () => {
    const recipe = serviceRecipe();
    const stepId = recipe.workDocuments.service!.steps[0].stepId;
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, {
      snapshot: makeSnapshot({
        recipes: [recipe],
        media: [makeMediaAsset({ mediaId: "unsafe", url: "https://example.com/photo.jpg", altText: "ห้ามแสดง" })],
        stepMedia: [
          makeStepMediaLink({ stepId, mediaId: "unsafe", order: 1 }),
          makeStepMediaLink({ stepId, mediaId: "missing", order: 2 }),
        ],
      }),
    });

    expect(screen.getByText("จัดข้าวลงจานตามต้นฉบับ")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("uses stable keys for duplicate names, continuations, and two-up slots", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const recipes = [1, 2].map((recipeId) => serviceRecipe({
      recipeId,
      recipeVersionId: `same-${recipeId}`,
      name: "ชื่อซ้ำ",
      workDocuments: {
        service: {
          stage: "service",
          scalable: false,
          ingredientLineKeys: ["rice"],
          steps: Array.from({ length: recipeId === 1 ? 8 : 1 }, (_, index) => makeWorkStep({
            stepId: `same-${recipeId}:service:${index + 1}`,
            stage: "service",
            order: index + 1,
          })),
        },
      },
    }));
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[1, 2]} />, {
      snapshot: makeSnapshot({ recipes }),
    });

    await user.selectOptions(screen.getByLabelText("แม่แบบ"), "two-up");

    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("same key");
    consoleError.mockRestore();
  });

  test("offers draft/approved preview labels without claiming a candidate is approved", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, {
      snapshot: makeSnapshot({ recipes: [serviceRecipe({ reviewState: "candidate" })] }),
    });

    expect(screen.getByText("ตรวจทานก่อนพิมพ์")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("ชุดที่ต้องการพิมพ์"), "approved");
    expect(screen.getByText("พร้อมพิมพ์")).toBeVisible();
    expect(screen.queryByText("อนุมัติแล้ว")).not.toBeInTheDocument();
  });

  test("does not mutate the snapshot or the planner page passed to the card", () => {
    const snapshot = makeSnapshot({ recipes: [serviceRecipe()] });
    const original = structuredClone(snapshot);
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, { snapshot });
    expect(snapshot).toEqual(original);

    const media = buildMediaIndex(snapshot);
    const [page] = buildPrintPlan(
      projectWorkDocuments(snapshot.recipes, { stage: "all", multiplier: 1 }),
      media,
      { template: "station", stage: "all", multiplier: 1 },
    );
    if (page.kind !== "station") throw new Error("expected station page");
    const pageBefore = structuredClone(page);
    renderWithPrototype(
      <WorkstationCard page={page} media={media} previewMode="draft" readiness="ready" />,
      { snapshot },
    );
    expect(screen.getAllByText("จัดข้าวลงจานตามต้นฉบับ").length).toBeGreaterThan(0);
    expect(page).toEqual(pageBefore);
  });
});
