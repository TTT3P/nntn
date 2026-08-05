import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, test } from "vitest";
import { PrototypeProvider } from "../prototype/PrototypeProvider";
import { makeRecipe, makeSnapshot } from "../test/builders";
import { AppRoutes } from "./router";

afterEach(cleanup);

describe("AppRoutes", () => {
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
