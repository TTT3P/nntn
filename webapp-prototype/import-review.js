(function exposeCookbookImportReview(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CookbookImportReview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCookbookImportReviewApi() {
  "use strict";

  function cleanText(value) {
    return String(value ?? "").trim().toLocaleLowerCase("th");
  }

  function summarizeImport(data) {
    return { ...(data?.meta?.counts || {}) };
  }

  function filterReviewQueue(rows, filters = {}) {
    const query = cleanText(filters.query);
    const recipeKind = cleanText(filters.recipeKind);
    const methodStatus = cleanText(filters.methodStatus);

    return (Array.isArray(rows) ? rows : []).filter((row) => {
      if (query && !cleanText(row.recipe_name).includes(query)) return false;
      if (recipeKind && recipeKind !== "all" && cleanText(row.recipe_kind) !== recipeKind) return false;
      if (methodStatus && methodStatus !== "all" && cleanText(row.v1_method_status) !== methodStatus) return false;
      return true;
    });
  }

  function mergeReviewQueueWithCandidates(rows, recipes) {
    const merged = [...(Array.isArray(rows) ? rows : [])];
    const knownIds = new Set(merged.map((row) => String(row.recipe_id)));

    for (const recipe of Array.isArray(recipes) ? recipes : []) {
      if (knownIds.has(String(recipe.recipe_id))) continue;
      const items = Array.isArray(recipe.items) ? recipe.items : [];
      merged.push({
        recipe_id: recipe.recipe_id,
        recipe_name: recipe.recipe_name,
        recipe_kind: recipe.recipe_type === "sellable_menu" ? "menu" : "prep",
        v1_bom_line_count: items.length,
        v1_dependency_count: items.filter((item) => item.item_kind === "prepared_recipe").length,
        v1_method_status: recipe.method_candidate_text ? "draft" : "missing",
        review_status: "candidate"
      });
      knownIds.add(String(recipe.recipe_id));
    }

    return merged;
  }

  function getRecipeReviewDetail(data, recipeId) {
    const numericId = Number(recipeId);
    const recipe = (data?.recipes || []).find((row) => Number(row.recipe_id) === numericId) || null;
    const items = (data?.recipe_items || [])
      .filter((row) => Number(row.recipe_id) === numericId)
      .sort((a, b) => Number(a.line_no) - Number(b.line_no));

    return {
      recipe,
      directIngredients: items.filter((row) => row.item_kind === "direct_ingredient"),
      preparedRecipes: items.filter((row) => row.item_kind === "prepared_recipe"),
      steps: (data?.recipe_steps || []).find((row) => Number(row.recipe_id) === numericId) || null,
      review: (data?.review_queue || []).find((row) => Number(row.recipe_id) === numericId) || null
    };
  }

  function getFirstSetReview(data, recipeId) {
    const numericId = Number(recipeId);
    const firstSet = data?.first_set_review || {};
    const manifest = (firstSet.manifest || []).find((row) => Number(row.recipe_id) === numericId) || null;
    const recipe = (firstSet.recipes || []).find((row) => Number(row.recipe_id) === numericId) || null;
    const recipeName = recipe?.recipe_name || manifest?.recipe_name;
    const unresolved = (firstSet.unresolved || []).filter((row) => row.recipe_name === recipeName || row.recipe_name === "ชุดเมนูแรก");
    return { manifest, recipe, unresolved };
  }

  function getSourceSectionMappings(data, recipeId) {
    const numericId = Number(recipeId);
    return (data?.first_set_review?.source_sections || []).filter((document) =>
      (document.sections || []).some((section) =>
        Number(section.maps_to_recipe_id) === numericId || Number(section.parent_recipe_id) === numericId
      )
    );
  }

  return {
    filterReviewQueue,
    getFirstSetReview,
    getRecipeReviewDetail,
    getSourceSectionMappings,
    mergeReviewQueueWithCandidates,
    summarizeImport
  };
});
