import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const preparerPath = resolve(moduleRoot, "scripts/prepare-cookbook-test-vault.mjs");

function runNode(scriptPath: string): Promise<number | null> {
  return new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [scriptPath], { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", resolveExit);
  });
}

test("rejects a symlinked cache parent before recursive removal and preserves external bytes", async () => {
  const testRoot = await mkdtemp(resolve(tmpdir(), "cookbook-vault-preparer-"));
  const temporaryModule = resolve(testRoot, "module");
  const externalNodeModules = resolve(testRoot, "external-node-modules");
  const externalVault = resolve(
    externalNodeModules,
    ".cache/cookbook-v5-e2e-vault",
  );
  const sentinelPath = resolve(externalVault, "sentinel.txt");
  const sentinelBytes = Buffer.from("must survive a rejected preparer\n", "utf8");

  try {
    await mkdir(resolve(temporaryModule, "scripts"), { recursive: true });
    await mkdir(resolve(temporaryModule, "src/data/fixtures"), { recursive: true });
    await mkdir(externalVault, { recursive: true });
    await writeFile(
      resolve(temporaryModule, "scripts/prepare-cookbook-test-vault.mjs"),
      await readFile(preparerPath),
    );
    await writeFile(
      resolve(temporaryModule, "src/data/fixtures/first-set.json"),
      "{}\n",
      "utf8",
    );
    await writeFile(sentinelPath, sentinelBytes);
    await symlink(externalNodeModules, resolve(temporaryModule, "node_modules"), "dir");

    expect(await runNode(resolve(temporaryModule, "scripts/prepare-cookbook-test-vault.mjs")))
      .not.toBe(0);
    await expect(access(sentinelPath)).resolves.toBeUndefined();
    expect(await readFile(sentinelPath)).toEqual(sentinelBytes);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});
