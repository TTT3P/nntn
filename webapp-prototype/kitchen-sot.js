(function exposeKitchenSot(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KitchenSot = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createKitchenSotApi() {
  "use strict";

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function recipeKey(recipeId) {
    return String(recipeId);
  }

  function uniqueBlockers(blockers) {
    const seen = new Set();
    return blockers.filter((blocker) => {
      const key = [blocker.code, blocker.recipeName, blocker.itemName, blocker.message].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function createKitchenSotStore(dataset) {
    const source = clone(dataset || { recipes: [], root_recipe_ids: [] });
    const drafts = new Map((source.recipes || []).map((recipe) => [recipeKey(recipe.recipe_id), recipe]));

    function getRecipeInternal(recipeId) {
      return drafts.get(recipeKey(recipeId)) || null;
    }

    function getRecipe(recipeId) {
      const recipe = getRecipeInternal(recipeId);
      return recipe ? clone(recipe) : null;
    }

    function preparedItems(recipe) {
      return (recipe?.items || []).filter((item) => item.item_kind === "prepared_recipe" && item.decision_status !== "removed_by_handwriting");
    }

    function getRecipeTree(recipeId, ancestry = []) {
      const recipe = getRecipeInternal(recipeId);
      if (!recipe) return null;
      const key = recipeKey(recipeId);
      const nextAncestry = [...ancestry, key];
      const children = preparedItems(recipe).map((item) => {
        const childKey = recipeKey(item.component_recipe_id);
        if (nextAncestry.includes(childKey)) {
          return { recipe: getRecipe(item.component_recipe_id), directIngredients: [], children: [], cycle: true };
        }
        const child = getRecipeTree(item.component_recipe_id, nextAncestry);
        return child || {
          recipe: { recipe_id: item.component_recipe_id, recipe_name: item.item_name, recipe_type: "prepared_recipe" },
          directIngredients: [],
          children: [],
          missing: true
        };
      });

      return {
        recipe: clone(recipe),
        directIngredients: clone((recipe.items || []).filter((item) => item.item_kind === "direct_ingredient" && item.decision_status !== "removed_by_handwriting")),
        children
      };
    }

    function updateItemCandidate(recipeId, lineKey, candidateText, decisionNote) {
      const recipe = getRecipeInternal(recipeId);
      if (!recipe) return null;
      const item = (recipe.items || []).find((entry) => entry.line_key === lineKey);
      if (!item) return clone(recipe);
      item.candidate_text = String(candidateText ?? "").trim() || null;
      item.decision_note = String(decisionNote ?? "").trim() || null;
      item.decision_status = item.candidate_text ? "manual_review" : "needs_review";
      item.selected_source = item.candidate_text ? "manual_review" : null;
      recipe.review_state = "draft_confirmed";
      return clone(recipe);
    }

    function updateMethodCandidate(recipeId, methodText, decisionNote) {
      const recipe = getRecipeInternal(recipeId);
      if (!recipe) return null;
      recipe.method_candidate_text = String(methodText ?? "").trim() || null;
      recipe.method_decision_note = String(decisionNote ?? "").trim() || null;
      recipe.method_selected_source = recipe.method_candidate_text ? "manual_review" : null;
      recipe.review_state = "draft_confirmed";
      return clone(recipe);
    }

    function saveDraft(recipeId) {
      const recipe = getRecipeInternal(recipeId);
      if (!recipe) return null;
      recipe.review_state = "draft_confirmed";
      return clone(recipe);
    }

    function evaluateRecipe(recipeId) {
      const recipe = getRecipeInternal(recipeId);
      if (!recipe) {
        return {
          recipeId,
          status: "blocked",
          blockers: [{ code: "missing_dependency", recipeName: String(recipeId), message: "ไม่พบสูตรที่เชื่อมไว้" }]
        };
      }

      const blockers = (recipe.blockers || []).map((blocker) => ({ ...blocker, recipeName: recipe.recipe_name }));

      for (const item of recipe.items || []) {
        if (item.decision_status === "removed_by_handwriting") continue;
        if (!item.candidate_text) {
          blockers.push({
            code: "missing_quantity_or_unit",
            recipeName: recipe.recipe_name,
            itemName: item.item_name,
            message: `${item.item_name} ยังไม่มีค่าหน้าครัวที่ยืนยัน`
          });
        } else if (["conflict", "needs_review"].includes(item.decision_status)) {
          blockers.push({
            code: "unresolved_source_conflict",
            recipeName: recipe.recipe_name,
            itemName: item.item_name,
            message: `${item.item_name} ยังมีต้นฉบับขัดแย้งกัน`
          });
        }

        if (item.item_kind === "prepared_recipe" && !getRecipeInternal(item.component_recipe_id)) {
          blockers.push({
            code: "missing_dependency",
            recipeName: recipe.recipe_name,
            itemName: item.item_name,
            message: `ยังไม่พบสูตรเตรียม ${item.item_name}`
          });
        }
      }

      if (!recipe.method_candidate_text) {
        blockers.push({ code: "missing_method", recipeName: recipe.recipe_name, message: `${recipe.recipe_name} ยังไม่มีวิธีทำ` });
      }

      const finalBlockers = uniqueBlockers(blockers);
      let status = finalBlockers.length ? "blocked" : "ready_for_final_review";
      if (recipe.review_state === "print_ready" && finalBlockers.length === 0) status = "print_ready";
      else if (recipe.review_state === "draft_confirmed" && finalBlockers.length === 0) status = "draft";
      return { recipeId: recipe.recipe_id, status, blockers: finalBlockers };
    }

    function markPrintReady(recipeId) {
      const evaluation = evaluateRecipe(recipeId);
      if (evaluation.blockers.length) return evaluation;
      const recipe = getRecipeInternal(recipeId);
      recipe.review_state = "print_ready";
      return evaluateRecipe(recipeId);
    }

    function buildPrintBundle(rootRecipeIds) {
      const ordered = [];
      const visited = new Set();
      const visiting = [];
      const blockers = [];

      function visit(recipeId) {
        const key = recipeKey(recipeId);
        const recipe = getRecipeInternal(recipeId);
        if (!recipe) {
          blockers.push({ code: "missing_dependency", recipeName: String(recipeId), message: "ไม่พบสูตรที่เชื่อมไว้" });
          return;
        }
        if (visited.has(key)) return;
        const cycleStart = visiting.indexOf(key);
        if (cycleStart >= 0) {
          const cycleKeys = [...visiting.slice(cycleStart), key];
          const names = cycleKeys.map((cycleKey) => getRecipeInternal(cycleKey)?.recipe_name || cycleKey);
          blockers.push({ code: "dependency_cycle", recipeName: recipe.recipe_name, message: `สูตรเชื่อมวนกัน: ${names.join(" → ")}` });
          return;
        }

        visiting.push(key);
        for (const item of preparedItems(recipe)) visit(item.component_recipe_id);
        visiting.pop();

        if (!visited.has(key)) {
          visited.add(key);
          ordered.push(clone(recipe));
          blockers.push(...evaluateRecipe(recipe.recipe_id).blockers);
        }
      }

      for (const recipeId of rootRecipeIds || []) visit(recipeId);
      const finalBlockers = uniqueBlockers(blockers);
      return { recipes: ordered, blockers: finalBlockers, allowedFinal: finalBlockers.length === 0 };
    }

    return {
      buildPrintBundle,
      evaluateRecipe,
      getRecipe,
      getRecipeTree,
      markPrintReady,
      saveDraft,
      updateItemCandidate,
      updateMethodCandidate
    };
  }

  return { createKitchenSotStore };
});
