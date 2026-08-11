import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultModuleRoot = resolve(dirname(scriptPath), "..");
const v4RelativePath = "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const manifestRelativePath = "Operations/CookBook/sot/v4-2026-08-05/SHA256SUMS.txt";
const v5RelativePath = "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json";
const v6RelativePath = "Operations/CookBook/sot/v6-draft/kitchen-cookbook-v6-draft.json";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isMissing(error) {
  return typeof error === "object" && error !== null && error.code === "ENOENT";
}

async function fileShaOrNull(path) {
  try {
    return sha256(await readFile(path));
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function requireCanonicalDirectory(path, label) {
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory() || await realpath(path) !== path) {
    throw new Error(`Refusing noncanonical ${label}: ${path}`);
  }
}

function expectedV4Sha(manifest) {
  for (const line of manifest.split(/\r?\n/u)) {
    const match = /^([a-fA-F0-9]{64}) [ *](.+)$/u.exec(line);
    if (match?.[2] === "source/kitchen-sot-first-set-v2.json") return match[1].toLowerCase();
  }
  throw new Error("V4 checksum entry is missing");
}

export async function prepareCookbookV6TestVault(options = {}) {
  const moduleRoot = resolve(options.moduleRoot ?? defaultModuleRoot);
  const sourceVaultRoot = resolve(options.sourceVaultRoot ?? resolve(moduleRoot, "../../../../../..", "vault/nntn"));
  const cacheRoot = resolve(moduleRoot, "node_modules/.cache");
  const vaultRoot = resolve(cacheRoot, "cookbook-v6-e2e-vault");
  await requireCanonicalDirectory(moduleRoot, "Cookbook module root");
  await requireCanonicalDirectory(sourceVaultRoot, "source vault");
  await mkdir(cacheRoot, { recursive: true });

  const realV4Path = resolve(sourceVaultRoot, v4RelativePath);
  const realManifestPath = resolve(sourceVaultRoot, manifestRelativePath);
  const realV5Path = resolve(sourceVaultRoot, v5RelativePath);
  const realV6Path = resolve(sourceVaultRoot, v6RelativePath);
  const [v4Bytes, manifest, v5Bytes, realV6Before] = await Promise.all([
    readFile(realV4Path),
    readFile(realManifestPath, "utf8"),
    readFile(realV5Path),
    fileShaOrNull(realV6Path),
  ]);
  const v4Sha256 = sha256(v4Bytes);
  if (v4Sha256 !== expectedV4Sha(manifest)) throw new Error("V4 checksum mismatch");

  await rm(vaultRoot, { recursive: true, force: true });
  for (const relativePath of [v4RelativePath, manifestRelativePath, v5RelativePath]) {
    const target = resolve(vaultRoot, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(sourceVaultRoot, relativePath), target);
  }
  const isolatedV6Path = resolve(vaultRoot, v6RelativePath);
  if (await fileShaOrNull(isolatedV6Path) !== null) throw new Error("Isolated V6 must start absent");
  const realV6After = await fileShaOrNull(realV6Path);
  if (realV6After !== realV6Before) throw new Error("Real V6 changed while preparing isolated vault");

  return {
    moduleRoot,
    vaultRoot,
    v4Sha256,
    v5Sha256: sha256(v5Bytes),
    realV6Sha256: realV6After,
  };
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
  const result = await prepareCookbookV6TestVault();
  console.log(`Prepared isolated Cookbook V6 test vault at ${relative(result.moduleRoot, result.vaultRoot)}`);
  console.log(`V4 SHA-256 ${result.v4Sha256}`);
  console.log(`V5 SHA-256 ${result.v5Sha256}`);
  console.log(result.realV6Sha256 === null ? "Real V6 remains absent" : `Real V6 unchanged ${result.realV6Sha256}`);
}
