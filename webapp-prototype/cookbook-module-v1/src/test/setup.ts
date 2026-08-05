import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";

let objectUrlSequence = 0;

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => `blob:test-media-${++objectUrlSequence}`),
});
Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  value: vi.fn(),
});

beforeEach(() => {
  objectUrlSequence = 0;
  vi.mocked(URL.createObjectURL)
    .mockReset()
    .mockImplementation(() => `blob:test-media-${++objectUrlSequence}`);
  vi.mocked(URL.revokeObjectURL).mockReset();
});
