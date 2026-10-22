import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test } from "vitest";
import { makeIngredientLine, makeRecipe } from "../../test/builders";
import { RecipeLibraryResults, type RecipeLibraryRow } from "./RecipeLibraryResults";

afterEach(cleanup);

const readyMenu: RecipeLibraryRow = {
  recipe: makeRecipe({
    recipeId: "RCP-069",
    name: "ข้าวหน้าเนื้อยากินิกุ",
    kind: "sellable_menu",
    lines: Array.from({ length: 5 }, (_, index) => makeIngredientLine({
      lineKey: `line-${index}`,
      itemName: `วัตถุดิบ ${index + 1}`,
    })),
  }),
  draft: false,
};

function renderResults(row: RecipeLibraryRow, mode: "read" | "work" | "manage", view: "read" | "compact" = "read") {
  return render(
    <MemoryRouter>
      <RecipeLibraryResults rows={[row]} mode={mode} view={view} />
    </MemoryRouter>,
  );
}

describe("RecipeLibraryResults", () => {
  test.each(["read", "compact"] as const)(
    "uses one full-row recipe link with the facts needed to choose a recipe in %s view",
    (view) => {
      renderResults(readyMenu, "read", view);

      const link = screen.getByRole("link", { name: /ข้าวหน้าเนื้อยากินิกุ/ });
      expect(link).toHaveAttribute("href", "/recipes/RCP-069");
      expect(link).toHaveTextContent("RCP-069");
      expect(link).toHaveTextContent("เมนูขาย");
      expect(link).toHaveTextContent("พร้อมใช้");
      expect(link).toHaveTextContent("ส่วนผสม 5 รายการ");
      expect(within(link).queryByRole("button")).not.toBeInTheDocument();
      expect(link.closest("li")).toHaveClass(`recipe-result--${view}`);
    },
  );

  test("work mode exposes only one visible Work action per row", () => {
    renderResults(readyMenu, "work");

    const row = screen.getByRole("listitem");
    const links = within(row).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("เปิดใบงาน ข้าวหน้าเนื้อยากินิกุ");
    expect(links[0]).toHaveAttribute("href", "/work/RCP-069?stage=all");
    expect(links[0]).toHaveTextContent("เปิดใบงาน");
    expect(within(row).queryByRole("link", { name: /แก้ไข/u })).not.toBeInTheDocument();
  });

  test("manage mode renders a semantic desktop table with one explicit edit action", () => {
    renderResults(readyMenu, "manage");

    const table = screen.getByRole("table", { name: "รายการจัดการสูตร" });
    expect(within(table).getByRole("columnheader", { name: "รหัส" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "ชื่อสูตร" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "ประเภท" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "สถานะ" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "ส่วนผสม" })).toBeVisible();
    const editLinks = within(table).getAllByRole("link");
    expect(editLinks).toHaveLength(1);
    expect(editLinks[0]).toHaveAccessibleName("แก้ไข ข้าวหน้าเนื้อยากินิกุ");
    expect(editLinks[0]).toHaveAttribute("href", "/recipes/RCP-069/edit");
  });

  test("manage mode renders the same fields and one edit action in its mobile list", () => {
    renderResults(readyMenu, "manage");

    const mobileList = screen.getByRole("list", { name: "รายการจัดการสูตรบนมือถือ" });
    const row = within(mobileList).getByRole("listitem");
    expect(row).toHaveTextContent("RCP-069");
    expect(row).toHaveTextContent("ข้าวหน้าเนื้อยากินิกุ");
    expect(row).toHaveTextContent("เมนูขาย");
    expect(row).toHaveTextContent("พร้อมใช้");
    expect(row).toHaveTextContent("ส่วนผสม 5 รายการ");
    const editLinks = within(row).getAllByRole("link");
    expect(editLinks).toHaveLength(1);
    expect(editLinks[0]).toHaveAccessibleName("แก้ไข ข้าวหน้าเนื้อยากินิกุ");
    expect(editLinks[0]).toHaveAttribute("href", "/recipes/RCP-069/edit");
  });
});
