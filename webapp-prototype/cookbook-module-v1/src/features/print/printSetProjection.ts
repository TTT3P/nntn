import type { RecipeIdentity, RecipeVersion } from "../../domain/cookbook/types";
import { buildRecipeGraph, dependencyFirstOrder } from "../../domain/graph/recipeGraph";
import { recipePrintCollectionKey, type PrintCollectionKey } from "./printCollections";

export type PrintSetMode =
  | { kind: "collection"; collectionKey: PrintCollectionKey }
  | { kind: "daily" }
  | { kind: "manual"; dependencyPolicy: "reference" | "include" };

export interface PrintSetProjection {
  fullRecipes: RecipeVersion[];
  externalReferences: RecipeVersion[];
  duplicateFree: boolean;
}

function identityKey(recipeId: RecipeIdentity): string {
  return `${typeof recipeId}:${String(recipeId)}`;
}

function selectedRecipes(
  recipesByIdentity: Map<string, RecipeVersion>,
  selectedRecipeIds: RecipeIdentity[],
): RecipeVersion[] {
  return selectedRecipeIds.flatMap((recipeId) => {
    const recipe = recipesByIdentity.get(identityKey(recipeId));
    return recipe === undefined ? [] : [recipe];
  });
}

function reachableRecipes(
  recipes: RecipeVersion[],
  selectedRecipeIds: RecipeIdentity[],
  recipesByIdentity: Map<string, RecipeVersion>,
): RecipeVersion[] {
  const graph = buildRecipeGraph(recipes, selectedRecipeIds);
  return dependencyFirstOrder(graph).flatMap((nodeId) => {
    const recipeId = graph.nodes.get(nodeId)?.recipeId;
    if (recipeId === null || recipeId === undefined) return [];
    const recipe = recipesByIdentity.get(identityKey(recipeId));
    return recipe === undefined ? [] : [recipe];
  });
}

function isDuplicateFree(
  fullRecipes: RecipeVersion[],
  externalReferences: RecipeVersion[],
): boolean {
  const identities = [...fullRecipes, ...externalReferences]
    .map(({ recipeId }) => identityKey(recipeId));
  return new Set(identities).size === identities.length;
}

export function projectPrintSet(
  recipes: RecipeVersion[],
  selectedRecipeIds: RecipeIdentity[],
  mode: PrintSetMode,
): PrintSetProjection {
  const recipesByIdentity = new Map(
    recipes.map((recipe) => [identityKey(recipe.recipeId), recipe]),
  );

  let fullRecipes: RecipeVersion[];
  let externalReferences: RecipeVersion[] = [];

  if (mode.kind === "collection") {
    fullRecipes = selectedRecipes(recipesByIdentity, selectedRecipeIds)
      .filter((recipe) => recipePrintCollectionKey(recipe) === mode.collectionKey);
    const graph = buildRecipeGraph(recipes, fullRecipes.map(({ recipeId }) => recipeId));
    const referenceKeys = new Set<string>();
    externalReferences = graph.rootIds.flatMap((rootId) => (
      [...(graph.edges.get(rootId) ?? [])].flatMap((dependencyId) => {
        const recipeId = graph.nodes.get(dependencyId)?.recipeId;
        if (recipeId === null || recipeId === undefined) return [];
        const recipe = recipesByIdentity.get(identityKey(recipeId));
        if (recipe === undefined || recipePrintCollectionKey(recipe) === mode.collectionKey) return [];
        const key = identityKey(recipe.recipeId);
        if (referenceKeys.has(key)) return [];
        referenceKeys.add(key);
        return [recipe];
      })
    ));
  } else if (mode.kind === "daily" || mode.dependencyPolicy === "include") {
    fullRecipes = reachableRecipes(recipes, selectedRecipeIds, recipesByIdentity);
  } else {
    fullRecipes = selectedRecipes(recipesByIdentity, selectedRecipeIds);
  }

  return {
    fullRecipes,
    externalReferences,
    duplicateFree: isDuplicateFree(fullRecipes, externalReferences),
  };
}
