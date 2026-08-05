import { expect, test } from "vitest";

test("discovers src spec files alongside src test files", () => {
  expect(import.meta.url.endsWith("vitestDiscovery.spec.ts")).toBe(true);
});
