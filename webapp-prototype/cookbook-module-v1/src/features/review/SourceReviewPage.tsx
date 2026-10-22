import { useState } from "react";
import type { RecipeIdentity, RecipeVersion } from "../../domain/cookbook/types";
import { buildReviewQueue, evaluateReadiness } from "../../domain/review/readiness";
import { usePrototype } from "../../prototype/PrototypeProvider";
import { deriveRecipeMediaCoverage } from "../recipe/recipeMediaCoverage";
import type { KitchenSotDraftClient } from "../../data/KitchenSotDraftClient";
import {
  KitchenSotDraftProvider,
  useOptionalKitchenSotDraft,
} from "./KitchenSotDraftProvider";
import { KitchenSotFillSurface } from "./KitchenSotFillSurface";

class InvalidSourceReviewFieldError extends Error {
  constructor(field: string, value: unknown) {
    super(`Invalid source review field ${field}: ${String(value)}`);
    this.name = "InvalidSourceReviewFieldError";
  }
}

function identityKey(identity: RecipeIdentity): string {
  return typeof identity === "number"
    ? `number:${String(identity)}`
    : `string:${JSON.stringify(identity)}`;
}

function rowKey(recipeId: RecipeIdentity, recipeVersionId: string): string {
  return JSON.stringify([identityKey(recipeId), recipeVersionId]);
}

function validateStringArray(field: string, value: unknown): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new InvalidSourceReviewFieldError(field, value);
  }
  for (const entry of value) {
    if (typeof entry !== "string") {
      throw new InvalidSourceReviewFieldError(`${field}[]`, entry);
    }
  }
}

function validateDisplayedRecipe(recipe: RecipeVersion): void {
  validateStringArray("sourceLocators", recipe.sourceLocators);
  validateStringArray("blockers", recipe.blockers);
  if (recipe.methodText !== null && typeof recipe.methodText !== "string") {
    throw new InvalidSourceReviewFieldError("methodText", recipe.methodText);
  }
  if (!Array.isArray(recipe.lines)) {
    throw new InvalidSourceReviewFieldError("lines", recipe.lines);
  }
  for (const line of recipe.lines) {
    if (line.selectedSource !== null && typeof line.selectedSource !== "string") {
      throw new InvalidSourceReviewFieldError(
        `lines[${String(line.lineKey)}].selectedSource`,
        line.selectedSource,
      );
    }
    if (typeof line.decisionStatus !== "string") {
      throw new InvalidSourceReviewFieldError(
        `lines[${String(line.lineKey)}].decisionStatus`,
        line.decisionStatus,
      );
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}

function statusLabel(status: RecipeVersion["reviewState"]): string {
  if (status === "blocked") return "blocked";
  if (status === "conflict") return "conflict";
  if (status === "candidate") return "candidate";
  return "confirmed";
}

function ReadOnlySourceReviewPage() {
  const { snapshot } = usePrototype();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  let view;
  try {
    const queue = buildReviewQueue(snapshot.recipes);
    const selectedRow =
      queue.find((row) => rowKey(row.recipeId, row.recipeVersionId) === selectedKey) ?? queue[0];
    if (!selectedRow) {
      view = { queue, selectedRow: undefined, selectedRecipe: undefined };
    } else {
      const selectedRecipe = snapshot.recipes.find(
        (recipe) =>
          identityKey(recipe.recipeId) === identityKey(selectedRow.recipeId) &&
          recipe.recipeVersionId === selectedRow.recipeVersionId,
      );
      if (!selectedRecipe) {
        throw new InvalidSourceReviewFieldError("selectedRecipe", selectedRow.recipeVersionId);
      }
      validateDisplayedRecipe(selectedRecipe);
      const mediaCoverage = deriveRecipeMediaCoverage(selectedRecipe, snapshot);
      const readiness = evaluateReadiness(selectedRecipe, mediaCoverage.coverage);
      view = { queue, selectedRow, selectedRecipe, mediaCoverage, readiness };
    }
  } catch (error) {
    return (
      <section role="alert" aria-labelledby="source-review-error-title">
        <h2 id="source-review-error-title">เปิดคิวตรวจสอบไม่ได้</h2>
        <p><strong>โหมดอ่านอย่างเดียว</strong></p>
        <p>{errorMessage(error)}</p>
      </section>
    );
  }

  const { queue, selectedRow, selectedRecipe } = view;

  if (!selectedRow || !selectedRecipe) {
    return (
      <section className="source-review-page" aria-labelledby="source-review-title">
        <h2 id="source-review-title">ตรวจสอบแหล่งข้อมูล</h2>
        <p><strong>โหมดอ่านอย่างเดียว</strong></p>
        <p role="status">ไม่มีสูตรที่ต้องตรวจสอบ</p>
      </section>
    );
  }

  const { mediaCoverage, readiness } = view;

  return (
    <section className="source-review-page" aria-labelledby="source-review-title">
      <header>
        <h2 id="source-review-title">ตรวจสอบแหล่งข้อมูล</h2>
        <p><strong>โหมดอ่านอย่างเดียว</strong></p>
        <p><strong>ลายมือใหม่เป็นหลักเมื่อมีการแก้ไข</strong></p>
        <p>DOCX และ V2 ใช้เป็นหลักฐานเปรียบเทียบ และ V1 ใช้เป็นรายการตั้งต้นเท่านั้น</p>
        <p>การแก้ไขทั้งหมดอยู่เฉพาะเซสชันนี้ และจะไม่บันทึกลงเครือข่ายหรือพื้นที่จัดเก็บ</p>
      </header>

      <nav aria-label="คิวสูตรที่ต้องตรวจสอบ">
        <ul>
          {queue.map((row) => (
            <li key={rowKey(row.recipeId, row.recipeVersionId)}>
              <button
                type="button"
                aria-pressed={rowKey(row.recipeId, row.recipeVersionId) === rowKey(selectedRow.recipeId, selectedRow.recipeVersionId)}
                onClick={() => setSelectedKey(rowKey(row.recipeId, row.recipeVersionId))}
              >
                {row.recipeName} · revision {row.recipeVersionId} · {statusLabel(row.status)} · {row.blockers.length > 0 ? row.blockers.join("; ") : "รอตรวจหลักฐาน"}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <article aria-labelledby="selected-review-title">
        <header>
          <h3 id="selected-review-title">{selectedRecipe.name}</h3>
          <p>revision: {selectedRecipe.recipeVersionId}</p>
          <p>reviewState: {selectedRecipe.reviewState}</p>
          <p>{readiness.draft ? "DRAFT" : "พร้อมใช้งาน"}</p>
        </header>

        <section>
          <h4>ตำแหน่งแหล่งข้อมูล</h4>
          <ul>{selectedRecipe.sourceLocators.map((locator) => <li key={locator}>{locator}</li>)}</ul>
        </section>

        <section>
          <h4>เปรียบเทียบรายการวัตถุดิบ</h4>
          {selectedRecipe.lines.length === 0 ? <p>ไม่มีรายการวัตถุดิบ</p> : (
            <table>
              <thead>
                <tr><th>รายการ / บรรทัด</th><th>ข้อความต้นฉบับ</th><th>แหล่งที่เลือก</th><th>สถานะการตัดสินใจ</th></tr>
              </thead>
              <tbody>
                {selectedRecipe.lines.map((line) => (
                  <tr key={line.lineKey}>
                    <th scope="row"><span>{line.itemName}</span><br /><span>{line.lineKey}</span></th>
                    <td style={{ whiteSpace: "pre-wrap" }}>{line.sourceText ?? "ไม่มีข้อความต้นฉบับ"}</td>
                    <td>{line.selectedSource ?? "ยังไม่เลือก"}</td>
                    <td>{line.decisionStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h4>วิธีทำต้นฉบับ</h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{selectedRecipe.methodText ?? "ไม่มีวิธีทำต้นฉบับ"}</p>
        </section>

        <section>
          <h4>ตัวขวางความพร้อม</h4>
          {readiness.blockers.length === 0 ? <p>ไม่มีตัวขวาง</p> : <ul>{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
        </section>

        <section>
          <h4>สถานะรูป</h4>
          <p>สถานะรูป: ไม่ใช่เหตุให้เป็น DRAFT</p>
          {!mediaCoverage.missingMedia && !mediaCoverage.mediaReviewNeeded && <p>รูปครบและไม่ต้องตรวจสอบ</p>}
          {mediaCoverage.missingMedia && <p>รูปขั้นตอนไม่ครบ</p>}
          {mediaCoverage.mediaReviewNeeded && <p>รูปต้องตรวจสอบ</p>}
        </section>
      </article>
    </section>
  );
}

export function SourceReviewPage({ draftClient }: { draftClient?: KitchenSotDraftClient }) {
  const sharedDraft = useOptionalKitchenSotDraft();
  if (sharedDraft !== null) return <KitchenSotFillSurface />;
  if (draftClient === undefined) return <ReadOnlySourceReviewPage />;
  return (
    <KitchenSotDraftProvider client={draftClient}>
      <KitchenSotFillSurface />
    </KitchenSotDraftProvider>
  );
}
