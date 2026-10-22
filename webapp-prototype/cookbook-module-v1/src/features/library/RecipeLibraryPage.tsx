import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { CookbookSnapshot, RecipeIdentity, RecipeVersion, WorkStage } from "../../domain/cookbook/types";
import { evaluateReadiness } from "../../domain/review/readiness";
import { projectKitchenSotPrintSnapshot } from "../../domain/sot/kitchenSotPrintProjection";
import { usePrototype } from "../../prototype/PrototypeProvider";
import { useOptionalCookbookDocument } from "../cookbook/CookbookDocumentProvider";
import { encodeRecipeIdentity } from "../recipe/recipeRoute";
import { deriveRecipeMediaCoverage } from "../recipe/recipeMediaCoverage";
import { useOptionalKitchenSotDraft } from "../review/KitchenSotDraftProvider";
import {
  recipePrintCollectionKey,
  STANDARD_PRINT_COLLECTIONS,
} from "../print/printCollections";
import { RecipeLibraryResults } from "./RecipeLibraryResults";
import {
  parseRecipeLibraryUrlState,
  updateRecipeLibraryUrlState,
  type RecipeKindFilter,
  type RecipeLibraryUrlState,
  type RecipeStageFilter,
  type RecipeStatusFilter,
} from "./recipeLibraryUrlState";

function compareRecipes(left: RecipeVersion, right: RecipeVersion): number {
  const byName = left.name.localeCompare(right.name, "th");
  return byName !== 0 ? byName : encodeRecipeIdentity(left.recipeId).localeCompare(encodeRecipeIdentity(right.recipeId));
}

const KIND_LABELS: Record<Exclude<RecipeKindFilter, "all">, string> = {
  sellable_menu: "เมนูขาย",
  prepared_recipe: "สูตรเตรียม",
  sub_recipe: "สูตรย่อย",
};

const STATUS_LABELS: Record<Exclude<RecipeStatusFilter, "all">, string> = {
  ready: "พร้อมใช้",
  waiting: "รอข้อมูล",
};

const STAGE_LABELS: Record<Exclude<RecipeStageFilter, "all">, string> = {
  prep: "เตรียม",
  cook: "ปรุง",
  service: "จัดเสิร์ฟ",
};

function visibleCode(recipe: RecipeVersion): string | null {
  return typeof recipe.recipeId === "string" && /^(?:RCP|SRCP)-/u.test(recipe.recipeId)
    ? recipe.recipeId
    : null;
}

export function RecipeLibraryPage() {
  const { snapshot: sessionSnapshot } = usePrototype();
  const cookbookDocument = useOptionalCookbookDocument();
  const kitchenSotDraft = useOptionalKitchenSotDraft();
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const state = parseRecipeLibraryUrlState(searchParams);
  const [rawQuery, setRawQuery] = useState(state.query);
  const expectedSearchRef = useRef<string | null>(null);
  const serializedSearch = searchParams.toString();
  const pageTitle = state.mode === "work" ? "ใบงานครัว" : state.mode === "manage" ? "จัดการสูตร" : "สูตรอาหาร";
  const pageDescription = state.mode === "work"
    ? "เลือกสูตรเพื่อเปิดใบงานตามจุดงาน"
    : state.mode === "manage"
      ? "เลือกสูตรที่ต้องการแก้ไขหรือเติมข้อมูล"
      : "ค้นหาและเปิดดูสูตรของร้านได้จากที่เดียว";

  function updateUrl(patch: Partial<RecipeLibraryUrlState>) {
    const next = updateRecipeLibraryUrlState(searchParams, patch);
    if (patch.query !== undefined) setRawQuery(patch.query);
    expectedSearchRef.current = next.toString();
    setSearchParams(next);
  }

  useEffect(() => {
    if (expectedSearchRef.current === serializedSearch) {
      expectedSearchRef.current = null;
      return;
    }
    expectedSearchRef.current = null;
    setRawQuery(state.query);
  }, [serializedSearch, state.query]);

  let snapshot: CookbookSnapshot = sessionSnapshot;
  let draftById: ReadonlyMap<RecipeIdentity, boolean> | null = null;
  try {
    if (cookbookDocument !== null) {
      snapshot = cookbookDocument.snapshot;
      draftById = cookbookDocument.recipeDraftById;
    } else if (kitchenSotDraft !== null) {
      const projection = projectKitchenSotPrintSnapshot(kitchenSotDraft.document, sessionSnapshot);
      snapshot = projection.snapshot;
      draftById = projection.recipeDraftById;
    }
  } catch {
    return <section role="alert"><h1>เปิดสูตรอาหารไม่ได้</h1><p>กรุณาลองใหม่อีกครั้ง</p></section>;
  }

  const rows = snapshot.recipes.map((recipe) => {
    const media = deriveRecipeMediaCoverage(recipe, snapshot);
    const readiness = evaluateReadiness(recipe, media.coverage);
    return {
      recipe,
      draft: draftById === null ? readiness.draft : (draftById.get(recipe.recipeId) ?? true),
    };
  });
  const normalizedQuery = state.query.toLocaleLowerCase("th");
  const filteredRows = rows.filter(({ recipe, draft }) => {
    const code = visibleCode(recipe)?.toLocaleLowerCase("th") ?? "";
    if (normalizedQuery !== "" && !recipe.name.toLocaleLowerCase("th").includes(normalizedQuery) && !code.includes(normalizedQuery)) return false;
    if (state.kind !== "all" && recipe.kind !== state.kind) return false;
    if (state.status === "ready" && draft) return false;
    if (state.status === "waiting" && !draft) return false;
    if (state.stage !== "all" && recipe.workDocuments[state.stage as WorkStage] === undefined) return false;
    if (state.collection !== "all" && recipePrintCollectionKey(recipe) !== state.collection) return false;
    return true;
  }).sort((left, right) => compareRecipes(left.recipe, right.recipe));
  const hasActiveFilters = state.query !== "" || state.kind !== "all" || state.status !== "all" || state.stage !== "all" || state.collection !== "all";
  const collectionLabel = state.collection === "all"
    ? null
    : STANDARD_PRINT_COLLECTIONS.find(({ key }) => key === state.collection)?.label ?? null;

  function clearFilters() {
    updateUrl({ query: "", kind: "all", status: "all", stage: "all", collection: "all" });
  }

  return (
    <section aria-labelledby="recipe-library-title">
      <header className="page-heading">
        <div>
          <h1 id="recipe-library-title">{pageTitle}</h1>
          <p>{pageDescription}</p>
        </div>
      </header>

      <div className={`recipe-toolbar${state.mode === "manage" ? " recipe-toolbar--manage" : ""}`} aria-label="ค้นหาและกรองสูตรอาหาร">
        <label>ค้นหาชื่อหรือรหัสสูตร<input
          type="search"
          value={rawQuery}
          placeholder="พิมพ์ชื่อหรือรหัสสูตร"
          onChange={(event) => updateUrl({ query: event.target.value })}
        /></label>
        <button
          type="button"
          aria-expanded={filtersExpanded}
          aria-controls="recipe-library-filters"
          onClick={() => setFiltersExpanded((expanded) => !expanded)}
        >ตัวกรอง</button>
        {filtersExpanded && <div id="recipe-library-filters">
          <label>ประเภทสูตร<select value={state.kind} onChange={(event) => updateUrl({ kind: event.target.value as RecipeKindFilter })}>
            <option value="all">ทุกประเภท</option>
            <option value="sellable_menu">เมนูขาย</option>
            <option value="prepared_recipe">สูตรเตรียม</option>
            <option value="sub_recipe">สูตรย่อย</option>
          </select></label>
          <label>สถานะข้อมูล<select value={state.status} onChange={(event) => updateUrl({ status: event.target.value as RecipeStatusFilter })}>
            <option value="all">ทุกสถานะ</option>
            <option value="ready">พร้อมใช้</option>
            <option value="waiting">รอข้อมูล</option>
          </select></label>
          <label>จุดงาน<select value={state.stage} onChange={(event) => updateUrl({ stage: event.target.value as RecipeStageFilter })}>
            <option value="all">ทุกจุดงาน</option>
            <option value="prep">เตรียม</option>
            <option value="cook">ปรุง</option>
            <option value="service">จัดเสิร์ฟ</option>
          </select></label>
          <label>หมวดพิมพ์<select value={state.collection} onChange={(event) => updateUrl({ collection: event.target.value as RecipeLibraryUrlState["collection"] })}>
            <option value="all">ทุกหมวด</option>
            {STANDARD_PRINT_COLLECTIONS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select></label>
        </div>}
        {hasActiveFilters && <div aria-label="ตัวกรองที่เลือก">
          {state.query !== "" && <button type="button" aria-label={`ลบตัวกรอง ค้นหา ${state.query}`} onClick={() => updateUrl({ query: "" })}>ค้นหา: {state.query} ×</button>}
          {state.kind !== "all" && <button type="button" aria-label={`ลบตัวกรอง ${KIND_LABELS[state.kind]}`} onClick={() => updateUrl({ kind: "all" })}>{KIND_LABELS[state.kind]} ×</button>}
          {state.status !== "all" && <button type="button" aria-label={`ลบตัวกรอง ${STATUS_LABELS[state.status]}`} onClick={() => updateUrl({ status: "all" })}>{STATUS_LABELS[state.status]} ×</button>}
          {state.stage !== "all" && <button type="button" aria-label={`ลบตัวกรอง ${STAGE_LABELS[state.stage]}`} onClick={() => updateUrl({ stage: "all" })}>{STAGE_LABELS[state.stage]} ×</button>}
          {collectionLabel !== null && <button type="button" aria-label={`ลบตัวกรอง ${collectionLabel}`} onClick={() => updateUrl({ collection: "all" })}>{collectionLabel} ×</button>}
          <button type="button" onClick={clearFilters}>ล้างตัวกรอง</button>
        </div>}
        {state.mode !== "manage" && <div role="group" aria-label="รูปแบบการแสดงสูตร">
          <button type="button" aria-pressed={state.view === "read"} onClick={() => updateUrl({ view: "read" })}>ดูง่าย</button>
          <button type="button" aria-pressed={state.view === "compact"} onClick={() => updateUrl({ view: "compact" })}>รายการย่อ</button>
        </div>}
      </div>

      <p><strong>{filteredRows.length} สูตร</strong></p>
      <p className="recipe-count" aria-live="polite">แสดง {filteredRows.length} จาก {rows.length} สูตร</p>
      {filteredRows.length === 0
        ? <p className="blank-content">ไม่พบสูตรที่ตรงกับการค้นหา</p>
        : <RecipeLibraryResults rows={filteredRows} mode={state.mode} view={state.view} />}
    </section>
  );
}
