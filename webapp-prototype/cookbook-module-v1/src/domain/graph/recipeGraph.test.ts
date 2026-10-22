import { beforeAll, describe, expect, test } from "vitest";
import { FixtureCookbookRepository } from "../../data/FixtureCookbookRepository";
import { makeIngredientLine, makeRecipe } from "../../test/builders";
import type {
  RecipeIdentity,
  RecipeVersion,
} from "../cookbook/types";
import {
  buildRecipeGraph,
  DuplicateReachableRecipeVersionIdError,
  DuplicateRecipeIdentityError,
  DuplicateRecipeLineKeyError,
  dependencyFirstOrder,
  RecipeDependencyCycleError,
  RecipeGraphIntegrityError,
  UnknownRecipeError,
  UnresolvedRecipeDependencyError,
} from "./recipeGraph";

const repository = new FixtureCookbookRepository();

let fixtures: RecipeVersion[];

beforeAll(async () => {
  fixtures = (await repository.loadSnapshot()).recipes;
});

function nodeIdForRecipe(
  graph: ReturnType<typeof buildRecipeGraph>,
  recipeId: RecipeIdentity,
): string | undefined {
  return [...graph.nodes.values()].find((node) => node.recipeId === recipeId)
    ?.id;
}

function thrownBy(operation: () => unknown): Error {
  try {
    operation();
  } catch (error) {
    if (error instanceof Error) return error;
    throw new Error("Expected an Error instance", { cause: error });
  }
  throw new Error("Expected operation to throw");
}

describe("recipe graph", () => {
  test("rejects an ambiguous selected root identity with revision context", () => {
    const first = makeRecipe({ recipeId: 1, recipeVersionId: "root-v1" });
    const second = makeRecipe({ recipeId: 1, recipeVersionId: "root-v2" });

    expect(() => buildRecipeGraph([first, second], [1])).toThrowError(
      expect.objectContaining({
        name: "DuplicateRecipeIdentityError",
        recipeId: 1,
        resolution: "root",
        recipeVersionIds: ["root-v1", "root-v2"],
      }),
    );
    expect(() => buildRecipeGraph([first, second], [1])).toThrow(DuplicateRecipeIdentityError);
  });

  test("rejects an ambiguous reachable component with owner and line context", () => {
    const root = makeRecipe({
      recipeId: "root",
      lines: [makeIngredientLine({ lineKey: "root:component", itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "component" })],
    });
    const first = makeRecipe({ recipeId: "component", recipeVersionId: "component-v1" });
    const second = makeRecipe({ recipeId: "component", recipeVersionId: "component-v2" });

    expect(() => buildRecipeGraph([root, first, second], ["root"])).toThrowError(
      expect.objectContaining({
        name: "DuplicateRecipeIdentityError",
        resolution: "component",
        ownerRecipeId: "root",
        lineKey: "root:component",
      }),
    );
  });

  test("ignores duplicate identities and versions outside the reachable graph", () => {
    const root = makeRecipe({ recipeId: "root", recipeVersionId: "root-v1" });
    const duplicateA = makeRecipe({ recipeId: "other", recipeVersionId: "other-v1" });
    const duplicateB = makeRecipe({ recipeId: "other", recipeVersionId: "other-v1" });

    expect(buildRecipeGraph([root, duplicateA, duplicateB], ["root"]).rootIds).toEqual([
      'recipe:string:"root"',
    ]);
  });

  test("rejects duplicate version IDs among distinct reachable recipes", () => {
    const root = makeRecipe({
      recipeId: "root",
      recipeVersionId: "same-version",
      lines: [makeIngredientLine({ itemKind: "prepared_recipe", ingredientId: null, componentRecipeId: "component" })],
    });
    const component = makeRecipe({ recipeId: "component", recipeVersionId: "same-version" });

    expect(() => buildRecipeGraph([root, component], ["root"])).toThrowError(
      expect.objectContaining({
        name: "DuplicateReachableRecipeVersionIdError",
        recipeVersionId: "same-version",
        firstRecipeId: "root",
        duplicateRecipeId: "component",
      }),
    );
    expect(() => buildRecipeGraph([root, component], ["root"])).toThrow(DuplicateReachableRecipeVersionIdError);
  });

  test("separates sellable menus, prepared recipes, and direct ingredients", () => {
    const graph = buildRecipeGraph(fixtures, [159]);

    expect(graph.nodes.get("recipe:159")?.kind).toBe("sellable_menu");
    expect(graph.nodes.get("recipe:158")?.kind).toBe("prepared_recipe");
    expect(
      [...graph.nodes.values()].some(
        (node) => node.kind === "direct_ingredient",
      ),
    ).toBe(true);
  });

  test("orders dependencies before the selected menu and deduplicates them", () => {
    const order = dependencyFirstOrder(buildRecipeGraph(fixtures, [159, 165]));

    expect(order.at(-1)).toBe("recipe:165");
    expect(new Set(order).size).toBe(order.length);
    for (const [recipeId, dependencies] of buildRecipeGraph(fixtures, [
      159,
      165,
    ]).edges) {
      for (const dependencyId of dependencies) {
        expect(order.indexOf(dependencyId)).toBeLessThan(
          order.indexOf(recipeId),
        );
      }
    }
  });

  test("excludes a removed component while retaining the same component where it is still used", () => {
    const removedGraph = buildRecipeGraph(fixtures, [156]);
    const activeGraph = buildRecipeGraph(fixtures, [157]);

    expect(nodeIdForRecipe(removedGraph, 14)).toBeUndefined();
    expect(nodeIdForRecipe(activeGraph, 14)).toBe("recipe:14");
    expect(activeGraph.edges.get("recipe:157")).toContain("recipe:14");
  });

  test("returns a cycle named by recipe instead of recursing forever", () => {
    const recipeA = makeRecipe({
      recipeId: 1,
      recipeVersionId: "cycle-a-v1",
      name: "สูตร A",
      lines: [
        makeIngredientLine({
          itemKind: "prepared_recipe",
          ingredientId: null,
          componentRecipeId: 2,
        }),
      ],
    });
    const recipeB = makeRecipe({
      recipeId: 2,
      recipeVersionId: "cycle-b-v1",
      name: "สูตร B",
      lines: [
        makeIngredientLine({
          itemKind: "prepared_recipe",
          ingredientId: null,
          componentRecipeId: 1,
        }),
      ],
    });
    const cyclicGraph = buildRecipeGraph([recipeA, recipeB], [1]);

    expect(() => dependencyFirstOrder(cyclicGraph)).toThrow(
      RecipeDependencyCycleError,
    );
    expect(() => dependencyFirstOrder(cyclicGraph)).toThrow(
      /สูตร A → สูตร B → สูตร A/,
    );
  });

  test("resolves string candidate recipes and all three incoming fixture edges", () => {
    const graph = buildRecipeGraph(fixtures, [165, 159, 37]);
    const jasmineRiceId = nodeIdForRecipe(
      graph,
      "candidate:prepared:ข้าวหอมมะลิหุงสุก",
    );
    const japaneseRiceId = nodeIdForRecipe(
      graph,
      "candidate:prepared:ข้าวญี่ปุ่นหุงสุก",
    );

    expect(jasmineRiceId).toBeDefined();
    expect(japaneseRiceId).toBeDefined();
    expect(jasmineRiceId).not.toBe("recipe:1");
    expect(graph.edges.get("recipe:165")).toContain(jasmineRiceId);
    expect(graph.edges.get("recipe:159")).toContain(japaneseRiceId);
    expect(graph.edges.get("recipe:37")).toContain(jasmineRiceId);
  });

  test("keeps numeric and numeric-looking string recipe identities distinct", () => {
    const numericRecipe = makeRecipe({ recipeId: 1, recipeVersionId: "numeric-v1", name: "สูตรตัวเลข" });
    const stringRecipe = makeRecipe({ recipeId: "1", recipeVersionId: "string-v1", name: "สูตรข้อความ" });
    const graph = buildRecipeGraph([numericRecipe, stringRecipe], [1, "1"]);
    const numericNodeId = nodeIdForRecipe(graph, 1);
    const stringNodeId = nodeIdForRecipe(graph, "1");

    expect(numericNodeId).toBe("recipe:1");
    expect(stringNodeId).toBeDefined();
    expect(stringNodeId).not.toBe(numericNodeId);
    expect(graph.rootIds).toEqual([numericNodeId, stringNodeId]);
  });

  test("rejects an unknown root with a named identity error", () => {
    const error = thrownBy(() => buildRecipeGraph([], ["missing-root"]));

    expect(error).toBeInstanceOf(UnknownRecipeError);
    expect(error).toMatchObject({
      name: "UnknownRecipeError",
      recipeId: "missing-root",
    });
    expect(error.message).toMatch(/missing-root/);
  });

  test("rejects a null prepared-recipe component with its owner and line key", () => {
    const owner = makeRecipe({
      recipeId: "owner:null",
      name: "สูตรเจ้าของ",
      lines: [
        makeIngredientLine({
          lineKey: "สูตรเจ้าของ:ส่วนประกอบที่หาย",
          itemKind: "prepared_recipe",
          ingredientId: null,
          componentRecipeId: null,
        }),
      ],
    });

    const error = thrownBy(() =>
      buildRecipeGraph([owner], [owner.recipeId]),
    );

    expect(error).toBeInstanceOf(UnresolvedRecipeDependencyError);
    expect(error).toMatchObject({
      name: "UnresolvedRecipeDependencyError",
      ownerRecipeId: "owner:null",
      lineKey: "สูตรเจ้าของ:ส่วนประกอบที่หาย",
      componentRecipeId: null,
    });
    expect(error.message).toMatch(
      /สูตรเจ้าของ.*owner:null.*สูตรเจ้าของ:ส่วนประกอบที่หาย/,
    );
  });

  test("rejects a dangling prepared-recipe identity with its owner and line key", () => {
    const owner = makeRecipe({
      recipeId: 7,
      name: "สูตรต้นทาง",
      lines: [
        makeIngredientLine({
          lineKey: "สูตรต้นทาง:สูตรปลายทาง",
          itemKind: "prepared_recipe",
          ingredientId: null,
          componentRecipeId: "missing:component",
        }),
      ],
    });

    const error = thrownBy(() => buildRecipeGraph([owner], [7]));

    expect(error).toBeInstanceOf(UnresolvedRecipeDependencyError);
    expect(error).toMatchObject({
      name: "UnresolvedRecipeDependencyError",
      ownerRecipeId: 7,
      lineKey: "สูตรต้นทาง:สูตรปลายทาง",
      componentRecipeId: "missing:component",
    });
    expect(error.message).toMatch(
      /สูตรต้นทาง.*7.*สูตรต้นทาง:สูตรปลายทาง.*missing:component/,
    );
  });

  test("deduplicates a known ingredient shared by multiple recipes", () => {
    const firstRecipe = makeRecipe({
      recipeId: 1,
      recipeVersionId: "first-v1",
      lines: [makeIngredientLine({ lineKey: "first:salt", ingredientId: 42 })],
    });
    const secondRecipe = makeRecipe({
      recipeId: 2,
      recipeVersionId: "second-v1",
      lines: [
        makeIngredientLine({ lineKey: "second:salt", ingredientId: 42 }),
      ],
    });
    const graph = buildRecipeGraph([firstRecipe, secondRecipe], [1, 2]);
    const ingredientNodes = [...graph.nodes.values()].filter(
      (node) => node.ingredientId === 42,
    );

    expect(ingredientNodes).toHaveLength(1);
    expect(graph.edges.get("recipe:1")).toContain(ingredientNodes[0]?.id);
    expect(graph.edges.get("recipe:2")).toContain(ingredientNodes[0]?.id);
  });

  test("isolates unknown ingredients by recipe and line key", () => {
    const firstRecipe = makeRecipe({
      recipeId: 1,
      recipeVersionId: "first-unknown-v1",
      lines: [
        makeIngredientLine({ lineKey: "shared:unknown", ingredientId: null }),
      ],
    });
    const secondRecipe = makeRecipe({
      recipeId: 2,
      recipeVersionId: "second-unknown-v1",
      lines: [
        makeIngredientLine({ lineKey: "shared:unknown", ingredientId: null }),
      ],
    });
    const graph = buildRecipeGraph([firstRecipe, secondRecipe], [1, 2]);
    const unknownIngredientIds = [...graph.nodes.values()]
      .filter(
        (node) =>
          node.kind === "direct_ingredient" && node.ingredientId === null,
      )
      .map((node) => node.id);

    expect(unknownIngredientIds).toHaveLength(2);
    expect(new Set(unknownIngredientIds).size).toBe(2);
  });

  test("rejects a selected recipe with duplicate line keys using exact context", () => {
    const recipe = makeRecipe({
      recipeId: 8,
      name: "สูตรซ้ำ",
      lines: [
        makeIngredientLine({ lineKey: "สูตรซ้ำ:ไม่ทราบ", ingredientId: null }),
        makeIngredientLine({ lineKey: "สูตรซ้ำ:ไม่ทราบ", ingredientId: null }),
      ],
    });

    const error = thrownBy(() => buildRecipeGraph([recipe], [8]));

    expect(error).toBeInstanceOf(DuplicateRecipeLineKeyError);
    expect(error).toMatchObject({
      name: "DuplicateRecipeLineKeyError",
      recipeId: 8,
      lineKey: "สูตรซ้ำ:ไม่ทราบ",
    });
    expect(error.message).toMatch(/สูตรซ้ำ.*8.*สูตรซ้ำ:ไม่ทราบ/);
  });

  test("ignores duplicate line keys in an unreachable recipe", () => {
    const validRecipe = makeRecipe({ recipeId: 1, name: "สูตรที่เลือก" });
    const unreachableRecipe = makeRecipe({
      recipeId: 8,
      name: "สูตรที่ไม่ถูกเลือก",
      lines: [
        makeIngredientLine({ lineKey: "unreachable:duplicate" }),
        makeIngredientLine({ lineKey: "unreachable:duplicate" }),
      ],
    });

    const graph = buildRecipeGraph([validRecipe, unreachableRecipe], [1]);

    expect([...graph.nodes.keys()]).toEqual(["recipe:1"]);
    expect(dependencyFirstOrder(graph)).toEqual(["recipe:1"]);
  });

  test("returns an empty graph and order without validating unrelated recipes", () => {
    const unrelatedRecipe = makeRecipe({
      recipeId: 8,
      name: "สูตรที่ไม่เกี่ยวข้อง",
      lines: [
        makeIngredientLine({ lineKey: "unrelated:duplicate" }),
        makeIngredientLine({ lineKey: "unrelated:duplicate" }),
      ],
    });

    const graph = buildRecipeGraph([unrelatedRecipe], []);

    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
    expect(graph.rootIds).toEqual([]);
    expect(dependencyFirstOrder(graph)).toEqual([]);
  });

  test("rejects traversal when a referenced graph node is missing", () => {
    const graph = buildRecipeGraph([makeRecipe({ recipeId: 1 })], [1]);
    graph.nodes.delete("recipe:1");

    const error = thrownBy(() => dependencyFirstOrder(graph));

    expect(error).toBeInstanceOf(RecipeGraphIntegrityError);
    expect(error).toMatchObject({
      name: "RecipeGraphIntegrityError",
      nodeId: "recipe:1",
      violation: "missing_node",
    });
    expect(error.message).toMatch(/recipe:1.*node/);
  });

  test("rejects traversal when a graph adjacency entry is missing", () => {
    const graph = buildRecipeGraph([makeRecipe({ recipeId: 1 })], [1]);
    graph.edges.delete("recipe:1");

    const error = thrownBy(() => dependencyFirstOrder(graph));

    expect(error).toBeInstanceOf(RecipeGraphIntegrityError);
    expect(error).toMatchObject({
      name: "RecipeGraphIntegrityError",
      nodeId: "recipe:1",
      violation: "missing_adjacency",
    });
    expect(error.message).toMatch(/recipe:1.*adjacency/);
  });

  test("encodes every JavaScript string identity without collisions", () => {
    const stringIdentities = [
      "1",
      "reserved:/?#[]@!$&'()*+,;=%",
      "ข้าวหอมมะลิ",
      "🍚",
      "\ud800",
    ];
    const recipes = [
      makeRecipe({ recipeId: 1, recipeVersionId: "identity-number-v1", name: "numeric" }),
      ...stringIdentities.map((recipeId, index) =>
        makeRecipe({ recipeId, recipeVersionId: `identity-string-${index}-v1`, name: `string ${JSON.stringify(recipeId)}` }),
      ),
    ];

    const graph = buildRecipeGraph(recipes, [1, ...stringIdentities]);
    const rootIds = graph.rootIds;

    expect(new Set(rootIds).size).toBe(rootIds.length);
    expect(rootIds[0]).toBe("recipe:1");
    expect(
      rootIds
        .slice(1)
        .every((nodeId) => nodeId.startsWith("recipe:string:")),
    ).toBe(true);
    expect(
      stringIdentities.map((identity) =>
        [...graph.nodes.values()].find((node) => node.recipeId === identity)
          ?.recipeId,
      ),
    ).toEqual(stringIdentities);
  });
});
