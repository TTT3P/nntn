import { createHash } from "node:crypto";
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest, type Server } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";
import { applyKitchenSotEdit, buildV5Draft } from "../src/domain/sot/kitchenSotEdits";
import { parseKitchenSotDocument, type KitchenSotDocument } from "../src/domain/sot/kitchenSotDocument";
import { createCookbookSotRequestHandler } from "./cookbookSotPlugin";

const MODULE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const V4_RELATIVE_PATH = "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const V4_DIRECTORY_RELATIVE_PATH = "Operations/CookBook/sot/v4-2026-08-05";
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

const invalidExistingDraftCases: Array<{
  name: string;
  mutate(document: KitchenSotDocument): void;
}> = [
  {
    name: "schema metadata",
    mutate(document) {
      document.schema_version = "2.1.0-parseable-but-invalid";
    },
  },
  {
    name: "recipe order",
    mutate(document) {
      [document.recipes[0], document.recipes[1]] = [document.recipes[1]!, document.recipes[0]!];
    },
  },
  {
    name: "recipe identity",
    mutate(document) {
      document.recipes[0]!.recipe_id = "changed-identity";
    },
  },
  {
    name: "review state",
    mutate(document) {
      document.recipes[0]!.review_state = "approved";
    },
  },
  {
    name: "immutable blocker evidence",
    mutate(document) {
      document.recipes.find(({ blockers }) => blockers.length > 0)!.blockers[0]!.message =
        "parseable rewritten evidence";
    },
  },
];

async function writeDraftFixture(vault: TemporaryVault, document: KitchenSotDocument): Promise<Buffer> {
  const bytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8");
  const target = join(vault.root, V5_RELATIVE_PATH);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return bytes;
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

test("rejects a matching V4 document and manifest reached through an external version-directory symlink", async () => {
  const vault = await makeTemporaryVault();
  const outside = await mkdtemp(join(tmpdir(), "cookbook-sot-external-v4-"));
  temporaryRoots.add(outside);
  const vaultV4Directory = join(vault.root, V4_DIRECTORY_RELATIVE_PATH);
  const externalV4Directory = join(outside, "v4-2026-08-05");
  await cp(vaultV4Directory, externalV4Directory, { recursive: true });
  await rm(vaultV4Directory, { recursive: true });
  await symlink(externalV4Directory, vaultV4Directory);

  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const getResponse = await fetch(`${server.origin}/__cookbook/v4`);
    expect(getResponse.status).toBe(422);
    expect(await getResponse.json()).toEqual({ code: "INVALID_DRAFT" });

    const putResponse = await putDraft(server, vault.sha256, makeValidDraft(vault));
    expect(putResponse.status).toBe(422);
    expect(await putResponse.json()).toEqual({ code: "INVALID_DRAFT" });
    await expect(readFile(join(vault.root, V5_RELATIVE_PATH))).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await server.close();
  }
});

test("rejects a symlinked sot ancestor without creating the draft directory outside the vault", async () => {
  const vault = await makeTemporaryVault();
  const outside = await mkdtemp(join(tmpdir(), "cookbook-sot-external-ancestor-"));
  temporaryRoots.add(outside);
  const vaultSotDirectory = join(vault.root, "Operations/CookBook/sot");
  const externalSotDirectory = join(outside, "sot");
  await cp(vaultSotDirectory, externalSotDirectory, { recursive: true });
  await rm(vaultSotDirectory, { recursive: true });
  await symlink(externalSotDirectory, vaultSotDirectory);
  const externalEntriesBefore = await readdir(externalSotDirectory);

  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const response = await putDraft(server, vault.sha256, makeValidDraft(vault));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: "INVALID_DRAFT" });
    expect(await readdir(externalSotDirectory)).toEqual(externalEntriesBefore);
    await expect(readFile(join(externalSotDirectory, "v5-draft", "kitchen-sot-first-set-v5-draft.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
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

test.each(invalidExistingDraftCases)(
  "GET rejects an existing parseable V5 with invalid $name",
  async ({ mutate }) => {
    const vault = await makeTemporaryVault();
    const invalid = makeValidDraft(vault);
    mutate(invalid);
    await writeDraftFixture(vault, invalid);
    const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
    try {
      const response = await fetch(`${server.origin}/__cookbook/v5-draft`);
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ code: "INVALID_DRAFT" });
    } finally {
      await server.close();
    }
  },
);

test.each([
  ["item-serving-note", "item-cost-basis"],
  ["item-cost-basis", "item-serving-note"],
] as const)("GET and PUT reopen cumulative optional edits in %s then %s order", async (firstKind, secondKind) => {
  const vault = await makeTemporaryVault();
  const source = parseKitchenSotDocument(JSON.parse(FIXTURE_TEXT) as unknown);
  const recipe = source.recipes[0]!;
  const item = recipe.items[0]!;
  const edit = (document: KitchenSotDocument, kind: typeof firstKind, value: string) =>
    applyKitchenSotEdit(document, {
      kind,
      recipeId: recipe.recipe_id,
      lineKey: item.line_key,
      value,
    });
  const derivedFrom = { path: V4_RELATIVE_PATH, sha256: vault.sha256 } as const;
  const first = buildV5Draft(edit(source, firstKind, "first value"), "2026-08-07T06:00:00.000Z", derivedFrom);
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const firstPut = await putDraft(server, vault.sha256, first);
    expect(firstPut.status).toBe(200);
    const firstBody = await firstPut.json() as { base_sha256: string; document: KitchenSotDocument };
    const firstGet = await fetch(`${server.origin}/__cookbook/v5-draft`);
    expect(firstGet.status).toBe(200);

    const second = buildV5Draft(
      edit(firstBody.document, secondKind, "second value"),
      "2026-08-07T06:01:00.000Z",
      derivedFrom,
    );
    const secondPut = await putDraft(server, firstBody.base_sha256, second);
    expect(secondPut.status).toBe(200);
    const secondGet = await fetch(`${server.origin}/__cookbook/v5-draft`);
    expect(secondGet.status).toBe(200);
    const reopened = await secondGet.json() as { document: KitchenSotDocument };
    expect(Object.keys(reopened.document.recipes[0]!.items[0]!)).toEqual([
      "line_key", "item_name", "item_kind", "component_recipe_id", "source_values",
      "candidate_text", "selected_source", "decision_status", "decision_note",
      "serving_note", "cost_basis_text",
    ]);
  } finally {
    await server.close();
  }
});

test.each(invalidExistingDraftCases)(
  "PUT rejects an existing parseable V5 with invalid $name as its previous draft",
  async ({ mutate }) => {
    const vault = await makeTemporaryVault();
    const invalid = makeValidDraft(vault);
    mutate(invalid);
    const before = await writeDraftFixture(vault, invalid);
    const baseSha256 = createHash("sha256").update(before).digest("hex");
    const server = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
    try {
      const response = await putDraft(
        server,
        baseSha256,
        makeValidDraft(vault, "2026-08-07T05:00:00.000Z"),
      );
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ code: "INVALID_DRAFT" });
      expect(await readFile(join(vault.root, V5_RELATIVE_PATH))).toEqual(before);
    } finally {
      await server.close();
    }
  },
);

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

test("independent handlers use one filesystem lock for the same canonical draft target", async () => {
  const vault = await makeTemporaryVault();
  let releaseFirstRename!: () => void;
  const firstRenameMayFinish = new Promise<void>((resolve) => { releaseFirstRename = resolve; });
  let reportFirstRename!: () => void;
  const firstRenameStarted = new Promise<void>((resolve) => { reportFirstRename = resolve; });
  const firstServer = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    renameFile: async (from, to) => {
      reportFirstRename();
      await firstRenameMayFinish;
      await rename(from, to);
    },
  }));
  let reportSecondRename!: () => void;
  const secondRenameStarted = new Promise<void>((resolve) => { reportSecondRename = resolve; });
  let secondRenameCount = 0;
  const secondServer = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    renameFile: async (from, to) => {
      secondRenameCount += 1;
      reportSecondRename();
      await rename(from, to);
    },
  }));
  try {
    const firstPromise = putDraft(firstServer, vault.sha256, makeValidDraft(vault));
    await firstRenameStarted;
    const secondPromise = putDraft(
      secondServer,
      vault.sha256,
      makeValidDraft(vault, "2026-08-07T05:00:00.000Z"),
    );
    await Promise.race([
      secondRenameStarted,
      new Promise<void>((resolve) => setTimeout(resolve, 200)),
    ]);
    releaseFirstRename();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ code: "STALE_DRAFT" });
    expect(secondRenameCount).toBe(0);
  } finally {
    releaseFirstRename();
    await Promise.all([firstServer.close(), secondServer.close()]);
  }
});

test("lock cleanup fails closed without deleting a replacement file", async () => {
  const vault = await makeTemporaryVault();
  let releaseRename!: () => void;
  const renameMayFinish = new Promise<void>((resolve) => { releaseRename = resolve; });
  let reportRename!: () => void;
  const renameStarted = new Promise<void>((resolve) => { reportRename = resolve; });
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    renameFile: async (from, to) => {
      reportRename();
      await renameMayFinish;
      await rename(from, to);
    },
  }));
  try {
    const responsePromise = putDraft(server, vault.sha256, makeValidDraft(vault));
    await renameStarted;
    const draftDirectory = join(vault.root, dirname(V5_RELATIVE_PATH));
    const lockNames = (await readdir(draftDirectory)).filter((name) => name.endsWith(".lock"));
    const lockPath = lockNames.length === 1 ? join(draftDirectory, lockNames[0]!) : null;
    const replacementOwner = `${JSON.stringify({ pid: process.pid, token: "pre-release-file-replacement" })}\n`;
    if (lockPath !== null) {
      await rm(lockPath, { recursive: true });
      await writeFile(lockPath, replacementOwner, "utf8");
    }
    releaseRename();

    const response = await responsePromise;
    expect(lockNames).toHaveLength(1);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "WRITE_FAILED" });
    expect(await readFile(lockPath!, "utf8")).toBe(replacementOwner);
    expect((await readdir(draftDirectory)).filter((name) =>
      name.includes(".lock-quarantine-") || name.includes(".lock-owner-")
    )).toEqual([]);
  } finally {
    releaseRename();
    await server.close();
  }
});

test("a live owner held beyond two seconds still makes the competing handler stale", async () => {
  const vault = await makeTemporaryVault();
  let reportFirstRename!: () => void;
  const firstRenameStarted = new Promise<void>((resolve) => { reportFirstRename = resolve; });
  let secondRenameCount = 0;
  const firstServer = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    renameFile: async (from, to) => {
      reportFirstRename();
      await new Promise<void>((resolve) => setTimeout(resolve, 2_200));
      await rename(from, to);
    },
  }));
  const secondServer = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    renameFile: async (from, to) => {
      secondRenameCount += 1;
      await rename(from, to);
    },
  }));
  try {
    const firstPromise = putDraft(firstServer, vault.sha256, makeValidDraft(vault));
    await firstRenameStarted;
    const secondPromise = putDraft(
      secondServer,
      vault.sha256,
      makeValidDraft(vault, "2026-08-07T05:00:00.000Z"),
    );
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ code: "STALE_DRAFT" });
    expect(secondRenameCount).toBe(0);
    const draftEntries = await readdir(join(vault.root, dirname(V5_RELATIVE_PATH)));
    expect(draftEntries.filter((name) => name.includes(".lock"))).toEqual([]);
  } finally {
    await Promise.all([firstServer.close(), secondServer.close()]);
  }
}, 7_000);

test("fully initialized owner publication may pause beyond one second without a 500", async () => {
  const vault = await makeTemporaryVault();
  let reportOwnerPrepared!: () => void;
  const ownerPrepared = new Promise<void>((resolve) => { reportOwnerPrepared = resolve; });
  const delayedServer = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    beforeLockPublication: async () => {
      reportOwnerPrepared();
      await new Promise<void>((resolve) => setTimeout(resolve, 1_200));
    },
  }));
  const competingServer = await startMiddlewareServer(createCookbookSotRequestHandler({ vaultRoot: vault.root }));
  try {
    const delayedPromise = putDraft(delayedServer, vault.sha256, makeValidDraft(vault));
    const firstResult = await Promise.race([
      ownerPrepared.then(() => "prepared" as const),
      delayedPromise.then(() => "response" as const),
    ]);
    expect(firstResult).toBe("prepared");

    const competing = await putDraft(
      competingServer,
      vault.sha256,
      makeValidDraft(vault, "2026-08-07T05:00:00.000Z"),
    );
    const delayed = await delayedPromise;
    expect(competing.status).toBe(200);
    expect(delayed.status).toBe(409);
    expect(await delayed.json()).toEqual({ code: "STALE_DRAFT" });
  } finally {
    await Promise.all([delayedServer.close(), competingServer.close()]);
  }
}, 7_000);

test("pre-release valid lock-directory replacement remains canonical and unchanged", async () => {
  const vault = await makeTemporaryVault();
  let releaseRename!: () => void;
  const renameMayFinish = new Promise<void>((resolve) => { releaseRename = resolve; });
  let reportRename!: () => void;
  const renameStarted = new Promise<void>((resolve) => { reportRename = resolve; });
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    renameFile: async (from, to) => {
      reportRename();
      await renameMayFinish;
      await rename(from, to);
    },
  }));
  try {
    const responsePromise = putDraft(server, vault.sha256, makeValidDraft(vault));
    await renameStarted;
    const draftDirectory = join(vault.root, dirname(V5_RELATIVE_PATH));
    const lockName = (await readdir(draftDirectory)).find((name) => name.endsWith(".lock"));
    expect(lockName).toBeDefined();
    const lockPath = join(draftDirectory, lockName!);
    await rm(lockPath, { recursive: true });
    const replacementOwner = `${JSON.stringify({ pid: process.pid, token: "pre-release-replacement" })}\n`;
    await mkdir(lockPath);
    await writeFile(join(lockPath, "owner.json"), replacementOwner, "utf8");
    releaseRename();

    const response = await responsePromise;
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "WRITE_FAILED" });
    expect(await readFile(join(lockPath, "owner.json"), "utf8")).toBe(replacementOwner);
    expect((await readdir(draftDirectory)).filter((name) =>
      name.includes(".lock-quarantine-") || name.includes(".lock-owner-")
    )).toEqual([]);
  } finally {
    releaseRename();
    await server.close();
  }
});

test("atomic lock removal cannot delete a replacement created before owner cleanup", async () => {
  const vault = await makeTemporaryVault();
  let continueCleanup!: () => void;
  const cleanupMayContinue = new Promise<void>((resolve) => { continueCleanup = resolve; });
  let reportOwnershipVerified!: (lockPath: string) => void;
  const ownershipVerified = new Promise<string>((resolve) => { reportOwnershipVerified = resolve; });
  const server = await startMiddlewareServer(createCookbookSotRequestHandler({
    vaultRoot: vault.root,
    afterLockOwnershipVerified: async (lockPath) => {
      reportOwnershipVerified(lockPath);
      await cleanupMayContinue;
    },
  }));
  try {
    const responsePromise = putDraft(server, vault.sha256, makeValidDraft(vault));
    const firstResult = await Promise.race([
      ownershipVerified.then((lockPath) => ({ kind: "hook" as const, lockPath })),
      responsePromise.then(() => ({ kind: "response" as const })),
    ]);
    expect(firstResult.kind).toBe("hook");
    if (firstResult.kind !== "hook") return;
    const replacementOwner = `${JSON.stringify({ pid: process.pid, token: "valid-replacement" })}\n`;
    await mkdir(firstResult.lockPath);
    await writeFile(join(firstResult.lockPath, "owner.json"), replacementOwner, "utf8");
    continueCleanup();

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(await readFile(join(firstResult.lockPath, "owner.json"), "utf8")).toBe(replacementOwner);
  } finally {
    continueCleanup();
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
