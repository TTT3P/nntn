import { describe, expect, test } from "vitest";
import v1Source from "../../../../outputs/nntn-cookbook-import/NNTN-Kitchen-Cookbook-Import-v1.json";
import firstSetSource from "../../data/fixtures/first-set.json";
import type { RecipeLineLink, ReconciliationAction } from "./types";
import {
  assertDirectLineClosure,
  RecipeRelinkError,
  relinkRecipeIngredients,
  type RecipeRelinkDecision,
  type RecipeRelinkDecisionSet,
  type RelinkRecipeDocument,
} from "./relinkRecipeIngredients";

const SHA = "a".repeat(64);

function line(
  lineId: string,
  name: string,
  overrides: Partial<RelinkRecipeDocument["recipes"][number]["ingredients"][number]> = {},
) {
  return {
    lineId,
    name,
    kind: "ingredient" as const,
    amountText: " 15.0 ",
    unitText: "กรัม ",
    sourceDisplayText: " 15.0 กรัม ",
    ingredientId: null,
    componentRecipeId: null,
    servingNote: " ห้ามตัดช่องว่าง ",
    active: true,
    ...overrides,
  };
}

function documentWith(
  ingredients: RelinkRecipeDocument["recipes"][number]["ingredients"],
): RelinkRecipeDocument {
  return {
    schemaVersion: "6.0.0",
    generatedAt: "2026-08-11T00:00:00.000Z",
    derivedFrom: {
      v5Path: "fixtures/revision.json",
      v5Sha256: SHA,
      catalogSha256: "b".repeat(64),
    },
    recipes: [{
      recipeId: "recipe-main",
      active: true,
      ingredients,
    }, {
      recipeId: "recipe-component",
      active: true,
      ingredients: [],
    }],
  };
}

function decision(
  lineId: string,
  action: ReconciliationAction,
  overrides: Partial<RecipeRelinkDecision> = {},
): RecipeRelinkDecision {
  return {
    decisionId: `decision:${lineId}`,
    proposalId: `proposal:${lineId}`,
    manifestId: "manifest-first-set",
    sourceSha256: SHA,
    sourceRecordId: `source:${lineId}`,
    recipeId: "recipe-main",
    lineId,
    decidedBy: "owner-001",
    decidedAt: "2026-08-11T08:00:00.000Z",
    note: " หลักฐานเดิม byte-exact ",
    approvalState: "approved",
    action,
    ...overrides,
  };
}

function decisionSet(
  decisions: readonly RecipeRelinkDecision[],
  overrides: Partial<RecipeRelinkDecisionSet> = {},
): RecipeRelinkDecisionSet {
  return {
    sourceSha256: SHA,
    decisions,
    ingredients: [{
      ingredientId: "ing-oyster",
      primaryName: "ซอสหอยนางรมชื่อใหม่",
      status: "active",
    }],
    specifications: [{
      specificationId: "spec-mae-krua",
      ingredientId: "ing-oyster",
      label: "แม่ครัว ฉลากใหม่",
      status: "active",
      approvalState: "approved",
    }],
    ...overrides,
  };
}

function errorIssues(run: () => unknown) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RecipeRelinkError);
    return (error as RecipeRelinkError).issues;
  }
  throw new Error("expected RecipeRelinkError");
}

describe("relinkRecipeIngredients", () => {
  test("creates exactly one ingredient, component, or explicit-unmapped state per active direct line", () => {
    const document = documentWith([
      line("line-ingredient", "ซอสหอยนางรม แม่ครัว"),
      line("line-component", "ข้าวหุงสุก"),
      line("line-unmapped", "วัตถุดิบรอตรวจ"),
    ]);
    const decisions = decisionSet([
      decision("line-unmapped", { type: "mark_unmapped", reason: " รอเจ้าของยืนยัน " }),
      decision("line-component", {
        type: "link_component_recipe",
        componentRecipeId: "recipe-component",
      }),
      decision("line-ingredient", {
        type: "link_ingredient",
        ingredientId: "ing-oyster",
        requiredSpecificationId: "spec-mae-krua",
      }),
    ]);

    const result = relinkRecipeIngredients(document, decisions);

    expect(result.links.map(({ state }) => state)).toEqual([
      "ingredient",
      "component",
      "unmapped",
    ]);
    expect(new Set(result.links.map(({ recipeId, lineId }) => `${recipeId}:${lineId}`)))
      .toHaveLength(3);
    expect(result.issues).toEqual([]);
  });

  test("never converts display-name equality into identity without an explicit approved decision", () => {
    const document = documentWith([line("line-name-match", "ซอสหอยนางรมชื่อใหม่")]);

    expect(errorIssues(() => relinkRecipeIngredients(document, decisionSet([]))))
      .toEqual([expect.objectContaining({
        code: "MISSING_RELINK_DECISION",
        recipeId: "recipe-main",
        lineId: "line-name-match",
      })]);
  });

  test("indexes decisions by source SHA, recipe ID, and line ID", () => {
    const document = documentWith([line("line-indexed", "ซอสหอยนางรม")]);
    const wrongRevision = decision("line-indexed", {
      type: "link_ingredient",
      ingredientId: "ing-oyster",
      requiredSpecificationId: null,
    }, { sourceSha256: "f".repeat(64) });

    expect(errorIssues(() => relinkRecipeIngredients(
      document,
      decisionSet([wrongRevision]),
    )).map(({ code }) => code)).toEqual([
      "MISSING_RELINK_DECISION",
      "UNUSED_RELINK_DECISION",
    ]);
  });

  test("rejects a decision set bound to another immutable recipe revision", () => {
    const document = documentWith([line("line-indexed", "ซอสหอยนางรม")]);
    const anotherSha = "e".repeat(64);
    const anotherRevision = decision("line-indexed", {
      type: "link_ingredient",
      ingredientId: "ing-oyster",
      requiredSpecificationId: null,
    }, { sourceSha256: anotherSha });

    expect(errorIssues(() => relinkRecipeIngredients(document, decisionSet(
      [anotherRevision],
      { sourceSha256: anotherSha },
    ))).map(({ code }) => code)).toEqual(["SOURCE_REVISION_MISMATCH"]);
  });

  test("rejects component payloads carrying an ingredient ID or naming a missing recipe", () => {
    const document = documentWith([line("line-component", "ข้าวหุงสุก")]);
    const withIngredientId = {
      ...decision("line-component", {
        type: "link_component_recipe",
        componentRecipeId: "recipe-component",
      }),
      action: {
        type: "link_component_recipe",
        componentRecipeId: "recipe-component",
        ingredientId: "ing-forbidden",
      },
    } as unknown as RecipeRelinkDecision;
    const missingRecipe = decision("line-component", {
      type: "link_component_recipe",
      componentRecipeId: "recipe-missing",
    });

    expect(errorIssues(() => relinkRecipeIngredients(
      document,
      decisionSet([withIngredientId]),
    )).map(({ code }) => code)).toEqual(["INVALID_COMPONENT_PAYLOAD"]);
    expect(errorIssues(() => relinkRecipeIngredients(
      document,
      decisionSet([missingRecipe]),
    )).map(({ code }) => code)).toEqual(["MISSING_COMPONENT_RECIPE"]);
  });

  test("preserves recipe evidence and historical label byte-exact after a master rename", () => {
    const sourceLine = line("line-oyster", "ซอสหอยนางรม แม่ครัว ");
    const document = documentWith([sourceLine]);
    const approved = decision("line-oyster", {
      type: "link_ingredient",
      ingredientId: "ing-oyster",
      requiredSpecificationId: "spec-mae-krua",
    });

    const historical = relinkRecipeIngredients(document, decisionSet([approved])).links[0]!;
    const newlyAuthored = relinkRecipeIngredients(
      documentWith([line("line-oyster", "แม่ครัว ฉลากใหม่")]),
      decisionSet([approved]),
    ).links[0]!;

    expect(historical).toMatchObject({
      amountText: " 15.0 ",
      unitText: "กรัม ",
      sourceDisplayText: " 15.0 กรัม ",
      servingNote: " ห้ามตัดช่องว่าง ",
      historicalLabel: "ซอสหอยนางรม แม่ครัว ",
      decisionEvidence: approved,
    });
    expect(historical.historicalLabel).not.toBe("แม่ครัว ฉลากใหม่");
    expect(newlyAuthored.historicalLabel).toBe("แม่ครัว ฉลากใหม่");
  });

  test("resolves inactive specifications historically with a deterministic replacement warning", () => {
    const document = documentWith([line("line-oyster", "ซอสหอยนางรม แม่ครัว")]);
    const approved = decision("line-oyster", {
      type: "link_ingredient",
      ingredientId: "ing-oyster",
      requiredSpecificationId: "spec-mae-krua",
    });
    const decisions = decisionSet([approved], {
      specifications: [{
        specificationId: "spec-mae-krua",
        ingredientId: "ing-oyster",
        label: "แม่ครัว ฉลากใหม่",
        status: "inactive",
        approvalState: "approved",
      }],
    });

    const result = relinkRecipeIngredients(document, decisions);

    expect(result.links[0]).toMatchObject({
      state: "ingredient",
      requiredSpecificationId: "spec-mae-krua",
      historicalLabel: "ซอสหอยนางรม แม่ครัว",
    });
    expect(result.issues).toEqual([{
      code: "INACTIVE_SPECIFICATION_REPLACEMENT_REQUIRED",
      sourceSha256: SHA,
      recipeId: "recipe-main",
      lineId: "line-oyster",
      decisionId: "decision:line-oyster",
      specificationId: "spec-mae-krua",
    }]);
  });

  test("keeps inactive source lines as evidence without making them active dependencies", () => {
    const inactive = line("line-removed", "ฉลากประวัติ ", { active: false });
    const document = documentWith([line("line-active", "ซอสหอยนางรม"), inactive]);
    const decisions = decisionSet([decision("line-active", {
      type: "link_ingredient",
      ingredientId: "ing-oyster",
      requiredSpecificationId: null,
    })]);

    const result = relinkRecipeIngredients(document, decisions);

    expect(result.links.map(({ lineId }) => lineId)).toEqual(["line-active"]);
    expect(result.sourceLines).toHaveLength(2);
    expect(result.sourceLines[1]).toEqual({ recipeId: "recipe-main", line: inactive });
    expect(result.sourceLines[1]!.line).not.toBe(inactive);
  });

  test("does not mutate the recipe document, decisions, or master lookup", () => {
    const document = documentWith([line("line-oyster", "ซอสหอยนางรม")]);
    const decisions = decisionSet([decision("line-oyster", {
      type: "link_ingredient",
      ingredientId: "ing-oyster",
      requiredSpecificationId: "spec-mae-krua",
    })]);
    const beforeDocument = JSON.stringify(document);
    const beforeDecisions = JSON.stringify(decisions);

    const result = relinkRecipeIngredients(document, decisions);
    (result.links[0]!.decisionEvidence.note as string) = "mutated output";

    expect(JSON.stringify(document)).toBe(beforeDocument);
    expect(JSON.stringify(decisions)).toBe(beforeDecisions);
  });
});

function closureLink(recipeId: string, lineId: string): RecipeLineLink {
  return {
    state: "unmapped",
    recipeId,
    lineId,
    sourceRecordId: `source:${lineId}`,
    reason: "closure evidence only",
    historicalLabel: "",
  };
}

describe("assertDirectLineClosure", () => {
  test("proves the frozen 426-line V1 direct inventory without dropped or duplicated lines", () => {
    const links = v1Source.recipe_items
      .filter(({ item_kind }) => item_kind === "direct_ingredient")
      .map(({ recipe_id, item_id }) => closureLink(String(recipe_id), String(item_id)));

    expect(links).toHaveLength(426);
    expect(() => assertDirectLineClosure(426, links)).not.toThrow();
  });

  test("proves the frozen 108-line first-set baseline without dropped or duplicated lines", () => {
    const links = firstSetSource.recipes.flatMap((recipe) => recipe.items
      .filter(({ item_kind }) => item_kind === "direct_ingredient")
      .map(({ line_key }) => closureLink(String(recipe.recipe_id), line_key)));

    expect(links).toHaveLength(108);
    expect(() => assertDirectLineClosure(108, links)).not.toThrow();
  });

  test("requires an explicit expected-count change for a later manifest with another inventory", () => {
    const baseline = firstSetSource.recipes.flatMap((recipe) => recipe.items
      .filter(({ item_kind }) => item_kind === "direct_ingredient")
      .map(({ line_key }) => closureLink(String(recipe.recipe_id), line_key)));
    const laterManifestLinks = [...baseline, closureLink("recipe-new", "line-new")];

    expect(() => assertDirectLineClosure(108, laterManifestLinks))
      .toThrow("RECIPE_LINE_CLOSURE_FAILED");
    expect(() => assertDirectLineClosure(109, laterManifestLinks)).not.toThrow();
    expect(() => assertDirectLineClosure(108, [...baseline.slice(0, -1), baseline[0]!]))
      .toThrow("RECIPE_LINE_CLOSURE_FAILED");
  });
});
