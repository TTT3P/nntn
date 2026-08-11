import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { makeRecipe } from "../../test/builders";
import { buildPrintCollections } from "./printCollections";
import { PrintCollectionPicker } from "./PrintCollectionPicker";

afterEach(cleanup);

const collections = buildPrintCollections([
  { ...makeRecipe({ recipeId: "SAUCE-A", name: "ซอส ก" }), category: "ซอสและน้ำจิ้ม" },
  { ...makeRecipe({ recipeId: "SAUCE-B", name: "ซอส ข" }), category: "ซอสและน้ำจิ้ม" },
  { ...makeRecipe({ recipeId: "MENU-A", name: "เมนู ก", kind: "sellable_menu" }), category: "เมนูอาหาร" },
]);

function pickerProps() {
  return {
    collections,
    activeCollectionKey: null,
    selectedRecipeKeys: [] as string[],
    onChooseCollection: vi.fn(),
    onChooseDaily: vi.fn(),
    onChooseManual: vi.fn(),
    onToggleRecipe: vi.fn(),
    onSelectAll: vi.fn(),
    onClearCollection: vi.fn(),
  };
}

describe("PrintCollectionPicker", () => {
  test("offers all seven collection actions with derived counts and disables empty collections", async () => {
    const user = userEvent.setup();
    const props = pickerProps();
    render(<PrintCollectionPicker {...props} />);

    expect(screen.getAllByRole("button", { name: /^พิมพ์ทั้งหมวด/u })).toHaveLength(7);
    expect(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด ซอสและน้ำจิ้ม 2 สูตร" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด จัดจาน 0 สูตร" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด ซอสและน้ำจิ้ม 2 สูตร" }));
    expect(props.onChooseCollection).toHaveBeenCalledWith("sauce");

    await user.click(screen.getByRole("button", { name: "ชุดงานวันนี้" }));
    await user.click(screen.getByRole("button", { name: "เลือกสูตรเอง" }));
    expect(props.onChooseDaily).toHaveBeenCalledOnce();
    expect(props.onChooseManual).toHaveBeenCalledOnce();
  });

  test("lets an operator select all, clear, and override individual recipes in the active collection", async () => {
    const user = userEvent.setup();
    const props = pickerProps();
    render(
      <PrintCollectionPicker
        {...props}
        activeCollectionKey="sauce"
        selectedRecipeKeys={['string:"SAUCE-A"']}
      />,
    );

    expect(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด ซอสและน้ำจิ้ม 2 สูตร" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "ซอส ก" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "ซอส ข" })).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "เลือกทั้งหมด ซอสและน้ำจิ้ม" }));
    await user.click(screen.getByRole("button", { name: "เอาออกทั้งหมด ซอสและน้ำจิ้ม" }));
    await user.click(screen.getByRole("checkbox", { name: "ซอส ข" }));

    expect(props.onSelectAll).toHaveBeenCalledWith("sauce");
    expect(props.onClearCollection).toHaveBeenCalledWith("sauce");
    expect(props.onToggleRecipe).toHaveBeenCalledWith("SAUCE-B", true);
  });

  test("shows an empty result when search does not match the active collection", async () => {
    const user = userEvent.setup();
    render(<PrintCollectionPicker {...pickerProps()} activeCollectionKey="sauce" />);

    await user.type(screen.getByRole("searchbox", { name: "ค้นหาสูตร" }), "ไม่พบชื่อนี้");

    expect(screen.getByText("ไม่พบสูตรที่ค้นหา")).toBeVisible();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
