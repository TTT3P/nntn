import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import fixture from "../data/fixtures/first-set.json";
import type { KitchenSotDraftClient } from "../data/KitchenSotDraftClient";
import { parseKitchenSotDocument } from "../domain/sot/kitchenSotDocument";
import { PrototypeProvider } from "../prototype/PrototypeProvider";
import { makeRecipe, makeSnapshot } from "../test/builders";
import { AppRoutes } from "./router";

afterEach(cleanup);

describe("AppRoutes", () => {
  test("passes the durable client only to Source Review", async () => {
    const document = parseKitchenSotDocument(fixture);
    const client: KitchenSotDraftClient = {
      load: vi.fn<KitchenSotDraftClient["load"]>(async () => ({
        document,
        origin: "v4",
        sourcePath: "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json",
        sourceSha256: "a".repeat(64),
        baseSha256: "b".repeat(64),
      })),
      save: vi.fn(),
    };

    render(
      <PrototypeProvider initialSnapshot={makeSnapshot()}>
        <MemoryRouter initialEntries={["/source-review"]}>
          <AppRoutes draftClient={client} />
        </MemoryRouter>
      </PrototypeProvider>,
    );

    expect(await screen.findByText("18 สูตร")).toBeVisible();
    expect(client.load).toHaveBeenCalledTimes(1);
  });

  test("keeps the projected repository route independent from the durable client", () => {
    const client: KitchenSotDraftClient = {
      load: vi.fn(),
      save: vi.fn(),
    };

    render(
      <PrototypeProvider initialSnapshot={makeSnapshot()}>
        <MemoryRouter initialEntries={["/recipes"]}>
          <AppRoutes draftClient={client} />
        </MemoryRouter>
      </PrototypeProvider>,
    );

    expect(screen.getByRole("heading", { name: "คลังสูตรอาหาร" })).toBeInTheDocument();
    expect(client.load).not.toHaveBeenCalled();
  });

  test("mounts the real Print Center inside the app routes", () => {
    render(
      <PrototypeProvider initialSnapshot={makeSnapshot()}>
        <MemoryRouter initialEntries={["/print"]}>
          <AppRoutes />
        </MemoryRouter>
      </PrototypeProvider>,
    );

    expect(screen.getByRole("heading", { name: "ศูนย์การพิมพ์" })).toBeInTheDocument();
    expect(screen.getByText("ตัวอย่าง A5 แนวนอนสำหรับจุดงาน · แนะนำอัตโนมัติ")).toBeInTheDocument();
    expect(screen.queryByText(/หน้าจอชั่วคราว/)).not.toBeInTheDocument();
  });

  test.each([
    ["/source-review", "ตรวจสอบแหล่งข้อมูล"],
    ["/work/159?stage=all", "ข้าวหน้าเนื้อยากินิกุ"],
  ])("renders the real review/work page for %s", (path, heading) => {
    render(
      <PrototypeProvider
        initialSnapshot={makeSnapshot({
          recipes: [
            makeRecipe({
              recipeId: 159,
              name: "ข้าวหน้าเนื้อยากินิกุ",
              reviewState: "candidate",
            }),
          ],
        })}
      >
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </PrototypeProvider>,
    );

    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument();
    expect(screen.queryByText(/หน้าจอชั่วคราว/)).not.toBeInTheDocument();
  });

  test.each([
    ["/recipes", "คลังสูตรอาหาร"],
    ["/recipes/159", "ข้าวหน้าเนื้อยากินิกุ"],
  ])("renders the real recipe page for %s", (path, heading) => {
    render(
      <PrototypeProvider
        initialSnapshot={makeSnapshot({
          recipes: [
            makeRecipe({
              recipeId: 159,
              name: "ข้าวหน้าเนื้อยากินิกุ",
            }),
          ],
        })}
      >
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </PrototypeProvider>,
    );

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByText(/หน้าจอชั่วคราว/)).not.toBeInTheDocument();
  });

  test("redirects the root route to the recipe library", async () => {
    render(
      <PrototypeProvider initialSnapshot={makeSnapshot()}>
        <MemoryRouter initialEntries={["/"]}>
          <AppRoutes />
        </MemoryRouter>
      </PrototypeProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "คลังสูตรอาหาร" }),
    ).toBeInTheDocument();
  });

  test("renders an accessible not-found placeholder for an unknown route", () => {
    render(
      <MemoryRouter initialEntries={["/not-an-approved-route"]}>
        <AppRoutes />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "ไม่พบหน้าที่ต้องการ" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/หน้าจอชั่วคราว/)).toBeInTheDocument();
  });
});
