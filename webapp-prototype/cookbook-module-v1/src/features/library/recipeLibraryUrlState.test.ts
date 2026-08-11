import { describe, expect, test } from "vitest";

import {
  parseRecipeLibraryUrlState,
  updateRecipeLibraryUrlState,
} from "./recipeLibraryUrlState";

describe("parseRecipeLibraryUrlState", () => {
  test("uses the friendly read view when URL state is absent or invalid", () => {
    expect(parseRecipeLibraryUrlState(new URLSearchParams())).toEqual({
      mode: "read",
      view: "read",
      query: "",
      kind: "all",
      status: "all",
      stage: "all",
    });
    expect(
      parseRecipeLibraryUrlState(
        new URLSearchParams("mode=admin&view=grid&kind=bad"),
      ),
    ).toEqual({
      mode: "read",
      view: "read",
      query: "",
      kind: "all",
      status: "all",
      stage: "all",
    });
  });

  test("reads the documented compact view and filters", () => {
    expect(
      parseRecipeLibraryUrlState(
        new URLSearchParams(
          "q=เนื้อ&kind=sellable_menu&status=ready&stage=service&view=compact&mode=work",
        ),
      ),
    ).toMatchObject({
      mode: "work",
      view: "compact",
      query: "เนื้อ",
      kind: "sellable_menu",
      status: "ready",
      stage: "service",
    });
  });

  test("trims the parsed query", () => {
    expect(
      parseRecipeLibraryUrlState(
        new URLSearchParams("q=%20เนื้อ%20"),
      ).query,
    ).toBe("เนื้อ");
  });
});

describe("updateRecipeLibraryUrlState", () => {
  test("updates one field while preserving other valid state and omitting defaults", () => {
    const current = new URLSearchParams(
      "q=ข้าว&kind=sellable_menu&view=compact&junk=x",
    );

    const next = updateRecipeLibraryUrlState(current, {
      status: "ready",
      view: "read",
    });

    expect(next.toString()).toBe(
      "q=%E0%B8%82%E0%B9%89%E0%B8%B2%E0%B8%A7&kind=sellable_menu&status=ready",
    );
  });

  test("trims the query and drops unsupported or invalid current parameters", () => {
    const current = new URLSearchParams(
      "junk=x&q=%20%20เนื้อ%20&mode=admin&view=grid&kind=bad&status=bad&stage=bad",
    );

    expect(updateRecipeLibraryUrlState(current, {}).toString()).toBe(
      "q=%E0%B9%80%E0%B8%99%E0%B8%B7%E0%B9%89%E0%B8%AD",
    );
  });

  test("serializes allowlisted state in stable order", () => {
    const next = updateRecipeLibraryUrlState(new URLSearchParams(), {
      stage: "cook",
      status: "waiting",
      kind: "prepared_recipe",
      query: " stew ",
      view: "compact",
      mode: "manage",
    });

    expect(next.toString()).toBe(
      "mode=manage&view=compact&q=stew&kind=prepared_recipe&status=waiting&stage=cook",
    );
  });
});
