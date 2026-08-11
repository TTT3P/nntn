import { useState } from "react";
import type { RecipeIdentity } from "../../domain/cookbook/types";
import type { PrintCollection, PrintCollectionKey } from "./printCollections";
import type { PrintSetMode } from "./printSetProjection";

export interface PrintCollectionPickerProps {
  collections: PrintCollection[];
  activeMode: PrintSetMode["kind"];
  activeCollectionKey: PrintCollectionKey | null;
  selectedRecipeKeys: readonly string[];
  onChooseCollection(collectionKey: PrintCollectionKey): void;
  onChooseDaily(): void;
  onChooseManual(): void;
  onToggleRecipe(recipeId: RecipeIdentity, checked: boolean): void;
  onSelectAll(collectionKey: PrintCollectionKey): void;
  onClearCollection(collectionKey: PrintCollectionKey): void;
}

function identityKey(recipeId: RecipeIdentity): string {
  return typeof recipeId === "number"
    ? `number:${String(recipeId)}`
    : `string:${JSON.stringify(recipeId)}`;
}

function recipeChoiceLabel(recipe: PrintCollection["recipes"][number]): string {
  const code = typeof recipe.recipeId === "string" && /^(?:RCP|SRCP)-/u.test(recipe.recipeId)
    ? recipe.recipeId
    : null;
  return code === null ? recipe.name : `${recipe.name} · ${code}`;
}

export function PrintCollectionPicker({
  collections,
  activeMode,
  activeCollectionKey,
  selectedRecipeKeys,
  onChooseCollection,
  onChooseDaily,
  onChooseManual,
  onToggleRecipe,
  onSelectAll,
  onClearCollection,
}: PrintCollectionPickerProps) {
  const [searchText, setSearchText] = useState("");
  const normalizedSearch = searchText.trim().toLocaleLowerCase("th");
  const visibleCollections = collections.flatMap((collection) => {
    if (activeCollectionKey !== null && collection.key !== activeCollectionKey) return [];
    const recipes = collection.recipes.filter((recipe) => {
      if (normalizedSearch === "") return true;
      return recipeChoiceLabel(recipe).toLocaleLowerCase("th").includes(normalizedSearch);
    });
    return recipes.length === 0 ? [] : [{ ...collection, recipes }];
  });

  return (
    <fieldset className="print-recipe-selection">
      <legend>1. เลือกชุดที่ต้องการพิมพ์</legend>
      <div className="print-collection-actions">
        {collections.map((collection) => (
          <button
            type="button"
            key={collection.key}
            aria-label={`พิมพ์ทั้งหมวด ${collection.label} ${collection.recipes.length} สูตร`}
            aria-pressed={activeMode === "collection" && activeCollectionKey === collection.key}
            disabled={collection.recipes.length === 0}
            onClick={() => onChooseCollection(collection.key)}
          >
            <strong>{collection.label}</strong>
            <span>{collection.recipes.length} สูตร</span>
            <small>พิมพ์ทั้งหมวด</small>
          </button>
        ))}
      </div>

      <div className="print-set-alternatives">
        <button
          type="button"
          aria-pressed={activeMode === "daily"}
          onClick={onChooseDaily}
        >
          ชุดงานวันนี้
        </button>
        <button
          type="button"
          aria-pressed={activeMode === "manual"}
          onClick={onChooseManual}
        >
          เลือกสูตรเอง
        </button>
      </div>

      <div className="print-collection-disclosure">
        <label className="print-search">
          <span>ค้นหาสูตร</span>
          <input
            type="search"
            value={searchText}
            placeholder="ค้นหาชื่อหรือรหัสสูตร"
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>
        <div className="print-collections">
          {visibleCollections.map((collection) => (
            <details
              className="print-collection"
              key={collection.key}
              open={activeCollectionKey === collection.key || normalizedSearch !== ""}
            >
              <summary>
                <span aria-hidden="true">›</span>
                <strong>{collection.label}</strong>
                <em>{collection.recipes.length}</em>
              </summary>
              <div className="print-collection__body">
                <div className="print-collection__bulk-actions">
                  <button
                    type="button"
                    aria-label={`เลือกทั้งหมด ${collection.label}`}
                    onClick={() => onSelectAll(collection.key)}
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    type="button"
                    aria-label={`เอาออกทั้งหมด ${collection.label}`}
                    onClick={() => onClearCollection(collection.key)}
                  >
                    เอาออกทั้งหมด
                  </button>
                </div>
                <div className="print-collection__recipes">
                  {collection.recipes.map((recipe) => (
                    <label key={`${identityKey(recipe.recipeId)}:${JSON.stringify(recipe.recipeVersionId)}`}>
                      <input
                        type="checkbox"
                        checked={selectedRecipeKeys.includes(identityKey(recipe.recipeId))}
                        onChange={(event) => onToggleRecipe(recipe.recipeId, event.target.checked)}
                      />
                      {recipeChoiceLabel(recipe)}
                    </label>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
        {visibleCollections.length === 0 && (
          <p className="print-empty-search">ไม่พบสูตรที่ค้นหา</p>
        )}
      </div>
    </fieldset>
  );
}
