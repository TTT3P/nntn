import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultModuleRoot = resolve(dirname(scriptPath), "..");
const vaultDirectoryName = "cookbook-v5-e2e-vault";
const v4RelativePath =
  "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const checksumRelativePath = "Operations/CookBook/sot/v4-2026-08-05/SHA256SUMS.txt";

function isMissing(error) {
  return typeof error === "object" && error !== null && error.code === "ENOENT";
}

async function requireCanonicalDirectory(path, label) {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`Refusing noncanonical ${label}: ${path}`);
  }
  const canonicalPath = await realpath(path);
  if (canonicalPath !== path) {
    throw new Error(`Refusing noncanonical ${label}: ${path}`);
  }
  return canonicalPath;
}

async function requireCanonicalExistingVault(vaultRoot, cacheRoot) {
  let metadata;
  try {
    metadata = await lstat(vaultRoot);
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`Refusing noncanonical existing Cookbook test vault: ${vaultRoot}`);
  }
  const canonicalVaultRoot = await realpath(vaultRoot);
  if (canonicalVaultRoot !== vaultRoot || dirname(canonicalVaultRoot) !== cacheRoot) {
    throw new Error(`Refusing noncanonical existing Cookbook test vault: ${vaultRoot}`);
  }
}

export async function prepareCookbookTestVault(options = {}) {
  const moduleRoot = resolve(options.moduleRoot ?? defaultModuleRoot);
  const nodeModulesRoot = resolve(moduleRoot, "node_modules");
  const cacheRoot = resolve(nodeModulesRoot, ".cache");
  const vaultRoot = resolve(cacheRoot, vaultDirectoryName);
  const fixturePath = resolve(moduleRoot, "src/data/fixtures/first-set.json");

  await requireCanonicalDirectory(moduleRoot, "Cookbook module root");
  await requireCanonicalDirectory(nodeModulesRoot, "Cookbook node_modules directory");
  if (cacheRoot !== resolve(moduleRoot, "node_modules/.cache")) {
    throw new Error("Refusing a Cookbook cache path outside the canonical module root");
  }
  try {
    await requireCanonicalDirectory(cacheRoot, "Cookbook cache directory");
  } catch (error) {
    if (!isMissing(error)) throw error;
    await mkdir(cacheRoot);
    await requireCanonicalDirectory(cacheRoot, "Cookbook cache directory");
  }
  if (relative(cacheRoot, vaultRoot) !== vaultDirectoryName) {
    throw new Error("Refusing a Cookbook test vault outside node_modules/.cache");
  }
  await requireCanonicalExistingVault(vaultRoot, cacheRoot);

  await rm(vaultRoot, { recursive: true, force: true });
  await mkdir(vaultRoot);
  await requireCanonicalDirectory(vaultRoot, "Cookbook test vault");

  const v4Path = resolve(vaultRoot, v4RelativePath);
  const checksumPath = resolve(vaultRoot, checksumRelativePath);
  await mkdir(dirname(v4Path), { recursive: true });
  await copyFile(fixturePath, v4Path);
  const copiedBytes = await readFile(v4Path);
  const sha256 = createHash("sha256").update(copiedBytes).digest("hex");
  await mkdir(dirname(checksumPath), { recursive: true });
  await writeFile(checksumPath, `${sha256}  source/kitchen-sot-first-set-v2.json\n`, "utf8");

  return { moduleRoot, vaultRoot, sha256 };
}

async function isDirectExecution() {
  if (process.argv[1] === undefined) return false;
  try {
    return await realpath(resolve(process.argv[1])) === await realpath(scriptPath);
  } catch {
    return false;
  }
}

if (await isDirectExecution()) {
  const result = await prepareCookbookTestVault();
  console.log(`Prepared isolated Cookbook test vault at ${relative(result.moduleRoot, result.vaultRoot)}`);
  console.log(`V4 SHA-256 ${result.sha256}`);
}
