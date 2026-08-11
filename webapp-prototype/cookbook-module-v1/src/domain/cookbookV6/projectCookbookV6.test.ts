import { describe, expect, test } from "vitest";
import catalogJson from "../../data/catalog/recipe-catalog-85.json";
import crosswalkJson from "../../data/catalog/v5-recipe-crosswalk.json";
import fixture from "../../data/fixtures/first-set.json";
import { withOwnerConfirmedEggRecipe } from "../../test/ownerConfirmedEggRecipe";
import { makeSnapshot } from "../../test/builders";
import { buildRecipeGraph } from "../graph/recipeGraph";
import { parseRecipeCatalog } from "../catalog/recipeCatalog";
import { parseKitchenSotDocument } from "../sot/kitchenSotDocument";
import { migrateV5ToV6 } from "./migrateV5ToV6";
import { projectCookbookV6 } from "./projectCookbookV6";

function v6Document() {
  return migrateV5ToV6({
    catalog: parseRecipeCatalog(catalogJson),
    v5: withOwnerConfirmedEggRecipe(parseKitchenSotDocument(fixture)),
    crosswalk: crosswalkJson,
    v5Sha256: "a".repeat(64),
    catalogSha256: "b".repeat(64),
    generatedAt: "2026-08-10T00:00:00.000Z",
  });
}

function dependencyNames(recipeId: string, snapshot: ReturnType<typeof projectCookbookV6>): string[] {
  const graph = buildRecipeGraph(snapshot.snapshot.recipes, [recipeId]);
  const rootId = graph.rootIds[0]!;
  return [...graph.edges.get(rootId)!].map((nodeId) => graph.nodes.get(nodeId)!.displayName);
}

describe("projectCookbookV6", () => {
  test("projects all 87 recipes and keeps removed dependencies excluded", () => {
    const projection = projectCookbookV6(v6Document(), makeSnapshot({ media: [], stepMedia: [] }));
    expect(projection.snapshot.recipes).toHaveLength(87);
    expect(dependencyNames("SRCP-014", projection)).not.toContain("ซอสอเนกประสงค์");
    expect(dependencyNames("SRCP-015", projection)).toContain("ซอสอเนกประสงค์");
  });

  test("preserves exact display quantities and marks blank catalog recipes as draft", () => {
    const projection = projectCookbookV6(v6Document(), makeSnapshot({ media: [], stepMedia: [] }));
    const egg = projection.snapshot.recipes.find(({ recipeId }) => recipeId === "RCP-026")!;
    expect(egg.lines.map(({ sourceText }) => sourceText)).toEqual(["2 ฟอง", "ครึ่งช้อนชา (2.5g)"]);
    expect(projection.recipeDraftById.get("RCP-026")).toBe(true);

    const blank = projection.snapshot.recipes.find(({ recipeId }) => recipeId === "RCP-011")!;
    expect(blank.lines).toEqual([]);
    expect(projection.recipeDraftById.get("RCP-011")).toBe(true);
  });
});
