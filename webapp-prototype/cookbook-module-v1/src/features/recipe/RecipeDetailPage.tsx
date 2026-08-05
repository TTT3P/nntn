import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  CookbookSnapshot,
  RecipeIdentity,
  RecipeVersion,
} from "../../domain/cookbook/types";
import { buildRecipeGraph, dependencyFirstOrder, type GraphNode } from "../../domain/graph/recipeGraph";
import { evaluateReadiness } from "../../domain/review/readiness";
import { usePrototype } from "../../prototype/PrototypeProvider";
import { deriveRecipeMediaCoverage } from "./recipeMediaCoverage";
import { decodeRecipeIdentity, encodeRecipeIdentity } from "./recipeRoute";

function sameIdentity(left: RecipeIdentity, right: RecipeIdentity): boolean {
  return typeof left === typeof right && left === right;
}

function kindLabel(node: GraphNode): string {
  if (node.kind === "sellable_menu") return "เมนูขาย";
  if (node.kind === "prepared_recipe") return "สูตรเตรียม";
  return "วัตถุดิบโดยตรง";
}

function recipeStatus(recipe: RecipeVersion, snapshot: CookbookSnapshot) {
  const mediaCoverage = deriveRecipeMediaCoverage(recipe, snapshot);
  return {
    readiness: evaluateReadiness(recipe, mediaCoverage.coverage),
    ...mediaCoverage,
  };
}

export function RecipeDetailPage() {
  const { recipeId: routeSegment } = useParams();
  const { snapshot } = usePrototype();
  const [expanded, setExpanded] = useState(false);
  const identity = routeSegment === undefined ? null : decodeRecipeIdentity(routeSegment);
  const recipe = identity === null
    ? undefined
    : snapshot.recipes.find((candidate) => sameIdentity(candidate.recipeId, identity));

  if (!recipe) {
    return (
      <section className="recipe-page recipe-error" role="alert">
        <h2>ไม่พบสูตรอาหาร</h2>
        <p>รหัสสูตรไม่ถูกต้องหรือไม่มีอยู่ในคลังสูตร</p>
        <Link to="/recipes">กลับไปคลังสูตรอาหาร</Link>
      </section>
    );
  }

  let graph;
  let order: string[];
  try {
    graph = buildRecipeGraph(snapshot.recipes, [recipe.recipeId]);
    order = dependencyFirstOrder(graph);
  } catch (error) {
    return (
      <section className="recipe-page recipe-error" role="alert">
        <h2>แสดงโครงสร้างสูตรไม่ได้</h2>
        <p>{error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ"}</p>
        <Link to="/recipes">กลับไปคลังสูตรอาหาร</Link>
      </section>
    );
  }

  const preparedLines = recipe.lines.filter((line) => line.itemKind === "prepared_recipe");
  const directLines = recipe.lines.filter((line) => line.itemKind === "direct_ingredient");
  const rootStatus = recipeStatus(recipe, snapshot);
  const relatedRecipeNodes = order
    .map((nodeId) => graph.nodes.get(nodeId))
    .filter(
      (node): node is GraphNode =>
        node !== undefined &&
        node.recipeId !== null &&
        node.id !== graph.rootIds[0],
    );

  return (
    <article className="recipe-page" aria-labelledby="recipe-detail-title">
      <Link to="/recipes">กลับไปคลังสูตรอาหาร</Link>
      <header>
        <h2 id="recipe-detail-title">{recipe.name}</h2>
        <div className="recipe-badges">
          <span>{recipe.kind === "sellable_menu" ? "เมนูขาย" : "สูตรเตรียม"}</span>
          <span>{rootStatus.readiness.draft ? "ฉบับร่าง" : "พร้อมใช้งาน"}</span>
          <span>{recipe.reviewState === "conflict" ? "แหล่งข้อมูลขัดแย้ง" : `แหล่งข้อมูล: ${recipe.reviewState}`}</span>
          {rootStatus.missingMedia && <span>รูปขั้นตอนไม่ครบ</span>}
          {rootStatus.mediaReviewNeeded && <span>รูปต้องตรวจสอบ</span>}
        </div>
      </header>

      <section>
        <h3>สูตรเตรียม</h3>
        {preparedLines.length === 0 ? <p>ไม่มีสูตรเตรียม</p> : (
          <ul>{preparedLines.map((line) => (
            <li key={line.lineKey}>
              {line.componentRecipeId === null ? line.itemName : (
                <Link to={`/recipes/${encodeRecipeIdentity(line.componentRecipeId)}`}>{line.itemName}</Link>
              )}
            </li>
          ))}</ul>
        )}
      </section>

      <section>
        <h3>วัตถุดิบโดยตรง</h3>
        {directLines.length === 0 ? <p>ไม่มีวัตถุดิบโดยตรง</p> : (
          <ul>{directLines.map((line) => <li key={line.lineKey}>{line.itemName}</li>)}</ul>
        )}
      </section>

      <section>
        <h3>สถานะโครงสร้างสูตร</h3>
        <ul className="recipe-graph-status">
          {order.map((nodeId) => {
            const node = graph.nodes.get(nodeId);
            if (!node) return null;
            const nodeRecipe = node.recipeId === null ? undefined : snapshot.recipes.find((candidate) => sameIdentity(candidate.recipeId, node.recipeId as RecipeIdentity));
            const nodeStatus = nodeRecipe
              ? recipeStatus(nodeRecipe, snapshot)
              : undefined;
            return (
              <li key={node.id}>
                <span>{node.displayName}</span> <span>{kindLabel(node)}</span>{" "}
                {nodeRecipe && nodeStatus ? (
                  <><span>{nodeStatus.readiness.draft ? "ฉบับร่าง" : "พร้อมใช้งาน"}</span>{" "}<span>{nodeRecipe.reviewState === "conflict" ? "แหล่งข้อมูลขัดแย้ง" : `แหล่งข้อมูล: ${nodeRecipe.reviewState}`}</span>{" "}{nodeStatus.missingMedia && <span>รูปขั้นตอนไม่ครบ</span>}{" "}{nodeStatus.mediaReviewNeeded && <span>รูปต้องตรวจสอบ</span>}</>
                ) : <span>ไม่ใช้สถานะสูตร</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {relatedRecipeNodes.length > 0 && (
        <section>
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
            {expanded ? "ซ่อนสูตรที่เกี่ยวข้อง" : "แสดงสูตรที่เกี่ยวข้อง"}
          </button>
          {expanded && (
            <nav aria-label="โครงสร้างสูตรที่เกี่ยวข้อง">
              <ul>{relatedRecipeNodes.map((node) => (
                <li key={node.id}><Link to={`/recipes/${encodeRecipeIdentity(node.recipeId as RecipeIdentity)}`}>{node.displayName}</Link></li>
              ))}</ul>
            </nav>
          )}
        </section>
      )}
    </article>
  );
}
