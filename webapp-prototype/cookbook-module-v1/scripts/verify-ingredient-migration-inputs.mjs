import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = "../outputs/nntn-cookbook-import/NNTN-Kitchen-Cookbook-Import-v1.json";
const EXPECTED_RECEIPT = {
  path: SOURCE_PATH,
  sha256: "473975a555da7b1e67f2357ac0dbb0d65af6cc6f36d6095eededa376e6537a94",
  ingredients: 138,
  recipes: 101,
  lines: 519,
  directLines: 426,
  componentLines: 93,
};

const sourceBytes = await readFile(SOURCE_PATH);
const source = JSON.parse(sourceBytes.toString("utf8"));
const receipt = {
  path: SOURCE_PATH,
  sha256: createHash("sha256").update(sourceBytes).digest("hex"),
  ingredients: source.ingredients.length,
  recipes: source.recipes.length,
  lines: source.recipe_items.length,
  directLines: source.recipe_items.filter(({ item_kind }) => item_kind === "direct_ingredient").length,
  componentLines: source.recipe_items.filter(({ item_kind }) => item_kind === "prepared_recipe").length,
};

assert.deepEqual(receipt, EXPECTED_RECEIPT);
process.stdout.write(`${JSON.stringify(receipt)}\n`);
