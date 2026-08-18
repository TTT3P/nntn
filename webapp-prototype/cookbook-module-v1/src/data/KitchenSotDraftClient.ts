import {
  parseKitchenSotDocument,
  type KitchenSotDocument,
} from "../domain/sot/kitchenSotDocument";
import {
  V4_ENDPOINT,
  V5_ENDPOINT,
  type SotSaveResponse,
} from "../domain/sot/kitchenSotTransport";

type KitchenSotFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface LoadedKitchenSotDraft {
  document: KitchenSotDocument;
  origin: "v4" | "v5-draft";
  sourcePath: string;
  sourceSha256: string;
  baseSha256: string;
}

export interface KitchenSotDraftClient {
  load(): Promise<LoadedKitchenSotDraft>;
  save(document: KitchenSotDocument, baseSha256: string): Promise<SotSaveResponse>;
}

export class KitchenSotHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(`Kitchen SOT request failed (${code})`);
    this.name = "KitchenSotHttpError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text());
  } catch {
    throw new KitchenSotHttpError(response.status, "INVALID_RESPONSE");
  }
}

function errorCode(value: unknown): string {
  return isRecord(value) &&
      typeof value.code === "string" &&
      /^[A-Z][A-Z0-9_]{0,63}$/u.test(value.code)
    ? value.code
    : "HTTP_ERROR";
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new KitchenSotHttpError(200, "INVALID_RESPONSE");
  }
  return value;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/iu.test(value);
}

function requireSha256(value: unknown): string {
  if (!isSha256(value)) {
    throw new KitchenSotHttpError(200, "INVALID_RESPONSE");
  }
  return value;
}

function parseLoadedDraft(
  value: unknown,
  expectedOrigin: LoadedKitchenSotDraft["origin"],
): LoadedKitchenSotDraft {
  if (!isRecord(value) || value.origin !== expectedOrigin) {
    throw new KitchenSotHttpError(200, "INVALID_RESPONSE");
  }
  try {
    return {
      document: parseKitchenSotDocument(value.document),
      origin: expectedOrigin,
      sourcePath: requireString(value.sourcePath),
      sourceSha256: requireSha256(value.sourceSha256),
      baseSha256: requireSha256(value.base_sha256),
    };
  } catch (error) {
    if (error instanceof KitchenSotHttpError) throw error;
    throw new KitchenSotHttpError(200, "INVALID_RESPONSE");
  }
}

function parseSaveResponse(value: unknown): SotSaveResponse {
  if (!isRecord(value)) {
    throw new KitchenSotHttpError(200, "INVALID_RESPONSE");
  }
  try {
    return {
      document: parseKitchenSotDocument(value.document),
      sha256: requireSha256(value.sha256),
      base_sha256: requireSha256(value.base_sha256),
      generatedAt: requireString(value.generatedAt),
      path: requireString(value.path),
    };
  } catch (error) {
    if (error instanceof KitchenSotHttpError) throw error;
    throw new KitchenSotHttpError(200, "INVALID_RESPONSE");
  }
}

async function fetchSafely(
  fetcher: KitchenSotFetcher,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetcher(input, init);
  } catch {
    throw new KitchenSotHttpError(0, "NETWORK_ERROR");
  }
}

export class HttpKitchenSotDraftClient implements KitchenSotDraftClient {
  private readonly fetcher: KitchenSotFetcher;

  constructor(fetcher: KitchenSotFetcher = fetch) {
    this.fetcher = fetcher;
  }

  async load(): Promise<LoadedKitchenSotDraft> {
    const v5Response = await fetchSafely(this.fetcher, V5_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const v5Body = await readJson(v5Response);
    if (v5Response.ok) return parseLoadedDraft(v5Body, "v5-draft");

    const code = errorCode(v5Body);
    if (v5Response.status !== 404 || code !== "DRAFT_NOT_FOUND") {
      throw new KitchenSotHttpError(v5Response.status, code);
    }

    const v4Response = await fetchSafely(this.fetcher, V4_ENDPOINT, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const v4Body = await readJson(v4Response);
    if (!v4Response.ok) {
      throw new KitchenSotHttpError(v4Response.status, errorCode(v4Body));
    }
    return parseLoadedDraft(v4Body, "v4");
  }

  async save(document: KitchenSotDocument, baseSha256: string): Promise<SotSaveResponse> {
    if (baseSha256.trim().length === 0) {
      throw new KitchenSotHttpError(0, "PRECONDITION_REQUIRED");
    }
    if (!isSha256(baseSha256)) {
      throw new KitchenSotHttpError(0, "INVALID_SHA256");
    }
    const response = await fetchSafely(this.fetcher, V5_ENDPOINT, {
      method: "PUT",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "If-Match": `"${baseSha256}"`,
      },
      body: JSON.stringify({ base_sha256: baseSha256, document }),
    });
    const body = await readJson(response);
    if (!response.ok) {
      throw new KitchenSotHttpError(response.status, errorCode(body));
    }
    return parseSaveResponse(body);
  }
}
