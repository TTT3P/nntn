import { describe, expect, test, vi } from "vitest";
import type { CookbookV6Document } from "../domain/cookbookV6/types";
import { CookbookDocumentHttpError, HttpCookbookDocumentClient } from "./CookbookDocumentClient";

const document: CookbookV6Document = {
  schemaVersion: "6.0.0",
  generatedAt: "2026-08-10T00:00:00.000Z",
  derivedFrom: {
    v5Path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
    v5Sha256: "a".repeat(64),
    catalogSha256: "b".repeat(64),
  },
  recipes: [],
};

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

describe("HttpCookbookDocumentClient", () => {
  test("loads a synthesized V6 document", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      document,
      base_sha256: "c".repeat(64),
      origin: "synthesized",
      path: "Operations/CookBook/sot/v6-draft/kitchen-cookbook-v6-draft.json",
    }));
    const client = new HttpCookbookDocumentClient(fetcher);

    await expect(client.load()).resolves.toEqual({
      document,
      baseSha256: "c".repeat(64),
      origin: "synthesized",
      path: "Operations/CookBook/sot/v6-draft/kitchen-cookbook-v6-draft.json",
    });
    expect(fetcher).toHaveBeenCalledWith("/__cookbook/v6-draft", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  test("saves with matching body and If-Match preconditions", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      document,
      sha256: "d".repeat(64),
      base_sha256: "d".repeat(64),
      generatedAt: document.generatedAt,
      path: "Operations/CookBook/sot/v6-draft/kitchen-cookbook-v6-draft.json",
    }));
    const client = new HttpCookbookDocumentClient(fetcher);

    await expect(client.save(document, "c".repeat(64))).resolves.toMatchObject({ base_sha256: "d".repeat(64) });
    expect(fetcher).toHaveBeenCalledWith("/__cookbook/v6-draft", {
      method: "PUT",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "If-Match": `"${"c".repeat(64)}"`,
      },
      body: JSON.stringify({ base_sha256: "c".repeat(64), document }),
    });
  });

  test("reports stale and malformed responses without returning partial data", async () => {
    const staleClient = new HttpCookbookDocumentClient(vi.fn().mockResolvedValue(response(
      { code: "STALE_DRAFT" },
      { status: 409 },
    )));
    await expect(staleClient.save(document, "c".repeat(64))).rejects.toMatchObject({
      name: "CookbookDocumentHttpError",
      status: 409,
      code: "STALE_DRAFT",
    });

    const malformedClient = new HttpCookbookDocumentClient(vi.fn().mockResolvedValue(response({
      document,
      base_sha256: "not-a-sha",
      origin: "synthesized",
      path: "x",
    })));
    await expect(malformedClient.load()).rejects.toBeInstanceOf(CookbookDocumentHttpError);
  });
});
