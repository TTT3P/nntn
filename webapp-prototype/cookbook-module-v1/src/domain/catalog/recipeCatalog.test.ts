import { describe, expect, test } from "vitest";
import catalogJson from "../../data/catalog/recipe-catalog-85.json";
import { parseRecipeCatalog } from "./recipeCatalog";

describe("recipe catalog", () => {
  test("loads the active 85-recipe catalog without excluded package records", () => {
    const catalog = parseRecipeCatalog(catalogJson);

    expect(catalog).toHaveLength(85);
    expect(catalog.filter((entry) => entry.kind === "sellable_menu")).toHaveLength(51);
    expect(catalog.filter((entry) => entry.kind === "prepared_recipe")).toHaveLength(33);
    expect(catalog.filter((entry) => entry.kind === "sub_recipe")).toHaveLength(1);
    expect(new Set(catalog.map((entry) => entry.code)).size).toBe(85);
    expect(catalog.some((entry) => entry.code.startsWith("PKG-"))).toBe(false);
  });
});
