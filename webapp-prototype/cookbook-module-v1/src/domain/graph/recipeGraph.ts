import type {
  RecipeIdentity,
  RecipeKind,
  RecipeVersion,
} from "../cookbook/types";

export interface GraphNode {
  id: string;
  displayName: string;
  kind: RecipeKind | "direct_ingredient";
  recipeId: RecipeIdentity | null;
  ingredientId: number | null;
}

export interface RecipeGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, Set<string>>;
  rootIds: string[];
}

export class RecipeDependencyCycleError extends Error {
  readonly cycleNodeIds: string[];

  constructor(cycleNodeIds: string[], displayNames: string[]) {
    super(`Recipe dependency cycle: ${displayNames.join(" → ")}`);
    this.name = "RecipeDependencyCycleError";
    this.cycleNodeIds = cycleNodeIds;
  }
}

export class UnknownRecipeError extends Error {
  readonly recipeId: RecipeIdentity;

  constructor(recipeId: RecipeIdentity) {
    super(`Unknown recipe identity: ${String(recipeId)}`);
    this.name = "UnknownRecipeError";
    this.recipeId = recipeId;
  }
}

export class DuplicateRecipeIdentityError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly resolution: "root" | "component";
  readonly ownerRecipeId: RecipeIdentity | null;
  readonly lineKey: string | null;
  readonly recipeVersionIds: string[];

  constructor(
    recipeId: RecipeIdentity,
    matches: RecipeVersion[],
    context: { resolution: "root" | "component"; ownerRecipeId: RecipeIdentity | null; lineKey: string | null },
  ) {
    const location = context.resolution === "root"
      ? "selected root"
      : `component of ${String(context.ownerRecipeId)} at line ${String(context.lineKey)}`;
    super(
      `Duplicate recipe identity ${String(recipeId)} while resolving ${location}: ${matches.map((recipe) => recipe.recipeVersionId).join(", ")}`,
    );
    this.name = "DuplicateRecipeIdentityError";
    this.recipeId = recipeId;
    this.resolution = context.resolution;
    this.ownerRecipeId = context.ownerRecipeId;
    this.lineKey = context.lineKey;
    this.recipeVersionIds = matches.map((recipe) => recipe.recipeVersionId);
  }
}

export class DuplicateReachableRecipeVersionIdError extends Error {
  readonly recipeVersionId: string;
  readonly firstRecipeId: RecipeIdentity;
  readonly duplicateRecipeId: RecipeIdentity;

  constructor(first: RecipeVersion, duplicate: RecipeVersion) {
    super(
      `Duplicate reachable recipe version ${duplicate.recipeVersionId}: ${String(first.recipeId)} and ${String(duplicate.recipeId)}`,
    );
    this.name = "DuplicateReachableRecipeVersionIdError";
    this.recipeVersionId = duplicate.recipeVersionId;
    this.firstRecipeId = first.recipeId;
    this.duplicateRecipeId = duplicate.recipeId;
  }
}

export class UnresolvedRecipeDependencyError extends Error {
  readonly ownerRecipeId: RecipeIdentity;
  readonly lineKey: string;
  readonly componentRecipeId: RecipeIdentity | null;

  constructor(
    owner: RecipeVersion,
    lineKey: string,
    componentRecipeId: RecipeIdentity | null,
  ) {
    const reason =
      componentRecipeId === null
        ? "component recipe identity is null"
        : `component recipe identity not found: ${String(componentRecipeId)}`;
    super(
      `Unresolved dependency in recipe ${owner.name} (${String(owner.recipeId)}) at line ${lineKey}: ${reason}`,
    );
    this.name = "UnresolvedRecipeDependencyError";
    this.ownerRecipeId = owner.recipeId;
    this.lineKey = lineKey;
    this.componentRecipeId = componentRecipeId;
  }
}

export class DuplicateRecipeLineKeyError extends Error {
  readonly recipeId: RecipeIdentity;
  readonly lineKey: string;

  constructor(recipe: RecipeVersion, lineKey: string) {
    super(
      `Duplicate line key in recipe ${recipe.name} (${String(recipe.recipeId)}): ${lineKey}`,
    );
    this.name = "DuplicateRecipeLineKeyError";
    this.recipeId = recipe.recipeId;
    this.lineKey = lineKey;
  }
}

type GraphIntegrityViolation = "missing_node" | "missing_adjacency";

export class RecipeGraphIntegrityError extends Error {
  readonly nodeId: string;
  readonly violation: GraphIntegrityViolation;

  constructor(nodeId: string, violation: GraphIntegrityViolation) {
    const missingPart = violation === "missing_node" ? "node" : "adjacency";
    super(`Recipe graph integrity failure for ${nodeId}: missing ${missingPart}`);
    this.name = "RecipeGraphIntegrityError";
    this.nodeId = nodeId;
    this.violation = violation;
  }
}

function recipeNodeId(recipeId: RecipeIdentity): string {
  if (typeof recipeId === "number") return `recipe:${recipeId}`;
  return `recipe:string:${JSON.stringify(recipeId)}`;
}

function directIngredientNodeId(
  recipeNodeIdValue: string,
  lineKey: string,
  ingredientId: number | null,
): string {
  if (ingredientId !== null) return `ingredient:${ingredientId}`;
  return `ingredient-line:${JSON.stringify(recipeNodeIdValue)}:${JSON.stringify(lineKey)}`;
}

function validateUniqueLineKeys(recipe: RecipeVersion): void {
  const lineKeys = new Set<string>();
  for (const line of recipe.lines) {
    if (lineKeys.has(line.lineKey)) {
      throw new DuplicateRecipeLineKeyError(recipe, line.lineKey);
    }
    lineKeys.add(line.lineKey);
  }
}

export function buildRecipeGraph(
  recipes: RecipeVersion[],
  rootRecipeIds: RecipeIdentity[],
): RecipeGraph {
  const recipesByNodeId = new Map<string, RecipeVersion[]>();
  for (const recipe of recipes) {
    const nodeId = recipeNodeId(recipe.recipeId);
    const matches = recipesByNodeId.get(nodeId);
    if (matches) matches.push(recipe);
    else recipesByNodeId.set(nodeId, [recipe]);
  }
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, Set<string>>();
  const expandedRecipeIds = new Set<string>();
  const reachableByVersionId = new Map<string, RecipeVersion>();

  const addRecipe = (
    recipeId: RecipeIdentity,
    context: { resolution: "root" | "component"; ownerRecipeId: RecipeIdentity | null; lineKey: string | null },
  ): string => {
    const nodeId = recipeNodeId(recipeId);
    const matches = recipesByNodeId.get(nodeId);
    if (!matches || matches.length === 0) throw new UnknownRecipeError(recipeId);
    if (matches.length > 1) {
      throw new DuplicateRecipeIdentityError(recipeId, matches, context);
    }
    const recipe = matches[0];

    if (expandedRecipeIds.has(nodeId)) return nodeId;
    const matchingVersion = reachableByVersionId.get(recipe.recipeVersionId);
    if (matchingVersion && recipeNodeId(matchingVersion.recipeId) !== nodeId) {
      throw new DuplicateReachableRecipeVersionIdError(matchingVersion, recipe);
    }
    reachableByVersionId.set(recipe.recipeVersionId, recipe);
    validateUniqueLineKeys(recipe);

    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, {
        id: nodeId,
        displayName: recipe.name,
        kind: recipe.kind,
        recipeId: recipe.recipeId,
        ingredientId: null,
      });
      edges.set(nodeId, new Set());
    }

    expandedRecipeIds.add(nodeId);

    const dependencies = edges.get(nodeId);
    if (!dependencies) throw new Error(`Missing graph edges for ${nodeId}`);

    for (const line of recipe.lines) {
      if (line.itemKind === "prepared_recipe") {
        if (
          line.componentRecipeId === null ||
          !recipesByNodeId.has(recipeNodeId(line.componentRecipeId))
        ) {
          throw new UnresolvedRecipeDependencyError(
            recipe,
            line.lineKey,
            line.componentRecipeId,
          );
        }
        dependencies.add(addRecipe(line.componentRecipeId, {
          resolution: "component",
          ownerRecipeId: recipe.recipeId,
          lineKey: line.lineKey,
        }));
        continue;
      }

      if (line.itemKind === "direct_ingredient") {
        const ingredientNodeId = directIngredientNodeId(
          nodeId,
          line.lineKey,
          line.ingredientId,
        );
        if (!nodes.has(ingredientNodeId)) {
          nodes.set(ingredientNodeId, {
            id: ingredientNodeId,
            displayName: line.itemName,
            kind: "direct_ingredient",
            recipeId: null,
            ingredientId: line.ingredientId,
          });
          edges.set(ingredientNodeId, new Set());
        }
        dependencies.add(ingredientNodeId);
      }
    }

    return nodeId;
  };

  return {
    nodes,
    edges,
    rootIds: rootRecipeIds.map((recipeId) => addRecipe(recipeId, {
      resolution: "root",
      ownerRecipeId: null,
      lineKey: null,
    })),
  };
}

export function dependencyFirstOrder(graph: RecipeGraph): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];

  const visit = (nodeId: string): void => {
    if (!graph.nodes.has(nodeId)) {
      throw new RecipeGraphIntegrityError(nodeId, "missing_node");
    }
    const dependencies = graph.edges.get(nodeId);
    if (!dependencies) {
      throw new RecipeGraphIntegrityError(nodeId, "missing_adjacency");
    }
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycleNodeIds = [...path.slice(cycleStart), nodeId];
      const displayNames = cycleNodeIds.map(
        (cycleNodeId) => graph.nodes.get(cycleNodeId)?.displayName ?? cycleNodeId,
      );
      throw new RecipeDependencyCycleError(cycleNodeIds, displayNames);
    }

    visiting.add(nodeId);
    path.push(nodeId);
    for (const dependencyId of dependencies) {
      visit(dependencyId);
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  };

  for (const rootId of graph.rootIds) visit(rootId);
  return order;
}
