import { useState } from "react";
import { Link } from "react-router-dom";
import type { RecipeVersion, WorkStage } from "../../domain/cookbook/types";
import { evaluateReadiness } from "../../domain/review/readiness";
import { usePrototype } from "../../prototype/PrototypeProvider";
import { deriveRecipeMediaCoverage } from "../recipe/recipeMediaCoverage";
import { encodeRecipeIdentity } from "../recipe/recipeRoute";
import { useOptionalKitchenSotDraft } from "../review/KitchenSotDraftProvider";

function compareRecipes(left: RecipeVersion, right: RecipeVersion): number {
  const byName = left.name.localeCompare(right.name, "th");
  if (byName !== 0) return byName;
  return encodeRecipeIdentity(left.recipeId).localeCompare(
    encodeRecipeIdentity(right.recipeId),
  );
}

type Flags = {
  missingMethod: boolean;
  sourceConflict: boolean;
  missingMedia: boolean;
  mediaReviewNeeded: boolean;
};

const emptyFlags: Flags = {
  missingMethod: false,
  sourceConflict: false,
  missingMedia: false,
  mediaReviewNeeded: false,
};

export function RecipeLibraryPage() {
  const { snapshot } = usePrototype();
  const kitchenSotDraft = useOptionalKitchenSotDraft();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [stage, setStage] = useState("all");
  const [flags, setFlags] = useState<Flags>(emptyFlags);

  const rows = snapshot.recipes.map((recipe) => {
    const mediaCoverage = deriveRecipeMediaCoverage(recipe, snapshot);
    const projectedReadiness = evaluateReadiness(recipe, mediaCoverage.coverage);
    const rawDraft = kitchenSotDraft === null
      ? projectedReadiness.draft
      : (kitchenSotDraft.recipeDraftById.get(recipe.recipeId) ?? true);
    const readiness = { ...projectedReadiness, draft: rawDraft };
    return {
      recipe,
      readiness,
      missingMethod: readiness.missingMethod,
      sourceConflict: recipe.reviewState === "conflict",
      missingMedia: mediaCoverage.missingMedia,
      mediaReviewNeeded: mediaCoverage.mediaReviewNeeded,
    };
  });

  const normalizedQuery = query.trim().toLocaleLowerCase("th");
  const filteredRows = rows
    .filter(({ recipe, ...rowFlags }) => {
      if (normalizedQuery && !recipe.name.toLocaleLowerCase("th").includes(normalizedQuery)) return false;
      if (kind !== "all" && recipe.kind !== kind) return false;
      if (stage !== "all" && !recipe.workDocuments[stage as WorkStage]) return false;
      if (flags.missingMethod && !rowFlags.missingMethod) return false;
      if (flags.sourceConflict && !rowFlags.sourceConflict) return false;
      if (flags.missingMedia && !rowFlags.missingMedia) return false;
      if (flags.mediaReviewNeeded && !rowFlags.mediaReviewNeeded) return false;
      return true;
    })
    .sort((left, right) => compareRecipes(left.recipe, right.recipe));

  const setFlag = (name: keyof Flags, checked: boolean) => {
    setFlags((current) => ({ ...current, [name]: checked }));
  };

  const clearFilters = () => {
    setQuery("");
    setKind("all");
    setStage("all");
    setFlags(emptyFlags);
  };

  return (
    <section className="recipe-page" aria-labelledby="recipe-library-title">
      <h2 id="recipe-library-title">คลังสูตรอาหาร</h2>
      <div className="recipe-filters" aria-label="ค้นหาและกรองสูตรอาหาร">
        <label>
          ค้นหาสูตรอาหาร
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          ประเภทสูตร
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">ทุกประเภท</option>
            <option value="sellable_menu">เมนูขาย</option>
            <option value="prepared_recipe">สูตรเตรียม</option>
          </select>
        </label>
        <label>
          ขั้นตอนงาน
          <select value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="all">ทุกขั้นตอน</option>
            <option value="prep">เตรียม</option>
            <option value="cook">ปรุง</option>
            <option value="service">จัดเสิร์ฟ</option>
          </select>
        </label>
        <label><input type="checkbox" checked={flags.missingMethod} onChange={(event) => setFlag("missingMethod", event.target.checked)} />เฉพาะสูตรที่วิธีทำไม่ครบ</label>
        <label><input type="checkbox" checked={flags.sourceConflict} onChange={(event) => setFlag("sourceConflict", event.target.checked)} />เฉพาะสูตรที่แหล่งข้อมูลขัดแย้ง</label>
        <label><input type="checkbox" checked={flags.missingMedia} onChange={(event) => setFlag("missingMedia", event.target.checked)} />เฉพาะสูตรที่รูปขั้นตอนไม่ครบ</label>
        <label><input type="checkbox" checked={flags.mediaReviewNeeded} onChange={(event) => setFlag("mediaReviewNeeded", event.target.checked)} />เฉพาะสูตรที่รูปต้องตรวจสอบ</label>
        <button type="button" onClick={clearFilters}>ล้างตัวกรอง</button>
      </div>

      <p aria-live="polite">{filteredRows.length} สูตร</p>
      {filteredRows.length === 0 ? (
        <p>ไม่พบสูตรที่ตรงกับเงื่อนไข</p>
      ) : (
        <ul className="recipe-list">
          {filteredRows.map(({ recipe, readiness, missingMethod, sourceConflict, missingMedia, mediaReviewNeeded }) => (
            <li key={encodeRecipeIdentity(recipe.recipeId)}>
              <h3><Link to={`/recipes/${encodeRecipeIdentity(recipe.recipeId)}`}>{recipe.name}</Link></h3>
              <div className="recipe-badges">
                <span>{recipe.kind === "sellable_menu" ? "เมนูขาย" : "สูตรเตรียม"}</span>
                <span>{readiness.draft ? "ฉบับร่าง" : "พร้อมใช้งาน"}</span>
                {missingMethod && <span>วิธีทำยังไม่ครบ</span>}
                {sourceConflict && <span>แหล่งข้อมูลขัดแย้ง</span>}
                {missingMedia && <span>รูปขั้นตอนไม่ครบ</span>}
                {mediaReviewNeeded && <span>รูปต้องตรวจสอบ</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
