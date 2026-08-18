import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import catalogJson from "../data/catalog/recipe-catalog-85.json";
import crosswalkJson from "../data/catalog/v5-recipe-crosswalk.json";
import type { CookbookDocumentClient } from "../data/CookbookDocumentClient";
import type { CookbookRepository } from "../data/CookbookRepository";
import fixture from "../data/fixtures/first-set.json";
import { parseRecipeCatalog } from "../domain/catalog/recipeCatalog";
import { migrateV5ToV6 } from "../domain/cookbookV6/migrateV5ToV6";
import { parseKitchenSotDocument } from "../domain/sot/kitchenSotDocument";
import { makeSnapshot } from "../test/builders";
import { withOwnerConfirmedEggRecipe } from "../test/ownerConfirmedEggRecipe";
import { App } from "./App";

declare const process: {
  getBuiltinModule(name: "node:fs"): { readFileSync(path: string, encoding: "utf8"): string };
};

const productStyles = process.getBuiltinModule("node:fs").readFileSync("src/app/product.css", "utf8");

afterEach(() => {
  cleanup();
  window.location.hash = "";
  vi.restoreAllMocks();
});

function repository(): CookbookRepository {
  return {
    capabilities: { persistence: "session", mediaUpload: false, production: false },
    loadSnapshot: vi.fn(async () => makeSnapshot({ recipes: [], media: [], stepMedia: [] })),
    saveSessionSnapshot: vi.fn(async () => ({ persisted: false as const, scope: "session" as const })),
  };
}

function productClient(): CookbookDocumentClient {
  const v6 = migrateV5ToV6({
    catalog: parseRecipeCatalog(catalogJson),
    v5: withOwnerConfirmedEggRecipe(parseKitchenSotDocument(fixture)),
    crosswalk: crosswalkJson,
    v5Sha256: "9da9f445d7757990af873eb89a47e103399cf5d81428423d02f4281d8ae637e7",
    catalogSha256: "9aa666169fc04774ba735894553d0a8f984f566f2004cbb2a315240cf0a00d66",
    generatedAt: "2026-08-10T00:00:00.000Z",
  });
  return {
    load: vi.fn(async () => ({ document: v6, baseSha256: "c".repeat(64), origin: "synthesized" as const, path: "draft.json" })),
    save: vi.fn(),
  };
}

test("opens as the complete read-first production recipe library", async () => {
  window.location.hash = "#/recipes";
  const client = productClient();
  render(<App repository={repository()} documentClient={client} />);

  expect(await screen.findByRole("heading", { name: "สูตรอาหาร" })).toBeVisible();
  expect(screen.getByText("87 สูตร")).toBeVisible();
  expect(screen.getByRole("searchbox", { name: "ค้นหาชื่อหรือรหัสสูตร" })).toBeVisible();
  expect(screen.getByRole("button", { name: "ดูง่าย", pressed: true })).toBeVisible();
  expect(screen.queryByLabelText("สรุปสูตรอาหาร")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "NNTN Cookbook" })).toBeVisible();
  expect(client.load).toHaveBeenCalledTimes(1);
});

test("keeps internal implementation language off normal product screens", async () => {
  window.location.hash = "#/recipes";
  render(<App repository={repository()} documentClient={productClient()} />);
  const main = await screen.findByRole("main");
  expect(main).not.toHaveTextContent(/AI|Prototype|Mock|V[456]|schema|source review|blocker|provenance|candidate|Supabase|gateway|snapshot|local.session/i);
  expect(screen.queryByRole("button", { name: /export/i })).not.toBeInTheDocument();
});

test("fails closed with a plain message when recipe data cannot load", async () => {
  window.location.hash = "#/recipes";
  const client: CookbookDocumentClient = {
    load: vi.fn(async () => { throw new Error("network detail must stay private"); }),
    save: vi.fn(),
  };
  render(<App repository={repository()} documentClient={client} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("เปิดข้อมูลสูตรอาหารไม่ได้ กรุณาลองใหม่อีกครั้ง");
  expect(document.body).not.toHaveTextContent("network detail must stay private");
});

test("uses 48px controls and the approved responsive ERP layout", () => {
  expect(productStyles).toMatch(/\.recipe-toolbar input,[^{]+\{[^}]*min-height:\s*3rem;/u);
  expect(productStyles).toContain("@media (max-width: 56rem)");
  expect(productStyles).toContain("@media (max-width: 40rem)");
  expect(productStyles).toContain("--cb-canvas: #f2f5f2");
  expect(productStyles).toContain("--cb-sidebar-width: 16rem");
  expect(productStyles).not.toContain("font-family: Inter");
  expect(productStyles).not.toContain("backdrop-filter");
});
