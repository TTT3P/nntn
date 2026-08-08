import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { FixtureCookbookRepository } from "../../data/FixtureCookbookRepository";
import type {
  KitchenSotDraftClient,
  LoadedKitchenSotDraft,
} from "../../data/KitchenSotDraftClient";
import type { CookbookSnapshot } from "../../domain/cookbook/types";
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
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { PrototypeContext, type PrototypeContextValue } from "../../prototype/PrototypeProvider";
import fixture from "../../data/fixtures/first-set.json";
import { KitchenSotDraftProvider } from "../review/KitchenSotDraftProvider";
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

describe("PrintCenterPage", () => {
  test("uses the loaded V5 raw document instead of the stale read projection", async () => {
    const document = parseKitchenSotDocument(fixture);
    const rice = document.recipes.find(({ recipe_id }) => recipe_id === 165)!.items
      .find(({ item_name }) => item_name === "ข้าวหอมมะลิหุงสุก")!;
    rice.candidate_text = "199 กรัม จาก V5";

    renderWithKitchenSotDocument(document, [165]);

    expect(await screen.findByText("ข้อมูลสูตร: V5 draft ในเครื่อง")).toBeVisible();
    expect(screen.getByText("199 กรัม จาก V5")).toBeVisible();
    expect(screen.queryByText("180 กรัม")).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(18);
  });

  test("keeps provenance-incomplete recipe 159 DRAFT through the shared raw predicate", async () => {
    renderWithKitchenSotDocument(parseKitchenSotDocument(fixture), [159]);

    const cards = await screen.findAllByRole("article", { name: /ข้าวหน้าเนื้อยากินิกุ/u });
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(within(card).getByText("สถานะสูตร: ฉบับร่าง")).toBeVisible();
      expect(within(card).queryByText("สถานะสูตร: พร้อมตามเกณฑ์พิมพ์"))
        .not.toBeInTheDocument();
    }
  });

  test("prints each unresolved raw blocker message without rewriting it", async () => {
    const document = parseKitchenSotDocument(fixture);
    const message = document.recipes.find(({ recipe_id }) => recipe_id === 164)!.blockers[0]!.message;

    renderWithKitchenSotDocument(document, [164]);

    expect((await screen.findAllByText(message)).length).toBeGreaterThan(0);
    expect(globalThis.document.querySelectorAll(".workstation-sheet")).toHaveLength(6);
  });

  test.each([2, 160, 9, 161, 162])(
    "renders missing-method recipe %s as one printable DRAFT sheet",
    async (recipeId) => {
      const document = parseKitchenSotDocument(fixture);
      const recipe = document.recipes.find(({ recipe_id }) => recipe_id === recipeId)!;

      renderWithKitchenSotDocument(document, [recipeId]);

      const cards = await screen.findAllByRole("article", {
        name: new RegExp(`${recipe.recipe_name} · ผลิตซอสและของเตรียม`, "u"),
      });
      expect(cards).toHaveLength(1);
      expect(within(cards[0]!).getByText("สถานะสูตร: ฉบับร่าง")).toBeVisible();
    },
  );

  test("defaults to an automatic A5 workstation recommendation", () => {
    renderWithPrototype(<PrintCenterPage initialRecipeIds={[165]} />, { snapshot: firstSet });

    expect(screen.getByText("ตัวอย่าง A5 แนวนอนสำหรับจุดงาน · แนะนำอัตโนมัติ")).toBeVisible();
    expect(document.querySelectorAll(".workstation-sheet")).toHaveLength(9);
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
      "สูตร ก · รหัส 1",
      "สูตร ข · รหัส 2",
    ]);
    expect(screen.getByRole("button", { name: "พิมพ์ชุดเอกสาร" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "สูตร ก · รหัส 1" }));
    expect(screen.getByRole("button", { name: "พิมพ์ชุดเอกสาร" })).toBeEnabled();
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
    expect(screen.getByRole("button", { name: "พิมพ์ชุดเอกสาร" })).toBeDisabled();
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
    expect(within(step!).getByText("DEMO · ภาพตัวอย่าง ยังไม่ยืนยัน")).toBeVisible();
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

    expect(screen.getByText("ชื่อที่จับครั้งเดียว")).toBeVisible();
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

    expect(screen.getByText("ตัวอย่างฉบับร่าง")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("สถานะตัวอย่าง"), "approved");
    expect(screen.getByText("ตัวอย่างพร้อมพิมพ์แบบอนุมัติ")).toBeVisible();
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
