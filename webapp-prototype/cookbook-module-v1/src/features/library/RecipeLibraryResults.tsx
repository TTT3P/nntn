import { Link } from "react-router-dom";
import type { RecipeVersion } from "../../domain/cookbook/types";
import { encodeRecipeIdentity } from "../recipe/recipeRoute";
import type { LibraryMode, LibraryView } from "./recipeLibraryUrlState";

export interface RecipeLibraryRow {
  recipe: RecipeVersion;
  draft: boolean;
}

export interface RecipeLibraryResultsProps {
  rows: readonly RecipeLibraryRow[];
  mode: LibraryMode;
  view: LibraryView;
}

function typeLabel(recipe: RecipeVersion): string {
  if (recipe.kind === "sellable_menu") return "เมนูขาย";
  if (recipe.kind === "sub_recipe") return "สูตรย่อย";
  return "สูตรเตรียม";
}

function visibleCode(recipe: RecipeVersion): string | null {
  return typeof recipe.recipeId === "string" && /^(?:RCP|SRCP)-/u.test(recipe.recipeId)
    ? recipe.recipeId
    : null;
}

function resultLink(row: RecipeLibraryRow, mode: Exclude<LibraryMode, "manage">): { to: string; label?: string } {
  const recipeId = encodeRecipeIdentity(row.recipe.recipeId);
  if (mode === "work") return { to: `/work/${recipeId}?stage=all`, label: `เปิดใบงาน ${row.recipe.name}` };
  return { to: `/recipes/${recipeId}` };
}

function ManageRecipeResults({ rows }: Pick<RecipeLibraryResultsProps, "rows">) {
  return (
    <>
      <table className="manage-recipe-table" aria-label="รายการจัดการสูตร">
        <thead>
          <tr>
            <th scope="col">รหัส</th>
            <th scope="col">ชื่อสูตร</th>
            <th scope="col">ประเภท</th>
            <th scope="col">สถานะ</th>
            <th scope="col">ส่วนผสม</th>
            <th scope="col">การทำงาน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ recipe, draft }) => {
            const recipeId = encodeRecipeIdentity(recipe.recipeId);
            return (
              <tr key={recipeId}>
                <td>{visibleCode(recipe) ?? "—"}</td>
                <td>{recipe.name}</td>
                <td>{typeLabel(recipe)}</td>
                <td>{draft ? "รอข้อมูล" : "พร้อมใช้"}</td>
                <td>{recipe.lines.length} รายการ</td>
                <td><Link className="manage-recipe__action" to={`/recipes/${recipeId}/edit`} aria-label={`แก้ไข ${recipe.name}`}>แก้ไข</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="manage-recipe-cards" aria-label="รายการจัดการสูตรบนมือถือ">
        {rows.map(({ recipe, draft }) => {
          const recipeId = encodeRecipeIdentity(recipe.recipeId);
          return (
            <li className="manage-recipe-card" key={recipeId}>
              <strong>{recipe.name}</strong>
              <dl>
                <div><dt>รหัส</dt><dd>{visibleCode(recipe) ?? "—"}</dd></div>
                <div><dt>ประเภท</dt><dd>{typeLabel(recipe)}</dd></div>
                <div><dt>สถานะ</dt><dd>{draft ? "รอข้อมูล" : "พร้อมใช้"}</dd></div>
                <div><dt>ส่วนผสม</dt><dd>ส่วนผสม {recipe.lines.length} รายการ</dd></div>
              </dl>
              <Link className="manage-recipe__action" to={`/recipes/${recipeId}/edit`} aria-label={`แก้ไข ${recipe.name}`}>แก้ไข</Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function RecipeLibraryResults({ rows, mode, view }: RecipeLibraryResultsProps) {
  if (mode === "manage") return <ManageRecipeResults rows={rows} />;

  return (
    <ul className="recipe-results">
      {rows.map((row) => {
        const { recipe, draft } = row;
        const code = visibleCode(recipe);
        const link = resultLink(row, mode);
        return (
          <li className={`recipe-result recipe-result--${view}`} key={encodeRecipeIdentity(recipe.recipeId)}>
            <Link className="recipe-result__link" to={link.to} aria-label={link.label}>
              <span className="recipe-result__name">{recipe.name}</span>
              {code !== null && <span className="recipe-result__code">{code}</span>}
              <span>{typeLabel(recipe)}</span>
              <span>{draft ? "รอข้อมูล" : "พร้อมใช้"}</span>
              <span>ส่วนผสม {recipe.lines.length} รายการ</span>
              {mode === "work" && <span className="recipe-result__action">เปิดใบงาน</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
