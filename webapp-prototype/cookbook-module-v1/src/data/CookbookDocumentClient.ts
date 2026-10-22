import { parseCookbookV6 } from "../domain/cookbookV6/parseCookbookV6";
import {
  V6_ENDPOINT,
  type CookbookV6SaveResponse,
} from "../domain/cookbookV6/cookbookV6Transport";
import type { CookbookV6Document } from "../domain/cookbookV6/types";

type CookbookFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface LoadedCookbookDocument {
  document: CookbookV6Document;
  baseSha256: string;
  origin: "synthesized" | "v6-draft";
  path: string;
}

export interface CookbookDocumentClient {
  load(): Promise<LoadedCookbookDocument>;
  save(document: CookbookV6Document, baseSha256: string): Promise<CookbookV6SaveResponse>;
}

export class CookbookDocumentHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(`Cookbook document request failed (${code})`);
    this.name = "CookbookDocumentHttpError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new CookbookDocumentHttpError(200, "INVALID_RESPONSE");
  return value;
}

function requireSha256(value: unknown): string {
  const text = requireString(value);
  if (!/^[a-f0-9]{64}$/iu.test(text)) throw new CookbookDocumentHttpError(200, "INVALID_RESPONSE");
  return text.toLowerCase();
}

function errorCode(value: unknown): string {
  return isRecord(value) && typeof value.code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/u.test(value.code)
    ? value.code
    : "HTTP_ERROR";
}

async function body(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text()) as unknown;
  } catch {
    throw new CookbookDocumentHttpError(response.status, "INVALID_RESPONSE");
  }
}

async function fetchSafely(fetcher: CookbookFetcher, init: RequestInit): Promise<Response> {
  try {
    return await fetcher(V6_ENDPOINT, init);
  } catch {
    throw new CookbookDocumentHttpError(0, "NETWORK_ERROR");
  }
}

function parseLoaded(value: unknown): LoadedCookbookDocument {
  if (!isRecord(value) || (value.origin !== "synthesized" && value.origin !== "v6-draft")) {
    throw new CookbookDocumentHttpError(200, "INVALID_RESPONSE");
  }
  try {
    return {
      document: parseCookbookV6(value.document),
      baseSha256: requireSha256(value.base_sha256),
      origin: value.origin,
      path: requireString(value.path),
    };
  } catch (error) {
    if (error instanceof CookbookDocumentHttpError) throw error;
    throw new CookbookDocumentHttpError(200, "INVALID_RESPONSE");
  }
}

function parseSaved(value: unknown): CookbookV6SaveResponse {
  if (!isRecord(value)) throw new CookbookDocumentHttpError(200, "INVALID_RESPONSE");
  try {
    return {
      document: parseCookbookV6(value.document),
      sha256: requireSha256(value.sha256),
      base_sha256: requireSha256(value.base_sha256),
      generatedAt: requireString(value.generatedAt),
      path: requireString(value.path),
    };
  } catch (error) {
    if (error instanceof CookbookDocumentHttpError) throw error;
    throw new CookbookDocumentHttpError(200, "INVALID_RESPONSE");
  }
}

export class HttpCookbookDocumentClient implements CookbookDocumentClient {
  private readonly fetcher: CookbookFetcher;

  constructor(fetcher: CookbookFetcher = fetch) {
    this.fetcher = fetcher;
  }

  async load(): Promise<LoadedCookbookDocument> {
    const response = await fetchSafely(this.fetcher, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const value = await body(response);
    if (!response.ok) throw new CookbookDocumentHttpError(response.status, errorCode(value));
    return parseLoaded(value);
  }

  async save(document: CookbookV6Document, baseSha256: string): Promise<CookbookV6SaveResponse> {
    if (baseSha256.length === 0) throw new CookbookDocumentHttpError(0, "PRECONDITION_REQUIRED");
    if (!/^[a-f0-9]{64}$/iu.test(baseSha256)) throw new CookbookDocumentHttpError(0, "INVALID_SHA256");
    const response = await fetchSafely(this.fetcher, {
      method: "PUT",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "If-Match": `"${baseSha256}"`,
      },
      body: JSON.stringify({ base_sha256: baseSha256, document }),
    });
    const value = await body(response);
    if (!response.ok) throw new CookbookDocumentHttpError(response.status, errorCode(value));
    return parseSaved(value);
  }
}
