import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheRoot = resolve(moduleRoot, "node_modules/.cache");
const vaultRoot = resolve(cacheRoot, "cookbook-v5-e2e-vault");
const fixturePath = resolve(moduleRoot, "src/data/fixtures/first-set.json");
const v4RelativePath =
  "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const checksumRelativePath = "Operations/CookBook/sot/v4-2026-08-05/SHA256SUMS.txt";

function requireExactVaultTarget() {
  const relativeTarget = relative(cacheRoot, vaultRoot);
  if (
    relativeTarget !== "cookbook-v5-e2e-vault" ||
    relativeTarget.startsWith(`..${sep}`) ||
    resolve(cacheRoot, relativeTarget) !== vaultRoot
  ) {
    throw new Error("Refusing to prepare a Cookbook test vault outside node_modules/.cache");
  }
}

requireExactVaultTarget();
await mkdir(cacheRoot, { recursive: true });
const realCacheRoot = await realpath(cacheRoot);
await rm(vaultRoot, { recursive: true, force: true });
await mkdir(vaultRoot, { recursive: true });
const realVaultRoot = await realpath(vaultRoot);
if (dirname(realVaultRoot) !== realCacheRoot) {
  throw new Error("Prepared Cookbook test vault escaped node_modules/.cache");
}

const v4Path = resolve(vaultRoot, v4RelativePath);
const checksumPath = resolve(vaultRoot, checksumRelativePath);
await mkdir(dirname(v4Path), { recursive: true });
await copyFile(fixturePath, v4Path);
const copiedBytes = await readFile(v4Path);
const sha256 = createHash("sha256").update(copiedBytes).digest("hex");
await mkdir(dirname(checksumPath), { recursive: true });
await writeFile(checksumPath, `${sha256}  source/kitchen-sot-first-set-v2.json\n`, "utf8");

console.log(`Prepared isolated Cookbook test vault at ${relative(moduleRoot, vaultRoot)}`);
console.log(`V4 SHA-256 ${sha256}`);
