import { expect, test } from "vitest";
import { resolveSampleMediaUrl } from "./sampleMediaUrl";

test("resolves approved sample media through an explicit application base", () => {
  expect(resolveSampleMediaUrl(
    "/sample-media/prep-cut-size.svg",
    "/nntn-cookbook/",
  )).toBe("/nntn-cookbook/sample-media/prep-cut-size.svg");
});
