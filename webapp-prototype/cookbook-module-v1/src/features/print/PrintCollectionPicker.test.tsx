// @ts-expect-error -- Vitest runs in Node, while the browser tsconfig intentionally excludes Node types.
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makeRecipe } from "../../test/builders";
import { buildPrintCollections } from "./printCollections";
import { PrintCollectionPicker } from "./PrintCollectionPicker";

const printStyles = readFileSync("src/features/print/print.css", "utf8");

beforeEach(() => {
  const style = document.createElement("style");
  style.dataset.testStyles = "print";
  style.textContent = printStyles.slice(printStyles.indexOf(".print-center-page"));
  document.head.append(style);
});

afterEach(() => {
  cleanup();
  document.querySelector('style[data-test-styles="print"]')?.remove();
});

const collections = buildPrintCollections([
  { ...makeRecipe({ recipeId: "SAUCE-A", name: "ซอส ก" }), category: "ซอสและน้ำจิ้ม" },
  { ...makeRecipe({ recipeId: "SAUCE-B", name: "ซอส ข" }), category: "ซอสและน้ำจิ้ม" },
  { ...makeRecipe({ recipeId: "MENU-A", name: "เมนู ก", kind: "sellable_menu" }), category: "เมนูอาหาร" },
]);

function pickerProps() {
  return {
    collections,
    activeMode: "manual" as const,
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
  test("exposes exactly one selected print-set action for collection, daily, and manual modes", () => {
    const props = pickerProps();
    const view = render(<PrintCollectionPicker {...props} />);

    function selectedActions() {
      return screen.getAllByRole("button").filter((button) => (
        button.getAttribute("aria-pressed") === "true"
      ));
    }

    expect(screen.getByRole("button", { name: "เลือกสูตรเอง" })).toHaveAttribute("aria-pressed", "true");
    expect(selectedActions()).toHaveLength(1);

    view.rerender(<PrintCollectionPicker {...props} activeMode="daily" />);
    expect(screen.getByRole("button", { name: "ชุดงานวันนี้" })).toHaveAttribute("aria-pressed", "true");
    expect(selectedActions()).toHaveLength(1);

    view.rerender(
      <PrintCollectionPicker {...props} activeMode="collection" activeCollectionKey="sauce" />,
    );
    expect(screen.getByRole("button", { name: "พิมพ์ทั้งหมวด ซอสและน้ำจิ้ม 2 สูตร" })).toHaveAttribute("aria-pressed", "true");
    expect(selectedActions()).toHaveLength(1);
  });

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
        activeMode="collection"
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

  test("keeps every new compact selection control at least 44 pixels tall", () => {
    render(
      <PrintCollectionPicker
        {...pickerProps()}
        activeMode="collection"
        activeCollectionKey="sauce"
      />,
    );

    const controls = [
      screen.getByRole("button", { name: "ชุดงานวันนี้" }),
      screen.getByRole("button", { name: "เลือกสูตรเอง" }),
      screen.getByRole("button", { name: "เลือกทั้งหมด ซอสและน้ำจิ้ม" }),
      screen.getByRole("button", { name: "เอาออกทั้งหมด ซอสและน้ำจิ้ม" }),
      screen.getByRole("checkbox", { name: "ซอส ก" }).closest("label"),
      screen.getByRole("checkbox", { name: "ซอส ข" }).closest("label"),
    ];

    for (const control of controls) {
      expect(control).not.toBeNull();
      const minHeight = getComputedStyle(control!).minHeight;
      const pixels = minHeight.endsWith("rem")
        ? Number.parseFloat(minHeight) * 16
        : Number.parseFloat(minHeight);
      expect(pixels).toBeGreaterThanOrEqual(44);
    }
  });

  test("keeps interactive collection counts and help text at least 12 pixels", () => {
    const view = render(
      <PrintCollectionPicker
        {...pickerProps()}
        activeMode="collection"
        activeCollectionKey="sauce"
      />,
    );

    const compactText = view.container.querySelectorAll(
      ".print-collection-actions span, .print-collection-actions small, .print-collection summary em",
    );
    expect(compactText.length).toBeGreaterThan(0);

    for (const text of compactText) {
      const fontSize = getComputedStyle(text).fontSize;
      const pixels = fontSize.endsWith("rem")
        ? Number.parseFloat(fontSize) * 16
        : Number.parseFloat(fontSize);
      expect(pixels).toBeGreaterThanOrEqual(12);
    }
  });
});
