import type { RecipeIdentity, RecipeVersion } from "../../domain/cookbook/types";

const contentsEntriesPerPage = 12;

function identityKey(recipeId: RecipeIdentity): string {
  return typeof recipeId === "number"
    ? `number:${String(recipeId)}`
    : `string:${JSON.stringify(recipeId)}`;
}

function publicRecipeCode(recipeId: RecipeIdentity): string | null {
  return typeof recipeId === "string" && /^(?:RCP|SRCP)-/u.test(recipeId)
    ? recipeId
    : null;
}

function RecipePage({
  recipe,
  recipesByIdentity,
  readiness,
}: {
  recipe: RecipeVersion;
  recipesByIdentity: ReadonlyMap<string, RecipeVersion>;
  readiness: "draft" | "ready";
}) {
  const code = publicRecipeCode(recipe.recipeId);
  const componentReferences = recipe.lines.flatMap((line) => {
    if (line.componentRecipeId === null) return [];
    const component = recipesByIdentity.get(identityKey(line.componentRecipeId));
    if (component === undefined) return [];
    const componentCode = publicRecipeCode(component.recipeId);
    return [{
      key: line.lineKey,
      label: componentCode === null ? component.name : `${component.name} · ${componentCode}`,
      amount: line.sourceText,
    }];
  });

  return (
    <article
      className="cookbook-page cookbook-page--recipe"
      aria-label={recipe.name}
      data-page-name="cookbook"
      data-sheet-size="148mm × 210mm"
    >
      <header className="cookbook-recipe__header">
        <div>
          <p>{recipe.kind === "sellable_menu" ? "MENU & ASSEMBLY" : "PREPARATION RECIPE"}</p>
          <h2>{recipe.name}</h2>
        </div>
        <div className="cookbook-recipe__identity">
          {code !== null && <span>{code}</span>}
          <strong>{readiness === "ready" ? "พร้อมใช้" : "ข้อมูลยังไม่ครบ"}</strong>
        </div>
      </header>

      <dl className="cookbook-recipe__facts">
        <div><dt>ผลผลิต</dt><dd>{recipe.yieldText ?? "รอเติมผลผลิต"}</dd></div>
        <div><dt>ประเภท</dt><dd>{recipe.kind === "sellable_menu" ? "เมนูและการประกอบ" : "สูตรเตรียม"}</dd></div>
        <div><dt>หมวด</dt><dd>{recipe.category?.trim() || "ยังไม่จัดหมวด"}</dd></div>
      </dl>

      <div className="cookbook-recipe__body">
        <section>
          <h3>วัตถุดิบ</h3>
          <table className="cookbook-ingredients">
            <tbody>
              {recipe.lines.map((line) => (
                <tr key={line.lineKey}>
                  <th scope="row">{line.itemName}</th>
                  <td>{line.sourceText ?? "รอเติม"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {componentReferences.length > 0 && (
            <section className="cookbook-components" aria-label="สูตรประกอบที่อ้างอิง">
              <h3>สูตรประกอบที่อ้างอิง</h3>
              <ul>
                {componentReferences.map((component) => (
                  <li key={component.key}>
                    <span>{component.label}</span>
                    {component.amount !== null && <strong>{component.amount}</strong>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>

        <section>
          <h3>ขั้นตอนการทำ</h3>
          {recipe.methodText === null
            ? <p className="cookbook-fill-later">รอเติมวิธีทำ</p>
            : <p className="cookbook-method">{recipe.methodText}</p>}
          {recipe.operationalNotes.length > 0 && (
            <section className="cookbook-operational-notes" aria-label="ข้อมูลใช้งาน">
              <h3>ข้อมูลใช้งาน</h3>
              <ul>{recipe.operationalNotes.map((note) => <li key={note}>{note}</li>)}</ul>
            </section>
          )}
        </section>
      </div>

      <footer className="cookbook-page__footer">
        <span>NNTN Cookbook</span>
        <span>{code ?? String(recipe.recipeId)}</span>
      </footer>
    </article>
  );
}

export function CookbookBooklet({
  recipes,
  allRecipes,
  readinessFor,
}: {
  recipes: RecipeVersion[];
  allRecipes: RecipeVersion[];
  readinessFor: (recipeId: RecipeIdentity) => "draft" | "ready";
}) {
  const recipesByIdentity = new Map(
    allRecipes.map((recipe) => [identityKey(recipe.recipeId), recipe]),
  );
  const contentsPages = Array.from(
    { length: Math.max(1, Math.ceil(recipes.length / contentsEntriesPerPage)) },
    (_, pageIndex) => recipes.slice(
      pageIndex * contentsEntriesPerPage,
      (pageIndex + 1) * contentsEntriesPerPage,
    ),
  );
  const firstRecipePage = 2 + contentsPages.length;

  return (
    <section className="cookbook-booklet" aria-label="ตัวอย่างเล่ม Cookbook">
      <section
        className="cookbook-page cookbook-page--cover"
        data-page-name="cookbook"
        data-sheet-size="148mm × 210mm"
      >
        <p>NNTN · KITCHEN COLLECTION</p>
        <div><h1>คู่มือสูตรครัว NNTN</h1><p>{recipes.length} สูตร · สำหรับใช้งานภายใน</p></div>
        <small>เรียงหน้าแบบอ่านปกติ</small>
      </section>

      {contentsPages.map((pageRecipes, contentsPageIndex) => {
        const titleId = `cookbook-contents-title-${String(contentsPageIndex + 1)}`;
        const firstRecipeIndex = contentsPageIndex * contentsEntriesPerPage;
        return (
          <section
            className="cookbook-page cookbook-page--contents"
            aria-labelledby={titleId}
            data-page-name="cookbook"
            data-sheet-size="148mm × 210mm"
            key={titleId}
          >
            <p className="cookbook-page__kicker">NNTN · KITCHEN COLLECTION</p>
            <h2 id={titleId}>{contentsPageIndex === 0 ? "สารบัญ" : "สารบัญ (ต่อ)"}</h2>
            <ol>
              {pageRecipes.map((recipe, index) => (
                <li key={identityKey(recipe.recipeId)}>
                  <span>{recipe.name}</span>
                  <strong>{String(firstRecipePage + firstRecipeIndex + index).padStart(2, "0")}</strong>
                </li>
              ))}
            </ol>
            <footer className="cookbook-page__footer"><span>NNTN Cookbook</span><span>สารบัญ {contentsPageIndex + 1}/{contentsPages.length}</span></footer>
          </section>
        );
      })}

      {recipes.map((recipe) => (
        <RecipePage
          key={identityKey(recipe.recipeId)}
          recipe={recipe}
          recipesByIdentity={recipesByIdentity}
          readiness={readinessFor(recipe.recipeId)}
        />
      ))}
    </section>
  );
}
