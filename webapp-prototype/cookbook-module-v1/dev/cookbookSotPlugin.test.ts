import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { buildV5Draft } from "../src/domain/sot/kitchenSotEdits";
import { parseKitchenSotDocument, type KitchenSotDocument } from "../src/domain/sot/kitchenSotDocument";
import { createCookbookSotRequestHandler } from "./cookbookSotPlugin";

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const V4_RELATIVE_PATH = "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const CHECKSUM_RELATIVE_PATH = "Operations/CookBook/sot/v4-2026-08-05/SHA256SUMS.txt";
const V5_RELATIVE_PATH = "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json";
const FIXTURE_TEXT = await readFile(join(MODULE_DIRECTORY, "../src/data/fixtures/first-set.json"), "utf8");

interface TemporaryVault {
  root: string;
  sha256: string;
}

interface MiddlewareServer {
  origin: string;
  close(): Promise<void>;
}

const temporaryRoots = new Set<string>();

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots.clear();
});

async function makeTemporaryVault(): Promise<TemporaryVault> {
  const root = await mkdtemp(join(tmpdir(), "cookbook-sot-plugin-"));
  temporaryRoots.add(root);
  const sourcePath = join(root, V4_RELATIVE_PATH);
  const fixturePath = join(MODULE_DIRECTORY, "../src/data/fixtures/first-set.json");
  await mkdir(dirname(sourcePath), { recursive: true });
  await copyFile(fixturePath, sourcePath);
  const bytes = await readFile(sourcePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(join(root, CHECKSUM_RELATIVE_PATH), `${sha256}  source/kitchen-sot-first-set-v2.json\n`, "utf8");
  return { root, sha256 };
}

async function startMiddlewareServer(
  handler: ReturnType<typeof createCookbookSotRequestHandler>,
): Promise<MiddlewareServer> {
  const server: Server = createServer((request, response) => {
    void handler(request, response, () => {
      response.statusCode = 404;
      response.end("fallthrough");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Expected TCP server address");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

function makeValidDraft(vault: TemporaryVault, generatedAt = "2026-08-07T04:00:00.000Z"): KitchenSotDocument {
  const fixture = JSON.parse(FIXTURE_TEXT) as unknown;
  return buildV5Draft(parseKitchenSotDocument(fixture), generatedAt, {
    path: V4_RELATIVE_PATH,
    sha256: vault.sha256,
  });
}

async function putDraft(
  server: MiddlewareServer,
  baseSha256: string | undefined,
  document: KitchenSotDocument,
  bodyBaseSha256 = baseSha256,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (baseSha256 !== undefined) headers["If-Match"] = `"${baseSha256}"`;
  return fetch(`${server.origin}/__cookbook/v5-draft`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ base_sha256: bodyBaseSha256, document }),
  });
}

async function rawRequest(origin: string, path: string): Promise<{ status: number; body: string }> {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      host: url.hostname,
      port: url.port,
      method: "GET",
      path,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.on("error", reject);
    request.end();
  });
}

test("serves verified V4 and reports V5 missing without falling through", async () => {
  const vault = await makeTemporaryVault();
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const v5 = await fetch(`${server.origin}/__cookbook/v5-draft`);
    expect(v5.status).toBe(404);
    expect(await v5.json()).toEqual({ code: "DRAFT_NOT_FOUND" });

    const v4 = await fetch(`${server.origin}/__cookbook/v4`);
    expect(v4.status).toBe(200);
    expect(await v4.json()).toMatchObject({
      sourceSha256: vault.sha256,
      base_sha256: vault.sha256,
      origin: "v4",
    });
  } finally {
    await server.close();
  }
});

test("rejects unsupported exact-route methods", async () => {
  const vault = await makeTemporaryVault();
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const [post, remove] = await Promise.all([
      fetch(`${server.origin}/__cookbook/v4`, { method: "POST" }),
      fetch(`${server.origin}/__cookbook/v5-draft`, { method: "DELETE" }),
    ]);
    expect(post.status).toBe(405);
    expect(await post.json()).toEqual({ code: "METHOD_NOT_ALLOWED" });
    expect(remove.status).toBe(405);
    expect(await remove.json()).toEqual({ code: "METHOD_NOT_ALLOWED" });
  } finally {
    await server.close();
  }
});

test("hostile non-exact paths fall through before filesystem access", async () => {
  const nonexistentVault = join(tmpdir(), `does-not-exist-${crypto.randomUUID()}`);
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: nonexistentVault }));
  try {
    await expect(rawRequest(server.origin, "/__cookbook/v5-draft/../other")).resolves.toEqual({
      status: 404,
      body: "fallthrough",
    });
    await expect(rawRequest(server.origin, "/__cookbook/v5-draft/%2e%2e/other")).resolves.toEqual({
      status: 404,
      body: "fallthrough",
    });
  } finally {
    await server.close();
  }
});

test("rejects a symlinked draft directory that escapes the temporary vault", async () => {
  const vault = await makeTemporaryVault();
  const outside = await mkdtemp(join(tmpdir(), "cookbook-sot-outside-"));
  temporaryRoots.add(outside);
  const draftDirectory = join(vault.root, dirname(V5_RELATIVE_PATH));
  await mkdir(dirname(draftDirectory), { recursive: true });
  await symlink(outside, draftDirectory);
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const response = await putDraft(server, vault.sha256, makeValidDraft(vault));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: "INVALID_DRAFT" });
    expect(await readdir(outside)).toEqual([]);
  } finally {
    await server.close();
  }
});

test("a mutated V4 fails the checksum gate for GET V4 and PUT V5", async () => {
  const vault = await makeTemporaryVault();
  await writeFile(join(vault.root, V4_RELATIVE_PATH), " ", { flag: "a" });
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const getResponse = await fetch(`${server.origin}/__cookbook/v4`);
    expect(getResponse.status).toBe(409);
    expect(await getResponse.json()).toEqual({ code: "SOURCE_CHECKSUM_MISMATCH" });
    const putResponse = await putDraft(server, vault.sha256, makeValidDraft(vault));
    expect(putResponse.status).toBe(409);
    expect(await putResponse.json()).toEqual({ code: "SOURCE_CHECKSUM_MISMATCH" });
  } finally {
    await server.close();
  }
});

test("oversized and malformed payloads leave V5 absent", async () => {
  const vault = await makeTemporaryVault();
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const oversized = await fetch(`${server.origin}/__cookbook/v5-draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": `"${vault.sha256}"` },
      body: "x".repeat(5 * 1024 * 1024 + 1),
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ code: "PAYLOAD_TOO_LARGE" });

    const malformed = await fetch(`${server.origin}/__cookbook/v5-draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "If-Match": `"${vault.sha256}"` },
      body: "{",
    });
    expect(malformed.status).toBe(422);
    expect(await malformed.json()).toEqual({ code: "INVALID_DRAFT" });
    await expect(readFile(join(vault.root, V5_RELATIVE_PATH))).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await server.close();
  }
});

test("missing and disagreeing preconditions leave V5 absent", async () => {
  const vault = await makeTemporaryVault();
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const missing = await putDraft(server, undefined, makeValidDraft(vault));
    expect(missing.status).toBe(428);
    expect(await missing.json()).toEqual({ code: "PRECONDITION_REQUIRED" });

    const disagreeing = await putDraft(server, vault.sha256, makeValidDraft(vault), "0".repeat(64));
    expect(disagreeing.status).toBe(409);
    expect(await disagreeing.json()).toEqual({ code: "STALE_DRAFT" });
    await expect(readFile(join(vault.root, V5_RELATIVE_PATH))).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await server.close();
  }
});

test("invalid transition data is rejected before creating V5", async () => {
  const vault = await makeTemporaryVault();
  const invalid = makeValidDraft(vault);
  invalid.recipes[0]!.recipe_name = "rewritten immutable name";
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const response = await putDraft(server, vault.sha256, invalid);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: "INVALID_DRAFT" });
    await expect(readFile(join(vault.root, V5_RELATIVE_PATH))).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await server.close();
  }
});

test("failed exclusive open never deletes a temporary path the request did not own", async () => {
  const vault = await makeTemporaryVault();
  const unlinkedPaths: string[] = [];
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    openFile: async () => { throw new Error("injected open failure"); },
    unlinkFile: async (path) => { unlinkedPaths.push(path.toString()); },
  }));
  try {
    const response = await putDraft(server, vault.sha256, makeValidDraft(vault));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "WRITE_FAILED" });
    expect(unlinkedPaths).toEqual([]);
  } finally {
    await server.close();
  }
});

test("two writes from one base reject the stale second write and preserve the first bytes", async () => {
  const vault = await makeTemporaryVault();
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const first = await putDraft(server, vault.sha256, makeValidDraft(vault));
    expect(first.status).toBe(200);
    const firstBody = await first.json() as { base_sha256: string; sha256: string };
    expect(firstBody.base_sha256).toBe(firstBody.sha256);
    const firstBytes = await readFile(join(vault.root, V5_RELATIVE_PATH));

    const second = await putDraft(server, vault.sha256, makeValidDraft(vault, "2026-08-07T05:00:00.000Z"));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ code: "STALE_DRAFT" });
    expect(await readFile(join(vault.root, V5_RELATIVE_PATH))).toEqual(firstBytes);
  } finally {
    await server.close();
  }
});

test("overlapping writes from one base serialize so only the first can commit", async () => {
  const vault = await makeTemporaryVault();
  let releaseFirstRename!: () => void;
  const firstRenameMayFinish = new Promise<void>((resolve) => { releaseFirstRename = resolve; });
  let reportFirstRename!: () => void;
  const firstRenameStarted = new Promise<void>((resolve) => { reportFirstRename = resolve; });
  let renameCount = 0;
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    renameFile: async (from, to) => {
      renameCount += 1;
      if (renameCount === 1) {
        reportFirstRename();
        await firstRenameMayFinish;
      }
      await rename(from, to);
    },
  }));
  try {
    const firstPromise = putDraft(server, vault.sha256, makeValidDraft(vault));
    await firstRenameStarted;
    const secondPromise = putDraft(server, vault.sha256, makeValidDraft(vault, "2026-08-07T05:00:00.000Z"));
    for (let turn = 0; turn < 20 && renameCount < 2; turn += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    releaseFirstRename();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ code: "STALE_DRAFT" });
    expect(renameCount).toBe(1);
  } finally {
    releaseFirstRename();
    await server.close();
  }
});

test("rename failure preserves V5 byte-for-byte and removes only its temporary file", async () => {
  const vault = await makeTemporaryVault();
  const initialServer = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  const first = await putDraft(initialServer, vault.sha256, makeValidDraft(vault));
  expect(first.status).toBe(200);
  const firstResponse = await first.json() as { base_sha256: string };
  await initialServer.close();
  const draftPath = join(vault.root, V5_RELATIVE_PATH);
  const before = await readFile(draftPath);

  const failingServer = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    renameFile: async () => { throw new Error("injected rename failure"); },
  }));
  try {
    const existing = parseKitchenSotDocument(JSON.parse(before.toString("utf8")) as unknown);
    const next = buildV5Draft(existing, "2026-08-07T05:00:00.000Z", {
      path: V4_RELATIVE_PATH,
      sha256: vault.sha256,
    });
    const response = await putDraft(failingServer, firstResponse.base_sha256, next);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "WRITE_FAILED" });
    expect(await readFile(draftPath)).toEqual(before);
    expect((await readdir(dirname(draftPath))).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  } finally {
    await failingServer.close();
  }
});
