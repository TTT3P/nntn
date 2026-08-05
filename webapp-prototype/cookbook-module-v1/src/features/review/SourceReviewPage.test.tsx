import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";
import type { CookbookSnapshot } from "../../domain/cookbook/types";
import { PrototypeContext } from "../../prototype/PrototypeProvider";
import { makeIngredientLine, makeMediaAsset, makeRecipe, makeSnapshot, makeStepMediaLink, makeWorkStep } from "../../test/builders";
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { SourceReviewPage } from "./SourceReviewPage";

afterEach(cleanup);

function reviewRecipe(name: string, id: number | string) {
  return makeRecipe({
    recipeId: id,
    recipeVersionId: `version-${String(id)}`,
    name,
    reviewState: "candidate",
    sourceLocators: ["ลายมือ: หน้า 9", "DOCX: สูตร.docx", "V2: สูตร", "V1: รายการ"],
    lines: [
      makeIngredientLine({
        lineKey: `${String(id)}:น้ำยำ`,
        itemName: "น้ำยำ",
        sourceText: "1 ช้อนโต๊ะ\nพูนเล็กน้อย",
        selectedSource: "ลายมือ",
        decisionStatus: "รอยืนยัน",
      }),
    ],
    methodText: "คนเบา ๆ\nแล้วพักไว้",
    blockers: ["ต้องยืนยันช้อนที่ใช้"],
    workDocuments: {
      prep: {
        stage: "prep",
        scalable: true,
        ingredientLineKeys: [`${String(id)}:น้ำยำ`],
        steps: [makeWorkStep({ stepId: `${String(id)}:prep:1` })],
      },
    },
  });
}

describe("SourceReviewPage", () => {
  test("states source precedence and renders exact source facts and newlines", () => {
    const recipe = reviewRecipe("น้ำยำ", 37);
    renderWithPrototype(<SourceReviewPage />, {
      snapshot: makeSnapshot({ recipes: [recipe] }),
    });

    expect(screen.getByText("ลายมือใหม่เป็นหลักเมื่อมีการแก้ไข")).toBeVisible();
    expect(screen.getByText(/DOCX และ V2.*หลักฐานเปรียบเทียบ/)).toBeVisible();
    expect(screen.getByText(/V1.*รายการตั้งต้นเท่านั้น/)).toBeVisible();
    expect(screen.getByRole("cell", { name: /1 ช้อนโต๊ะ/ })).toHaveTextContent("1 ช้อนโต๊ะ\nพูนเล็กน้อย", { normalizeWhitespace: false });
    expect(screen.getByText(/คนเบา ๆ/)).toHaveTextContent("คนเบา ๆ\nแล้วพักไว้", { normalizeWhitespace: false });
    expect(screen.getByText("ลายมือ")).toBeVisible();
    expect(screen.getByText("รอยืนยัน")).toBeVisible();
    expect(screen.getByText("37:น้ำยำ")).toBeVisible();
    expect(screen.getByText("ลายมือ: หน้า 9")).toBeVisible();
    expect(screen.getByText(/การแก้ไข.*เฉพาะเซสชันนี้/)).toBeVisible();
  });

  test("selects review work by recipe name and replaces the panel without requiring a code", async () => {
    const user = userEvent.setup();
    const first = reviewRecipe("สูตรแรก", 1);
    const second = reviewRecipe("สูตรที่สอง", "candidate-A");
    renderWithPrototype(<SourceReviewPage />, {
      snapshot: makeSnapshot({ recipes: [first, second] }),
    });

    expect(screen.getByRole("heading", { name: "สูตรที่สอง" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /สูตรแรก.*candidate/ }));

    expect(screen.getByRole("heading", { name: "สูตรแรก" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "สูตรที่สอง" })).not.toBeInTheDocument();
  });

  test("keeps blockers and DRAFT separate from media gaps and review", () => {
    const recipe = reviewRecipe("สูตรมีประเด็น", 2);
    renderWithPrototype(<SourceReviewPage />, {
      snapshot: makeSnapshot({ recipes: [recipe] }),
    });

    expect(screen.getByText("DRAFT")).toBeVisible();
    expect(screen.getByText("ต้องยืนยันช้อนที่ใช้")).toBeVisible();
    expect(screen.getByText("รูปขั้นตอนไม่ครบ")).toBeVisible();
    expect(screen.getByText("สถานะรูป: ไม่ใช่เหตุให้เป็น DRAFT")).toBeVisible();
  });

  test("reports media review separately from missing media", () => {
    const recipe = reviewRecipe("สูตรรอตรวจรูป", 3);
    renderWithPrototype(<SourceReviewPage />, {
      snapshot: makeSnapshot({
        recipes: [recipe],
        media: [makeMediaAsset({ mediaId: "review-photo" })],
        stepMedia: [makeStepMediaLink({ stepId: "3:prep:1", mediaId: "review-photo", reviewNeeded: true })],
      }),
    });

    expect(screen.getByText("รูปต้องตรวจสอบ")).toBeVisible();
    expect(screen.queryByText("รูปขั้นตอนไม่ครบ")).not.toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeVisible();
  });

  test("moves selection to the first remaining queue row when the selected recipe disappears", async () => {
    const user = userEvent.setup();
    const first = reviewRecipe("ก สูตรแรก", 1);
    const second = reviewRecipe("ฮ สูตรที่เลือก", 2);

    function SnapshotHarness() {
      const [snapshot, setSnapshot] = useState<CookbookSnapshot>(makeSnapshot({ recipes: [first, second] }));
      return (
        <PrototypeContext.Provider value={{ snapshot, dirty: false, persistence: "session", dispatch: () => ({ ok: true }), createSessionObjectUrl: () => "blob:test", releaseSessionObjectUrl: () => undefined, isSessionObjectUrl: () => false }}>
          <button type="button" onClick={() => setSnapshot(makeSnapshot({ recipes: [first] }))}>เปลี่ยนข้อมูล</button>
          <SourceReviewPage />
        </PrototypeContext.Provider>
      );
    }

    render(<SnapshotHarness />);
    await user.click(screen.getByRole("button", { name: /ฮ สูตรที่เลือก.*candidate/ }));
    expect(screen.getByRole("heading", { name: "ฮ สูตรที่เลือก" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "เปลี่ยนข้อมูล" }));
    expect(screen.getByRole("heading", { name: "ก สูตรแรก" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "ฮ สูตรที่เลือก" })).not.toBeInTheDocument();
  });

  test("keys selection by typed identity and revision across reorder and revision replacement", async () => {
    const user = userEvent.setup();
    const first = reviewRecipe("ชื่อซ้ำ", 1);
    first.recipeVersionId = "revision-a";
    const selected = reviewRecipe("ชื่อซ้ำ", "selected");
    selected.recipeVersionId = "revision-b";

    function RevisionHarness() {
      const [snapshot, setSnapshot] = useState<CookbookSnapshot>(makeSnapshot({ recipes: [first, selected] }));
      return (
        <PrototypeContext.Provider value={{ snapshot, dirty: false, persistence: "session", dispatch: () => ({ ok: true }), createSessionObjectUrl: () => "blob:test", releaseSessionObjectUrl: () => undefined, isSessionObjectUrl: () => false }}>
          <button type="button" onClick={() => setSnapshot(makeSnapshot({ recipes: [selected, first] }))}>สลับลำดับ</button>
          <button type="button" onClick={() => setSnapshot(makeSnapshot({ recipes: [{ ...selected, recipeVersionId: "revision-c" }, first] }))}>เปลี่ยน revision</button>
          <SourceReviewPage />
        </PrototypeContext.Provider>
      );
    }

    render(<RevisionHarness />);
    await user.click(screen.getByRole("button", { name: /ชื่อซ้ำ.*revision-b/ }));
    expect(screen.getByText("revision: revision-b")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "สลับลำดับ" }));
    expect(screen.getByText("revision: revision-b")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "เปลี่ยน revision" }));
    expect(screen.getByText("revision: revision-a")).toBeVisible();
    expect(screen.queryByText("revision: revision-b")).not.toBeInTheDocument();
  });

  test.each([
    ["selectedSource", (recipe: ReturnType<typeof reviewRecipe>) => { recipe.lines[0]!.selectedSource = {} as never; }],
    ["decisionStatus", (recipe: ReturnType<typeof reviewRecipe>) => { recipe.lines[0]!.decisionStatus = [] as never; }],
    ["sourceLocators", (recipe: ReturnType<typeof reviewRecipe>) => { recipe.sourceLocators = [42 as never]; }],
    ["sourceLocators array", (recipe: ReturnType<typeof reviewRecipe>) => { recipe.sourceLocators = {} as never; }],
    ["methodText", (recipe: ReturnType<typeof reviewRecipe>) => { recipe.methodText = { hostile: true } as never; }],
    ["blockers", (recipe: ReturnType<typeof reviewRecipe>) => { recipe.blockers = [undefined as never]; }],
  ] as const)("guards hostile displayed field %s before rendering the panel", (_field, corrupt) => {
    const recipe = reviewRecipe("สูตรข้อมูลเสีย", 8);
    corrupt(recipe);
    renderWithPrototype(<SourceReviewPage />, {
      snapshot: makeSnapshot({ recipes: [recipe] }),
    });

    expect(screen.getByRole("alert")).toHaveAccessibleName("เปิดคิวตรวจสอบไม่ได้");
    expect(screen.queryByRole("heading", { name: "สูตรข้อมูลเสีย" })).not.toBeInTheDocument();
  });

  test("does not introduce a nested main landmark", () => {
    const view = renderWithPrototype(<SourceReviewPage />, {
      snapshot: makeSnapshot({ recipes: [reviewRecipe("สูตร landmark", 9)] }),
    });
    expect(view.container.querySelector("main")).toBeNull();
  });

  test("shows deterministic accessible empty and malformed-data states", () => {
    const empty = renderWithPrototype(<SourceReviewPage />, {
      snapshot: makeSnapshot({ recipes: [makeRecipe({ reviewState: "confirmed" })] }),
    });
    expect(screen.getByRole("status")).toHaveTextContent("ไม่มีสูตรที่ต้องตรวจสอบ");
    empty.unmount();

    renderWithPrototype(<SourceReviewPage />, {
      snapshot: makeSnapshot({
        recipes: [makeRecipe({ name: " ", reviewState: "candidate" })],
      }),
    });
    expect(screen.getByRole("alert")).toHaveAccessibleName("เปิดคิวตรวจสอบไม่ได้");
  });
});
