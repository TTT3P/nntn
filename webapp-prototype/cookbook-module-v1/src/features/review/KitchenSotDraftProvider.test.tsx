import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import fixture from "../../data/fixtures/first-set.json";
import type {
  KitchenSotDraftClient,
  LoadedKitchenSotDraft,
} from "../../data/KitchenSotDraftClient";
import { KitchenSotHttpError } from "../../data/KitchenSotDraftClient";
import { parseKitchenSotDocument } from "../../domain/sot/kitchenSotDocument";
import {
  KitchenSotDraftProvider,
  useKitchenSotDraft,
} from "./KitchenSotDraftProvider";

const sourcePath = "Operations/CookBook/sot/v4-2026-08-05/source/kitchen-sot-first-set-v2.json";
const sourceSha256 = "a".repeat(64);
const initialBaseSha256 = "b".repeat(64);
const persistedSha256 = "c".repeat(64);

function loadedDraft(): LoadedKitchenSotDraft {
  return {
    document: parseKitchenSotDocument(fixture),
    origin: "v4",
    sourcePath,
    sourceSha256,
    baseSha256: initialBaseSha256,
  };
}

function makeClient(): KitchenSotDraftClient & {
  load: ReturnType<typeof vi.fn<KitchenSotDraftClient["load"]>>;
  save: ReturnType<typeof vi.fn<KitchenSotDraftClient["save"]>>;
} {
  return {
    load: vi.fn(async () => loadedDraft()),
    save: vi.fn(async (document) => ({
      document,
      sha256: persistedSha256,
      base_sha256: persistedSha256,
      generatedAt: document.generated_at,
      path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v2.json",
    })),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function Harness() {
  const draft = useKitchenSotDraft();
  const recipe = draft.document.recipes.find(({ recipe_id }) => recipe_id === 162)!;
  return (
    <>
      <output aria-label="origin">{draft.origin}</output>
      <output aria-label="dirty">{String(draft.dirty)}</output>
      <output aria-label="yield">{recipe.yield_candidate_text}</output>
      <output aria-label="save state">{draft.saveState}</output>
      <output aria-label="save message">{draft.saveMessage}</output>
      <button
        type="button"
        onClick={() => draft.applyEdit({
          kind: "yield",
          recipeId: 162,
          value: "ค่าทดสอบ temp",
        })}
      >
        edit
      </button>
      <button type="button" onClick={() => void draft.save()}>save</button>
      <button
        type="button"
        onClick={() => draft.applyEdit({ kind: "yield", recipeId: 999, value: "invalid" })}
      >
        invalid edit
      </button>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("KitchenSotDraftProvider", () => {
  test("keeps dirty edits until an atomic save receipt replaces the base", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-07T04:05:06.789Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const client = makeClient();

    render(
      <KitchenSotDraftProvider client={client}>
        <Harness />
      </KitchenSotDraftProvider>,
    );

    expect(await screen.findByLabelText("origin")).toHaveTextContent("v4");
    await user.click(screen.getByRole("button", { name: "edit" }));
    expect(screen.getByLabelText("yield")).toHaveTextContent("ค่าทดสอบ temp");
    expect(screen.getByLabelText("dirty")).toHaveTextContent("true");

    await user.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByLabelText("dirty")).toHaveTextContent("false");
    expect(screen.getByLabelText("save state")).toHaveTextContent("saved");
    expect(client.save).toHaveBeenCalledWith(
      expect.objectContaining({
        schema_version: "2.1.0-prototype-draft",
        generated_at: "2026-08-07T04:05:06.789Z",
        derived_from: { path: sourcePath, sha256: sourceSha256 },
      }),
      initialBaseSha256,
    );
    expect(screen.getByLabelText("save message")).toHaveTextContent(
      "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v2.json",
    );
    expect(screen.getByLabelText("save message")).toHaveTextContent(persistedSha256);
    expect(screen.getByLabelText("save message")).toHaveTextContent("2026-08-07T04:05:06.789Z");

    await user.click(screen.getByRole("button", { name: "edit" }));
    await user.click(screen.getByRole("button", { name: "save" }));
    expect(client.save).toHaveBeenNthCalledWith(2, expect.any(Object), persistedSha256);
  });

  test("retains the working edit and mounted route when save fails", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    client.save.mockRejectedValueOnce(new KitchenSotHttpError(500, "WRITE_FAILED"));
    render(
      <KitchenSotDraftProvider client={client}>
        <Harness />
      </KitchenSotDraftProvider>,
    );
    await screen.findByLabelText("origin");

    await user.click(screen.getByRole("button", { name: "edit" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByLabelText("save state")).toHaveTextContent("error");
    expect(screen.getByLabelText("dirty")).toHaveTextContent("true");
    expect(screen.getByLabelText("yield")).toHaveTextContent("ค่าทดสอบ temp");
    expect(screen.getByRole("alert")).toHaveTextContent("WRITE_FAILED");
    expect(screen.getByRole("button", { name: "edit" })).toBeEnabled();
  });

  test("rejects clean saves and invalid edits without unmounting the route", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    render(
      <KitchenSotDraftProvider client={client}>
        <Harness />
      </KitchenSotDraftProvider>,
    );
    await screen.findByLabelText("origin");

    await user.click(screen.getByRole("button", { name: "save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("ไม่มีการแก้ไข");
    expect(client.save).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "invalid edit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("KitchenSotIdentityNotFoundError");
    expect(screen.getByLabelText("dirty")).toHaveTextContent("false");
    expect(screen.getByRole("button", { name: "edit" })).toBeEnabled();
  });

  test("retains edits and blocks resubmission when the server reports a stale draft", async () => {
    const user = userEvent.setup();
    const client = makeClient();
    client.save.mockRejectedValueOnce(new KitchenSotHttpError(409, "STALE_DRAFT"));
    render(
      <KitchenSotDraftProvider client={client}>
        <Harness />
      </KitchenSotDraftProvider>,
    );
    await screen.findByLabelText("origin");

    await user.click(screen.getByRole("button", { name: "edit" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    expect(await screen.findByLabelText("save state")).toHaveTextContent("stale");
    expect(screen.getByLabelText("dirty")).toHaveTextContent("true");
    expect(screen.getByRole("alert")).toHaveTextContent("โหลดหน้าใหม่");
    await user.click(screen.getByRole("button", { name: "save" }));
    expect(client.save).toHaveBeenCalledTimes(1);
  });

  test("does not overlap rapid saves", async () => {
    const user = userEvent.setup();
    const pending = deferred<Awaited<ReturnType<KitchenSotDraftClient["save"]>>>();
    const client = makeClient();
    client.save.mockImplementationOnce(() => pending.promise);
    render(
      <KitchenSotDraftProvider client={client}>
        <Harness />
      </KitchenSotDraftProvider>,
    );
    await screen.findByLabelText("origin");
    await user.click(screen.getByRole("button", { name: "edit" }));

    await user.click(screen.getByRole("button", { name: "save" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    expect(client.save).toHaveBeenCalledTimes(1);
    const submitted = client.save.mock.calls[0]![0];
    await act(async () => {
      pending.resolve({
        document: submitted,
        sha256: persistedSha256,
        base_sha256: persistedSha256,
        generatedAt: submitted.generated_at,
        path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v2.json",
      });
    });
    expect(screen.getByLabelText("save state")).toHaveTextContent("saved");
  });

  test("ignores an older load after the client is replaced", async () => {
    const oldLoad = deferred<LoadedKitchenSotDraft>();
    const oldClient = makeClient();
    oldClient.load.mockImplementationOnce(() => oldLoad.promise);
    const newClient = makeClient();
    newClient.load.mockResolvedValueOnce({ ...loadedDraft(), origin: "v5-draft" });
    const view = render(
      <KitchenSotDraftProvider client={oldClient}>
        <Harness />
      </KitchenSotDraftProvider>,
    );

    view.rerender(
      <KitchenSotDraftProvider client={newClient}>
        <Harness />
      </KitchenSotDraftProvider>,
    );
    expect(await screen.findByLabelText("origin")).toHaveTextContent("v5-draft");
    await act(async () => oldLoad.resolve(loadedDraft()));
    expect(screen.getByLabelText("origin")).toHaveTextContent("v5-draft");
  });

  test("does not inspect or commit a save receipt after unmount", async () => {
    const user = userEvent.setup();
    const pending = deferred<Awaited<ReturnType<KitchenSotDraftClient["save"]>>>();
    const client = makeClient();
    client.save.mockImplementationOnce(() => pending.promise);
    const receiptDocumentRead = vi.fn(() => parseKitchenSotDocument(fixture));
    const view = render(
      <KitchenSotDraftProvider client={client}>
        <Harness />
      </KitchenSotDraftProvider>,
    );
    await screen.findByLabelText("origin");
    await user.click(screen.getByRole("button", { name: "edit" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    view.unmount();
    await act(async () => pending.resolve({
      get document() {
        return receiptDocumentRead();
      },
      sha256: persistedSha256,
      base_sha256: persistedSha256,
      generatedAt: "2026-08-07T04:05:06.789Z",
      path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v2.json",
    }));

    expect(receiptDocumentRead).not.toHaveBeenCalled();
  });

  test("ignores an older save receipt after the client is replaced", async () => {
    const user = userEvent.setup();
    const pendingSave = deferred<Awaited<ReturnType<KitchenSotDraftClient["save"]>>>();
    const oldClient = makeClient();
    oldClient.save.mockImplementationOnce(() => pendingSave.promise);
    const newClient = makeClient();
    newClient.load.mockResolvedValueOnce({ ...loadedDraft(), origin: "v5-draft" });
    const view = render(
      <KitchenSotDraftProvider client={oldClient}>
        <Harness />
      </KitchenSotDraftProvider>,
    );
    await screen.findByLabelText("origin");
    await user.click(screen.getByRole("button", { name: "edit" }));
    await user.click(screen.getByRole("button", { name: "save" }));

    view.rerender(
      <KitchenSotDraftProvider client={newClient}>
        <Harness />
      </KitchenSotDraftProvider>,
    );
    expect(await screen.findByLabelText("origin")).toHaveTextContent("v5-draft");
    await act(async () => pendingSave.resolve({
      document: oldClient.save.mock.calls[0]![0],
      sha256: persistedSha256,
      base_sha256: persistedSha256,
      generatedAt: "2026-08-07T04:05:06.789Z",
      path: "Operations/CookBook/sot/v5-draft/kitchen-sot-first-set-v2.json",
    }));

    expect(screen.getByLabelText("origin")).toHaveTextContent("v5-draft");
    expect(screen.getByLabelText("dirty")).toHaveTextContent("false");
    expect(screen.getByLabelText("save state")).toHaveTextContent("idle");
  });

  test("renders distinct Thai loading and load-error states", async () => {
    const pendingLoad = deferred<LoadedKitchenSotDraft>();
    const client = makeClient();
    client.load.mockImplementationOnce(() => pendingLoad.promise);
    const view = render(
      <KitchenSotDraftProvider client={client}>
        <Harness />
      </KitchenSotDraftProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลดร่าง Kitchen SOT");
    await act(async () => pendingLoad.reject(new KitchenSotHttpError(503, "SERVICE_UNAVAILABLE")));
    expect(await screen.findByRole("alert")).toHaveTextContent("โหลดร่าง Kitchen SOT ไม่สำเร็จ");
    expect(screen.getByRole("alert")).toHaveTextContent("SERVICE_UNAVAILABLE");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    view.unmount();
  });
});
