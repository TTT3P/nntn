import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  CookbookSnapshot,
  FocalPoint,
  IngredientLine,
  MediaAsset,
  MediaCrop,
  RecipeIdentity,
  RecipeVersion,
  StepMediaLink,
  WorkDocument,
  WorkStage,
  WorkStep,
} from "../../domain/cookbook/types";
import {
  buildMediaIndex,
  buildPrintPlan,
  UnpageableDocumentError,
  UnpageableStepError,
  type MediaIndex,
  type PrintPage,
  type PrintTemplate,
  type WorkstationPage,
} from "../../domain/print/printPlanner";
import { evaluateReadiness } from "../../domain/review/readiness";
import { projectKitchenSotPrintSnapshot } from "../../domain/sot/kitchenSotPrintProjection";
import { projectWorkDocuments } from "../../domain/work/workDocuments";
import { usePrototype } from "../../prototype/PrototypeProvider";
import { deriveRecipeMediaCoverage } from "../recipe/recipeMediaCoverage";
import { decodeRecipeIdentity } from "../recipe/recipeRoute";
import { useOptionalKitchenSotDraft } from "../review/KitchenSotDraftProvider";
import { CookbookBooklet } from "./CookbookBooklet";
import { buildPrintCollections } from "./printCollections";
import { projectPrintSet } from "./printSetProjection";
import { WorkstationCard } from "./WorkstationCard";
import { useOptionalCookbookDocument } from "../cookbook/CookbookDocumentProvider";
import "./print.css";

type PreviewMode = "draft" | "approved";
type OutputIntent = "master" | "station" | "booklet";
type DependencyPolicy = "reference" | "include";

class InvalidPrintUiSnapshotError extends Error {
  constructor() {
    super("Print Center snapshot has an invalid declared field");
    this.name = "InvalidPrintUiSnapshotError";
  }
}

class DuplicatePrintRecipeIdentityError extends Error {
  constructor() {
    super("Print Center snapshot contains duplicate recipe identity");
    this.name = "DuplicatePrintRecipeIdentityError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new InvalidPrintUiSnapshotError();
  return value;
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new InvalidPrintUiSnapshotError();
  return value;
}

function meaningfulString(value: unknown): value is string {
  return typeof value === "string" && value.replace(/[\s\p{Cf}]/gu, "").length > 0;
}

function captureIdentity(value: unknown): RecipeIdentity {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (meaningfulString(value)) return value;
  throw new InvalidPrintUiSnapshotError();
}

function capturePoint(value: unknown, crop: boolean): MediaCrop | FocalPoint | null {
  if (value === null) return null;
  const point = requireRecord(value);
  return crop
    ? { x: point.x as number, y: point.y as number, width: point.width as number, height: point.height as number }
    : { x: point.x as number, y: point.y as number };
}

function captureIngredient(value: unknown): IngredientLine {
  const line = requireRecord(value);
  return {
    lineKey: line.lineKey as string,
    itemName: line.itemName as string,
    itemKind: line.itemKind as IngredientLine["itemKind"],
    ingredientId: line.ingredientId as number | null,
    componentRecipeId: line.componentRecipeId as RecipeIdentity | null,
    sourceText: line.sourceText as string | null,
    sourceValue: line.sourceValue as number | null,
    sourceUnit: line.sourceUnit as string | null,
    servingNote: line.servingNote as string | null,
    decisionStatus: line.decisionStatus as string,
    selectedSource: line.selectedSource as string | null,
  };
}

function captureStep(value: unknown): WorkStep {
  const step = requireRecord(value);
  return {
    stepId: step.stepId as string,
    stage: step.stage as WorkStage,
    instruction: step.instruction as string,
    order: step.order as number,
  };
}

function captureWorkDocument(value: unknown): WorkDocument {
  const document = requireRecord(value);
  const ingredientLineKeys = requireArray(document.ingredientLineKeys);
  const steps = requireArray(document.steps);
  return {
    stage: document.stage as WorkStage,
    scalable: document.scalable as boolean,
    ingredientLineKeys: ingredientLineKeys.map((lineKey) => lineKey as string),
    steps: steps.map(captureStep),
  };
}

function captureRecipe(value: unknown): RecipeVersion {
  const recipe = requireRecord(value);
  const recipeId = captureIdentity(recipe.recipeId);
  const recipeVersionId = recipe.recipeVersionId;
  const name = recipe.name;
  if (!meaningfulString(recipeVersionId) || !meaningfulString(name)) {
    throw new InvalidPrintUiSnapshotError();
  }
  const rawWorkDocuments = requireRecord(recipe.workDocuments);
  const workDocuments: RecipeVersion["workDocuments"] = {};
  for (const stage of ["prep", "cook", "service"] as const) {
    const document = rawWorkDocuments[stage];
    if (document !== undefined) workDocuments[stage] = captureWorkDocument(document);
  }
  return {
    recipeId,
    recipeVersionId,
    name,
    kind: recipe.kind as RecipeVersion["kind"],
    category: meaningfulString(recipe.category) ? recipe.category : null,
    parentRecipeIds: requireArray(recipe.parentRecipeIds).map(captureIdentity),
    reviewState: recipe.reviewState as RecipeVersion["reviewState"],
    sourceLocators: requireArray(recipe.sourceLocators).map((locator) => locator as string),
    lines: requireArray(recipe.lines).map(captureIngredient),
    methodText: recipe.methodText as string | null,
    methodDecisionNote: recipe.methodDecisionNote as string | null,
    yieldText: recipe.yieldText as string | null,
    blockers: requireArray(recipe.blockers).map((blocker) => blocker as string),
    operationalNotes: requireArray(recipe.operationalNotes).map((note) => note as string),
    workDocuments,
  };
}

function captureMediaAsset(value: unknown): MediaAsset {
  const asset = requireRecord(value);
  return {
    mediaId: asset.mediaId as string,
    url: asset.url as string,
    caption: asset.caption as string,
    altText: asset.altText as string,
    source: asset.source as string | null,
    capturedAt: asset.capturedAt as string | null,
    author: asset.author as string | null,
    reviewState: asset.reviewState as MediaAsset["reviewState"],
    localSessionOnly: asset.localSessionOnly as boolean,
    crop: capturePoint(asset.crop, true) as MediaCrop | null,
    focalPoint: capturePoint(asset.focalPoint, false) as FocalPoint | null,
    measurementAnnotation: asset.measurementAnnotation as string | null,
  };
}

function captureMediaLink(value: unknown): StepMediaLink {
  const link = requireRecord(value);
  return {
    stepId: link.stepId as string,
    mediaId: link.mediaId as string,
    order: link.order as number,
    role: link.role as StepMediaLink["role"],
    vessel: link.vessel as StepMediaLink["vessel"],
    reviewNeeded: link.reviewNeeded as boolean,
  };
}

function capturePrintSnapshot(value: unknown): CookbookSnapshot {
  const snapshot = requireRecord(value);
  const recipes = requireArray(snapshot.recipes).map(captureRecipe);
  const identities = new Set<string>();
  for (const recipe of recipes) {
    const key = identityKey(recipe.recipeId);
    if (identities.has(key)) throw new DuplicatePrintRecipeIdentityError();
    identities.add(key);
  }
  return {
    recipes,
    media: requireArray(snapshot.media).map(captureMediaAsset),
    stepMedia: requireArray(snapshot.stepMedia).map(captureMediaLink),
  };
}

function identityKey(recipeId: RecipeIdentity): string {
  return typeof recipeId === "number"
    ? `number:${String(recipeId)}`
    : `string:${JSON.stringify(recipeId)}`;
}

function recipeIdsFromSearchParams(searchParams: URLSearchParams): RecipeIdentity[] {
  return searchParams.getAll("recipe").flatMap((value) => {
    const identity = decodeRecipeIdentity(value);
    return identity === null ? [] : [identity];
  });
}

function compareRecipes(left: RecipeVersion, right: RecipeVersion): number {
  const byName = left.name.localeCompare(right.name, "th");
  if (byName !== 0) return byName;
  return identityKey(left.recipeId).localeCompare(identityKey(right.recipeId));
}

function publicRecipeCode(recipe: RecipeVersion): string | null {
  return typeof recipe.recipeId === "string" && /^(?:RCP|SRCP)-/u.test(recipe.recipeId)
    ? recipe.recipeId
    : null;
}

function recipeChoiceLabel(recipe: RecipeVersion): string {
  const code = publicRecipeCode(recipe);
  return code === null ? recipe.name : `${recipe.name} · ${code}`;
}

function isDuplicateSnapshotError(
  error: unknown,
): error is DuplicatePrintRecipeIdentityError {
  try {
    return error instanceof DuplicatePrintRecipeIdentityError;
  } catch {
    return false;
  }
}

function isUnpageableStepError(error: unknown): error is UnpageableStepError {
  try {
    return error instanceof UnpageableStepError;
  } catch {
    return false;
  }
}

function isUnpageableDocumentError(
  error: unknown,
): error is UnpageableDocumentError {
  try {
    return error instanceof UnpageableDocumentError;
  } catch {
    return false;
  }
}

function isStandardError(error: unknown): error is Error {
  try {
    return error instanceof Error;
  } catch {
    return false;
  }
}

function pageKey(page: WorkstationPage): string {
  const document = page.document;
  return [
    identityKey(document.recipeId),
    JSON.stringify(document.recipeVersionId),
    document.stage,
    String(document.multiplier),
    String(page.partNumber),
    String(page.totalParts),
  ].join(":");
}

function plannerErrorMessage(error: unknown): string {
  if (isUnpageableStepError(error)) {
    return `ขั้นตอนยาวเกินพื้นที่ A5 และไม่สามารถตัดกลางขั้นตอนได้ · สูตร ${String(error.recipeId)} · ขั้นตอน ${error.stepId}`;
  }
  if (isUnpageableDocumentError(error)) {
    const sectionLabels = {
      header: "หัวเอกสาร",
      ingredients: "วัตถุดิบ",
      operational_facts: "ข้อมูลใช้งานตามต้นฉบับ",
      media_metadata: "รายละเอียดรูป",
      combined: "องค์ประกอบรวม",
    } as const;
    return `เนื้อหาส่วน${sectionLabels[error.section]}เกินพื้นที่ A5 และไม่สามารถพิมพ์โดยตัดข้อมูลได้`;
  }
  if (isStandardError(error)) {
    return `ข้อมูลชุดพิมพ์ไม่ถูกต้อง กรุณาตรวจสูตร จุดงาน และรูปประกอบ · ${error.name}: ${error.message}`;
  }
  return "ข้อมูลชุดพิมพ์ไม่ถูกต้อง กรุณาตรวจสูตร จุดงาน และรูปประกอบ";
}

function PreviewPage({
  page,
  media,
  previewMode,
  readinessByRecipe,
}: {
  page: PrintPage;
  media: MediaIndex;
  previewMode: PreviewMode;
  readinessByRecipe: Map<string, "draft" | "ready">;
}) {
  if (page.kind === "station") {
    return (
      <section
        className="workstation-sheet"
        data-page-name="workstation"
        data-sheet-size="210mm × 148mm"
      >
        <WorkstationCard
          page={page}
          media={media}
          previewMode={previewMode}
          readiness={readinessByRecipe.get(identityKey(page.document.recipeId)) ?? "draft"}
        />
      </section>
    );
  }

  return (
    <section
      className="two-up-sheet"
      data-page-name="two-up"
      data-sheet-size="210mm × 297mm"
    >
      {page.slots.map((slot) => (
        <div className="two-up-slot" key={pageKey(slot)}>
          <WorkstationCard
            page={slot}
            media={media}
            previewMode={previewMode}
            readiness={readinessByRecipe.get(identityKey(slot.document.recipeId)) ?? "draft"}
          />
        </div>
      ))}
    </section>
  );
}

export function PrintCenterPage({
  initialRecipeIds = [],
}: {
  initialRecipeIds?: RecipeIdentity[];
}) {
  const { snapshot: rawSnapshot } = usePrototype();
  const cookbookDocument = useOptionalCookbookDocument();
  const kitchenSotDraft = useOptionalKitchenSotDraft();
  const [searchParams] = useSearchParams();
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => [
    ...new Set([
      ...initialRecipeIds,
      ...recipeIdsFromSearchParams(searchParams),
    ].map(identityKey)),
  ]);
  const [outputIntent, setOutputIntent] = useState<OutputIntent>("station");
  const [dependencyPolicy, setDependencyPolicy] = useState<DependencyPolicy>("include");
  const [searchText, setSearchText] = useState("");
  const [closedCollectionKeys, setClosedCollectionKeys] = useState<string[]>([]);
  const [stage, setStage] = useState<WorkStage | "all">("all");
  const [template, setTemplate] = useState<PrintTemplate>("auto");
  const [multiplierText, setMultiplierText] = useState("1");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("draft");

  let snapshot: CookbookSnapshot;
  let rawRecipeDraftById: ReadonlyMap<RecipeIdentity, boolean> | null = null;
  try {
    if (cookbookDocument !== null) {
      snapshot = capturePrintSnapshot(cookbookDocument.snapshot);
      rawRecipeDraftById = cookbookDocument.recipeDraftById;
    } else if (kitchenSotDraft === null) {
      snapshot = capturePrintSnapshot(rawSnapshot);
    } else {
      const projected = projectKitchenSotPrintSnapshot(
        kitchenSotDraft.document,
        rawSnapshot,
      );
      snapshot = capturePrintSnapshot(projected.snapshot);
      rawRecipeDraftById = projected.recipeDraftById;
    }
  } catch (error) {
    const message = isDuplicateSnapshotError(error)
      ? "พบรหัสสูตรซ้ำในชุดข้อมูลศูนย์การพิมพ์"
      : "ข้อมูลสูตรสำหรับศูนย์การพิมพ์ไม่ถูกต้อง";
    return (
      <section className="print-center-page" aria-labelledby="print-center-title">
        <header className="print-center-header">
          <h2 id="print-center-title">ศูนย์การพิมพ์</h2>
          <p>จัดชุดใบงาน A5 หรือ A4 สำหรับพิมพ์หน้าครัว</p>
        </header>
        <section className="print-error" role="alert">
          <h3>เปิดข้อมูลศูนย์การพิมพ์ไม่ได้</h3>
          <p>{message}</p>
        </section>
      </section>
    );
  }

  const availableRecipes = [...snapshot.recipes].sort(compareRecipes);
  const recipesByIdentity = new Map(
    availableRecipes.map((recipe) => [identityKey(recipe.recipeId), recipe]),
  );
  const selectedIds = selectedKeys.flatMap((key) => {
    const recipe = recipesByIdentity.get(key);
    return recipe === undefined ? [] : [recipe.recipeId];
  });
  const selectedRecipes = selectedKeys.flatMap((key) => {
    const recipe = recipesByIdentity.get(key);
    return recipe === undefined ? [] : [recipe];
  });
  const normalizedSearch = searchText.trim().toLocaleLowerCase("th");
  const collections = buildPrintCollections(availableRecipes).flatMap((collection) => {
    const recipes = collection.recipes.filter((recipe) => {
      if (normalizedSearch === "") return true;
      const code = publicRecipeCode(recipe) ?? "";
      return `${recipe.name} ${code}`.toLocaleLowerCase("th").includes(normalizedSearch);
    });
    return recipes.length === 0 ? [] : [{ ...collection, recipes }];
  });

  const parsedMultiplier = stage === "service" ? 1 : Number(multiplierText);
  const multiplierValid =
    Number.isSafeInteger(parsedMultiplier) && parsedMultiplier >= 1;
  let pages: PrintPage[] = [];
  let media: MediaIndex | null = null;
  let planningError: string | null = null;
  let bookletRecipes: RecipeVersion[] = [];
  const readinessByRecipe = new Map<string, "draft" | "ready">();

  if (selectedIds.length > 0 && (outputIntent === "booklet" || multiplierValid)) {
    try {
      const includedRecipes = projectPrintSet(snapshot.recipes, selectedIds, {
        kind: "manual",
        dependencyPolicy,
      }).fullRecipes;
      for (const recipe of includedRecipes) {
        if (rawRecipeDraftById === null) {
          const coverage = deriveRecipeMediaCoverage(recipe, snapshot).coverage;
          const readiness = evaluateReadiness(recipe, coverage);
          readinessByRecipe.set(identityKey(recipe.recipeId), readiness.draft ? "draft" : "ready");
        } else {
          readinessByRecipe.set(
            identityKey(recipe.recipeId),
            (rawRecipeDraftById.get(recipe.recipeId) ?? true) ? "draft" : "ready",
          );
        }
      }
      const printableRecipes = previewMode === "approved"
        ? includedRecipes.filter((recipe) => readinessByRecipe.get(identityKey(recipe.recipeId)) === "ready")
        : includedRecipes;
      if (outputIntent === "booklet") {
        bookletRecipes = printableRecipes;
      } else {
        const documents = projectWorkDocuments(printableRecipes, {
          stage: "all",
          multiplier: parsedMultiplier,
        });
        media = buildMediaIndex(snapshot);
        pages = buildPrintPlan(documents, media, {
          template,
          stage,
          multiplier: parsedMultiplier,
        });
      }
    } catch (error) {
      planningError = plannerErrorMessage(error);
      pages = [];
      media = null;
    }
  }

  function toggleRecipe(recipeId: RecipeIdentity, checked: boolean): void {
    const key = identityKey(recipeId);
    setSelectedKeys((current) => checked
      ? current.includes(key)
        ? current
        : [...current, key]
      : current.filter((candidate) => candidate !== key));
  }

  function chooseOutput(next: OutputIntent): void {
    setOutputIntent(next);
    if (next === "booklet") {
      setDependencyPolicy("reference");
      return;
    }
    setDependencyPolicy("include");
    setTemplate(next === "master" ? "two-up" : "station");
  }

  const outputCount = outputIntent === "booklet" ? bookletRecipes.length : pages.length;
  const printDisabled = selectedIds.length === 0
    || (outputIntent !== "booklet" && !multiplierValid)
    || planningError !== null
    || outputCount === 0;

  return (
    <section className="print-center-page" aria-labelledby="print-center-title">
      <header className="print-center-header">
        <div>
          <p className="print-center-header__eyebrow">งานพิมพ์เอกสารครัว</p>
          <h2 id="print-center-title">ศูนย์การพิมพ์</h2>
          <p>จัดชุดใบงาน A5 หรือ A4 สำหรับพิมพ์หน้าครัว</p>
        </div>
        <p className="print-center-header__note">ข้อมูลที่มีแสดงทันที · ช่องว่างเติมภายหลังได้</p>
      </header>

      <div className="print-workspace">
        <form className="print-sidebar" onSubmit={(event) => event.preventDefault()}>
          <div className="print-sidebar__scroll">
            <fieldset className="print-intents">
              <legend>1. พิมพ์เพื่อใช้อะไร</legend>
              <div>
                <button type="button" aria-pressed={outputIntent === "master"} onClick={() => chooseOutput("master")}>
                  <span aria-hidden="true">▤</span><strong>A4 สูตรเต็ม</strong><small>สูตรอ้างอิงฉบับเต็ม</small>
                </button>
                <button type="button" aria-pressed={outputIntent === "station"} onClick={() => chooseOutput("station")}>
                  <span aria-hidden="true">✓</span><strong>A5 ใบงาน</strong><small>ใช้ตามจุดครัว</small>
                </button>
                <button type="button" aria-pressed={outputIntent === "booklet"} onClick={() => chooseOutput("booklet")}>
                  <span aria-hidden="true">▥</span><strong>พิมพ์เป็นเล่ม</strong><small>ปก สารบัญ และสูตร</small>
                </button>
              </div>
            </fieldset>

            <fieldset className="print-recipe-selection">
              <legend>2. เลือกสูตรตามชื่อ</legend>
              <label className="print-search">
                <span>ค้นหาสูตร</span>
                <input
                  type="search"
                  value={searchText}
                  placeholder="ค้นหาชื่อหรือรหัสสูตร"
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </label>
              <div className="print-collections">
                {collections.map((collection) => (
                  <details
                    className="print-collection"
                    key={collection.key}
                    open={normalizedSearch !== "" || !closedCollectionKeys.includes(collection.key)}
                    onToggle={(event) => {
                      if (normalizedSearch !== "") return;
                      const isOpen = event.currentTarget.open;
                      setClosedCollectionKeys((current) => isOpen
                        ? current.filter((key) => key !== collection.key)
                        : current.includes(collection.key) ? current : [...current, collection.key]);
                    }}
                  >
                    <summary>
                      <span aria-hidden="true">›</span>
                      <strong>{collection.label}</strong>
                      <em>{collection.recipes.length}</em>
                    </summary>
                    <div>
                      {collection.recipes.map((recipe) => (
                        <label key={`${identityKey(recipe.recipeId)}:${JSON.stringify(recipe.recipeVersionId)}`}>
                          <input
                            type="checkbox"
                            checked={selectedKeys.includes(identityKey(recipe.recipeId))}
                            onChange={(event) => toggleRecipe(recipe.recipeId, event.target.checked)}
                          />
                          {recipeChoiceLabel(recipe)}
                        </label>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              {collections.length === 0 && <p className="print-empty-search">ไม่พบสูตรที่ค้นหา</p>}
            </fieldset>

            <section className="print-selected" aria-label="รายการที่เลือก">
              <header><strong>เลือกแล้ว {selectedRecipes.length} สูตร</strong><button type="button" onClick={() => setSelectedKeys([])}>ล้างการเลือก</button></header>
              {selectedRecipes.length === 0
                ? <p>เลือกสูตรจากหมวดด้านบน</p>
                : <div>{selectedRecipes.map((recipe) => <span className="print-selected-chip" key={identityKey(recipe.recipeId)}>{recipe.name}</span>)}</div>}
            </section>

            <label className="print-dependency-policy">
              <span><strong>3. สูตรประกอบ</strong><small>กำหนดว่าต้องแนบสูตรที่อ้างอิงหรือไม่</small></span>
              <select aria-label="สูตรประกอบ" value={dependencyPolicy} onChange={(event) => setDependencyPolicy(event.target.value as DependencyPolicy)}>
                <option value="reference">อ้างอิงชื่อและรหัสเท่านั้น</option>
                <option value="include">แนบสูตรที่ต้องเตรียม</option>
              </select>
            </label>

            {outputIntent !== "booklet" && (
              <details className="print-advanced">
                <summary>ตั้งค่าใบงานเพิ่มเติม</summary>
                <div className="print-control-grid">
                  <label>
                    จุดงาน
                    <select value={stage} onChange={(event) => setStage(event.target.value as WorkStage | "all")}>
                      <option value="all">ทุกจุดงาน</option>
                      <option value="prep">เตรียม</option>
                      <option value="cook">ปรุง</option>
                      <option value="service">จัดเสิร์ฟ</option>
                    </select>
                  </label>
                  <label>
                    แม่แบบ
                    <select value={template} onChange={(event) => {
                      const nextTemplate = event.target.value as PrintTemplate;
                      setTemplate(nextTemplate);
                      setOutputIntent(nextTemplate === "two-up" ? "master" : "station");
                    }}>
                      <option value="auto">แนะนำอัตโนมัติ</option>
                      <option value="station">A5 จุดงาน</option>
                      <option value="two-up">A4 สองใบต่อหน้า</option>
                    </select>
                  </label>
                  <label>
                    ตัวคูณการผลิต
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      disabled={stage === "service"}
                      value={stage === "service" ? "1" : multiplierText}
                      aria-invalid={!multiplierValid}
                      aria-describedby={!multiplierValid ? "print-multiplier-error" : undefined}
                      onChange={(event) => setMultiplierText(event.target.value)}
                    />
                  </label>
                  <label>
                    ชุดที่ต้องการพิมพ์
                    <select value={previewMode} onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}>
                      <option value="draft">ข้อมูลทั้งหมด</option>
                      <option value="approved">เฉพาะสูตรพร้อมใช้</option>
                    </select>
                  </label>
                </div>
              </details>
            )}

            {outputIntent === "booklet" && (
              <label className="print-booklet-status">
                ชุดที่ต้องการพิมพ์
                <select value={previewMode} onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}>
                  <option value="draft">ข้อมูลทั้งหมด</option>
                  <option value="approved">เฉพาะสูตรพร้อมใช้</option>
                </select>
              </label>
            )}

            {outputIntent !== "booklet" && !multiplierValid && (
              <p id="print-multiplier-error" role="alert">ตัวคูณต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป</p>
            )}
          </div>

          <footer className="print-sidebar__footer">
            <p><strong>{selectedRecipes.length} สูตร</strong><span>{outputCount} {outputIntent === "booklet" ? "หน้าสูตร" : "แผ่น"}</span></p>
            <button type="button" disabled={printDisabled} onClick={() => window.print()}>พิมพ์ชุดที่เลือก</button>
          </footer>
        </form>

        <section className="print-proof" aria-label="ตรวจตัวอย่างก่อนพิมพ์">
          <header className="print-proof__header">
            <div><strong>{outputIntent === "booklet" ? "เล่มคู่มือสูตรครัว" : outputIntent === "master" ? "A4 สูตรเต็ม" : "A5 ใบงาน"}</strong><span>ตรวจรายการและหน้ากระดาษก่อนพิมพ์</span></div>
            <div><span>{selectedRecipes.length} สูตร</span><span>{dependencyPolicy === "include" ? "แนบสูตรประกอบ" : "อ้างอิงสูตรประกอบ"}</span><span>{outputCount} {outputIntent === "booklet" ? "หน้าสูตร" : "แผ่น"}</span><span>{outputIntent === "booklet" ? "A5 แนวตั้ง" : outputIntent === "master" ? "A4 แนวตั้ง" : "A5 แนวนอน"}</span></div>
          </header>

          <div className="print-proof__canvas">
            {planningError !== null && (
              <section className="print-error" role="alert" aria-labelledby="print-error-title">
                <h3 id="print-error-title">สร้างตัวอย่างพิมพ์ไม่ได้</h3>
                <p>{planningError}</p>
              </section>
            )}

            {selectedIds.length === 0 && <p className="print-empty-state" role="status">เลือกอย่างน้อยหนึ่งสูตรเพื่อสร้างชุดพิมพ์</p>}
            {selectedIds.length > 0 && (outputIntent === "booklet" || multiplierValid) && planningError === null && outputCount === 0 && (
              <p className="print-empty-state" role="status">ไม่มีเอกสารที่ตรงกับจุดงานและชุดที่เลือก</p>
            )}

            {outputIntent === "booklet" && bookletRecipes.length > 0 && (
              <CookbookBooklet
                recipes={bookletRecipes}
                allRecipes={availableRecipes}
                readinessFor={(recipeId) => readinessByRecipe.get(identityKey(recipeId)) ?? "draft"}
              />
            )}

            {outputIntent !== "booklet" && media !== null && pages.length > 0 && (
              <div className="print-preview" aria-label="ตัวอย่างชุดพิมพ์">
                {pages.map((page, index) => (
                  <PreviewPage
                    key={page.kind === "station" ? pageKey(page) : `two-up:${String(index)}:${page.slots.map(pageKey).join("|")}`}
                    page={page}
                    media={media}
                    previewMode={previewMode}
                    readinessByRecipe={readinessByRecipe}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
