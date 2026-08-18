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
import "./recipe-studio.css";

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
  const ownerInputId = useId();
  const ownerErrorId = useId();
  const servingInputId = useId();
  const costBasisInputId = useId();

  return (
    <fieldset className="sot-edit-grid recipe-studio__item-row">
      <legend>{item.item_name}</legend>
      <p className="recipe-studio__current-value">
        ตอนนี้ใช้: <strong>{item.candidate_text ?? "ยังรอคำตอบ"}</strong>
      </p>
      {isOwnerProvenanceIncomplete(item) && (
        <p className="sot-provenance-warning">ยังรอคำตอบจากทีมครัว</p>
      )}

      <label className="recipe-studio__primary-question" htmlFor={ownerInputId}>
        ทีมครัวใช้ {item.item_name} เท่าไร? (ต้องกรอก)
      </label>
      <input
        id={ownerInputId}
        className="recipe-studio__primary-input"
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
            setOwnerError("กรอกปริมาณที่ทีมครัวใช้ก่อน ระบบคืนค่าเดิมให้แล้ว");
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
      <small className="recipe-studio__field-help">
        ตัวอย่าง: 30 กรัมต่อจาน · 1 ทัพพี · ครึ่งช้อนโต๊ะ
      </small>
      {ownerError && <p id={ownerErrorId} role="alert">{ownerError}</p>}

      <details className="recipe-studio__optional-fields">
        <summary>ตัวเลือกเพิ่มเติม (ไม่บังคับ)</summary>
        <div className="recipe-studio__optional-content">
          <p className="recipe-studio__optional-intro">
            กรอกส่วนนี้เฉพาะเมื่อปริมาณตอนเสิร์ฟหรือปริมาณที่ใช้คิดต้นทุนต่างจากคำตอบด้านบน
          </p>

          <div className="recipe-studio__source-context">
            <p>แหล่งข้อมูลเดิม: {item.selected_source ?? "ยังไม่เลือก"}</p>
            <p>สถานะเดิม: {item.decision_status}</p>
            <dl aria-label={`หลักฐานต้นทาง — ${item.item_name}`}>
              {Object.entries(item.source_values).map(([source, value]) => (
                <div key={source} data-testid="sot-source-evidence">
                  <dt>{source}</dt>
                  <dd><pre>{sourceEvidenceText(value)}</pre></dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="recipe-studio__optional-field">
            <label htmlFor={servingInputId}>ปริมาณตอนเสิร์ฟ (ไม่บังคับ)</label>
            <input
              id={servingInputId}
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
            <small className="recipe-studio__field-help">
              กรอกเมื่อปริมาณที่เสิร์ฟต่างจากคำตอบหลัก
            </small>
          </div>

          <div className="recipe-studio__optional-field">
            <label htmlFor={costBasisInputId}>ปริมาณสำหรับคิดต้นทุน (ไม่บังคับ)</label>
            <input
              id={costBasisInputId}
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
            <small className="recipe-studio__field-help">
              กรอกเมื่อปริมาณที่ใช้คิดต้นทุนต่างจากคำตอบหลัก
            </small>
          </div>
        </div>
      </details>
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
    <section className="sot-edit-grid recipe-studio__section recipe-studio__method-card" aria-labelledby="sot-method-title">
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
    <li className="sot-blocker recipe-studio__blocker-card">
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
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "sellable_menu" | "prepared_recipe">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "ready">("all");
  const [selectedKey, setSelectedKey] = useState(() =>
    draft.document.recipes[0] ? identityKey(draft.document.recipes[0].recipe_id) : ""
  );
  const selectedRecipe = draft.document.recipes.find(
    ({ recipe_id }) => identityKey(recipe_id) === selectedKey,
  ) ?? draft.document.recipes[0];
  const saving = draft.saveState === "saving";
  const normalizedQuery = query.trim().toLocaleLowerCase("th");
  const visibleRecipes = draft.document.recipes.filter((recipe) => {
    const matchesQuery = recipe.recipe_name.toLocaleLowerCase("th").includes(normalizedQuery);
    const matchesType = typeFilter === "all" || recipe.recipe_type === typeFilter;
    const recipeIsDraft = isKitchenSotRecipeDraft(recipe);
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "draft" ? recipeIsDraft : !recipeIsDraft);
    return matchesQuery && matchesType && matchesStatus;
  });

  return (
    <section className="recipe-studio" aria-labelledby="source-review-title">
      <header className="recipe-studio__intro">
        <h2 id="source-review-title">กรอกสูตรจากทีมครัว</h2>
        <p>เลือกสูตร แล้วกรอกปริมาณหรือวิธีทำตามคำตอบที่ได้รับ โดยคงหน่วยครัวเดิม</p>
        <section className="recipe-studio__summary" aria-label="สรุปข้อมูล Kitchen SOT">
          <span><strong>{draft.summary.recipeCount} สูตร</strong></span>
          <span>{draft.summary.sellableMenuCount} เมนูขาย + {draft.summary.preparedRecipeCount} สูตรประกอบ</span>
          <span>{draft.summary.itemFillTargetCount} รายการรอกรอก/เคาะ</span>
          <span>{draft.summary.blockerCount} ตัวขวาง</span>
        </section>
      </header>

      <div className="recipe-studio__workspace">
        <nav className="recipe-studio__queue" aria-label="คิวสูตร Kitchen SOT">
          <header className="recipe-studio__queue-header">
            <h3>เลือกสูตร</h3>
            <p>ค้นหาตามชื่อ แล้วเปิดสูตรที่ต้องการกรอก</p>
          </header>
          <div className="recipe-studio__filters">
            <label>
              ค้นหาสูตร
              <input
                type="search"
                value={query}
                placeholder="ชื่อเมนูหรือสูตรประกอบ"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              ประเภทสูตร
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
              >
                <option value="all">ทั้งหมด</option>
                <option value="sellable_menu">เมนูขาย</option>
                <option value="prepared_recipe">สูตรประกอบ</option>
              </select>
            </label>
            <label>
              สถานะ
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              >
                <option value="all">ทั้งหมด</option>
                <option value="draft">DRAFT</option>
                <option value="ready">พร้อมจากข้อมูลปัจจุบัน</option>
              </select>
            </label>
          </div>
          <ul>
            {visibleRecipes.map((recipe) => {
              const unresolvedBlockers = recipe.blockers.filter(({ resolved }) => resolved !== true).length;
              const provenanceIncomplete = recipe.items.some(isOwnerProvenanceIncomplete);
              const recipeIsDraft = isKitchenSotRecipeDraft(recipe);
              return (
                <li key={identityKey(recipe.recipe_id)}>
                  <button
                    type="button"
                    aria-pressed={identityKey(recipe.recipe_id) === identityKey(selectedRecipe?.recipe_id ?? "")}
                    onClick={() => setSelectedKey(identityKey(recipe.recipe_id))}
                  >
                    <span className="recipe-studio__queue-name">{recipe.recipe_name}</span>
                    <span className="recipe-studio__queue-meta">
                      {recipe.recipe_type === "sellable_menu" ? "เมนูขาย" : "สูตรประกอบ"} · revision {displayString(recipe.recipe_version_id, "ไม่ระบุ")}
                    </span>
                    <span className={`recipe-studio__queue-status ${recipeIsDraft ? "is-draft" : "is-ready"}`}>
                      {recipeIsDraft ? "DRAFT" : "พร้อมจากข้อมูลปัจจุบัน"}
                    </span>
                    <span className="recipe-studio__queue-meta">
                      {unresolvedBlockers} ตัวขวางที่ยังไม่จบ{provenanceIncomplete ? " · ยังรอคำตอบจากทีมครัว" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {visibleRecipes.length === 0 && <p className="recipe-studio__empty">ไม่พบสูตรตามตัวกรอง</p>}
        </nav>

        {selectedRecipe && (
          <article
            className="recipe-studio__detail"
            aria-label={`รายละเอียดสูตร ${selectedRecipe.recipe_name}`}
          >
            <header>
              <p className="recipe-studio__folio-label">
                แฟ้มสูตรครัว · {selectedRecipe.recipe_type === "sellable_menu" ? "เมนูขาย" : "สูตรประกอบ"}
              </p>
              <h3 id="selected-review-title">{selectedRecipe.recipe_name}</h3>
              <p className="recipe-studio__revision">
                Revision {displayString(selectedRecipe.recipe_version_id, "ไม่ระบุ")}
              </p>
              <p
                className={`recipe-studio__status ${isKitchenSotRecipeDraft(selectedRecipe) ? "is-draft" : "is-ready"}`}
                role="status"
                aria-label="สถานะสูตร"
              >
                {isKitchenSotRecipeDraft(selectedRecipe) ? "DRAFT" : "พร้อมจากข้อมูลปัจจุบัน"}
              </p>
            </header>

            <section className="recipe-studio__section" aria-labelledby="sot-items-title">
              <h4 id="sot-items-title">วัตถุดิบ</h4>
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

            <section className="recipe-studio__section" aria-labelledby="sot-blockers-title">
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
          </article>
        )}
      </div>
    </section>
  );
}
