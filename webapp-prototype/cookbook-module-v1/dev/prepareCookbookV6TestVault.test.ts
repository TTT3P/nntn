import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "vitest";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const preparerPath = resolve(moduleRoot, "scripts/prepare-cookbook-v6-test-vault.mjs");
const v4RelativePath =
  "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const manifestRelativePath = "Operations/CookBook/sot/v4-2026-08-05/SHA256SUMS.txt";
const v5RelativePath =
  "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json";

interface RunResult {
  code: number | null;
  stderr: string;
  stdout: string;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function makeCanonicalTemporaryRoot(prefix: string): Promise<string> {
  return await realpath(await mkdtemp(resolve(tmpdir(), prefix)));
}

async function makeSourceVault(root: string): Promise<{ v4: Buffer; v5: Buffer }> {
  const v4 = Buffer.from('{"source":"v4"}\n', "utf8");
  const v5 = Buffer.from('{"source":"v5"}\n', "utf8");
  await mkdir(dirname(resolve(root, v4RelativePath)), { recursive: true });
  await mkdir(dirname(resolve(root, v5RelativePath)), { recursive: true });
  await writeFile(resolve(root, v4RelativePath), v4);
  await writeFile(
    resolve(root, manifestRelativePath),
    `${sha256(v4)}  source/kitchen-sot-first-set-v2.json\n`,
    "utf8",
  );
  await writeFile(resolve(root, v5RelativePath), v5);
  return { v4, v5 };
}

function runPreparer(testModuleRoot: string, sourceVaultRoot: string): Promise<RunResult> {
  const script = `
    import { prepareCookbookV6TestVault } from ${JSON.stringify(pathToFileURL(preparerPath).href)};
    const result = await prepareCookbookV6TestVault({
      moduleRoot: process.env.COOKBOOK_TEST_MODULE_ROOT,
      sourceVaultRoot: process.env.COOKBOOK_TEST_SOURCE_ROOT,
    });
    process.stdout.write(JSON.stringify(result));
  `;
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
      env: {
        ...process.env,
        COOKBOOK_TEST_MODULE_ROOT: testModuleRoot,
        COOKBOOK_TEST_SOURCE_ROOT: sourceVaultRoot,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let stdout = "";
    child.stderr.setEncoding("utf8");
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.stdout.on("data", (chunk: string) => { stdout += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => { resolveRun({ code, stderr, stdout }); });
  });
}

test("prepares an isolated V6 vault under the canonical cache and returns its receipt", async () => {
  const testRoot = await makeCanonicalTemporaryRoot("cookbook-v6-preparer-positive-");
  const temporaryModule = resolve(testRoot, "module");
  const sourceVault = resolve(testRoot, "source-vault");
  try {
    await mkdir(resolve(temporaryModule, "node_modules"), { recursive: true });
    const source = await makeSourceVault(sourceVault);

    const run = await runPreparer(temporaryModule, sourceVault);

    expect(run.code, run.stderr).toBe(0);
    const receipt = JSON.parse(run.stdout) as Record<string, unknown>;
    const isolatedRoot = resolve(
      temporaryModule,
      "node_modules/.cache/cookbook-v6-e2e-vault",
    );
    expect(receipt).toEqual({
      moduleRoot: temporaryModule,
      vaultRoot: isolatedRoot,
      v4Sha256: sha256(source.v4),
      v5Sha256: sha256(source.v5),
      realV6Sha256: null,
    });
    expect(await readFile(resolve(isolatedRoot, v4RelativePath))).toEqual(source.v4);
    expect(await readFile(resolve(isolatedRoot, v5RelativePath))).toEqual(source.v5);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test("rejects a symlinked cache before recursive removal and preserves external bytes", async () => {
  const testRoot = await makeCanonicalTemporaryRoot("cookbook-v6-preparer-cache-link-");
  const temporaryModule = resolve(testRoot, "module");
  const sourceVault = resolve(testRoot, "source-vault");
  const externalCache = resolve(testRoot, "external-cache");
  const externalVault = resolve(externalCache, "cookbook-v6-e2e-vault");
  const sentinelPath = resolve(externalVault, "sentinel.txt");
  const sentinel = Buffer.from("must survive cache symlink rejection\n", "utf8");
  try {
    await mkdir(resolve(temporaryModule, "node_modules"), { recursive: true });
    await makeSourceVault(sourceVault);
    await mkdir(externalVault, { recursive: true });
    await writeFile(sentinelPath, sentinel);
    await symlink(externalCache, resolve(temporaryModule, "node_modules/.cache"), "dir");

    const run = await runPreparer(temporaryModule, sourceVault);

    expect(run.code).not.toBe(0);
    await expect(access(sentinelPath)).resolves.toBeUndefined();
    expect(await readFile(sentinelPath)).toEqual(sentinel);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test("rejects a symlinked existing V6 vault before recursive removal", async () => {
  const testRoot = await makeCanonicalTemporaryRoot("cookbook-v6-preparer-vault-link-");
  const temporaryModule = resolve(testRoot, "module");
  const sourceVault = resolve(testRoot, "source-vault");
  const cacheRoot = resolve(temporaryModule, "node_modules/.cache");
  const externalVault = resolve(testRoot, "external-vault");
  const linkedVault = resolve(cacheRoot, "cookbook-v6-e2e-vault");
  const sentinelPath = resolve(externalVault, "sentinel.txt");
  const sentinel = Buffer.from("must survive vault symlink rejection\n", "utf8");
  try {
    await mkdir(cacheRoot, { recursive: true });
    await makeSourceVault(sourceVault);
    await mkdir(externalVault);
    await writeFile(sentinelPath, sentinel);
    await symlink(externalVault, linkedVault, "dir");

    const run = await runPreparer(temporaryModule, sourceVault);

    expect(run.code).not.toBe(0);
    expect((await lstat(linkedVault)).isSymbolicLink()).toBe(true);
    expect(await readFile(sentinelPath)).toEqual(sentinel);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});
