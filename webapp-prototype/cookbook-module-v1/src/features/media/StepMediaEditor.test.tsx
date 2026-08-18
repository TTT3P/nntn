import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { CookbookSnapshot } from "../../domain/cookbook/types";
import { PrototypeContext, usePrototype } from "../../prototype/PrototypeProvider";
import { makeMediaAsset, makeRecipe, makeSnapshot, makeStepMediaLink, makeWorkStep } from "../../test/builders";
import { renderWithPrototype } from "../../test/renderWithPrototype";
import { StepMediaEditor } from "./StepMediaEditor";

afterEach(cleanup);

function editorSnapshot(overrides: Partial<CookbookSnapshot> = {}) {
  return makeSnapshot({
    recipes: [
      makeRecipe({
        workDocuments: {
          prep: {
            stage: "prep",
            scalable: true,
            ingredientLineKeys: [],
            steps: [
              makeWorkStep({ stepId: "step-1", instruction: "หั่นให้พอดี" }),
              makeWorkStep({ stepId: "step-2", instruction: "จัดใส่จาน", order: 2 }),
            ],
          },
        },
      }),
    ],
    ...overrides,
  });
}

function SnapshotProbe() {
  const { snapshot } = usePrototype();
  return <output aria-label="snapshot">{JSON.stringify(snapshot)}</output>;
}

function renderEditor(snapshot = editorSnapshot(), stepId = "step-1") {
  return renderWithPrototype(
    <>
      <StepMediaEditor stepId={stepId} />
      <SnapshotProbe />
    </>,
    { snapshot },
  );
}

function SharedEditorHarness() {
  const [showFirstEditor, setShowFirstEditor] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setShowFirstEditor(false)}>ซ่อนขั้นตอนแรก</button>
      {showFirstEditor && <StepMediaEditor stepId="step-1" />}
      <StepMediaEditor stepId="step-2" />
    </>
  );
}

function ResettableEditorsHarness() {
  const { dispatch } = usePrototype();
  return (
    <>
      <button type="button" onClick={() => dispatch({ type: "reset-session" })}>
        รีเซ็ต session
      </button>
      <StepMediaEditor stepId="step-1" />
      <StepMediaEditor stepId="step-2" />
      <SnapshotProbe />
    </>
  );
}

function ForeignBlobClaimHarness() {
  const prototype = usePrototype();
  const [, forceRender] = useState(0);
  const legacyRegister = (
    prototype as unknown as {
      registerSessionObjectUrl?: (url: string) => void;
    }
  ).registerSessionObjectUrl;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          legacyRegister?.("blob:foreign-session");
          forceRender((value) => value + 1);
        }}
      >
        พยายามอ้างสิทธิ์ blob ต่าง session
      </button>
      <StepMediaEditor stepId="step-1" />
    </>
  );
}

describe("StepMediaEditor", () => {
  test("previews a selected image and stores it as session-only media", async () => {
    const user = userEvent.setup();
    renderEditor();

    const file = new File(["image"], "cut-size.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("เลือกรูป"), file);

    expect(screen.getByAltText("ตัวอย่าง cut-size.png")).toHaveAttribute("src", "blob:test-media-1");
    expect(screen.getByText("รูปนี้อยู่เฉพาะ session และจะหายเมื่อ reload")).toBeVisible();
    expect(screen.getByLabelText("snapshot")).toHaveTextContent('"localSessionOnly":true');
    expect(screen.getByLabelText("snapshot")).toHaveTextContent('"url":"blob:test-media-1"');
  });

  test("revokes object URLs on file replacement and unmount", async () => {
    const user = userEvent.setup();
    const view = renderEditor();

    await user.upload(screen.getByLabelText("เลือกรูป"), new File(["one"], "one.png", { type: "image/png" }));
    const oldUrlRenderedAtRevoke: boolean[] = [];
    vi.mocked(URL.revokeObjectURL).mockImplementation((url) => {
      if (url === "blob:test-media-1") {
        oldUrlRenderedAtRevoke.push(
          document.querySelector('img[src="blob:test-media-1"]') !== null,
        );
      }
    });
    await user.upload(screen.getByLabelText("เลือกรูป"), new File(["two"], "two.png", { type: "image/png" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(1, "blob:test-media-1");
    expect(oldUrlRenderedAtRevoke).toEqual([false]);
    expect(screen.getByAltText("ตัวอย่าง two.png")).toHaveAttribute("src", "blob:test-media-2");
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenNthCalledWith(2, "blob:test-media-2");
  });

  test("keeps a reused object URL alive when only its creator editor unmounts", async () => {
    const user = userEvent.setup();
    const view = renderWithPrototype(<SharedEditorHarness />, { snapshot: editorSnapshot() });
    const firstEditor = screen.getByRole("group", { name: "รูปของขั้นตอน หั่นให้พอดี" });

    await user.upload(
      within(firstEditor).getByLabelText("เลือกรูป"),
      new File(["shared"], "shared.png", { type: "image/png" }),
    );
    const secondEditor = screen.getByRole("group", { name: "รูปของขั้นตอน จัดใส่จาน" });
    await user.click(within(secondEditor).getByRole("button", { name: "ใช้รูป shared.png" }));

    await user.click(screen.getByRole("button", { name: "ซ่อนขั้นตอนแรก" }));

    expect(within(secondEditor).getByAltText("ตัวอย่าง shared.png")).toHaveAttribute(
      "src",
      "blob:test-media-1",
    );
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:test-media-1");

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-media-1");
  });

  test("allocates fresh media identities after reset and across mounted editors", async () => {
    const user = userEvent.setup();
    renderWithPrototype(<ResettableEditorsHarness />, { snapshot: editorSnapshot() });
    const firstEditor = () => screen.getByRole("group", { name: "รูปของขั้นตอน หั่นให้พอดี" });
    const secondEditor = () => screen.getByRole("group", { name: "รูปของขั้นตอน จัดใส่จาน" });

    await user.upload(
      within(firstEditor()).getByLabelText("เลือกรูป"),
      new File(["first"], "first.png", { type: "image/png" }),
    );
    const firstMediaId = JSON.parse(screen.getByLabelText("snapshot").textContent!).media[0].mediaId;

    await user.click(screen.getByRole("button", { name: "รีเซ็ต session" }));
    await user.upload(
      within(firstEditor()).getByLabelText("เลือกรูป"),
      new File(["second"], "second.png", { type: "image/png" }),
    );
    await user.upload(
      within(secondEditor()).getByLabelText("เลือกรูป"),
      new File(["third"], "third.png", { type: "image/png" }),
    );

    expect(within(firstEditor()).getByAltText("ตัวอย่าง second.png")).toBeVisible();
    expect(within(secondEditor()).getByAltText("ตัวอย่าง third.png")).toBeVisible();
    const snapshot = JSON.parse(screen.getByLabelText("snapshot").textContent!);
    expect(snapshot.media).toHaveLength(2);
    expect(new Set(snapshot.media.map((asset: { mediaId: string }) => asset.mediaId)).size).toBe(2);
    expect(snapshot.media.map((asset: { mediaId: string }) => asset.mediaId)).not.toContain(firstMediaId);
  });

  test("edits caption, role, and nullable delivery vessel in session state", async () => {
    const user = userEvent.setup();
    renderEditor(editorSnapshot({
      media: [makeMediaAsset({ mediaId: "media-a", caption: "ก่อนแก้" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "media-a" })],
    }));

    const caption = screen.getByLabelText("คำบรรยายรูป");
    await user.clear(caption);
    await user.type(caption, "หั่นขนาดหนึ่งนิ้ว");
    await user.selectOptions(screen.getByLabelText("ชนิดรูป"), "final");
    await user.selectOptions(screen.getByLabelText("ภาชนะ"), "delivery_box");

    expect(screen.getByLabelText("snapshot")).toHaveTextContent('"caption":"หั่นขนาดหนึ่งนิ้ว"');
    expect(screen.getByLabelText("snapshot")).toHaveTextContent('"role":"final"');
    expect(screen.getByLabelText("snapshot")).toHaveTextContent('"vessel":"delivery_box"');

    await user.selectOptions(screen.getByLabelText("ภาชนะ"), "");
    expect(screen.getByLabelText("snapshot")).toHaveTextContent('"vessel":null');
  });

  test("searches reusable assets name-first and never offers an already-linked duplicate", async () => {
    const user = userEvent.setup();
    renderEditor(editorSnapshot({
      media: [
        makeMediaAsset({ mediaId: "linked", caption: "รูปที่ใช้แล้ว" }),
        makeMediaAsset({ mediaId: "available", caption: "ขนาดหลังหั่น", altText: "ภาพขนาดหลังหั่น" }),
      ],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "linked" })],
    }));

    const search = screen.getByLabelText("เลือกจากคลังรูป");
    await user.type(search, "หลังหั่น");
    expect(screen.getByRole("button", { name: "ใช้รูป ขนาดหลังหั่น" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "ใช้รูป รูปที่ใช้แล้ว" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ใช้รูป ขนาดหลังหั่น" }));
    expect(screen.getByLabelText("snapshot")).toHaveTextContent('"mediaId":"available"');
    expect(screen.queryByRole("button", { name: "ใช้รูป ขนาดหลังหั่น" })).not.toBeInTheDocument();
  });

  test("explains an empty library and a search with no results", async () => {
    const user = userEvent.setup();
    const empty = renderEditor();
    expect(screen.getByText("คลังรูปยังว่าง")).toBeVisible();
    empty.unmount();

    renderEditor(editorSnapshot({ media: [makeMediaAsset({ caption: "รูปเตรียมซอส" })] }));
    await user.type(screen.getByLabelText("เลือกจากคลังรูป"), "ไม่มีรูปนี้");
    expect(screen.getByText("ไม่พบรูปที่ค้นหา")).toBeVisible();
  });

  test("reorders only target-step links and disables boundary moves", async () => {
    const user = userEvent.setup();
    renderEditor(editorSnapshot({
      media: [
        makeMediaAsset({ mediaId: "a", altText: "รูป A" }),
        makeMediaAsset({ mediaId: "b", altText: "รูป B" }),
        makeMediaAsset({ mediaId: "other", altText: "รูปขั้นตอนอื่น" }),
      ],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "a", order: 1 }),
        makeStepMediaLink({ stepId: "step-1", mediaId: "b", order: 2 }),
        makeStepMediaLink({ stepId: "step-2", mediaId: "other", order: 1 }),
      ],
    }));

    expect(screen.getByRole("button", { name: "เลื่อนรูป A ก่อนหน้า" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "เลื่อนรูป B ถัดไป" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "เลื่อนรูป B ก่อนหน้า" }));

    const images = within(screen.getByRole("list", { name: "รูปที่ผูกกับขั้นตอน" })).getAllByRole("img");
    expect(images.map((image) => image.getAttribute("alt"))).toEqual(["รูป B", "รูป A"]);
    expect(screen.getByLabelText("snapshot")).toHaveTextContent('"stepId":"step-2","mediaId":"other","order":1');
  });

  test("shows review-needed separately from an empty step", () => {
    const review = renderEditor(editorSnapshot({
      media: [makeMediaAsset({ mediaId: "review" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "review", reviewNeeded: true })],
    }));
    expect(screen.getByText("รูปควรตรวจใหม่")).toBeVisible();
    expect(screen.queryByText("เพิ่มรูปภายหลัง")).not.toBeInTheDocument();
    review.unmount();

    renderEditor();
    expect(screen.getByText("เพิ่มรูปภายหลัง")).toBeVisible();
    expect(screen.queryByText("รูปควรตรวจใหม่")).not.toBeInTheDocument();
  });

  test("turns malformed media data into a named editor alert", () => {
    renderEditor(editorSnapshot({
      media: [makeMediaAsset({ mediaId: "duplicate" }), makeMediaAsset({ mediaId: "duplicate" })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "duplicate" })],
    }));

    expect(screen.getByRole("alert")).toHaveAccessibleName("แก้ไขรูปขั้นตอนไม่ได้");
    expect(screen.getByRole("alert")).toHaveTextContent("DuplicateMediaAssetIdError");
  });

  test("fails closed when an unlinked reusable asset is malformed", () => {
    const malformed = makeMediaAsset({ mediaId: "bad-library-asset" });
    malformed.caption = { unsafe: true } as never;
    renderEditor(editorSnapshot({ media: [malformed] }));

    expect(screen.getByRole("alert")).toHaveAccessibleName("แก้ไขรูปขั้นตอนไม่ได้");
    expect(screen.getByRole("alert")).toHaveTextContent("InvalidMediaAssetFieldError");
  });

  test("fails closed before metadata edits when unrelated links violate the reducer contract", () => {
    renderEditor(editorSnapshot({
      media: [
        makeMediaAsset({ mediaId: "target" }),
        makeMediaAsset({ mediaId: "unrelated" }),
      ],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "target" }),
        makeStepMediaLink({ stepId: "step-2", mediaId: "unrelated", order: 1 }),
        makeStepMediaLink({ stepId: "step-2", mediaId: "unrelated", order: 2 }),
      ],
    }));

    expect(screen.getByRole("alert")).toHaveAccessibleName("แก้ไขรูปขั้นตอนไม่ได้");
    expect(screen.getByRole("alert")).toHaveTextContent("DuplicateStepMediaLinkError");
    expect(screen.queryByLabelText("คำบรรยายรูป")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("ชนิดรูป")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("ภาชนะ")).not.toBeInTheDocument();
  });

  test("names a malformed unrelated reducer link instead of leaking a runtime TypeError", () => {
    renderEditor(editorSnapshot({
      media: [makeMediaAsset({ mediaId: "target" })],
      stepMedia: [
        makeStepMediaLink({ stepId: "step-1", mediaId: "target" }),
        null as never,
      ],
    }));

    expect(screen.getByRole("alert")).toHaveTextContent("InvalidSessionMediaLinkError");
    expect(screen.getByRole("alert")).not.toHaveTextContent("TypeError");
  });

  test.each([
    "https://example.invalid/kitchen.jpg",
    "data:image/png;base64,AAAA",
    "javascript:alert(1)",
    "blob:foreign-session",
    "//example.invalid/kitchen.jpg",
  ])("never creates a request-capable image for unsafe media URL %s", (url) => {
    renderEditor(editorSnapshot({
      media: [makeMediaAsset({ mediaId: "unsafe-url", url })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "unsafe-url" })],
    }));

    expect(screen.getByRole("alert")).toHaveTextContent("UnsafeMediaUrlError");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("cannot claim or revoke a caller-supplied foreign blob URL", async () => {
    const user = userEvent.setup();
    const view = renderWithPrototype(<ForeignBlobClaimHarness />, {
      snapshot: editorSnapshot({
        media: [makeMediaAsset({
          mediaId: "foreign-blob",
          url: "blob:foreign-session",
          localSessionOnly: true,
        })],
        stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "foreign-blob" })],
      }),
    });

    await user.click(screen.getByRole("button", { name: "พยายามอ้างสิทธิ์ blob ต่าง session" }));

    expect(screen.getByRole("alert")).toHaveTextContent("UnsafeMediaUrlError");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    view.unmount();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:foreign-session");
  });

  test.each([
    "/\n//example.invalid/pixel.png",
    "/sample-media/%2e%2e/api/pixel.png",
    "/sample-media/%2F%2Fexample.invalid/pixel.png",
    "/sample-media/photo.svg?next=//example.invalid/pixel.png",
    "/sample-media/photo.svg#//example.invalid/pixel.png",
    "/sample-media\\..\\pixel.png",
  ])("rejects non-canonical sample path bypass %j before creating an image", (url) => {
    renderEditor(editorSnapshot({
      media: [makeMediaAsset({ mediaId: "sample-bypass", url })],
      stepMedia: [makeStepMediaLink({ stepId: "step-1", mediaId: "sample-bypass" })],
    }));

    expect(screen.getByRole("alert")).toHaveTextContent("UnsafeMediaUrlError");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("revokes a newly created URL and reports a synchronous dispatch failure", async () => {
    const user = userEvent.setup();
    const dispatch = vi.fn(() => {
      throw new Error("dispatch failed");
    });
    render(
      <PrototypeContext.Provider value={{
        snapshot: editorSnapshot(),
        dirty: false,
        persistence: "session",
        dispatch,
        createSessionObjectUrl: (file) => URL.createObjectURL(file),
        releaseSessionObjectUrl: (url) => URL.revokeObjectURL(url),
        isSessionObjectUrl: () => false,
      }}>
        <StepMediaEditor stepId="step-1" />
      </PrototypeContext.Provider>,
    );

    await user.upload(screen.getByLabelText("เลือกรูป"), new File(["bad"], "bad.png", { type: "image/png" }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-media-1");
    expect(screen.getByRole("alert")).toHaveTextContent("Error: dispatch failed");
    expect(screen.queryByAltText("ตัวอย่าง bad.png")).not.toBeInTheDocument();
  });

  test("rejects an unsafe append order and revokes the unused preview URL", async () => {
    const user = userEvent.setup();
    renderEditor(editorSnapshot({
      media: [makeMediaAsset({ mediaId: "last-safe-media" })],
      stepMedia: [makeStepMediaLink({
        stepId: "step-1",
        mediaId: "last-safe-media",
        order: Number.MAX_SAFE_INTEGER,
      })],
    }));

    await user.upload(
      screen.getByLabelText("เลือกรูป"),
      new File(["overflow"], "overflow.png", { type: "image/png" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent("StepMediaOrderOverflowError");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-media-1");
    expect(screen.queryByAltText("ตัวอย่าง overflow.png")).not.toBeInTheDocument();
  });
});
