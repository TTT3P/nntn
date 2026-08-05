import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import type { CookbookSnapshot } from "../domain/cookbook/types";
import { PrototypeProvider } from "../prototype/PrototypeProvider";

interface RenderWithPrototypeOptions {
  snapshot?: CookbookSnapshot;
  route?: string;
}

function makeEmptySnapshot(): CookbookSnapshot {
  return { recipes: [], media: [], stepMedia: [] };
}

export function renderWithPrototype(
  ui: ReactElement,
  { snapshot = makeEmptySnapshot(), route = "/" }: RenderWithPrototypeOptions = {},
): RenderResult {
  return render(
    <PrototypeProvider initialSnapshot={snapshot}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </PrototypeProvider>,
  );
}
