import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { MediaIndex, WorkstationPage } from "../../domain/print/printPlanner";
import { makeIngredientLine, makeProjectedWorkDocument } from "../../test/builders";
import { WorkstationCard } from "./WorkstationCard";

describe("WorkstationCard", () => {
  test("shows a resolved component name and public code beneath the unchanged ingredient facts", () => {
    const page: WorkstationPage = {
      kind: "station",
      document: makeProjectedWorkDocument({
        ingredients: [makeIngredientLine({
          lineKey: "menu:rice",
          itemName: "ข้าวญี่ปุ่นหุงสุก",
          componentRecipeId: "RCP-RICE",
          sourceText: "180 กรัม",
          servingNote: "ตักข้าวหุงสุก 180 กรัม",
        })],
        stage: "service",
      }),
      blocks: [],
      partNumber: 1,
      totalParts: 1,
    };
    const media: MediaIndex = {
      assetsById: new Map(),
      linksByStepId: new Map(),
    };

    render(
      <WorkstationCard
        page={page}
        media={media}
        previewMode="draft"
        readiness="ready"
        componentLabelFor={(componentRecipeId) => (
          componentRecipeId === "RCP-RICE" ? "ข้าวญี่ปุ่นหุงสุก · RCP-RICE" : null
        )}
      />,
    );

    const row = screen.getByRole("row", { name: /ข้าวญี่ปุ่นหุงสุก/u });
    expect(within(row).getByText("ข้าวญี่ปุ่นหุงสุก · RCP-RICE")).toBeVisible();
    expect(within(row).getByText("180 กรัม")).toBeVisible();
    expect(within(row).getByText("ตักข้าวหุงสุก 180 กรัม")).toBeVisible();
  });
});
