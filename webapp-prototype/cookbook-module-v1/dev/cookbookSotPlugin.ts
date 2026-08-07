import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, isAbsolute, join, relative } from "node:path";
import type { Plugin } from "vite";
import { parseKitchenSotDocument } from "../src/domain/sot/kitchenSotDocument";
import { validateKitchenSotTransition } from "../src/domain/sot/kitchenSotValidation";
import {
  V4_ENDPOINT,
  V5_ENDPOINT,
  type SotReadResponse,
  type SotSaveRequest,
  type SotSaveResponse,
} from "../src/domain/sot/kitchenSotTransport";

const V4_RELATIVE_PATH = "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const CHECKSUM_RELATIVE_PATH = "Operations/CookBook/sot/v4-2026-08-05/SHA256SUMS.txt";
const V5_DIRECTORY_RELATIVE_PATH = "Operations/CookBook/sot/v5-draft";
const V5_FILENAME = "kitchen-sot-first-set-v5-draft.json";
const V5_RELATIVE_PATH = `${V5_DIRECTORY_RELATIVE_PATH}/${V5_FILENAME}`;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

interface CookbookSotPluginOptions {
  vaultRoot: string;
  openFile?: typeof open;
  renameFile?: typeof rename;
  unlinkFile?: typeof unlink;
}

type NextFunction = () => void;

export type CookbookSotRequestHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  next: NextFunction,
) => Promise<void>;

interface VerifiedSource {
  bytes: Buffer;
  document: ReturnType<typeof parseKitchenSotDocument>;
  sha256: string;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function isWithin(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return pathFromParent === "" || (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent));
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function checksumFromManifest(manifest: string): string | null {
  const expectedName = "source/kitchen-sot-first-set-v2.json";
  for (const line of manifest.split(/\r?\n/u)) {
    const match = /^([a-fA-F0-9]{64}) [ *](.+)$/u.exec(line);
    if (match?.[2] === expectedName) return match[1]!.toLowerCase();
  }
  return null;
}

async function loadVerifiedSource(vaultRoot: string): Promise<VerifiedSource> {
  const sourcePath = join(vaultRoot, V4_RELATIVE_PATH);
  const sourceDirectory = await realpath(dirname(sourcePath));
  const realSourcePath = await realpath(sourcePath);
  if (!isWithin(sourceDirectory, realSourcePath)) throw new Error("V4 source escaped its fixed directory");

  const [bytes, manifest] = await Promise.all([
    readFile(realSourcePath),
    readFile(join(vaultRoot, CHECKSUM_RELATIVE_PATH), "utf8"),
  ]);
  const actualSha256 = sha256(bytes);
  const expectedSha256 = checksumFromManifest(manifest);
  if (expectedSha256 === null || expectedSha256 !== actualSha256) {
    throw new SourceChecksumMismatchError();
  }
  return {
    bytes,
    document: parseKitchenSotDocument(JSON.parse(bytes.toString("utf8")) as unknown),
    sha256: actualSha256,
  };
}

class SourceChecksumMismatchError extends Error {}
class DraftNotFoundError extends Error {}
class InvalidDraftError extends Error {}
class PayloadTooLargeError extends Error {}
class PreconditionRequiredError extends Error {}
class StaleDraftError extends Error {}
class WriteFailedError extends Error {}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function resolveDraftDirectory(vaultRoot: string, create: boolean): Promise<string> {
  const draftDirectory = join(vaultRoot, V5_DIRECTORY_RELATIVE_PATH);
  if (create) await mkdir(draftDirectory, { recursive: true });
  const [realVaultRoot, realDraftDirectory] = await Promise.all([
    realpath(vaultRoot),
    realpath(draftDirectory),
  ]);
  if (!isWithin(realVaultRoot, realDraftDirectory)) throw new InvalidDraftError();
  return realDraftDirectory;
}

async function loadDraft(vaultRoot: string): Promise<{ bytes: Buffer; document: VerifiedSource["document"] }> {
  try {
    const realDraftDirectory = await resolveDraftDirectory(vaultRoot, false);
    const expectedTarget = join(realDraftDirectory, V5_FILENAME);
    const realTarget = await realpath(expectedTarget);
    if (realTarget !== expectedTarget) throw new InvalidDraftError();
    const bytes = await readFile(realTarget);
    return {
      bytes,
      document: parseKitchenSotDocument(JSON.parse(bytes.toString("utf8")) as unknown),
    };
  } catch (error) {
    if (isMissingFile(error)) throw new DraftNotFoundError();
    if (error instanceof InvalidDraftError) throw error;
    throw new InvalidDraftError();
  }
}

async function readBoundedBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let byteCount = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    byteCount += bytes.byteLength;
    if (byteCount > MAX_BODY_BYTES) throw new PayloadTooLargeError();
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function parseSaveRequest(bytes: Buffer): SotSaveRequest {
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new InvalidDraftError();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new InvalidDraftError();
  const body = value as Record<string, unknown>;
  const document = parseKitchenSotDocument(body.document);
  return {
    base_sha256: typeof body.base_sha256 === "string" ? body.base_sha256 : "",
    document,
  };
}

function requireMatchingPreconditions(
  request: IncomingMessage,
  bodyBaseSha256: string,
  currentBaseSha256: string,
): void {
  const ifMatch = request.headers["if-match"];
  if (ifMatch === undefined || bodyBaseSha256 === "") throw new PreconditionRequiredError();
  const header = Array.isArray(ifMatch) ? ifMatch.join(",") : ifMatch;
  const match = /^"([a-fA-F0-9]{64})"$/u.exec(header);
  if (
    match === null ||
    match[1]!.toLowerCase() !== bodyBaseSha256.toLowerCase() ||
    bodyBaseSha256.toLowerCase() !== currentBaseSha256
  ) {
    throw new StaleDraftError();
  }
}

async function writeDraft(
  vaultRoot: string,
  document: VerifiedSource["document"],
  openFile: typeof open,
  renameFile: typeof rename,
  unlinkFile: typeof unlink,
): Promise<{ bytes: Buffer; sha256: string }> {
  let realDraftDirectory: string;
  try {
    realDraftDirectory = await resolveDraftDirectory(vaultRoot, true);
  } catch (error) {
    if (error instanceof InvalidDraftError) throw error;
    throw new WriteFailedError();
  }
  const targetPath = join(realDraftDirectory, V5_FILENAME);
  try {
    const existingTarget = await realpath(targetPath);
    if (existingTarget !== targetPath) throw new InvalidDraftError();
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }

  const bytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8");
  const temporaryPath = join(realDraftDirectory, `.${V5_FILENAME}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await openFile(temporaryPath, "wx");
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    await renameFile(temporaryPath, targetPath);
  } catch {
    await handle?.close().catch(() => undefined);
    if (handle !== undefined) await unlinkFile(temporaryPath).catch(() => undefined);
    throw new WriteFailedError();
  }
  return { bytes, sha256: sha256(bytes) };
}

async function handlePut(
  request: IncomingMessage,
  response: ServerResponse,
  options: CookbookSotPluginOptions,
): Promise<void> {
  const source = await loadVerifiedSource(options.vaultRoot);
  const saveRequest = parseSaveRequest(await readBoundedBody(request));
  let previousDraft: Awaited<ReturnType<typeof loadDraft>> | null;
  try {
    previousDraft = await loadDraft(options.vaultRoot);
  } catch (error) {
    if (error instanceof DraftNotFoundError) previousDraft = null;
    else throw error;
  }
  const currentBaseSha256 = previousDraft === null ? source.sha256 : sha256(previousDraft.bytes);
  requireMatchingPreconditions(request, saveRequest.base_sha256, currentBaseSha256);
  validateKitchenSotTransition(
    source.document,
    previousDraft?.document ?? null,
    saveRequest.document,
    { path: V4_RELATIVE_PATH, sha256: source.sha256 },
  );
  const saved = await writeDraft(
    options.vaultRoot,
    saveRequest.document,
    options.openFile ?? open,
    options.renameFile ?? rename,
    options.unlinkFile ?? unlink,
  );
  const body: SotSaveResponse = {
    document: saveRequest.document,
    sha256: saved.sha256,
    base_sha256: saved.sha256,
    generatedAt: saveRequest.document.generated_at,
    path: V5_RELATIVE_PATH,
  };
  sendJson(response, 200, body);
}

export function createCookbookSotRequestHandler(
  options: CookbookSotPluginOptions,
): CookbookSotRequestHandler {
  let pendingPut = Promise.resolve();
  return async (request, response, next) => {
    const path = request.url?.split("?", 1)[0];
    if (path !== V4_ENDPOINT && path !== V5_ENDPOINT) {
      next();
      return;
    }

    const allowed = path === V4_ENDPOINT
      ? request.method === "GET"
      : request.method === "GET" || request.method === "PUT";
    if (!allowed) {
      sendJson(response, 405, { code: "METHOD_NOT_ALLOWED" });
      return;
    }

    try {
      if (path === V5_ENDPOINT && request.method === "PUT") {
        const precedingPut = pendingPut;
        let releasePut!: () => void;
        pendingPut = new Promise<void>((resolve) => { releasePut = resolve; });
        await precedingPut;
        try {
          await handlePut(request, response, options);
        } finally {
          releasePut();
        }
        return;
      }
      const source = await loadVerifiedSource(options.vaultRoot);
      if (path === V4_ENDPOINT) {
        const body: SotReadResponse = {
          document: source.document,
          sourcePath: V4_RELATIVE_PATH,
          sourceSha256: source.sha256,
          base_sha256: source.sha256,
          origin: "v4",
        };
        sendJson(response, 200, body);
        return;
      }

      const draft = await loadDraft(options.vaultRoot);
      const body: SotReadResponse = {
        document: draft.document,
        sourcePath: V4_RELATIVE_PATH,
        sourceSha256: source.sha256,
        base_sha256: sha256(draft.bytes),
        origin: "v5-draft",
      };
      sendJson(response, 200, body);
    } catch (error) {
      if (error instanceof SourceChecksumMismatchError) {
        sendJson(response, 409, { code: "SOURCE_CHECKSUM_MISMATCH" });
      } else if (error instanceof DraftNotFoundError) {
        sendJson(response, 404, { code: "DRAFT_NOT_FOUND" });
      } else if (error instanceof PayloadTooLargeError) {
        sendJson(response, 413, { code: "PAYLOAD_TOO_LARGE" });
      } else if (error instanceof PreconditionRequiredError) {
        sendJson(response, 428, { code: "PRECONDITION_REQUIRED" });
      } else if (error instanceof StaleDraftError) {
        sendJson(response, 409, { code: "STALE_DRAFT" });
      } else if (error instanceof WriteFailedError) {
        sendJson(response, 500, { code: "WRITE_FAILED" });
      } else {
        sendJson(response, 422, { code: "INVALID_DRAFT" });
      }
    }
  };
}

export function cookbookSotPlugin(options: CookbookSotPluginOptions): Plugin {
  return {
    name: "cookbook-sot",
    configureServer(server) {
      server.middlewares.use(createCookbookSotRequestHandler(options));
    },
  };
}
