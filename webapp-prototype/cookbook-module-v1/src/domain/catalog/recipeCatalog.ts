export type RecipeCatalogKind = "sellable_menu" | "prepared_recipe" | "sub_recipe";

export interface RecipeCatalogEntry {
  code: string;
  name: string;
  kind: RecipeCatalogKind;
  legacyBomLineCount: number | null;
  legacyMethodAvailable: boolean;
}

const EXPECTED_KIND_COUNTS: Readonly<Record<RecipeCatalogKind, number>> = {
  sellable_menu: 51,
  prepared_recipe: 33,
  sub_recipe: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function meaningfulString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && ![...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

function parseEntry(value: unknown): RecipeCatalogEntry {
  if (!isRecord(value)) throw new Error("INVALID_RECIPE_CATALOG");
  const { code, name, kind, legacyBomLineCount, legacyMethodAvailable } = value;
  if (
    !meaningfulString(code) ||
    !/^(?:RCP|SRCP)-[0-9A-Z-]+$/u.test(code) ||
    !meaningfulString(name) ||
    (kind !== "sellable_menu" && kind !== "prepared_recipe" && kind !== "sub_recipe") ||
    !(
      legacyBomLineCount === null ||
      (typeof legacyBomLineCount === "number" &&
        Number.isInteger(legacyBomLineCount) &&
        legacyBomLineCount >= 0)
    ) ||
    typeof legacyMethodAvailable !== "boolean"
  ) {
    throw new Error("INVALID_RECIPE_CATALOG");
  }
  return {
    code,
    name,
    kind,
    legacyBomLineCount,
    legacyMethodAvailable,
  };
}

export function parseRecipeCatalog(value: unknown): readonly RecipeCatalogEntry[] {
  if (!Array.isArray(value)) throw new Error("INVALID_RECIPE_CATALOG");
  const entries = value.map(parseEntry);
  const codes = new Set(entries.map(({ code }) => code));
  if (entries.length !== 85 || codes.size !== entries.length) {
    throw new Error("INVALID_RECIPE_CATALOG");
  }
  for (const [kind, expectedCount] of Object.entries(EXPECTED_KIND_COUNTS)) {
    if (entries.filter((entry) => entry.kind === kind).length !== expectedCount) {
      throw new Error("INVALID_RECIPE_CATALOG");
    }
  }
  return entries;
}
