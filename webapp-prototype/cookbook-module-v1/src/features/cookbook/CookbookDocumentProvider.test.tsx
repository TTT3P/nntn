import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { CookbookDocumentHttpError, type CookbookDocumentClient } from "../../data/CookbookDocumentClient";
import type { CookbookV6Document } from "../../domain/cookbookV6/types";
import { makeSnapshot } from "../../test/builders";
import { CookbookDocumentProvider, useCookbookDocument } from "./CookbookDocumentProvider";

const document: CookbookV6Document = {
  schemaVersion: "6.0.0",
  generatedAt: "2026-08-10T00:00:00.000Z",
  derivedFrom: {
    v5Path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
    v5Sha256: "a".repeat(64),
    catalogSha256: "b".repeat(64),
  },
  recipes: [{
    recipeId: "RCP-026",
    code: "RCP-026",
    name: "ไข่ข้น",
    kind: "prepared_recipe",
    category: "ไข่",
    active: true,
    reviewState: "confirmed_by_owner",
    sourceLocators: [],
    yieldText: "",
    operationalNotes: [],
    methodDecisionNote: "",
    ingredients: [],
    methodSteps: [],
    blockers: [],
    workDocuments: {},
    parentRecipeIds: [],
    lineage: { source: "v5", sourceRecipeId: 18 },
  }],
};

function Probe() {
  const cookbook = useCookbookDocument();
  const recipe = cookbook.document.recipes[0]!;
  return (
    <form onSubmit={(event) => { event.preventDefault(); void cookbook.save(); }}>
      <label>
        ชื่อสูตร
        <input
          value={recipe.name}
          onChange={(event) => cookbook.applyEdits([{
            type: "recipe-update",
            recipeId: recipe.recipeId,
            patch: { name: event.target.value },
          }])}
        />
      </label>
      <button type="submit">บันทึกสูตร</button>
      <output aria-label="จำนวนสูตร">{cookbook.snapshot.recipes.length}</output>
    </form>
  );
}

test("keeps unsaved editor state after a stale save", async () => {
  const user = userEvent.setup();
  const client: CookbookDocumentClient = {
    load: vi.fn(async () => ({
      document,
      baseSha256: "c".repeat(64),
      origin: "v6-draft" as const,
      path: "Operations/CookBook/sot/v6-draft/kitchen-cookbook-v6-draft.json",
    })),
    save: vi.fn(async () => { throw new CookbookDocumentHttpError(409, "STALE_DRAFT"); }),
  };
  render(
    <CookbookDocumentProvider client={client} mediaSnapshot={makeSnapshot({ recipes: [], media: [], stepMedia: [] })}>
      <Probe />
    </CookbookDocumentProvider>,
  );

  const input = await screen.findByLabelText("ชื่อสูตร");
  await user.type(input, "กระทะ");
  await user.click(screen.getByRole("button", { name: "บันทึกสูตร" }));

  expect(input).toHaveValue("ไข่ข้นกระทะ");
  expect(screen.getByRole("alert")).toHaveTextContent("มีการบันทึกจากหน้าต่างอื่น");
  expect(screen.getByLabelText("จำนวนสูตร")).toHaveTextContent("1");
});
