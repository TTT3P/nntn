import { describe, expect, test } from "vitest";
import fixture from "../../data/fixtures/first-set.json";
import { parseKitchenSotDocument, type KitchenSotDocument } from "./kitchenSotDocument";
import { applyKitchenSotEdit, buildV5Draft, type DerivedFrom } from "./kitchenSotEdits";
import {
  InvalidKitchenSotTransitionError,
  validateKitchenSotTransition,
} from "./kitchenSotValidation";

const derivedFrom: DerivedFrom = {
  path: "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json",
  sha256: "verified-v4-sha256",
};
const generatedAt = "2026-08-07T03:31:00.000Z";

function sourceDocument(): KitchenSotDocument {
  return parseKitchenSotDocument(fixture);
}

function draft(document = sourceDocument()): KitchenSotDocument {
  return buildV5Draft(document, generatedAt, derivedFrom);
}

function moveKeyToEnd<T extends Record<string, unknown>>(record: T, key: string): T {
  const entries = Object.entries(record);
  const movedIndex = entries.findIndex(([entryKey]) => entryKey === key);
  const [moved] = entries.splice(movedIndex, 1);
  entries.push(moved!);
  return Object.fromEntries(entries) as T;
}

describe("Kitchen SOT transition validation", () => {
  test("allows an unrelated first edit while grandfathering the inherited provenance gap", () => {
    const source = sourceDocument();
    const edited = applyKitchenSotEdit(source, { kind: "yield", recipeId: 162, value: "ค่าทดสอบใน temp vault" });
    const submitted = draft(edited);
    expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom)).not.toThrow();
    expect(submitted.recipes.find(({ recipe_id }) => recipe_id === 159)!.items)
      .toEqual(source.recipes.find(({ recipe_id }) => recipe_id === 159)!.items);
  });

  test("requires a dirty owner item to carry all owner-confirmation mappings", () => {
    const source = sourceDocument();
    const submitted = draft(source);
    const item = submitted.recipes[0]!.items[0]!;
    item.candidate_text = "changed";
    item.selected_source = "owner_confirmation";
    item.decision_status = "confirmed_by_owner";
    expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom))
      .toThrow(/owner_confirmation/u);

    const target = source.recipes.find(({ recipe_id }) => recipe_id === 159)!.items
      .find(({ selected_source }) => selected_source === "owner_confirmation")!;
    const repaired = draft(applyKitchenSotEdit(source, {
      kind: "item-owner-confirmation",
      recipeId: 159,
      lineKey: target.line_key,
      value: "180 กรัม",
      confirmedOn: "2026-08-07",
    }));
    expect(() => validateKitchenSotTransition(source, null, repaired, derivedFrom)).not.toThrow();
  });

  test("rejects a status-only owner confirmation bypass", () => {
    const source = sourceDocument();
    const submitted = draft(source);
    submitted.recipes[0]!.items[0]!.decision_status = "confirmed_by_owner";
    expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom))
      .toThrow(/selected_source/u);
  });

  test.each([
    ["candidate text", (item: KitchenSotDocument["recipes"][number]["items"][number]) => {
      item.candidate_text = "crafted candidate";
    }],
    ["selected source", (item: KitchenSotDocument["recipes"][number]["items"][number]) => {
      item.selected_source = "owner_confirmation";
    }],
    ["decision note", (item: KitchenSotDocument["recipes"][number]["items"][number]) => {
      item.decision_note = "crafted provenance";
    }],
    ["owner source", (item: KitchenSotDocument["recipes"][number]["items"][number]) => {
      item.source_values.owner_confirmation = "crafted owner value";
    }],
  ] as const)("rejects standalone %s mutation without the atomic owner mapping", (_name, mutate) => {
    const source = sourceDocument();
    const submitted = draft(source);
    mutate(submitted.recipes[0]!.items[0]!);
    expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom))
      .toThrow(InvalidKitchenSotTransitionError);
  });

  test("rejects crafted owner readiness and provenance states", () => {
    const source = sourceDocument();

    const missingEvidence = draft(source);
    const missingEvidenceItem = missingEvidence.recipes[0]!.items[0]!;
    missingEvidenceItem.candidate_text = "1 ถ้วย";
    missingEvidenceItem.selected_source = "owner_confirmation";
    missingEvidenceItem.decision_status = "confirmed_by_owner";
    missingEvidenceItem.decision_note = "เจ้าของยืนยันวันที่ 2026-08-07 ว่าข้อมูลนี้พร้อม";
    expect(() => validateKitchenSotTransition(source, null, missingEvidence, derivedFrom))
      .toThrow(/source_values\.owner_confirmation/u);

    const mismatchedCandidate = draft(source);
    const mismatchedItem = mismatchedCandidate.recipes[0]!.items[0]!;
    mismatchedItem.source_values.owner_confirmation = "1 ถ้วย";
    mismatchedItem.candidate_text = "2 ถ้วย";
    mismatchedItem.selected_source = "owner_confirmation";
    mismatchedItem.decision_status = "confirmed_by_owner";
    mismatchedItem.decision_note = "เจ้าของยืนยันวันที่ 2026-08-07 ว่าข้อมูลนี้พร้อม";
    expect(() => validateKitchenSotTransition(source, null, mismatchedCandidate, derivedFrom))
      .toThrow(/candidate_text/u);
  });

  test("scopes dirty records against previous V5 despite regenerated metadata", () => {
    const source = sourceDocument();
    const previous = draft(applyKitchenSotEdit(source, { kind: "yield", recipeId: 162, value: "ผลผลิตเดิม" }));
    const submitted = buildV5Draft(previous, "2026-08-07T04:00:00.000Z", derivedFrom);
    const inherited = submitted.recipes.find(({ recipe_id }) => recipe_id === 159)!.items
      .find(({ selected_source }) => selected_source === "owner_confirmation")!;
    expect(inherited.source_values.owner_confirmation).toBeUndefined();
    expect(() => validateKitchenSotTransition(source, previous, submitted, derivedFrom)).not.toThrow();
  });

  test("requires changed methods to select owner confirmation with a meaningful note", () => {
    const source = sourceDocument();
    const submitted = draft(source);
    const recipe = submitted.recipes.find(({ recipe_id }) => recipe_id === 162)!;
    recipe.method_candidate_text = "คลุกให้เข้ากัน";
    expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom)).toThrow(/method_selected_source/u);
    recipe.method_selected_source = "owner_confirmation";
    recipe.method_decision_note = " ";
    expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom)).toThrow(/method_decision_note/u);
  });

  test("permits raw serving and cost notes plus yield changes", () => {
    const source = sourceDocument();
    const item = source.recipes[0]!.items[0]!;
    const edited = applyKitchenSotEdit(
      applyKitchenSotEdit(
        applyKitchenSotEdit(source, { kind: "item-serving-note", recipeId: source.recipes[0]!.recipe_id, lineKey: item.line_key, value: "  แยกถ้วย  " }),
        { kind: "item-cost-basis", recipeId: source.recipes[0]!.recipe_id, lineKey: item.line_key, value: "  50 g  " },
      ),
      { kind: "yield", recipeId: source.recipes[0]!.recipe_id, value: "10 ที่" },
    );
    expect(() => validateKitchenSotTransition(source, null, draft(edited), derivedFrom)).not.toThrow();
  });

  test("rejects immutable fields, review-state mutation, and recipe identity reordering", () => {
    const source = sourceDocument();
    const immutable = draft(source);
    immutable.recipes[0]!.recipe_name = "rewritten";
    expect(() => validateKitchenSotTransition(source, null, immutable, derivedFrom)).toThrow(InvalidKitchenSotTransitionError);

    const review = draft(source);
    review.recipes[0]!.review_state = "approved";
    expect(() => validateKitchenSotTransition(source, null, review, derivedFrom)).toThrow(/review_state/u);

    const reordered = draft(source);
    [reordered.recipes[0], reordered.recipes[1]] = [reordered.recipes[1]!, reordered.recipes[0]!];
    expect(() => validateKitchenSotTransition(source, null, reordered, derivedFrom)).toThrow(/recipe_id/u);
  });

  test("preserves numeric/string recipe and component identity types", () => {
    const source = sourceDocument();
    const recipeTypeChanged = draft(source);
    const numericRecipe = recipeTypeChanged.recipes.find(({ recipe_id }) => typeof recipe_id === "number")!;
    numericRecipe.recipe_id = String(numericRecipe.recipe_id);
    expect(() => validateKitchenSotTransition(source, null, recipeTypeChanged, derivedFrom)).toThrow(/recipe_id/u);

    const componentTypeChanged = draft(source);
    const item = componentTypeChanged.recipes.flatMap(({ items }) => items)
      .find(({ component_recipe_id }) => typeof component_recipe_id === "number")!;
    item.component_recipe_id = String(item.component_recipe_id);
    expect(() => validateKitchenSotTransition(source, null, componentTypeChanged, derivedFrom))
      .toThrow(/component_recipe_id/u);
  });

  test("allows only owner_confirmation in source_values and preserves existing key order", () => {
    const source = sourceDocument();
    const foreignKey = draft(source);
    foreignKey.recipes[0]!.items[0]!.source_values.extra = "invented";
    expect(() => validateKitchenSotTransition(source, null, foreignKey, derivedFrom)).toThrow(/source_values/u);

    const reordered = draft(source);
    const item = reordered.recipes[0]!.items[0]!;
    item.source_values = Object.fromEntries(Object.entries(item.source_values).reverse());
    expect(() => validateKitchenSotTransition(source, null, reordered, derivedFrom)).toThrow(/source_values/u);
  });

  test("rejects reordered top-level and recipe mutable keys", () => {
    const source = sourceDocument();
    const topLevel = moveKeyToEnd(draft(source), "generated_at");
    expect(() => validateKitchenSotTransition(source, null, topLevel, derivedFrom)).toThrow(/order/u);

    const recipe = draft(source);
    recipe.recipes[0] = moveKeyToEnd(recipe.recipes[0]!, "method_candidate_text");
    expect(() => validateKitchenSotTransition(source, null, recipe, derivedFrom)).toThrow(/order/u);
  });

  test("rejects reordered item and already-resolved blocker mutable keys", () => {
    const source = sourceDocument();
    const item = draft(source);
    item.recipes[0]!.items[0] = moveKeyToEnd(item.recipes[0]!.items[0]!, "candidate_text");
    expect(() => validateKitchenSotTransition(source, null, item, derivedFrom)).toThrow(/order/u);

    const previous = draft(applyKitchenSotEdit(source, {
      kind: "resolve-blocker", recipeId: 162, blockerIndex: 0,
      note: "ครัวยืนยันแล้ว", resolvedAt: "2026-08-07T03:30:00.000Z",
    }));
    const submitted = buildV5Draft(previous, "2026-08-07T04:00:00.000Z", derivedFrom);
    const blocker = submitted.recipes.find(({ recipe_id }) => recipe_id === 162)!.blockers[0]!;
    submitted.recipes.find(({ recipe_id }) => recipe_id === 162)!.blockers[0] =
      moveKeyToEnd(blocker, "resolved");
    expect(() => validateKitchenSotTransition(source, previous, submitted, derivedFrom)).toThrow(/order/u);
  });

  test("rejects array length changes and item identity reordering", () => {
    const source = sourceDocument();
    const shortened = draft(source);
    shortened.recipes[0]!.items.pop();
    expect(() => validateKitchenSotTransition(source, null, shortened, derivedFrom)).toThrow(/items/u);

    const reordered = draft(source);
    const items = reordered.recipes.find(({ items: recipeItems }) => recipeItems.length > 1)!.items;
    [items[0], items[1]] = [items[1]!, items[0]!];
    expect(() => validateKitchenSotTransition(source, null, reordered, derivedFrom)).toThrow(/line_key/u);
  });

  test("requires blocker evidence preservation and complete resolution metadata", () => {
    const source = sourceDocument();
    const rewritten = draft(source);
    const blocker = rewritten.recipes.find(({ blockers }) => blockers.length > 0)!.blockers[0]!;
    blocker.message = "rewritten evidence";
    expect(() => validateKitchenSotTransition(source, null, rewritten, derivedFrom)).toThrow(/message/u);

    const partial = draft(source);
    const partialBlocker = partial.recipes.find(({ blockers }) => blockers.length > 0)!.blockers[0]!;
    partialBlocker.resolved = true;
    expect(() => validateKitchenSotTransition(source, null, partial, derivedFrom)).toThrow(/resolved_note/u);
  });

  test("enforces the missing-method owner-N/A guard server-side", () => {
    const source = sourceDocument();
    const submitted = draft(source);
    const recipe = submitted.recipes.find(({ recipe_id }) => recipe_id === 162)!;
    const blocker = recipe.blockers.find(({ code }) => code === "missing_method")!;
    blocker.resolved = true;
    blocker.resolved_note = "เจ้าของยืนยันว่าไม่ต้องมีวิธีทำ (N/A): สูตรนี้เป็นผงแห้งพร้อมใช้";
    blocker.resolved_at = "2026-08-07T03:30:00.000Z";
    expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom)).not.toThrow();

    blocker.resolved_note = "ติ๊กว่าแก้แล้ว";
    expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom)).toThrow(/N\/A/u);
  });

  test("requires exact generated metadata", () => {
    const source = sourceDocument();
    const submitted = draft(source);
    submitted.schema_version = "wrong";
    expect(() => validateKitchenSotTransition(source, null, submitted, derivedFrom)).toThrow(/schema_version/u);

    const wrongProvenance = draft(source);
    wrongProvenance.derived_from = { path: derivedFrom.path, sha256: "wrong" };
    expect(() => validateKitchenSotTransition(source, null, wrongProvenance, derivedFrom)).toThrow(/derived_from/u);
  });

  test("rejects impossible calendar timestamps in file and blocker metadata", () => {
    const source = sourceDocument();
    const impossibleGeneratedAt = draft(source);
    impossibleGeneratedAt.generated_at = "2026-02-29T03:31:00.000Z";
    expect(() => validateKitchenSotTransition(source, null, impossibleGeneratedAt, derivedFrom))
      .toThrow(/generated_at/u);

    const impossibleResolvedAt = draft(source);
    const blocker = impossibleResolvedAt.recipes.find(({ blockers }) => blockers.length > 0)!.blockers[0]!;
    blocker.resolved = true;
    blocker.resolved_note = "ครัวยืนยันแล้ว";
    blocker.resolved_at = "2026-04-31T03:30:00.000Z";
    expect(() => validateKitchenSotTransition(source, null, impossibleResolvedAt, derivedFrom))
      .toThrow(/resolved_at/u);
  });
});
