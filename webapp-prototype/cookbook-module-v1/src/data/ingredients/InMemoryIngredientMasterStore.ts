import {
  serializeIngredientMaster,
} from "../../domain/ingredients/ingredientMigrationReport";
import { parseIngredientMaster } from "../../domain/ingredients/parseIngredientMaster";
import type { IngredientMasterStore } from "./IngredientMasterStore";

function invalid(): never {
  throw new Error("INVALID_INGREDIENT_MASTER_SNAPSHOT");
}

function validateCanonicalBytes(bytes: string): void {
  let value: unknown;
  try {
    value = JSON.parse(bytes);
  } catch {
    invalid();
  }

  try {
    const snapshot = parseIngredientMaster(value);
    if (serializeIngredientMaster(snapshot) !== bytes) invalid();
  } catch {
    invalid();
  }
}

export class InMemoryIngredientMasterStore implements IngredientMasterStore {
  #bytes: string | null;
  #revisionNumber: number;

  constructor(initialBytes: string | null = null) {
    if (initialBytes !== null) validateCanonicalBytes(initialBytes);
    this.#bytes = initialBytes;
    this.#revisionNumber = initialBytes === null ? 0 : 1;
  }

  async read(): Promise<{ bytes: string; revision: string } | null> {
    if (this.#bytes === null) return null;
    return { bytes: this.#bytes, revision: this.revision() };
  }

  async compareAndSwap(input: {
    expectedRevision: string | null;
    nextBytes: string;
  }): Promise<{ revision: string }> {
    const currentRevision = this.#bytes === null ? null : this.revision();
    if (input.expectedRevision !== currentRevision) {
      throw new Error("STALE_INGREDIENT_MASTER");
    }
    validateCanonicalBytes(input.nextBytes);
    this.#revisionNumber += 1;
    this.#bytes = input.nextBytes;
    return { revision: this.revision() };
  }

  private revision(): string {
    return `rev-${this.#revisionNumber}`;
  }
}
