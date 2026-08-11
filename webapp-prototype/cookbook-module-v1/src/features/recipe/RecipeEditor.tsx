import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CookbookV6Edit } from "../../domain/cookbookV6/editCookbookV6";
import type { CookbookV6IngredientLine, CookbookV6MethodStep, CookbookV6Recipe } from "../../domain/cookbookV6/types";
import { useCookbookDocument } from "../cookbook/CookbookDocumentProvider";
import { STANDARD_PRINT_COLLECTIONS } from "../print/printCollections";
import { CUSTOM_INGREDIENT_UNIT, normalizeSelectedUnit, STANDARD_INGREDIENT_UNITS } from "./ingredientUnits";
import { decodeRecipeIdentity, encodeRecipeIdentity } from "./recipeRoute";
import "./recipe-editor.css";

type IngredientDraft = CookbookV6IngredientLine & {
  removed: boolean;
  unitSelection: string;
  customUnit: string;
};

type MethodDraft = CookbookV6MethodStep & { removed: boolean };

type RecipeDraft = Omit<CookbookV6Recipe, "ingredients" | "methodSteps"> & {
  ingredients: IngredientDraft[];
  methodSteps: MethodDraft[];
};

const STANDARD_CATEGORY_OPTIONS = STANDARD_PRINT_COLLECTIONS.flatMap((collection) => (
  collection.key === "unassigned" || collection.category === null
    ? []
    : [{ label: collection.label, value: collection.category }]
));

let localSequence = 0;

function nextId(prefix: string): string {
  localSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${localSequence.toString(36)}`;
}

function unitDraft(unitText: string) {
  const standard = STANDARD_INGREDIENT_UNITS.some((unit) => unit === unitText);
  return {
    unitSelection: unitText === "" || standard ? unitText : CUSTOM_INGREDIENT_UNIT,
    customUnit: standard ? "" : unitText,
  };
}

function toDraft(recipe: CookbookV6Recipe): RecipeDraft {
  return {
    ...structuredClone(recipe),
    ingredients: recipe.ingredients.map((line) => ({ ...structuredClone(line), removed: false, ...unitDraft(line.unitText) })),
    methodSteps: recipe.methodSteps.map((step) => ({ ...structuredClone(step), removed: false })),
  };
}

function buildEdits(original: CookbookV6Recipe, draft: RecipeDraft): CookbookV6Edit[] {
  const edits: CookbookV6Edit[] = [{
    type: "recipe-update",
    recipeId: original.recipeId,
    patch: {
      code: draft.code?.trim() || null,
      name: draft.name.trim(),
      kind: draft.kind,
      category: draft.category,
      active: draft.active,
      yieldText: draft.yieldText,
      operationalNotes: draft.operationalNotes,
      methodDecisionNote: draft.methodDecisionNote,
    },
  }];
  const originalLineIds = new Set(original.ingredients.map(({ lineId }) => lineId));
  for (const line of draft.ingredients) {
    if (originalLineIds.has(line.lineId) && line.removed) {
      edits.push({ type: "ingredient-remove", recipeId: original.recipeId, lineId: line.lineId });
    }
  }
  let previousLineId: string | null = null;
  for (let index = 0; index < draft.ingredients.length; index += 1) {
    const line = draft.ingredients[index]!;
    if (line.removed) continue;
    const unitText = normalizeSelectedUnit(line.unitSelection, line.customUnit);
    if (originalLineIds.has(line.lineId)) {
      edits.push({
        type: "ingredient-update",
        recipeId: original.recipeId,
        lineId: line.lineId,
        patch: {
          name: line.name.trim(),
          kind: line.kind,
          amountText: line.amountText,
          unitText,
          ingredientId: line.ingredientId,
          componentRecipeId: line.componentRecipeId,
          servingNote: line.servingNote,
          active: line.active,
        },
      });
    } else {
      edits.push({
        type: "ingredient-add",
        recipeId: original.recipeId,
        afterLineId: previousLineId,
        line: {
          lineId: line.lineId,
          name: line.name.trim(),
          kind: line.kind,
          amountText: line.amountText,
          unitText,
          sourceDisplayText: unitText === "" ? line.amountText : `${line.amountText} ${unitText}`,
          ingredientId: line.ingredientId,
          componentRecipeId: line.componentRecipeId,
          servingNote: line.servingNote,
          costBasisText: "",
          decisionStatus: "",
          selectedSource: null,
          active: line.active,
        },
      });
    }
    previousLineId = line.lineId;
  }
  draft.ingredients.filter((line) => !line.removed).forEach((line, toIndex) => {
    edits.push({ type: "ingredient-move", recipeId: original.recipeId, lineId: line.lineId, toIndex });
  });

  const originalStepIds = new Set(original.methodSteps.map(({ stepId }) => stepId));
  for (const step of draft.methodSteps) {
    if (originalStepIds.has(step.stepId) && step.removed) {
      edits.push({ type: "method-remove", recipeId: original.recipeId, stepId: step.stepId });
    }
  }
  for (const step of draft.methodSteps) {
    if (step.removed) continue;
    if (originalStepIds.has(step.stepId)) {
      edits.push({
        type: "method-update",
        recipeId: original.recipeId,
        stepId: step.stepId,
        patch: { stage: step.stage, instruction: step.instruction.trim() },
      });
    } else {
      edits.push({
        type: "method-add",
        recipeId: original.recipeId,
        step: { stepId: step.stepId, stage: step.stage, instruction: step.instruction.trim(), order: step.order },
      });
    }
  }
  draft.methodSteps.filter((step) => !step.removed).forEach((step, toIndex) => {
    edits.push({ type: "method-move", recipeId: original.recipeId, stepId: step.stepId, toIndex });
  });
  return edits;
}

function moveItem<T>(values: T[], from: number, to: number): T[] {
  if (to < 0 || to >= values.length) return values;
  const next = [...values];
  const [value] = next.splice(from, 1);
  if (value !== undefined) next.splice(to, 0, value);
  return next;
}

export function RecipeEditor() {
  const { recipeId: routeSegment } = useParams();
  const cookbook = useCookbookDocument();
  const identity = routeSegment === undefined ? null : decodeRecipeIdentity(routeSegment);
  const sourceRecipe = identity === null ? undefined : cookbook.document.recipes.find((recipe) => recipe.recipeId === identity);
  const [draft, setDraft] = useState<RecipeDraft | null>(() => sourceRecipe === undefined ? null : toDraft(sourceRecipe));
  const [submitted, setSubmitted] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const draftChanged = sourceRecipe !== undefined && draft !== null && JSON.stringify(draft) !== JSON.stringify(toDraft(sourceRecipe));
  const hasUnsavedChanges = (draftChanged && !submitted) || cookbook.dirty;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    let acceptedHistoryIndex = typeof window.history.state?.idx === "number" ? window.history.state.idx : 0;
    let restoringHistory = false;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const guardSpaLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;
      const origin = event.target;
      const anchor = origin instanceof Element ? origin.closest("a[href]") : null;
      if (anchor === null || anchor.hasAttribute("download") || anchor.getAttribute("target") === "_blank") return;
      if (!window.confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const guardHistory = (event: PopStateEvent) => {
      const nextIndex = typeof event.state?.idx === "number" ? event.state.idx : null;
      if (restoringHistory) {
        restoringHistory = false;
        if (nextIndex !== null) acceptedHistoryIndex = nextIndex;
        return;
      }
      if (window.confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่")) {
        if (nextIndex !== null) acceptedHistoryIndex = nextIndex;
        return;
      }
      if (nextIndex !== null && nextIndex !== acceptedHistoryIndex) {
        restoringHistory = true;
        window.history.go(acceptedHistoryIndex - nextIndex);
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("popstate", guardHistory);
    document.addEventListener("click", guardSpaLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("popstate", guardHistory);
      document.removeEventListener("click", guardSpaLink, true);
    };
  }, [hasUnsavedChanges]);

  const encodedId = useMemo(() => sourceRecipe === undefined ? "" : encodeRecipeIdentity(sourceRecipe.recipeId), [sourceRecipe]);
  const componentRecipes = useMemo(() => cookbook.document.recipes
    .filter((recipe) => recipe.active && recipe.recipeId !== sourceRecipe?.recipeId && (recipe.kind === "prepared_recipe" || recipe.kind === "sub_recipe"))
    .sort((left, right) => left.name.localeCompare(right.name, "th")), [cookbook.document.recipes, sourceRecipe?.recipeId]);
  const hasLegacyCategory = draft !== null
    && draft.category.trim() !== ""
    && !STANDARD_CATEGORY_OPTIONS.some(({ value }) => value === draft.category);

  if (sourceRecipe === undefined || draft === null) {
    return <section role="alert"><h1>ไม่พบสูตรอาหาร</h1><Link to="/recipes">กลับไปสูตรอาหาร</Link></section>;
  }

  function change(update: (current: RecipeDraft) => RecipeDraft) {
    setDraft((current) => current === null ? current : update(current));
    setSubmitted(false);
    setValidationMessage(null);
  }

  function patchIngredient(index: number, patch: Partial<IngredientDraft>) {
    change((current) => ({
      ...current,
      ingredients: current.ingredients.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line),
    }));
  }

  function patchMethod(index: number, patch: Partial<MethodDraft>) {
    change((current) => ({
      ...current,
      methodSteps: current.methodSteps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step),
    }));
  }

  async function save() {
    const currentDraft = draft;
    const currentSource = sourceRecipe;
    if (currentDraft === null || currentSource === undefined) return;
    const visibleLines = currentDraft.ingredients.filter((line) => !line.removed);
    const visibleSteps = currentDraft.methodSteps.filter((step) => !step.removed);
    if (currentDraft.name.trim() === "") return setValidationMessage("กรุณาระบุชื่อสูตร");
    if (!currentDraft.active && cookbook.document.recipes.some((recipe) =>
      recipe.active
      && recipe.recipeId !== currentSource.recipeId
      && recipe.ingredients.some((line) => line.active && line.componentRecipeId === currentSource.recipeId),
    )) return setValidationMessage("สูตรนี้ยังถูกใช้งานในสูตรอื่น จึงปิดใช้งานไม่ได้");
    if (visibleLines.some((line) => line.active && line.kind === "prepared_recipe" && line.componentRecipeId === null)) {
      return setValidationMessage("กรุณาเลือกสูตรเตรียมสำหรับรายการที่เปิดใช้งาน");
    }
    if (visibleLines.some((line) => line.active && line.kind === "prepared_recipe" && !componentRecipes.some((recipe) => recipe.recipeId === line.componentRecipeId))) {
      return setValidationMessage("สูตรเตรียมที่เลือกไม่ได้เปิดใช้งาน กรุณาเลือกสูตรอื่น");
    }
    if (visibleLines.some((line) => line.name.trim() === "")) return setValidationMessage("กรุณาระบุชื่อวัตถุดิบที่เพิ่ม");
    if (visibleSteps.some((step) => step.instruction.trim() === "")) return setValidationMessage("กรุณาระบุวิธีทำในขั้นตอนที่เพิ่ม");
    cookbook.applyEdits(buildEdits(currentSource, currentDraft));
    setSubmitted(true);
    await cookbook.save();
  }

  return (
    <form className="recipe-editor" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="recipe-editor__topline">
        <div><Link to={`/recipes/${encodedId}`}>← กลับไปดูสูตร</Link><h1>แก้ไขสูตร</h1><p>{sourceRecipe.code ?? sourceRecipe.name}</p></div>
      </div>

      {validationMessage !== null && <p role="alert">{validationMessage}</p>}

      <section className="content-panel recipe-editor__basics">
        <h2>ข้อมูลสูตร</h2>
        <label>รหัสสูตร<input value={draft.code ?? ""} onChange={(event) => change((current) => ({ ...current, code: event.target.value || null }))} /></label>
        <label>ชื่อสูตร<input value={draft.name} onChange={(event) => change((current) => ({ ...current, name: event.target.value }))} /></label>
        <label>ประเภทสูตร<select value={draft.kind} onChange={(event) => change((current) => ({ ...current, kind: event.target.value as CookbookV6Recipe["kind"] }))}>
          <option value="sellable_menu">เมนูขาย</option><option value="prepared_recipe">สูตรเตรียม</option><option value="sub_recipe">สูตรย่อย</option>
        </select></label>
        <label>หมวดหมู่<select value={draft.category} onChange={(event) => change((current) => ({ ...current, category: event.target.value }))}>
          <option value="">ยังไม่จัดหมวด</option>
          {hasLegacyCategory && <option value={draft.category}>{draft.category}</option>}
          {STANDARD_CATEGORY_OPTIONS.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>ผลผลิต<input value={draft.yieldText} onChange={(event) => change((current) => ({ ...current, yieldText: event.target.value }))} placeholder="เช่น 1 หม้อ หรือ 10 ที่" /></label>
        <label className="recipe-editor__toggle"><input type="checkbox" checked={draft.active} onChange={(event) => change((current) => ({ ...current, active: event.target.checked }))} />เปิดใช้งานสูตร</label>
        <label className="recipe-editor__wide">หมายเหตุหน้าครัว<textarea value={draft.operationalNotes.join("\n")} onChange={(event) => change((current) => ({ ...current, operationalNotes: event.target.value.split("\n") }))} /></label>
      </section>

      <section className="content-panel">
        <div className="recipe-editor__section-heading"><div><h2>วัตถุดิบ</h2><p>กรอกปริมาณและหน่วยตามที่ใช้จริงในครัว</p></div><button type="button" onClick={() => change((current) => ({
          ...current,
          ingredients: [...current.ingredients, {
            lineId: nextId("ingredient"), name: "", kind: "ingredient", amountText: "", unitText: "", sourceDisplayText: "",
            ingredientId: null, componentRecipeId: null, servingNote: "", costBasisText: "", decisionStatus: "", selectedSource: null,
            active: true, removed: false, unitSelection: "", customUnit: "",
          }],
        }))}>เพิ่มวัตถุดิบ</button></div>
        <div className="recipe-editor__list">{draft.ingredients.map((line, index) => {
          const number = index + 1;
          return <fieldset className={line.removed ? "editor-row editor-row--removed" : "editor-row"} key={line.lineId} aria-label={`แถววัตถุดิบ รายการ ${number}`}>
            <legend>รายการ {number}</legend>
            {line.removed ? <><p>รอลบเมื่อบันทึก</p><button type="button" onClick={() => patchIngredient(index, { removed: false })}>เลิกทำ</button></> : <>
              <label>ชื่อวัตถุดิบ รายการ {number}<input value={line.name} onChange={(event) => patchIngredient(index, { name: event.target.value })} /></label>
              <label>ปริมาณ รายการ {number}<input inputMode="decimal" value={line.amountText} onChange={(event) => patchIngredient(index, { amountText: event.target.value })} /></label>
              <label>หน่วย รายการ {number}<select value={line.unitSelection} onChange={(event) => patchIngredient(index, { unitSelection: event.target.value, customUnit: event.target.value === CUSTOM_INGREDIENT_UNIT ? line.customUnit : "" })}>
                <option value="">ไม่ระบุหน่วย</option>{STANDARD_INGREDIENT_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}<option value={CUSTOM_INGREDIENT_UNIT}>หน่วยอื่น</option>
              </select></label>
              {line.unitSelection === CUSTOM_INGREDIENT_UNIT && <label>หน่วยอื่น รายการ {number}<input value={line.customUnit} onChange={(event) => patchIngredient(index, { customUnit: event.target.value })} /></label>}
              <label>ประเภทวัตถุดิบ รายการ {number}<select value={line.kind} onChange={(event) => {
                const kind = event.target.value as IngredientDraft["kind"];
                patchIngredient(index, { kind, componentRecipeId: kind === "ingredient" ? null : line.componentRecipeId });
              }}><option value="ingredient">วัตถุดิบ</option><option value="prepared_recipe">สูตรเตรียม</option></select></label>
              {line.kind === "prepared_recipe" && <label>สูตรเตรียม รายการ {number}<select required={line.active} value={line.componentRecipeId ?? ""} onChange={(event) => {
                const componentRecipeId = event.target.value || null;
                const selected = componentRecipes.find((recipe) => recipe.recipeId === componentRecipeId);
                patchIngredient(index, { componentRecipeId, name: selected?.name ?? line.name });
              }}>
                <option value="">เลือกสูตรเตรียม</option>
                {componentRecipes.map((recipe) => <option key={recipe.recipeId} value={recipe.recipeId}>{recipe.name}{recipe.active ? "" : " (ปิดใช้งาน)"}</option>)}
              </select></label>}
              <label className="recipe-editor__toggle"><input type="checkbox" checked={line.active} onChange={(event) => patchIngredient(index, { active: event.target.checked })} />ใช้งานวัตถุดิบ รายการ {number}</label>
              <div className="editor-row__actions">
                <button type="button" aria-label={`ย้ายวัตถุดิบรายการ ${number} ขึ้น`} disabled={index === 0} onClick={() => change((current) => ({ ...current, ingredients: moveItem(current.ingredients, index, index - 1) }))}>ขึ้น</button>
                <button type="button" aria-label={`ย้ายวัตถุดิบรายการ ${number} ลง`} disabled={index === draft.ingredients.length - 1} onClick={() => change((current) => ({ ...current, ingredients: moveItem(current.ingredients, index, index + 1) }))}>ลง</button>
                <button type="button" aria-label={`ลบวัตถุดิบรายการ ${number}`} onClick={() => patchIngredient(index, { removed: true })}>ลบ</button>
              </div>
            </>}
          </fieldset>;
        })}</div>
      </section>

      <section className="content-panel">
        <div className="recipe-editor__section-heading"><div><h2>วิธีทำ</h2><p>เรียงตามลำดับที่พนักงานต้องทำจริง</p></div><button type="button" onClick={() => change((current) => ({
          ...current,
          methodSteps: [...current.methodSteps, { stepId: nextId("method"), stage: "prep", instruction: "", order: current.methodSteps.length + 1, removed: false }],
        }))}>เพิ่มขั้นตอน</button></div>
        <div className="recipe-editor__list">{draft.methodSteps.map((step, index) => {
          const number = index + 1;
          return <fieldset className={step.removed ? "editor-row editor-row--removed" : "editor-row"} key={step.stepId} aria-label={`รายละเอียดวิธีทำ ขั้นตอน ${number}`}>
            <legend>ขั้นตอน {number}</legend>
            {step.removed ? <><p>รอลบเมื่อบันทึก</p><button type="button" onClick={() => patchMethod(index, { removed: false })}>เลิกทำ</button></> : <>
              <label className="recipe-editor__wide">วิธีทำ ขั้นตอน {number}<textarea value={step.instruction} onChange={(event) => patchMethod(index, { instruction: event.target.value })} /></label>
              <label>จุดงาน ขั้นตอน {number}<select value={step.stage} onChange={(event) => patchMethod(index, { stage: event.target.value as MethodDraft["stage"] })}><option value="prep">เตรียม</option><option value="cook">ปรุง</option><option value="service">จัดเสิร์ฟ</option></select></label>
              <div className="editor-row__actions">
                <button type="button" aria-label={`ย้ายขั้นตอน ${number} ขึ้น`} disabled={index === 0} onClick={() => change((current) => ({ ...current, methodSteps: moveItem(current.methodSteps, index, index - 1) }))}>ขึ้น</button>
                <button type="button" aria-label={`ย้ายขั้นตอน ${number} ลง`} disabled={index === draft.methodSteps.length - 1} onClick={() => change((current) => ({ ...current, methodSteps: moveItem(current.methodSteps, index, index + 1) }))}>ลง</button>
                <button type="button" aria-label={`ลบขั้นตอน ${number}`} onClick={() => patchMethod(index, { removed: true })}>ลบ</button>
              </div>
            </>}
          </fieldset>;
        })}</div>
      </section>

      <div className="recipe-editor__savebar"><Link className="button-link" to={`/recipes/${encodedId}`}>ยกเลิก</Link><button className="button-link button-link--primary" type="submit" disabled={!hasUnsavedChanges || cookbook.saveState === "saving"}>บันทึกสูตร</button></div>
    </form>
  );
}
