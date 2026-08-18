export interface IngredientMasterStore {
  read(): Promise<{ bytes: string; revision: string } | null>;
  compareAndSwap(input: {
    expectedRevision: string | null;
    nextBytes: string;
  }): Promise<{ revision: string }>;
}
