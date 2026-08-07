import type { KitchenSotDocument } from "./kitchenSotDocument.ts";

export const V4_ENDPOINT = "/__cookbook/v4";
export const V5_ENDPOINT = "/__cookbook/v5-draft";

export interface SotReadResponse {
  document: KitchenSotDocument;
  sourcePath: string;
  sourceSha256: string;
  base_sha256: string;
  origin: "v4" | "v5-draft";
}

export interface SotSaveRequest {
  base_sha256: string;
  document: KitchenSotDocument;
}

export interface SotSaveResponse {
  document: KitchenSotDocument;
  sha256: string;
  base_sha256: string;
  generatedAt: string;
  path: string;
}
