import { Link, useLocation, useParams } from "react-router-dom";
import type { CookbookSnapshot, IngredientLine, RecipeIdentity, RecipeVersion, WorkStage } from "../../domain/cookbook/types";
import { buildRecipeGraph, dependencyFirstOrder, UnknownRecipeError } from "../../domain/graph/recipeGraph";
import { evaluateReadiness } from "../../domain/review/readiness";
import { projectKitchenSotPrintSnapshot } from "../../domain/sot/kitchenSotPrintProjection";
import { projectWorkDocuments, type ProjectedWorkDocument } from "../../domain/work/workDocuments";
import { usePrototype } from "../../prototype/PrototypeProvider";
import { StepMediaEditor } from "../media/StepMediaEditor";
import { decodeRecipeIdentity, encodeRecipeIdentity } from "../recipe/recipeRoute";
import { deriveRecipeMediaCoverage } from "../recipe/recipeMediaCoverage";
import { useOptionalKitchenSotDraft } from "../review/KitchenSotDraftProvider";

const STAGES: WorkStage[] = ["prep", "cook", "service"];
const STAGE_LABELS: Record<WorkStage, string> = {
  prep: "ผลิตซอสและของเตรียม",
  cook: "ครัวปรุง / BOM",
  service: "จัดเสิร์ฟหน้าร้าน",
};

function sameIdentity(left: RecipeIdentity, right: RecipeIdentity): boolean {
  return typeof left === typeof right && left === right;
}

function identityKey(identity: RecipeIdentity): string {
  return typeof identity === "number"
    ? `number:${String(identity)}`
    : `string:${JSON.stringify(identity)}`;
}

function parseRequestedStage(search: string): WorkStage | "all" | null {
  const params = new URLSearchParams(search);
  const entries = [...params.entries()];
  if (entries.length === 0) return "all";
  if (entries.length !== 1 || entries[0]?.[0] !== "stage") return null;
  const stage = entries[0][1];
  return stage === "prep" || stage === "cook" || stage === "service" || stage === "all"
    ? stage
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}

function sourceFact(line: IngredientLine): string | null {
  if (line.sourceText !== null) return line.sourceText;
  if (line.sourceValue !== null && line.sourceUnit !== null) {
    return `${String(line.sourceValue)} ${line.sourceUnit}`;
  }
  return null;
}

function WorkRouteError() {
  return (
    <section role="alert" aria-labelledby="work-route-error-title">
      <h2 id="work-route-error-title">เปิดจุดงานไม่ได้</h2>
      <p>รหัสสูตรไม่ถูกต้องหรือไม่มีอยู่ในคลังสูตร</p>
      <Link to="/recipes">กลับไปคลังสูตรอาหาร</Link>
    </section>
  );
}

function reachableRecipes(
  snapshot: CookbookSnapshot,
  rootRecipeId: RecipeIdentity,
): { recipes: RecipeVersion[]; root: RecipeVersion } {
  const graph = buildRecipeGraph(snapshot.recipes, [rootRecipeId]);
  const order = dependencyFirstOrder(graph);
  let root: RecipeVersion | undefined;
  const recipes = order.flatMap((nodeId) => {
    const identity = graph.nodes.get(nodeId)?.recipeId;
    if (identity === null || identity === undefined) return [];
    const matches = snapshot.recipes.filter((candidate) => sameIdentity(candidate.recipeId, identity));
    if (matches.length !== 1) {
      throw new Error(`Reachable recipe identity did not resolve uniquely: ${String(identity)}`);
    }
    if (sameIdentity(matches[0].recipeId, rootRecipeId)) root = matches[0];
    return matches;
  });
  if (!root) throw new Error(`Reachable root recipe missing: ${String(rootRecipeId)}`);
  return { recipes, root };
}

// Shared raw readiness is authoritative whenever the Kitchen SOT provider is
// active. A missing raw identity must not silently become operationally ready.
// eslint-disable-next-line react-refresh/only-export-components
export function resolveWorkStageDraft(
  recipe: RecipeVersion,
  snapshot: CookbookSnapshot,
  rawDraftById: ReadonlyMap<RecipeIdentity, boolean> | null,
): boolean {
  if (rawDraftById !== null) return rawDraftById.get(recipe.recipeId) ?? true;
  return evaluateReadiness(
    recipe,
    deriveRecipeMediaCoverage(recipe, snapshot).coverage,
  ).draft;
}

function WorkDocumentView({
  document,
  recipe,
  snapshot,
  draft,
}: {
  document: ProjectedWorkDocument;
  recipe: RecipeVersion;
  snapshot: CookbookSnapshot;
  draft: boolean;
}) {
  const media = deriveRecipeMediaCoverage(recipe, snapshot);
  const hasOperationalFacts =
    document.operationalNotes.length > 0 ||
    document.yieldText !== null ||
    document.methodDecisionNote !== null;

  return (
    <article aria-labelledby={`work-document-${document.recipeVersionId}-${document.stage}`}>
      <h4 id={`work-document-${document.recipeVersionId}-${document.stage}`}>{document.recipeName}</h4>
      <p>{draft ? "DRAFT" : "พร้อมใช้งาน"}</p>
      {document.blockers.length > 0 && <ul aria-label={`ตัวขวางในเอกสารของ ${document.recipeName}`}>{document.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
      <div aria-label={`สถานะรูปของ ${document.recipeName}`}>
        {media.missingMedia && <p>รูปขั้นตอนไม่ครบ</p>}
        {media.mediaReviewNeeded && <p>รูปต้องตรวจสอบ</p>}
        {(media.missingMedia || media.mediaReviewNeeded) && <p>สถานะรูปไม่ทำให้เอกสารเป็น DRAFT</p>}
      </div>
      {hasOperationalFacts && (
        <section aria-label={`ข้อมูลใช้งานตามต้นฉบับของ ${document.recipeName}`}>
          {document.operationalNotes.length > 0 && (
            <div>
              <h5>หมายเหตุการใช้งาน</h5>
              <ul>{document.operationalNotes.map((note, index) => (
                <li key={`${String(index)}:${note}`} style={{ whiteSpace: "pre-wrap" }}>{note}</li>
              ))}</ul>
            </div>
          )}
          {document.yieldText !== null && (
            <p style={{ whiteSpace: "pre-wrap" }}><strong>ผลผลิตตามต้นฉบับ</strong> <span>{document.yieldText}</span></p>
          )}
          {document.methodDecisionNote !== null && (
            <p style={{ whiteSpace: "pre-wrap" }}><strong>ขอบเขตวิธีทำ</strong> <span>{document.methodDecisionNote}</span></p>
          )}
        </section>
      )}
      {document.ingredients.length > 0 && (
        <table>
          <thead><tr><th>วัตถุดิบ</th><th>ปริมาณตามต้นฉบับ</th></tr></thead>
          <tbody>{document.ingredients.map((line) => (
            <tr key={line.lineKey}>
              <th scope="row">{line.itemName}</th>
              <td style={{ whiteSpace: "pre-wrap" }}>
                <span>{sourceFact(line) ?? "ไม่ระบุในต้นฉบับ"}</span>
                {document.stage === "service" && line.servingNote !== null && (
                  <span style={{ display: "block" }}>{line.servingNote}</span>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {document.steps.length > 0 && (
        <ol>{document.steps.map((step) => (
          <li key={step.stepId} style={{ whiteSpace: "pre-wrap" }}>
            <p>{step.instruction}</p>
            <StepMediaEditor stepId={step.stepId} />
          </li>
        ))}</ol>
      )}
    </article>
  );
}

export function WorkStagePage() {
  const { recipeId: routeSegment } = useParams();
  const location = useLocation();
  const { snapshot: sessionSnapshot } = usePrototype();
  const kitchenSotDraft = useOptionalKitchenSotDraft();
  const identity = routeSegment === undefined ? null : decodeRecipeIdentity(routeSegment);

  if (identity === null || !routeSegment) {
    return <WorkRouteError />;
  }

  const requestedStage = parseRequestedStage(location.search);
  if (requestedStage === null) {
    return (
      <section role="alert" aria-labelledby="work-stage-error-title">
        <h2 id="work-stage-error-title">จุดงานไม่ถูกต้อง</h2>
        <p>เลือกจุดงาน prep, cook, service หรือ all เท่านั้น</p>
        <Link to={`/work/${encodeRecipeIdentity(identity)}?stage=all`}>ดูทุกจุดงาน</Link>
      </section>
    );
  }

  let documents: ProjectedWorkDocument[];
  let recipe: RecipeVersion;
  let documentRecipes: Map<string, RecipeVersion>;
  let snapshot = sessionSnapshot;
  let rawDraftById: ReadonlyMap<RecipeIdentity, boolean> | null = null;
  try {
    if (kitchenSotDraft !== null) {
      const projection = projectKitchenSotPrintSnapshot(
        kitchenSotDraft.document,
        sessionSnapshot,
      );
      snapshot = projection.snapshot;
      rawDraftById = projection.recipeDraftById;
    }
    const reachable = reachableRecipes(snapshot, identity);
    recipe = reachable.root;
    documentRecipes = new Map(
      reachable.recipes.map((reachableRecipe) => [identityKey(reachableRecipe.recipeId), reachableRecipe]),
    );
    documents = projectWorkDocuments(reachable.recipes, { stage: requestedStage, multiplier: 1 });
    for (const document of documents) {
      const documentRecipe = documentRecipes.get(identityKey(document.recipeId));
      if (!documentRecipe) throw new Error(`Projected recipe missing from snapshot: ${String(document.recipeId)}`);
      resolveWorkStageDraft(documentRecipe, snapshot, rawDraftById);
    }
  } catch (error) {
    if (
      error instanceof UnknownRecipeError &&
      sameIdentity(error.recipeId, identity)
    ) {
      return <WorkRouteError />;
    }
    return (
      <section role="alert" aria-labelledby="work-document-error-title">
        <h2 id="work-document-error-title">สร้างเอกสารจุดงานไม่ได้</h2>
        <p>{errorMessage(error)}</p>
        <Link to="/recipes">กลับไปคลังสูตรอาหาร</Link>
      </section>
    );
  }

  return (
    <section className="work-stage-page" aria-labelledby="work-stage-title">
      <header>
        <Link to={`/recipes/${encodeRecipeIdentity(recipe.recipeId)}`}>กลับไปหน้าสูตร</Link>
        <h2 id="work-stage-title">{recipe.name}</h2>
        <p>แก้ไขรูปได้เฉพาะ session นี้</p>
      </header>
      <nav aria-label="เลือกจุดงาน">
        <ul>
          {STAGES.map((stage) => (
            <li key={stage}><Link to={`/work/${encodeRecipeIdentity(recipe.recipeId)}?stage=${stage}`}>{STAGE_LABELS[stage]}</Link></li>
          ))}
          <li><Link to={`/work/${encodeRecipeIdentity(recipe.recipeId)}?stage=all`}>ทุกจุดงาน</Link></li>
        </ul>
      </nav>

      {documents.length === 0 && requestedStage !== "all" && <p role="status">เมนูนี้ไม่มีขั้นตอนในจุดงานที่เลือก</p>}
      {STAGES.map((stage) => {
        const stageDocuments = documents.filter((document) => document.stage === stage);
        if (stageDocuments.length === 0) return null;
        return (
          <section key={stage} aria-labelledby={`work-stage-${stage}`}>
            <h3 id={`work-stage-${stage}`}>{STAGE_LABELS[stage]}</h3>
            {stageDocuments.map((document) => {
              const documentRecipe = documentRecipes.get(identityKey(document.recipeId));
              if (!documentRecipe) return null;
              return (
                <WorkDocumentView
                  key={`${typeof document.recipeId}:${String(document.recipeId)}:${document.recipeVersionId}:${stage}`}
                  document={document}
                  recipe={documentRecipe}
                  snapshot={snapshot}
                  draft={resolveWorkStageDraft(documentRecipe, snapshot, rawDraftById)}
                />
              );
            })}
          </section>
        );
      })}
    </section>
  );
}
