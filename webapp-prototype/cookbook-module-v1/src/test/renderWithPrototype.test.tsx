import { cleanup, screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import { FixtureCookbookRepository } from "../data/FixtureCookbookRepository";
import { usePrototype } from "../prototype/PrototypeProvider";
import { makeRecipe, makeSnapshot } from "./builders";
import { renderWithPrototype } from "./renderWithPrototype";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function ContextReader() {
  const { snapshot, dirty, persistence } = usePrototype();
  const location = useLocation();

  return (
    <div>
      <p>{snapshot.recipes[0]?.name}</p>
      <p>{dirty ? "dirty" : "clean"}</p>
      <p>{persistence}</p>
      <p>{location.pathname}</p>
    </div>
  );
}

test("renders supplied snapshot through real prototype state and MemoryRouter", () => {
  renderWithPrototype(<ContextReader />, {
    snapshot: makeSnapshot({
      recipes: [makeRecipe({ name: "สูตรจาก helper" })],
    }),
    route: "/recipes/string-id",
  });

  expect(screen.getByText("สูตรจาก helper")).toBeInTheDocument();
  expect(screen.getByText("clean")).toBeInTheDocument();
  expect(screen.getByText("session")).toBeInTheDocument();
  expect(screen.getByText("/recipes/string-id")).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("defaults to an empty ready snapshot at the root without repository loading", () => {
  const loadSnapshot = vi.spyOn(
    FixtureCookbookRepository.prototype,
    "loadSnapshot",
  );

  renderWithPrototype(<ContextReader />);

  expect(screen.getByText("clean")).toBeInTheDocument();
  expect(screen.getByText("session")).toBeInTheDocument();
  expect(screen.getByText("/")).toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(loadSnapshot).not.toHaveBeenCalled();
});
