import type { CookbookSnapshot } from "../domain/cookbook/types";

export interface RepositoryCapabilities {
  persistence: "session" | "durable";
  mediaUpload: boolean;
  production: boolean;
}

export interface CookbookRepository {
  readonly capabilities: RepositoryCapabilities;
  loadSnapshot(): Promise<CookbookSnapshot>;
  saveSessionSnapshot(
    snapshot: CookbookSnapshot,
  ): Promise<{ persisted: false; scope: "session" }>;
}
