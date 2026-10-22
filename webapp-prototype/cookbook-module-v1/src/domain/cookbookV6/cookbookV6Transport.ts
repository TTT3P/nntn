import type { CookbookV6Document } from "./types.ts";

export const V6_ENDPOINT = "/__cookbook/v6-draft";

export interface CookbookV6ReadResponse {
  document: CookbookV6Document;
  base_sha256: string;
  origin: "synthesized" | "v6-draft";
  path: string;
}

export interface CookbookV6SaveRequest {
  base_sha256: string;
  document: CookbookV6Document;
}

export interface CookbookV6SaveResponse {
  document: CookbookV6Document;
  sha256: string;
  base_sha256: string;
  generatedAt: string;
  path: string;
}
