import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { CookbookDocumentClient } from "../data/CookbookDocumentClient";
import type { CookbookV6Document } from "../domain/cookbookV6/types";
import { CookbookDocumentProvider } from "../features/cookbook/CookbookDocumentProvider";
import { PrototypeProvider } from "../prototype/PrototypeProvider";
import { makeRecipe, makeSnapshot } from "../test/builders";
import { AppRoutes } from "./router";

afterEach(cleanup);

function productDocument(): CookbookV6Document {
  return {
    schemaVersion: "6.0.0",
    generatedAt: "2026-08-10T00:00:00.000Z",
    derivedFrom: { v5Path: "draft.json", v5Sha256: "a".repeat(64), catalogSha256: "b".repeat(64) },
    recipes: [{
      recipeId: "RCP-011", code: "RCP-011", name: "ข้าวเนื้อสับคั่วน้ำปลาไข่ข้น", kind: "sellable_menu", category: "เมนูข้าว",
      active: true, reviewState: "", sourceLocators: [], yieldText: "", operationalNotes: [], methodDecisionNote: "",
      ingredients: [], methodSteps: [], blockers: [], workDocuments: {}, parentRecipeIds: [], lineage: { source: "catalog", sourceRecipeId: null },
    }],
  };
}

function renderProductRoute(path: string) {
  const document = productDocument();
  const client: CookbookDocumentClient = {
    load: vi.fn(async () => ({ document, baseSha256: "c".repeat(64), origin: "synthesized" as const, path: "draft.json" })),
    save: vi.fn(),
  };
  return render(
    <PrototypeProvider initialSnapshot={makeSnapshot({ recipes: [] })}>
      <CookbookDocumentProvider client={client} mediaSnapshot={makeSnapshot({ recipes: [], media: [], stepMedia: [] })}>
        <MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>
      </CookbookDocumentProvider>
    </PrototypeProvider>,
  );
}

describe("AppRoutes", () => {
  test("redirects the product root to the Cookbook role center", async () => {
    renderProductRoute("/");
    expect(await screen.findByRole("heading", { name: "ภาพรวม Cookbook" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "เมนูหลัก" })).toBeVisible();
    expect(screen.getByLabelText("1 สูตรทั้งหมด")).toBeVisible();
    expect(screen.getByLabelText("1 สูตรรอข้อมูล")).toBeVisible();
  });

  test.each([
    ["/recipes", "สูตรอาหาร"],
    ["/recipes/RCP-011", "ข้าวเนื้อสับคั่วน้ำปลาไข่ข้น"],
    ["/recipes/RCP-011/edit", "แก้ไขสูตร"],
  ])("renders the product route %s", async (path, heading) => {
    renderProductRoute(path);
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
  });

  test("keeps the operational Work page available", () => {
    render(
      <PrototypeProvider initialSnapshot={makeSnapshot({ recipes: [makeRecipe({ recipeId: 159, name: "ข้าวหน้าเนื้อยากินิกุ" })] })}>
        <MemoryRouter initialEntries={["/work/159?stage=all"]}><AppRoutes /></MemoryRouter>
      </PrototypeProvider>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "ข้าวหน้าเนื้อยากินิกุ" })).toBeVisible();
  });

  test("keeps the Print Center available", () => {
    render(<PrototypeProvider initialSnapshot={makeSnapshot()}><MemoryRouter initialEntries={["/print"]}><AppRoutes /></MemoryRouter></PrototypeProvider>);
    expect(screen.getByRole("heading", { name: "ศูนย์การพิมพ์" })).toBeVisible();
  });

  test.each([
    ["/branches", "สาขาและเมนู"],
    ["/knowledge", "Measurement Knowledge"],
    ["/settings", "ตั้งค่า Cookbook"],
  ])("renders the ERP module route %s without fake records", async (path, heading) => {
    renderProductRoute(path);
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(document.body).not.toHaveTextContent(/ยอดขายวันนี้|สาขาสยาม|อัปเดตเมื่อ 5 นาที|฿\d/u);
  });

  test.each(["/source-review", "/not-a-product-route"])("renders a clean not-found page for %s", (path) => {
    render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "ไม่พบหน้าที่ต้องการ" })).toBeVisible();
    expect(screen.getByText("ตรวจสอบที่อยู่แล้วลองอีกครั้ง")).toBeVisible();
    expect(document.body).not.toHaveTextContent(/ชั่วคราว|source.review|Prototype/i);
  });
});
