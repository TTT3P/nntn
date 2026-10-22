(function exposePrintCenter(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NNTNPrintCenter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPrintCenterApi() {
  "use strict";

  const STAGE_ORDER = ["prep", "cook", "service"];
  const STAGE_LABELS = {
    prep: "ผลิตซอสและของเตรียม",
    cook: "ครัวปรุง / BOM",
    service: "จัดเสิร์ฟหน้าร้าน"
  };
  const STATION_PAGE_WEIGHT = 22;

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function recommendTemplate() {
    return "station";
  }

  function resolveTemplate(template, workStage) {
    return template === "auto" ? recommendTemplate(workStage) : template;
  }

  function workDocuments(recipes, requestedStage = "all") {
    const stages = requestedStage === "all" ? STAGE_ORDER : [requestedStage];
    const documents = [];
    const seen = new Set();

    for (const stage of stages) {
      for (const recipe of recipes || []) {
        const source = recipe.workDocuments?.[stage];
        if (!source) continue;
        const recipeIdentity = recipe.id || recipe.recipe_id || recipe.name;
        const key = `${recipeIdentity}:${stage}`;
        if (seen.has(key)) continue;
        seen.add(key);
        documents.push({
          ...clone(source),
          key,
          stage,
          stageLabel: STAGE_LABELS[stage],
          recipeId: recipe.recipe_id ?? recipe.id,
          recipeName: recipe.name,
          recipeVersion: recipe.version,
          kitchenStatus: recipe.kitchenStatus,
          blockers: clone(recipe.blockers || []),
          operationalNotes: clone(recipe.operationalNotes || []),
          ingredients: clone(source.ingredients || []),
          steps: clone(source.steps || [])
        });
      }
    }
    return documents;
  }

  function contentWeight(kind, value) {
    const text = kind === "ingredient"
      ? `${value.name || ""} ${value.amount || ""} ${value.unit || ""}`
      : String(value || "");
    const lineLength = kind === "ingredient" ? 52 : 58;
    const base = kind === "ingredient" ? 1 : 2;
    return base + Math.max(0, Math.ceil(text.length / lineLength) - 1);
  }

  function paginateDocument(document, pageWeight = STATION_PAGE_WEIGHT) {
    const pages = [];
    let current = { ingredients: [], steps: [], weight: 0 };

    function flush() {
      if (current.ingredients.length === 0 && current.steps.length === 0) return;
      pages.push(current);
      current = { ingredients: [], steps: [], weight: 0 };
    }

    function append(kind, value) {
      const weight = contentWeight(kind, value);
      if (current.weight > 0 && current.weight + weight > pageWeight) flush();
      current[`${kind}s`].push(clone(value));
      current.weight += weight;
    }

    for (const ingredient of document.ingredients || []) append("ingredient", ingredient);
    for (const step of document.steps || []) append("step", step);
    flush();

    if (pages.length === 0) pages.push({ ingredients: [], steps: [], weight: 0 });
    return pages.map((page, index) => ({
      ...clone(document),
      ingredients: page.ingredients,
      steps: page.steps,
      continuation: index > 0,
      partNumber: index + 1,
      totalParts: pages.length
    }));
  }

  function normalizedMultiplier(value) {
    const multiplier = Number.parseFloat(value);
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }

  function buildPagePlan(recipes, settings = {}) {
    const workStage = settings.workStage || "all";
    const template = resolveTemplate(settings.template || "auto", workStage);
    const requestedMultiplier = normalizedMultiplier(settings.multiplier);
    const documents = workDocuments(recipes, workStage).map((document) => ({
      ...document,
      multiplier: document.scalable ? requestedMultiplier : 1
    }));

    if (template === "station" || template === "two-up") {
      const cards = documents.flatMap((document) => paginateDocument(document));
      if (template === "station") return cards.map((document) => ({ kind: "station", document }));

      const sheets = [];
      for (let index = 0; index < cards.length; index += 2) {
        sheets.push({ kind: "two-up", slots: cards.slice(index, index + 2) });
      }
      return sheets;
    }

    return documents.map((document) => ({ kind: template, document }));
  }

  return {
    STAGE_LABELS,
    buildPagePlan,
    paginateDocument,
    recommendTemplate,
    resolveTemplate,
    workDocuments
  };
});
