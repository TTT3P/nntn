import { useId, useState } from "react";
import {
  isKitchenSotRecipeDraft,
  isOwnerProvenanceIncomplete,
  type JsonValue,
  type KitchenSotBlocker,
  type KitchenSotItem,
  type KitchenSotRecipe,
  type RecipeIdentity,
} from "../../domain/sot/kitchenSotDocument";
import type { KitchenSotEdit } from "../../domain/sot/kitchenSotEdits";
import { useKitchenSotDraft } from "./KitchenSotDraftProvider";

function identityKey(identity: RecipeIdentity): string {
  return typeof identity === "number"
    ? `number:${String(identity)}`
    : `string:${JSON.stringify(identity)}`;
}

function displayString(value: JsonValue | undefined, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function rawString(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function sourceEvidenceText(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function localIsoDate(): string {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type ApplyEdit = (edit: KitchenSotEdit) => void;

function ItemEditor({
  recipeId,
  item,
  applyEdit,
  locked,
}: {
  recipeId: RecipeIdentity;
  item: KitchenSotItem;
  applyEdit: ApplyEdit;
  locked: boolean;
}) {
  const ownerValue = rawString(item.source_values.owner_confirmation);
  const servingValue = rawString(item.serving_note);
  const costBasisValue = rawString(item.cost_basis_text);
  const [owner, setOwner] = useState(ownerValue);
  const [servingNote, setServingNote] = useState(servingValue);
  const [costBasis, setCostBasis] = useState(costBasisValue);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const ownerErrorId = useId();

  return (
    <fieldset className="sot-edit-grid">
      <legend>{item.item_name}</legend>
      <p>ค่าที่ใช้แสดง: {item.candidate_text ?? "รอข้อมูล"}</p>
      <p>แหล่งที่เลือก: {item.selected_source ?? "ยังไม่เลือก"}</p>
      <p>สถานะการตัดสินใจ: {item.decision_status}</p>
      <dl aria-label={`หลักฐานต้นทาง — ${item.item_name}`}>
        {Object.entries(item.source_values).map(([source, value]) => (
          <div key={source} data-testid="sot-source-evidence">
            <dt>{source}</dt>
            <dd><pre>{sourceEvidenceText(value)}</pre></dd>
          </div>
        ))}
      </dl>
      {isOwnerProvenanceIncomplete(item) && (
        <p className="sot-provenance-warning">ข้อมูลยืนยันเจ้าของไม่ครบ</p>
      )}

      <label>
        ค่าหน้าครัว — {item.item_name}
        <input
          disabled={locked}
          value={owner}
          aria-invalid={ownerError !== null}
          aria-describedby={ownerError === null ? undefined : ownerErrorId}
          onChange={(event) => {
            setOwner(event.target.value);
            setOwnerError(null);
          }}
          onBlur={() => {
            if (owner === ownerValue) return;
            if (owner.trim() === "") {
              setOwner(ownerValue);
              setOwnerError("ค่าหน้าครัวต้องไม่ว่าง ระบบคืนค่าเดิมแล้ว");
              return;
            }
            setOwnerError(null);
            applyEdit({
              kind: "item-owner-confirmation",
              recipeId,
              lineKey: item.line_key,
              value: owner,
              confirmedOn: localIsoDate(),
            });
          }}
        />
      </label>
      {ownerError && <p id={ownerErrorId} role="alert">{ownerError}</p>}

      <label>
        หมายเหตุปริมาณเสิร์ฟ — {item.item_name}
        <input
          disabled={locked}
          value={servingNote}
          onChange={(event) => setServingNote(event.target.value)}
          onBlur={() => {
            if (servingNote !== servingValue) {
              applyEdit({
                kind: "item-serving-note",
                recipeId,
                lineKey: item.line_key,
                value: servingNote,
              });
            }
          }}
        />
      </label>

      <label>
        ฐานต้นทุน — {item.item_name}
        <input
          disabled={locked}
          value={costBasis}
          onChange={(event) => setCostBasis(event.target.value)}
          onBlur={() => {
            if (costBasis !== costBasisValue) {
              applyEdit({
                kind: "item-cost-basis",
                recipeId,
                lineKey: item.line_key,
                value: costBasis,
              });
            }
          }}
        />
      </label>
    </fieldset>
  );
}

function MethodAndYieldEditor({
  recipe,
  applyEdit,
  locked,
}: {
  recipe: KitchenSotRecipe;
  applyEdit: ApplyEdit;
  locked: boolean;
}) {
  const initialMethod = recipe.method_candidate_text ?? "";
  const initialDecisionNote = recipe.method_decision_note ?? "";
  const initialYield = recipe.yield_candidate_text ?? "";
  const [method, setMethod] = useState(initialMethod);
  const [decisionNote, setDecisionNote] = useState(initialDecisionNote);
  const [yieldText, setYieldText] = useState(initialYield);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [decisionNoteError, setDecisionNoteError] = useState<string | null>(null);
  const [yieldError, setYieldError] = useState<string | null>(null);
  const methodErrorId = useId();
  const decisionNoteErrorId = useId();
  const yieldErrorId = useId();

  function commitMethod(): void {
    const methodChanged = method !== initialMethod;
    const decisionNoteChanged = decisionNote !== initialDecisionNote;
    if (!methodChanged) {
      if (decisionNoteChanged) {
        setDecisionNote(initialDecisionNote);
        setDecisionNoteError("แก้หมายเหตุได้เมื่อแก้ไขวิธีทำพร้อมกัน ระบบคืนค่าเดิมแล้ว");
      }
      return;
    }
    if (method.trim() === "") {
      setMethod(initialMethod);
      setDecisionNote(initialDecisionNote);
      setMethodError("วิธีทำต้องไม่ว่าง ระบบคืนค่าเดิมแล้ว");
      setDecisionNoteError(null);
      return;
    }
    if (decisionNote.trim() === "") {
      setDecisionNoteError("ต้องกรอกหมายเหตุขอบเขตวิธีทำก่อนบันทึกวิธีทำ");
      return;
    }
    if (!decisionNoteChanged) {
      setDecisionNoteError("ต้องอัปเดตหมายเหตุขอบเขตวิธีทำสำหรับวิธีทำใหม่นี้");
      return;
    }
    setMethodError(null);
    setDecisionNoteError(null);
    applyEdit({
      kind: "method",
      recipeId: recipe.recipe_id,
      value: method,
      decisionNote,
    });
  }

  return (
    <section className="sot-edit-grid" aria-labelledby="sot-method-title">
      <h4 id="sot-method-title">วิธีทำและผลผลิต</h4>
      <label>
        วิธีทำจากหน้าครัว
        <textarea
          disabled={locked}
          value={method}
          aria-invalid={methodError !== null}
          aria-describedby={methodError === null ? undefined : methodErrorId}
          onChange={(event) => {
            setMethod(event.target.value);
            setMethodError(null);
          }}
          onBlur={commitMethod}
        />
      </label>
      {methodError && <p id={methodErrorId} role="alert">{methodError}</p>}
      <label>
        หมายเหตุขอบเขตวิธีทำ
        <textarea
          required
          disabled={locked}
          value={decisionNote}
          aria-invalid={decisionNoteError !== null}
          aria-describedby={decisionNoteError === null ? undefined : decisionNoteErrorId}
          onChange={(event) => {
            setDecisionNote(event.target.value);
            setDecisionNoteError(null);
          }}
          onBlur={commitMethod}
        />
      </label>
      {decisionNoteError && (
        <p id={decisionNoteErrorId} role="alert">{decisionNoteError}</p>
      )}
      <label>
        ผลผลิตจากหน้าครัว
        <input
          disabled={locked}
          value={yieldText}
          aria-invalid={yieldError !== null}
          aria-describedby={yieldError === null ? undefined : yieldErrorId}
          onChange={(event) => {
            setYieldText(event.target.value);
            setYieldError(null);
          }}
          onBlur={() => {
            if (yieldText === initialYield) return;
            if (yieldText.trim() === "") {
              setYieldText(initialYield);
              setYieldError("ผลผลิตต้องไม่ว่าง ระบบคืนค่าเดิมแล้ว");
              return;
            }
            setYieldError(null);
            applyEdit({ kind: "yield", recipeId: recipe.recipe_id, value: yieldText });
          }}
        />
      </label>
      {yieldError && <p id={yieldErrorId} role="alert">{yieldError}</p>}
    </section>
  );
}

function BlockerEditor({
  recipe,
  blocker,
  blockerIndex,
  applyEdit,
  locked,
}: {
  recipe: KitchenSotRecipe;
  blocker: KitchenSotBlocker;
  blockerIndex: number;
  applyEdit: ApplyEdit;
  locked: boolean;
}) {
  const [note, setNote] = useState(blocker.resolved_note ?? "");
  const [ownerNaReason, setOwnerNaReason] = useState("");
  const missingMethod = blocker.code === "missing_method" &&
    (recipe.method_candidate_text === null || recipe.method_candidate_text.trim() === "");
  const resolved = blocker.resolved === true;

  function resolve(noteValue: string, ownerMethodNa?: true): void {
    applyEdit({
      kind: "resolve-blocker",
      recipeId: recipe.recipe_id,
      blockerIndex,
      note: noteValue,
      resolvedAt: new Date().toISOString(),
      ...(ownerMethodNa === true ? { ownerMethodNa: true } : {}),
    });
  }

  return (
    <li className="sot-blocker">
      <p data-testid="sot-blocker">{blocker.message}</p>
      {resolved ? (
        <p>ปิดแล้ว: {blocker.resolved_note} · {blocker.resolved_at}</p>
      ) : (
        <>
          <label>
            เหตุผลการปิดตัวขวาง {blockerIndex + 1}
            <textarea
              disabled={locked || missingMethod}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              aria-label={`ปิดตัวขวางตามวิธีปกติ ${blockerIndex + 1}`}
              disabled={locked || missingMethod || note.trim() === ""}
              checked={false}
              onChange={(event) => {
                if (event.target.checked) resolve(note);
              }}
            />
            ปิดตัวขวางตามวิธีปกติ
          </label>
          {missingMethod && (
            <fieldset>
              <legend>ทางเลือกเมื่อเจ้าของยืนยันว่าไม่ต้องมีวิธีทำ</legend>
              <label>
                เหตุผล N/A
                <textarea
                  disabled={locked}
                  value={ownerNaReason}
                  onChange={(event) => setOwnerNaReason(event.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  aria-label="เจ้าของยืนยันว่าไม่ต้องมีวิธีทำ (N/A)"
                  disabled={locked || ownerNaReason.trim() === ""}
                  checked={false}
                  onChange={(event) => {
                    if (event.target.checked) resolve(ownerNaReason, true);
                  }}
                />
                เจ้าของยืนยันว่าไม่ต้องมีวิธีทำ (N/A)
              </label>
            </fieldset>
          )}
        </>
      )}
    </li>
  );
}

export function KitchenSotFillSurface() {
  const draft = useKitchenSotDraft();
  const [selectedKey, setSelectedKey] = useState(() =>
    draft.document.recipes[0] ? identityKey(draft.document.recipes[0].recipe_id) : ""
  );
  const selectedRecipe = draft.document.recipes.find(
    ({ recipe_id }) => identityKey(recipe_id) === selectedKey,
  ) ?? draft.document.recipes[0];
  const saving = draft.saveState === "saving";

  return (
    <section className="source-review-page" aria-labelledby="source-review-title">
      <header>
        <h2 id="source-review-title">Recipe Studio: ร่าง Kitchen SOT V5</h2>
        <div className="sot-summary" aria-label="สรุปข้อมูล Kitchen SOT">
          <p>{draft.summary.recipeCount} สูตร</p>
          <p>{draft.summary.sellableMenuCount} เมนูขาย + {draft.summary.preparedRecipeCount} สูตรประกอบ</p>
          <p>{draft.summary.itemFillTargetCount} รายการรอกรอก/เคาะ</p>
          <p>{draft.summary.blockerCount} ตัวขวาง</p>
        </div>
      </header>

      <nav aria-label="คิวสูตร Kitchen SOT">
        <ul>
          {draft.document.recipes.map((recipe) => {
            const unresolvedBlockers = recipe.blockers.filter(({ resolved }) => resolved !== true).length;
            const provenanceIncomplete = recipe.items.some(isOwnerProvenanceIncomplete);
            return (
              <li key={identityKey(recipe.recipe_id)}>
                <button
                  type="button"
                  aria-pressed={identityKey(recipe.recipe_id) === identityKey(selectedRecipe?.recipe_id ?? "")}
                  onClick={() => setSelectedKey(identityKey(recipe.recipe_id))}
                >
                  {recipe.recipe_name} · revision {displayString(recipe.recipe_version_id, "ไม่ระบุ")} · {isKitchenSotRecipeDraft(recipe) ? "DRAFT" : "พร้อมจากข้อมูลปัจจุบัน"} · {unresolvedBlockers} ตัวขวางที่ยังไม่จบ{provenanceIncomplete ? " · ข้อมูลยืนยันเจ้าของไม่ครบ" : ""}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {selectedRecipe && (
        <article aria-labelledby="selected-review-title">
          <header>
            <h3 id="selected-review-title">{selectedRecipe.recipe_name}</h3>
            <p>revision: {displayString(selectedRecipe.recipe_version_id, "ไม่ระบุ")}</p>
            <p role="status" aria-label="สถานะสูตร">
              {isKitchenSotRecipeDraft(selectedRecipe) ? "DRAFT" : "พร้อมจากข้อมูลปัจจุบัน"}
            </p>
          </header>

          <section aria-labelledby="sot-items-title">
            <h4 id="sot-items-title">วัตถุดิบและหลักฐานที่เลือก</h4>
            {selectedRecipe.items.map((item) => (
              <ItemEditor
                key={JSON.stringify([identityKey(selectedRecipe.recipe_id), item.line_key])}
                recipeId={selectedRecipe.recipe_id}
                item={item}
                applyEdit={draft.applyEdit}
                locked={saving}
              />
            ))}
          </section>

          <MethodAndYieldEditor
            key={identityKey(selectedRecipe.recipe_id)}
            recipe={selectedRecipe}
            applyEdit={draft.applyEdit}
            locked={saving}
          />

          <section aria-labelledby="sot-blockers-title">
            <h4 id="sot-blockers-title">ตัวขวางความพร้อม</h4>
            {selectedRecipe.blockers.length === 0 ? <p>ไม่มีตัวขวาง</p> : (
              <ul>
                {selectedRecipe.blockers.map((blocker, blockerIndex) => (
                  <BlockerEditor
                    key={JSON.stringify([identityKey(selectedRecipe.recipe_id), blockerIndex])}
                    recipe={selectedRecipe}
                    blocker={blocker}
                    blockerIndex={blockerIndex}
                    applyEdit={draft.applyEdit}
                    locked={saving}
                  />
                ))}
              </ul>
            )}
          </section>
        </article>
      )}

      <footer className="sot-save-bar">
        <button
          type="button"
          disabled={!draft.dirty || saving || draft.saveState === "stale"}
          onClick={() => void draft.save()}
        >
          {saving ? "กำลังบันทึก…" : "บันทึกฉบับร่าง V5"}
        </button>
        <p role="status" aria-label="สถานะการบันทึก">
          {saving
            ? "กำลังบันทึก…"
            : draft.saveMessage ?? (draft.dirty ? "มีการแก้ไขที่ยังไม่บันทึก" : "ยังไม่มีการแก้ไข")}
        </p>
      </footer>
    </section>
  );
}
