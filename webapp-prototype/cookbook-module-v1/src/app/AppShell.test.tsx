import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("../features/cookbook/CookbookDocumentProvider", () => ({
  useOptionalCookbookDocument: () => ({ document: { recipes: [] } }),
}));

test("renders the production Cookbook navigation without internal language", () => {
  render(
    <MemoryRouter initialEntries={["/recipes"]}>
      <AppShell><p>เนื้อหาทดสอบ</p></AppShell>
    </MemoryRouter>,
  );

  expect(screen.getByRole("banner")).toBeVisible();
  expect(screen.getByRole("link", { name: "NNTN Cookbook" })).toHaveAttribute("href", "/home");
  expect(screen.getByRole("navigation", { name: "เมนูหลัก" })).toBeVisible();
  expect(screen.getByRole("link", { name: "ภาพรวม" })).toHaveAttribute("href", "/home");
  expect(screen.getByRole("link", { name: "สูตรอาหาร" })).toHaveAttribute("href", "/recipes");
  expect(screen.getByRole("link", { name: "สูตรเตรียม" })).toHaveAttribute("href", "/recipes?kind=prepared_recipe");
  expect(screen.getByRole("link", { name: "ใบงานครัว" })).toHaveAttribute("href", "/recipes?mode=work");
  expect(screen.getByRole("link", { name: "ศูนย์พิมพ์" })).toHaveAttribute("href", "/print");
  expect(screen.getByRole("link", { name: "จัดการสูตร" })).toHaveAttribute("href", "/recipes?mode=manage");
  expect(screen.getByRole("link", { name: "สาขาและเมนู" })).toHaveAttribute("href", "/branches");
  expect(screen.getByRole("link", { name: "Measurement Knowledge" })).toHaveAttribute("href", "/knowledge");
  expect(screen.getByRole("link", { name: "ตั้งค่า" })).toHaveAttribute("href", "/settings");
  expect(screen.getByRole("button", { name: "เปิดเมนู" })).toHaveAttribute("aria-expanded", "false");
  expect(within(screen.getByRole("navigation", { name: "เมนูหลัก" })).queryByRole("button", { name: "ดาวน์โหลดข้อมูล" })).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "เครื่องมือข้อมูล" })).toContainElement(screen.getByRole("button", { name: "ดาวน์โหลดข้อมูล" }));
  expect(screen.getByRole("main")).toHaveTextContent("เนื้อหาทดสอบ");
  expect(document.body).not.toHaveTextContent(/AI|Prototype|Mock|V[456]|schema|blocker|provenance|candidate|Supabase|snapshot/i);
});

test.each([
  ["/home", "ภาพรวม"],
  ["/work/RCP-021?stage=all", "ใบงานครัว"],
  ["/recipes?kind=prepared_recipe", "สูตรเตรียม"],
  ["/print", "ศูนย์พิมพ์"],
  ["/recipes?mode=manage", "จัดการสูตร"],
  ["/branches", "สาขาและเมนู"],
  ["/knowledge", "Measurement Knowledge"],
  ["/settings", "ตั้งค่า"],
] as const)("marks the correct production section for %s", (entry, label) => {
  const { container } = render(
    <MemoryRouter initialEntries={[entry]}>
      <AppShell><p>เนื้อหาทดสอบ</p></AppShell>
    </MemoryRouter>,
  );

  expect(within(container).getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
});
