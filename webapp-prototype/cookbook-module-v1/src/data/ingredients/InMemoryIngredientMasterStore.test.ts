import { describe, expect, test } from "vitest";
import { makeIngredientMasterSnapshot } from "../../test/ingredientBuilders";
import { serializeIngredientMaster } from "../../domain/ingredients/ingredientMigrationReport";
import { InMemoryIngredientMasterStore } from "./InMemoryIngredientMasterStore";

function canonicalBytes(generatedAt: string): string {
  const snapshot = makeIngredientMasterSnapshot();
  snapshot.generatedAt = generatedAt;
  return serializeIngredientMaster(snapshot);
}

describe("InMemoryIngredientMasterStore", () => {
  test("rejects a stale second writer and leaves the first writer bytes authoritative", async () => {
    const initialBytes = canonicalBytes("2026-08-11T00:00:00.000Z");
    const firstBytes = canonicalBytes("2026-08-11T01:00:00.000Z");
    const staleBytes = canonicalBytes("2026-08-11T02:00:00.000Z");
    const store = new InMemoryIngredientMasterStore(initialBytes);
    const readerOne = await store.read();
    const readerTwo = await store.read();

    const firstWrite = await store.compareAndSwap({
      expectedRevision: readerOne!.revision,
      nextBytes: firstBytes,
    });
    await expect(store.compareAndSwap({
      expectedRevision: readerTwo!.revision,
      nextBytes: staleBytes,
    })).rejects.toThrow("STALE_INGREDIENT_MASTER");

    expect(firstWrite.revision).not.toBe(readerOne!.revision);
    expect(await store.read()).toEqual({ bytes: firstBytes, revision: firstWrite.revision });
  });

  test("uses monotonic opaque revisions and returns independent read results", async () => {
    const store = new InMemoryIngredientMasterStore();
    expect(await store.read()).toBeNull();

    const first = await store.compareAndSwap({
      expectedRevision: null,
      nextBytes: canonicalBytes("2026-08-11T00:00:00.000Z"),
    });
    const readOne = await store.read();
    const readTwo = await store.read();
    readOne!.bytes = "mutated caller value";
    const second = await store.compareAndSwap({
      expectedRevision: readTwo!.revision,
      nextBytes: canonicalBytes("2026-08-11T01:00:00.000Z"),
    });

    expect(first.revision).toBe("rev-1");
    expect(second.revision).toBe("rev-2");
    expect((await store.read())!.bytes).not.toBe("mutated caller value");
  });

  test.each([
    ["malformed JSON", "not json"],
    ["valid but noncanonical JSON", JSON.stringify(makeIngredientMasterSnapshot())],
  ])("rejects %s before changing authoritative bytes", async (_label, nextBytes) => {
    const initialBytes = canonicalBytes("2026-08-11T00:00:00.000Z");
    const store = new InMemoryIngredientMasterStore(initialBytes);
    const before = await store.read();

    await expect(store.compareAndSwap({
      expectedRevision: before!.revision,
      nextBytes,
    })).rejects.toThrow("INVALID_INGREDIENT_MASTER_SNAPSHOT");
    expect(await store.read()).toEqual(before);
  });
});
