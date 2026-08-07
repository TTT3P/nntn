import { describe, expect, test, vi } from "vitest";
import type { KitchenSotDocument } from "../domain/sot/kitchenSotDocument";
import {
  HttpKitchenSotDraftClient,
  KitchenSotHttpError,
} from "./KitchenSotDraftClient";

const document: KitchenSotDocument = {
  schema_version: "5-draft",
  generated_at: "2026-08-07T00:00:00.000Z",
  recipes: [],
};

const sourceSha256 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const draftSha256 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const nextDraftSha256 = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const v5ReadResponse = {
  document,
  sourcePath: "Operations/CookBook/sot/v4/kitchen-sot.json",
  sourceSha256,
  base_sha256: draftSha256,
  origin: "v5-draft",
};

const v4ReadResponse = {
  ...v5ReadResponse,
  base_sha256: sourceSha256,
  origin: "v4",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(status: number, body: string, contentType = "text/plain"): Response {
  return new Response(body, { status, headers: { "Content-Type": contentType } });
}

describe("HttpKitchenSotDraftClient load", () => {
  test("loads V5 first without using the V4 fallback", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, v5ReadResponse));

    await expect(new HttpKitchenSotDraftClient(fetcher).load()).resolves.toEqual({
      document,
      origin: "v5-draft",
      sourcePath: "Operations/CookBook/sot/v4/kitchen-sot.json",
      sourceSha256,
      baseSha256: draftSha256,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("/__cookbook/v5-draft", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  test("falls back to V4 only when V5 returns DRAFT_NOT_FOUND", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(404, { code: "DRAFT_NOT_FOUND" }))
      .mockResolvedValueOnce(jsonResponse(200, v4ReadResponse));

    await expect(new HttpKitchenSotDraftClient(fetcher).load()).resolves.toMatchObject({
      origin: "v4",
      baseSha256: sourceSha256,
    });
    expect(fetcher).toHaveBeenNthCalledWith(1, "/__cookbook/v5-draft", expect.any(Object));
    expect(fetcher).toHaveBeenNthCalledWith(2, "/__cookbook/v4", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  test.each([
    [400, "INVALID_DRAFT"],
    [409, "STALE_DRAFT"],
    [500, "WRITE_FAILED"],
  ])("does not hide V5 HTTP %s behind V4", async (status, code) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, { code }));

    const rejection = expect(new HttpKitchenSotDraftClient(fetcher).load()).rejects;
    await rejection.toThrow(KitchenSotHttpError);
    await rejection.toMatchObject({ name: "KitchenSotHttpError", status, code });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  test("does not fall back when a 404 has a different error code", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(404, { code: "ROUTE_NOT_FOUND" }));

    await expect(new HttpKitchenSotDraftClient(fetcher).load()).rejects.toMatchObject({
      name: "KitchenSotHttpError",
      status: 404,
      code: "ROUTE_NOT_FOUND",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  test("rejects a V5 response that claims the V4 origin", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, {
      ...v5ReadResponse,
      origin: "v4",
    }));

    await expect(new HttpKitchenSotDraftClient(fetcher).load()).rejects.toMatchObject({
      name: "KitchenSotHttpError",
      status: 200,
      code: "INVALID_RESPONSE",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  test("rejects a V4 fallback response that claims the V5 draft origin", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(404, { code: "DRAFT_NOT_FOUND" }))
      .mockResolvedValueOnce(jsonResponse(200, {
        ...v4ReadResponse,
        origin: "v5-draft",
      }));

    await expect(new HttpKitchenSotDraftClient(fetcher).load()).rejects.toMatchObject({
      name: "KitchenSotHttpError",
      status: 200,
      code: "INVALID_RESPONSE",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["sourcePath", { ...v5ReadResponse, sourcePath: undefined }],
    ["sourceSha256", { ...v5ReadResponse, sourceSha256: "" }],
    ["base_sha256", { ...v5ReadResponse, base_sha256: undefined }],
    ["origin", { ...v5ReadResponse, origin: "v6" }],
    ["document", { ...v5ReadResponse, document: { recipes: [] } }],
  ])("rejects a successful load response with a missing or invalid %s", async (_field, body) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, body));

    await expect(new HttpKitchenSotDraftClient(fetcher).load()).rejects.toMatchObject({
      name: "KitchenSotHttpError",
      status: 200,
      code: "INVALID_RESPONSE",
    });
  });

  test.each([
    ["sourceSha256", { ...v5ReadResponse, sourceSha256: " " }],
    ["sourceSha256", { ...v5ReadResponse, sourceSha256: "a".repeat(63) }],
    ["base_sha256", { ...v5ReadResponse, base_sha256: `${"b".repeat(63)}g` }],
    ["base_sha256", { ...v5ReadResponse, base_sha256: `${"b".repeat(63)}"` }],
  ])("rejects an invalid load response SHA in %s", async (_field, body) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, body));

    await expect(new HttpKitchenSotDraftClient(fetcher).load()).rejects.toMatchObject({
      name: "KitchenSotHttpError",
      status: 200,
      code: "INVALID_RESPONSE",
    });
  });
});

describe("HttpKitchenSotDraftClient save", () => {
  const saveResponse = {
    document,
    sha256: nextDraftSha256,
    base_sha256: nextDraftSha256,
    generatedAt: "2026-08-07T00:00:00.000Z",
    path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v5-draft.json",
  };

  test("saves to V5 with matching body and If-Match preconditions", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, saveResponse));

    await expect(new HttpKitchenSotDraftClient(fetcher).save(document, draftSha256)).resolves.toEqual(
      saveResponse,
    );
    expect(fetcher).toHaveBeenCalledWith("/__cookbook/v5-draft", {
      method: "PUT",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "If-Match": `"${draftSha256}"`,
      },
      body: JSON.stringify({ base_sha256: draftSha256, document }),
    });
  });

  test.each([
    ["blank", ""],
    ["whitespace", " \t\n"],
  ])("rejects a %s save base as a missing precondition", async (_case, baseSha256) => {
    const fetcher = vi.fn();

    await expect(new HttpKitchenSotDraftClient(fetcher).save(document, baseSha256)).rejects.toMatchObject({
      name: "KitchenSotHttpError",
      status: 0,
      code: "PRECONDITION_REQUIRED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  test.each([
    ["wrong length", "a".repeat(63)],
    ["non-hex", `${"a".repeat(63)}g`],
    ["quote-containing", `${"a".repeat(63)}"`],
  ])("rejects a %s save base without sending a request", async (_case, baseSha256) => {
    const fetcher = vi.fn();

    await expect(new HttpKitchenSotDraftClient(fetcher).save(document, baseSha256)).rejects.toMatchObject({
      name: "KitchenSotHttpError",
      status: 0,
      code: "INVALID_SHA256",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  test.each([
    [428, "PRECONDITION_REQUIRED"],
    [409, "STALE_DRAFT"],
  ])("preserves the save concurrency error %s/%s", async (status, code) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, { code }));

    await expect(new HttpKitchenSotDraftClient(fetcher).save(document, draftSha256))
      .rejects.toMatchObject({ name: "KitchenSotHttpError", status, code });
  });

  test.each([
    ["document", { ...saveResponse, document: { recipes: [] } }],
    ["sha256", { ...saveResponse, sha256: "" }],
    ["base_sha256", { ...saveResponse, base_sha256: undefined }],
    ["generatedAt", { ...saveResponse, generatedAt: null }],
    ["path", { ...saveResponse, path: undefined }],
  ])("rejects a successful save response with a missing or invalid %s", async (_field, body) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, body));

    await expect(new HttpKitchenSotDraftClient(fetcher).save(document, draftSha256))
      .rejects.toMatchObject({
        name: "KitchenSotHttpError",
        status: 200,
        code: "INVALID_RESPONSE",
      });
  });

  test.each([
    ["sha256", { ...saveResponse, sha256: " " }],
    ["sha256", { ...saveResponse, sha256: "c".repeat(63) }],
    ["base_sha256", { ...saveResponse, base_sha256: `${"c".repeat(63)}g` }],
    ["base_sha256", { ...saveResponse, base_sha256: `${"c".repeat(63)}"` }],
  ])("rejects an invalid save response SHA in %s", async (_field, body) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, body));

    await expect(new HttpKitchenSotDraftClient(fetcher).save(document, draftSha256))
      .rejects.toMatchObject({
        name: "KitchenSotHttpError",
        status: 200,
        code: "INVALID_RESPONSE",
      });
  });
});

describe("HttpKitchenSotDraftClient failure safety", () => {
  test.each(["load", "save"] as const)("turns a %s network failure into a named safe error", async (method) => {
    const fetcher = vi.fn().mockRejectedValue(
      new Error("connect ECONNREFUSED /Users/operator/private-vault/secret.json"),
    );
    const client = new HttpKitchenSotDraftClient(fetcher);
    const request = method === "load" ? client.load() : client.save(document, draftSha256);

    const error = await request.catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      name: "KitchenSotHttpError",
      status: 0,
      code: "NETWORK_ERROR",
    });
    expect(String(error)).not.toContain("private-vault");
  });

  test.each([
    [200, "{not-json", "application/json"],
    [500, "<html><body>/Users/operator/private-vault</body></html>", "text/html"],
  ])("rejects an invalid response body for HTTP %s without exposing it", async (status, body, contentType) => {
    const fetcher = vi.fn().mockResolvedValue(textResponse(status, body, contentType));

    const error = await new HttpKitchenSotDraftClient(fetcher).load().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      name: "KitchenSotHttpError",
      status,
      code: "INVALID_RESPONSE",
    });
    expect(String(error)).not.toContain("private-vault");
    expect(String(error)).not.toContain("<html>");
  });

  test("caps and sanitizes server-provided error text", async () => {
    const unsafeMessage = `Error: cannot read /Users/operator/private-vault/secret.json\n${"x".repeat(1_000)}`;
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(500, {
      code: "WRITE_FAILED",
      message: unsafeMessage,
      stack: unsafeMessage,
    }));

    const error = await new HttpKitchenSotDraftClient(fetcher).load().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(KitchenSotHttpError);
    expect(String(error).length).toBeLessThanOrEqual(120);
    expect(String(error)).not.toContain("private-vault");
    expect(String(error)).not.toContain("secret.json");
  });

  test("does not surface an oversized or path-like server error code", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(500, {
      code: `WRITE_FAILED_/Users/operator/private-vault/${"X".repeat(1_000)}`,
    }));

    const error = await new HttpKitchenSotDraftClient(fetcher).load().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      name: "KitchenSotHttpError",
      status: 500,
      code: "HTTP_ERROR",
    });
    expect(String(error).length).toBeLessThanOrEqual(120);
    expect(String(error)).not.toContain("private-vault");
  });
});
