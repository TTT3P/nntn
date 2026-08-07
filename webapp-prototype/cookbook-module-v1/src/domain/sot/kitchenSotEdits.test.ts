import { describe, expect, test } from "vitest";
import fixture from "../../data/fixtures/first-set.json";
import { parseKitchenSotDocument } from "./kitchenSotDocument";
import {
  InvalidKitchenSotEditError,
  KitchenSotIdentityNotFoundError,
  applyKitchenSotEdit,
  buildV5Draft,
  type DerivedFrom,
} from "./kitchenSotEdits";

const derivedFrom: DerivedFrom = {
  path: "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json",
  sha256: "abc123",
};

function getRecipe(recipeId: number | string) {
  const recipe = parseKitchenSotDocument(fixture).recipes.find(({ recipe_id }) => recipe_id === recipeId);
  if (!recipe) throw new Error(`fixture recipe ${recipeId} missing`);
  return recipe;
}

describe("Kitchen SOT explicit edits", () => {
  test("writes owner confirmation with owner-specific status and the exact dated note", () => {
    const base = parseKitchenSotDocument(fixture);
    const fixtureItem = getRecipe(164).items.find(({ item_name }) => item_name === "แป้งมันฮ่องกง")!;
    const edited = applyKitchenSotEdit(base, {
      kind: "item-owner-confirmation",
      recipeId: 164,
      lineKey: fixtureItem.line_key,
      value: "1 ช้อนโต๊ะ",
      confirmedOn: "2026-08-07",
    });
    const item = edited.recipes.find(({ recipe_id }) => recipe_id === 164)!
      .items.find(({ line_key }) => line_key === fixtureItem.line_key)!;
    expect(item.source_values.owner_confirmation).toBe("1 ช้อนโต๊ะ");
    expect(item.candidate_text).toBe("1 ช้อนโต๊ะ");
    expect(item.selected_source).toBe("owner_confirmation");
    expect(item.decision_status).toBe("confirmed_by_owner");
    expect(item.decision_note).toBe(
      "เจ้าของยืนยันวันที่ 2026-08-07 ว่าเนื้อตุ๋น (ราดข้าว) ใช้แป้งมันฮ่องกง 1 ช้อนโต๊ะ",
    );
    expect(base).toEqual(parseKitchenSotDocument(fixture));
  });

  test("writes serving and cost notes as unchanged raw strings", () => {
    const base = parseKitchenSotDocument(fixture);
    const fixtureItem = getRecipe(159).items[0]!;
    const serving = "  เสิร์ฟแยก 1 ถ้วย  ";
    const cost = "  ใช้คิดต้นทุน 45 g  ";
    const withServing = applyKitchenSotEdit(base, {
      kind: "item-serving-note", recipeId: 159, lineKey: fixtureItem.line_key, value: serving,
    });
    const edited = applyKitchenSotEdit(withServing, {
      kind: "item-cost-basis", recipeId: 159, lineKey: fixtureItem.line_key, value: cost,
    });
    const item = edited.recipes.find(({ recipe_id }) => recipe_id === 159)!.items[0]!;
    expect(item.serving_note).toBe(serving);
    expect(item.cost_basis_text).toBe(cost);
  });

  test("allows optional serving and cost notes to be cleared with an empty raw string", () => {
    const base = parseKitchenSotDocument(fixture);
    const fixtureItem = getRecipe(159).items.find(({ serving_note }) => typeof serving_note === "string")!;
    const withoutServing = applyKitchenSotEdit(base, {
      kind: "item-serving-note", recipeId: 159, lineKey: fixtureItem.line_key, value: "",
    });
    const edited = applyKitchenSotEdit(withoutServing, {
      kind: "item-cost-basis", recipeId: 159, lineKey: fixtureItem.line_key, value: "",
    });
    const item = edited.recipes.find(({ recipe_id }) => recipe_id === 159)!
      .items.find(({ line_key }) => line_key === fixtureItem.line_key)!;
    expect(item.serving_note).toBe("");
    expect(item.cost_basis_text).toBe("");
  });

  test("requires a non-empty no-invention note for method edits and writes only approved method fields", () => {
    const base = parseKitchenSotDocument(fixture);
    expect(() => applyKitchenSotEdit(base, {
      kind: "method", recipeId: 162, value: "คลุกทุกอย่าง", decisionNote: "  ",
    })).toThrow(InvalidKitchenSotEditError);
    const edited = applyKitchenSotEdit(base, {
      kind: "method", recipeId: 162, value: "คลุกทุกอย่าง", decisionNote: "เจ้าของยืนยันวิธีทำ",
    });
    expect(edited.recipes.find(({ recipe_id }) => recipe_id === 162)).toMatchObject({
      method_candidate_text: "คลุกทุกอย่าง",
      method_selected_source: "owner_confirmation",
      method_decision_note: "เจ้าของยืนยันวิธีทำ",
    });
  });

  test("yield edits write only yield_candidate_text", () => {
    const base = parseKitchenSotDocument(fixture);
    const before = structuredClone(getRecipe(162));
    const edited = applyKitchenSotEdit(base, { kind: "yield", recipeId: 162, value: "ได้ 1 ถุง" });
    const after = edited.recipes.find(({ recipe_id }) => recipe_id === 162)!;
    expect(after.yield_candidate_text).toBe("ได้ 1 ถุง");
    expect({ ...after, yield_candidate_text: before.yield_candidate_text }).toEqual(before);
  });

  test("resolves a blocker without removing or rewriting evidence", () => {
    const base = parseKitchenSotDocument(fixture);
    const before = structuredClone(base.recipes.find(({ recipe_id }) => recipe_id === 162)!.blockers[0]!);
    const edited = applyKitchenSotEdit(base, {
      kind: "resolve-blocker", recipeId: 162, blockerIndex: 0,
      note: "ครัวยืนยันผลผลิตและวิธีเก็บแล้ว", resolvedAt: "2026-08-07T03:30:00.000Z",
    });
    const after = edited.recipes.find(({ recipe_id }) => recipe_id === 162)!.blockers[0]!;
    expect({ code: after.code, message: after.message }).toEqual({ code: before.code, message: before.message });
    expect(after).toMatchObject({
      resolved: true,
      resolved_note: "ครัวยืนยันผลผลิตและวิธีเก็บแล้ว",
      resolved_at: "2026-08-07T03:30:00.000Z",
    });
  });

  test("accepts a valid ISO timestamp with an explicit offset without normalizing it", () => {
    const base = parseKitchenSotDocument(fixture);
    const edited = applyKitchenSotEdit(base, {
      kind: "resolve-blocker", recipeId: 162, blockerIndex: 0,
      note: "ครัวยืนยันแล้ว", resolvedAt: "2026-08-07T10:30:00+07:00",
    });
    expect(edited.recipes.find(({ recipe_id }) => recipe_id === 162)!.blockers[0]!.resolved_at)
      .toBe("2026-08-07T10:30:00+07:00");
  });

  test("requires explicit owner N/A and constructs the missing-method resolution prefix", () => {
    const base = parseKitchenSotDocument(fixture);
    const blockerIndex = getRecipe(162).blockers.findIndex(({ code }) => code === "missing_method");
    const edit = {
      kind: "resolve-blocker" as const,
      recipeId: 162,
      blockerIndex,
      note: "สูตรนี้เป็นผงแห้งพร้อมใช้",
      resolvedAt: "2026-08-07T03:30:00.000Z",
    };
    expect(() => applyKitchenSotEdit(base, edit)).toThrow(InvalidKitchenSotEditError);
    const edited = applyKitchenSotEdit(base, { ...edit, ownerMethodNa: true });
    expect(edited.recipes.find(({ recipe_id }) => recipe_id === 162)!.blockers[blockerIndex]!.resolved_note)
      .toBe("เจ้าของยืนยันว่าไม่ต้องมีวิธีทำ (N/A): สูตรนี้เป็นผงแห้งพร้อมใช้");
  });

  test("rejects unknown identities, empty required text, invalid dates, and blocker bounds with named errors", () => {
    const base = parseKitchenSotDocument(fixture);
    expect(() => applyKitchenSotEdit(base, { kind: "yield", recipeId: 999, value: "x" }))
      .toThrow(KitchenSotIdentityNotFoundError);
    expect(() => applyKitchenSotEdit(base, { kind: "yield", recipeId: 162, value: " " }))
      .toThrow(InvalidKitchenSotEditError);
    const lineKey = getRecipe(164).items[0]!.line_key;
    expect(() => applyKitchenSotEdit(base, {
      kind: "item-owner-confirmation", recipeId: 164, lineKey, value: "x", confirmedOn: "07/08/2026",
    })).toThrow(InvalidKitchenSotEditError);
    expect(() => applyKitchenSotEdit(base, {
      kind: "resolve-blocker", recipeId: 162, blockerIndex: 99, note: "x", resolvedAt: "yesterday",
    })).toThrow(InvalidKitchenSotEditError);
  });
});

describe("V5 draft metadata", () => {
  test("replaces metadata deterministically and appends derived_from when absent", () => {
    const base = parseKitchenSotDocument(fixture);
    const beforeKeys = Object.keys(base);
    const draft = buildV5Draft(base, "2026-08-07T03:31:00.000Z", derivedFrom);
    expect(draft.schema_version).toBe("2.1.0-prototype-draft");
    expect(draft.generated_at).toBe("2026-08-07T03:31:00.000Z");
    expect(draft.derived_from).toEqual(derivedFrom);
    expect(Object.keys(draft)).toEqual([...beforeKeys, "derived_from"]);
    expect(base).toEqual(parseKitchenSotDocument(fixture));
  });

  test("preserves the key position of an existing derived_from while replacing its value", () => {
    const base = parseKitchenSotDocument(fixture);
    const entries = Object.entries(base);
    entries.splice(1, 0, ["derived_from", { path: derivedFrom.path, sha256: "old" }]);
    const withMetadata = Object.fromEntries(entries);
    const parsed = parseKitchenSotDocument(withMetadata);
    const beforeIndex = Object.keys(parsed).indexOf("derived_from");
    const draft = buildV5Draft(parsed, "2026-08-07T03:31:00.000Z", derivedFrom);
    expect(Object.keys(draft).indexOf("derived_from")).toBe(beforeIndex);
    expect(draft.derived_from).toEqual(derivedFrom);
  });
});
