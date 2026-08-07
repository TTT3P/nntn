(function exposeRecipeVariants(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RecipeVariants = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRecipeVariantsApi() {
  "use strict";

  function cleanText(value) {
    return String(value ?? "").trim();
  }

  function safeId(value, fallback) {
    const normalized = cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9ก-๙]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
  }

  function cleanCode(value, fallback) {
    const normalized = cleanText(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
  }

  function suggestSku(recipeCode, variantCode) {
    return `${cleanCode(recipeCode, "MENU")}-${cleanCode(variantCode, "V01")}`;
  }

  function normalizeVariants(variants) {
    if (!Array.isArray(variants)) return [];

    return variants.map((variant, variantIndex) => {
      const parts = Array.isArray(variant?.parts)
        ? variant.parts
          .map((part) => ({
            name: cleanText(part?.name),
            amount: cleanText(part?.amount),
            unit: cleanText(part?.unit) || "กรัม"
          }))
          .filter((part) => part.name || part.amount)
        : [];
      const name = cleanText(variant?.name);
      const status = ["draft", "active", "inactive"].includes(variant?.status)
        ? variant.status
        : (variant?.active === false ? "inactive" : "active");
      const routes = Array.isArray(variant?.routes)
        ? variant.routes.map((route) => ({
          channel: cleanText(route?.channel),
          enabled: route?.enabled === true,
          externalSku: cleanText(route?.externalSku)
        })).filter((route) => route.channel)
        : [];

      return {
        id: safeId(variant?.id || name, `variant-${variantIndex + 1}`),
        name: name || `ตัวเลือกที่ ${variantIndex + 1}`,
        price: cleanText(variant?.price),
        status,
        active: status === "active",
        code: cleanText(variant?.code),
        sku: cleanText(variant?.sku),
        station: cleanText(variant?.station),
        branchRoute: cleanText(variant?.branchRoute) || "assignment",
        routes,
        note: cleanText(variant?.note),
        parts,
        isEmpty: !name && parts.length === 0 && !cleanText(variant?.code) && !cleanText(variant?.sku)
      };
    }).filter((variant) => !variant.isEmpty)
      .map(({ isEmpty, ...variant }) => variant);
  }

  function buildVariantRecipes(baseRecipe, variants, options = {}) {
    const mode = options.mode || "auto";
    if (mode === "single") return [baseRecipe];
    const activeVariants = normalizeVariants(variants).filter((variant) => variant.active);
    if (activeVariants.length === 0) return mode === "variant" ? [] : [baseRecipe];

    return activeVariants.map((variant) => ({
      ...baseRecipe,
      id: `${baseRecipe.id}--${variant.id}`,
      name: `${baseRecipe.name} · ${variant.name}`,
      price: variant.price,
      variant,
      ingredients: [...(baseRecipe.ingredients || []), ...variant.parts],
      steps: variant.note
        ? [...(baseRecipe.steps || []), `เฉพาะ${variant.name}: ${variant.note}`]
        : [...(baseRecipe.steps || [])]
    }));
  }

  return { normalizeVariants, buildVariantRecipes, suggestSku };
});
