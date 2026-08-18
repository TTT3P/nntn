import { Link, useParams } from "react-router-dom";
import type { CookbookSnapshot, RecipeIdentity, RecipeVersion } from "../../domain/cookbook/types";
import { buildRecipeGraph, dependencyFirstOrder, type GraphNode, type RecipeGraph } from "../../domain/graph/recipeGraph";
import { evaluateReadiness } from "../../domain/review/readiness";
import { projectKitchenSotPrintSnapshot } from "../../domain/sot/kitchenSotPrintProjection";
import { usePrototype } from "../../prototype/PrototypeProvider";
import { useOptionalCookbookDocument } from "../cookbook/CookbookDocumentProvider";
import { useOptionalKitchenSotDraft } from "../review/KitchenSotDraftProvider";
import { deriveRecipeMediaCoverage } from "./recipeMediaCoverage";
import { decodeRecipeIdentity, encodeRecipeIdentity } from "./recipeRoute";

function sameIdentity(left: RecipeIdentity, right: RecipeIdentity): boolean {
  return typeof left === typeof right && left === right;
}

function typeLabel(recipe: RecipeVersion): string {
  if (recipe.kind === "sellable_menu") return "เมนูขาย";
  if (recipe.kind === "sub_recipe") return "สูตรย่อย";
  return "สูตรเตรียม";
}

function visibleCode(recipe: RecipeVersion): string | null {
  return typeof recipe.recipeId === "string" && /^(?:RCP|SRCP)-/u.test(recipe.recipeId) ? recipe.recipeId : null;
}

function recipeDraft(recipe: RecipeVersion, snapshot: CookbookSnapshot, draftById: ReadonlyMap<RecipeIdentity, boolean> | null): boolean {
  const readiness = evaluateReadiness(recipe, deriveRecipeMediaCoverage(recipe, snapshot).coverage);
  return draftById === null ? readiness.draft : (draftById.get(recipe.recipeId) ?? true);
}

function uniqueSteps(recipe: RecipeVersion) {
  const stageOrder = new Map([
    ["prep", 0],
    ["cook", 1],
    ["service", 2],
  ] as const);
  const seen = new Set<string>();
  return Object.values(recipe.workDocuments)
    .flatMap(({ steps }) => steps)
    .toSorted((left, right) =>
      (stageOrder.get(left.stage) ?? Number.MAX_SAFE_INTEGER)
      - (stageOrder.get(right.stage) ?? Number.MAX_SAFE_INTEGER)
      || left.order - right.order,
    )
    .filter(({ stepId }) => {
      if (seen.has(stepId)) return false;
      seen.add(stepId);
      return true;
    });
}

function BlankSection({ title }: { title: string }) {
  return <div className="blank-content"><strong>{title}</strong><span>ทีมครัวเติมภายหลัง</span></div>;
}

export function RecipeDetailPage() {
  const { recipeId: routeSegment } = useParams();
  const { snapshot: sessionSnapshot } = usePrototype();
  const cookbookDocument = useOptionalCookbookDocument();
  const kitchenSotDraft = useOptionalKitchenSotDraft();
  let snapshot = sessionSnapshot;
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
  const identity = routeSegment === undefined ? null : decodeRecipeIdentity(routeSegment);
  const recipe = identity === null ? undefined : snapshot.recipes.find((candidate) => sameIdentity(candidate.recipeId, identity));
  if (recipe === undefined) {
    return <section role="alert"><h1>ไม่พบสูตรอาหาร</h1><p>สูตรนี้ไม่มีอยู่ในคลัง</p><Link to="/recipes">กลับไปสูตรอาหาร</Link></section>;
  }

  let graph: RecipeGraph;
  let related: GraphNode[];
  try {
    graph = buildRecipeGraph(snapshot.recipes, [recipe.recipeId]);
    related = dependencyFirstOrder(graph).map((nodeId) => graph.nodes.get(nodeId)).filter(
      (node): node is GraphNode => node !== undefined && node.recipeId !== null && node.id !== graph.rootIds[0],
    );
  } catch {
    return <section role="alert"><h1>เปิดสูตรอาหารไม่ได้</h1><p>ข้อมูลสูตรที่เกี่ยวข้องยังไม่ครบ</p><Link to="/recipes">กลับไปสูตรอาหาร</Link></section>;
  }

  const encodedId = encodeRecipeIdentity(recipe.recipeId);
  const draft = recipeDraft(recipe, snapshot, draftById);
  const steps = uniqueSteps(recipe);
  const code = visibleCode(recipe);

  return (
    <article className="recipe-detail" aria-labelledby="recipe-detail-title">
      <Link to="/recipes">← กลับไปสูตรอาหาร</Link>
      <header className="recipe-detail__top">
        <p className="recipe-detail__eyebrow">{code ?? typeLabel(recipe)}</p>
        <h1 id="recipe-detail-title">{recipe.name}</h1>
        <div className="recipe-card__meta">
          <span className="type-pill">{typeLabel(recipe)}</span>
          <span className={`status-pill ${draft ? "status-pill--waiting" : "status-pill--ready"}`}>{draft ? "รอข้อมูล" : "พร้อมใช้"}</span>
        </div>
        <nav className="recipe-detail__actions" aria-label="จัดการสูตร">
          <Link className="button-link button-link--primary" to={`/recipes/${encodedId}/edit`}>แก้ไขสูตร</Link>
          <Link className="button-link" to={`/work/${encodedId}?stage=all`}>เปิดใบงาน</Link>
          <Link className="button-link" to={`/print?recipe=${encodeURIComponent(encodedId)}`}>พิมพ์</Link>
        </nav>
      </header>

      <section className="content-panel">
        <h2>ผลผลิต</h2>
        {recipe.yieldText === null || recipe.yieldText === "" ? <BlankSection title="ยังไม่มีข้อมูลผลผลิต" /> : <p>{recipe.yieldText}</p>}
      </section>

      <section className="content-panel">
        <h2>วัตถุดิบ</h2>
        {recipe.lines.length === 0 ? <BlankSection title="ยังไม่มีรายการวัตถุดิบ" /> : (
          <table className="ingredient-table">
            <thead><tr><th>วัตถุดิบ</th><th>ปริมาณ</th></tr></thead>
            <tbody>{recipe.lines.map((line) => (
              <tr key={line.lineKey}>
                <td>{line.itemKind === "prepared_recipe" && line.componentRecipeId !== null
                  ? <Link to={`/recipes/${encodeRecipeIdentity(line.componentRecipeId)}`}>{line.itemName}</Link>
                  : line.itemName}</td>
                <td>{line.sourceText ?? <span>ยังไม่ระบุ</span>}{line.servingNote !== null && <small>{line.servingNote}</small>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <section className="content-panel">
        <h2>วิธีทำ</h2>
        {steps.length === 0 ? <BlankSection title="ยังไม่มีวิธีทำ" /> : (
          <ol className="method-list">{steps.map((step) => <li key={step.stepId}>{step.instruction}</li>)}</ol>
        )}
      </section>

      {(recipe.operationalNotes.length > 0 || recipe.methodDecisionNote !== null) && (
        <section className="content-panel"><h2>หมายเหตุหน้าครัว</h2><ul>
          {recipe.operationalNotes.map((note) => <li key={note}>{note}</li>)}
          {recipe.methodDecisionNote !== null && <li>{recipe.methodDecisionNote}</li>}
        </ul></section>
      )}

      {related.length > 0 && (
        <section className="content-panel"><h2>สูตรที่ใช้ร่วมกัน</h2><nav aria-label="สูตรที่ใช้ร่วมกัน"><ul>
          {related.map((node) => <li key={node.id}><Link to={`/recipes/${encodeRecipeIdentity(node.recipeId as RecipeIdentity)}`}>{node.displayName}</Link></li>)}
        </ul></nav></section>
      )}
    </article>
  );
}
