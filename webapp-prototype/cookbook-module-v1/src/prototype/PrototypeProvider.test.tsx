import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { CookbookRepository } from "../data/CookbookRepository";
import { makeMediaAsset, makeRecipe, makeSnapshot, makeStepMediaLink, makeWorkStep } from "../test/builders";
import { PrototypeProvider, usePrototype } from "./PrototypeProvider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function SnapshotReader() {
  const { snapshot, dirty, persistence, dispatch } = usePrototype();

  return (
    <section>
      <p>{snapshot.recipes[0]?.name}</p>
      <p>{dirty ? "dirty" : "clean"}</p>
      <p>{persistence}</p>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "set-recipe-note",
            recipeId: snapshot.recipes[0]!.recipeId,
            note: "แก้ในเซสชัน",
          })
        }
      >
        แก้ไข
      </button>
    </section>
  );
}

function InvalidMediaAction() {
  const { dispatch } = usePrototype();
  return (
    <section>
      <p>เส้นทางยังทำงาน</p>
      <button
        type="button"
        onClick={() => dispatch({
          type: "replace-step-media",
          stepId: "step-1",
          links: [makeStepMediaLink({ stepId: "step-1", mediaId: "target" })],
        })}
      >
        แก้ชนิดรูป
      </button>
    </section>
  );
}

function ReplacementSafetyHarness() {
  const { snapshot, dispatch, createSessionObjectUrl } = usePrototype();
  return (
    <section>
      <p>เส้นทาง replacement ยังทำงาน</p>
      <output aria-label="replacement snapshot">{JSON.stringify(snapshot)}</output>
      <button
        type="button"
        onClick={() => {
          const url = createSessionObjectUrl(new File(["owned"], "owned.png", { type: "image/png" }));
          dispatch({
            type: "add-session-media",
            asset: makeMediaAsset({
              mediaId: "owned-media",
              url,
              localSessionOnly: true,
              reviewState: "unreviewed",
            }),
            link: makeStepMediaLink({ stepId: "step-1", mediaId: "owned-media" }),
          });
        }}
      >
        สร้าง owned media
      </button>
      <button
        type="button"
        onClick={() => dispatch({
          type: "replace-snapshot",
          snapshot: { ...snapshot, media: null as never },
        })}
      >
        แทนที่ด้วย media ผิดรูป
      </button>
      <button
        type="button"
        onClick={() => dispatch({
          type: "replace-snapshot",
          snapshot: { ...snapshot, stepMedia: [null as never] },
        })}
      >
        แทนที่ด้วย step media ผิดรูป
      </button>
      <button type="button" onClick={() => dispatch({ type: "reset-session" })}>
        รีเซ็ตหลัง reject
      </button>
    </section>
  );
}

function makeRepository(
  loadSnapshot: CookbookRepository["loadSnapshot"],
): CookbookRepository & { saveSessionSnapshot: ReturnType<typeof vi.fn> } {
  return {
    capabilities: {
      persistence: "session",
      mediaUpload: false,
      production: false,
    },
    loadSnapshot,
    saveSessionSnapshot: vi.fn(async () => ({
      persisted: false as const,
      scope: "session" as const,
    })),
  };
}

describe("PrototypeProvider", () => {
  test("rejects malformed replacement snapshots before commit and preserves owned URL cleanup", async () => {
    const user = userEvent.setup();
    const initialSnapshot = makeSnapshot({
      recipes: [makeRecipe({
        workDocuments: {
          prep: {
            stage: "prep",
            scalable: true,
            ingredientLineKeys: [],
            steps: [makeWorkStep({ stepId: "step-1" })],
          },
        },
      })],
    });
    const view = render(
      <PrototypeProvider initialSnapshot={initialSnapshot}>
        <ReplacementSafetyHarness />
      </PrototypeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "สร้าง owned media" }));
    const acceptedSnapshot = screen.getByLabelText("replacement snapshot").textContent;
    expect(acceptedSnapshot).toContain("blob:test-media-1");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "แทนที่ด้วย media ผิดรูป" }));
    expect(screen.getByRole("alert")).toHaveTextContent("InvalidReplacementSnapshotError");
    expect(screen.getByLabelText("replacement snapshot")).toHaveTextContent(acceptedSnapshot!);
    expect(screen.getByText("เส้นทาง replacement ยังทำงาน")).toBeVisible();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "แทนที่ด้วย step media ผิดรูป" }));
    expect(screen.getByRole("alert")).toHaveTextContent("InvalidReplacementSnapshotError");
    expect(screen.getByLabelText("replacement snapshot")).toHaveTextContent(acceptedSnapshot!);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "รีเซ็ตหลัง reject" }));
    expect(screen.getByLabelText("replacement snapshot")).toHaveTextContent(JSON.stringify(initialSnapshot));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-media-1");

    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
  test("surfaces reducer action errors without crashing the mounted route", async () => {
    const user = userEvent.setup();
    render(
      <PrototypeProvider initialSnapshot={makeSnapshot({
        recipes: [makeRecipe({
          workDocuments: {
            prep: {
              stage: "prep",
              scalable: true,
              ingredientLineKeys: [],
              steps: [
                makeWorkStep({ stepId: "step-1" }),
                makeWorkStep({ stepId: "step-2", order: 2 }),
              ],
            },
          },
        })],
        media: [
          makeMediaAsset({ mediaId: "target" }),
          makeMediaAsset({ mediaId: "unrelated" }),
        ],
        stepMedia: [
          makeStepMediaLink({ stepId: "step-1", mediaId: "target" }),
          makeStepMediaLink({ stepId: "step-2", mediaId: "unrelated", order: 1 }),
          makeStepMediaLink({ stepId: "step-2", mediaId: "unrelated", order: 2 }),
        ],
      })}>
        <InvalidMediaAction />
      </PrototypeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "แก้ชนิดรูป" }));

    expect(screen.getByRole("alert")).toHaveTextContent("DuplicateStepMediaLinkError");
    expect(screen.getByText("เส้นทางยังทำงาน")).toBeVisible();
  });
  test("loads an injected repository and keeps edits in session memory", async () => {
    const repository = makeRepository(
      vi.fn(async () =>
        makeSnapshot({ recipes: [makeRecipe({ name: "สูตรที่โหลด" })] }),
      ),
    );
    const storageGet = vi.spyOn(Storage.prototype, "getItem");
    const storageSet = vi.spyOn(Storage.prototype, "setItem");
    const storageRemove = vi.spyOn(Storage.prototype, "removeItem");
    const storageClear = vi.spyOn(Storage.prototype, "clear");

    render(
      <PrototypeProvider repository={repository}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลด");
    expect(await screen.findByText("สูตรที่โหลด")).toBeInTheDocument();
    screen.getByRole("button", { name: "แก้ไข" }).click();

    expect(await screen.findByText("dirty")).toBeInTheDocument();
    expect(screen.getByText("session")).toBeInTheDocument();
    expect(repository.saveSessionSnapshot).not.toHaveBeenCalled();
    expect(storageGet).not.toHaveBeenCalled();
    expect(storageSet).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
    expect(storageClear).not.toHaveBeenCalled();
  });

  test("surfaces a named, human-readable repository load error", async () => {
    const repository = makeRepository(
      vi.fn(async () => {
        throw new TypeError("fixture อ่านไม่ได้");
      }),
    );

    render(
      <PrototypeProvider repository={repository}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "TypeError: fixture อ่านไม่ได้",
    );
  });

  test("does not update state after an in-flight load is unmounted", async () => {
    let resolveLoad: ((snapshot: ReturnType<typeof makeSnapshot>) => void) | undefined;
    const repository = makeRepository(
      vi.fn(
        () =>
          new Promise<ReturnType<typeof makeSnapshot>>((resolve) => {
            resolveLoad = resolve;
          }),
      ),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(
      <PrototypeProvider repository={repository}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    view.unmount();
    await act(async () => {
      resolveLoad?.(makeSnapshot());
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
  });

  test("supports an explicit snapshot without loading a repository", () => {
    render(
      <PrototypeProvider
        initialSnapshot={makeSnapshot({
          recipes: [makeRecipe({ name: "สถานะทดสอบ" })],
        })}
      >
        <SnapshotReader />
      </PrototypeProvider>,
    );

    expect(screen.getByText("สถานะทดสอบ")).toBeInTheDocument();
    expect(screen.getByText("clean")).toBeInTheDocument();
  });

  test("fails clearly when the hook is used outside its provider", () => {
    function InvalidConsumer() {
      usePrototype();
      return null;
    }

    expect(() => render(<InvalidConsumer />)).toThrow(/PrototypeProvider/);
  });

  test("does not update state when repository rejects after unmount", async () => {
    let rejectLoad: ((error: Error) => void) | undefined;
    const repository = makeRepository(
      vi.fn(
        () =>
          new Promise<ReturnType<typeof makeSnapshot>>((_resolve, reject) => {
            rejectLoad = reject;
          }),
      ),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(
      <PrototypeProvider repository={repository}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    view.unmount();
    await act(async () => {
      rejectLoad?.(new Error("late failure"));
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();
  });

  test("moves ready to loading to ready and resets dirty state when repository changes", async () => {
    let resolveA: ((snapshot: ReturnType<typeof makeSnapshot>) => void) | undefined;
    let resolveB: ((snapshot: ReturnType<typeof makeSnapshot>) => void) | undefined;
    const repositoryA = makeRepository(
      () =>
        new Promise((resolve) => {
          resolveA = resolve;
        }),
    );
    const repositoryB = makeRepository(
      () =>
        new Promise((resolve) => {
          resolveB = resolve;
        }),
    );
    const view = render(
      <PrototypeProvider repository={repositoryA}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      resolveA?.(makeSnapshot({ recipes: [makeRecipe({ name: "สูตร A" })] }));
      await Promise.resolve();
    });
    expect(screen.getByText("สูตร A")).toBeInTheDocument();
    screen.getByRole("button", { name: "แก้ไข" }).click();
    expect(await screen.findByText("dirty")).toBeInTheDocument();

    view.rerender(
      <PrototypeProvider repository={repositoryB}>
        <SnapshotReader />
      </PrototypeProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลด");
    expect(screen.queryByText("สูตร A")).not.toBeInTheDocument();

    await act(async () => {
      await Promise.resolve();
      resolveB?.(makeSnapshot({ recipes: [makeRecipe({ name: "สูตร B" })] }));
      await Promise.resolve();
    });
    expect(screen.getByText("สูตร B")).toBeInTheDocument();
    expect(screen.getByText("clean")).toBeInTheDocument();
  });

  test("ignores an out-of-order result from a stale repository", async () => {
    let resolveA: ((snapshot: ReturnType<typeof makeSnapshot>) => void) | undefined;
    let resolveB: ((snapshot: ReturnType<typeof makeSnapshot>) => void) | undefined;
    const repositoryA = makeRepository(
      () =>
        new Promise((resolve) => {
          resolveA = resolve;
        }),
    );
    const repositoryB = makeRepository(
      () =>
        new Promise((resolve) => {
          resolveB = resolve;
        }),
    );
    const view = render(
      <PrototypeProvider repository={repositoryA}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    view.rerender(
      <PrototypeProvider repository={repositoryB}>
        <SnapshotReader />
      </PrototypeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      resolveB?.(makeSnapshot({ recipes: [makeRecipe({ name: "สูตร B" })] }));
      await Promise.resolve();
    });
    expect(screen.getByText("สูตร B")).toBeInTheDocument();

    await act(async () => {
      resolveA?.(makeSnapshot({ recipes: [makeRecipe({ name: "สูตร A ล่าช้า" })] }));
      await Promise.resolve();
    });
    expect(screen.getByText("สูตร B")).toBeInTheDocument();
    expect(screen.queryByText("สูตร A ล่าช้า")).not.toBeInTheDocument();
  });

  test("ignores an out-of-order rejection from a stale repository", async () => {
    let rejectA: ((error: Error) => void) | undefined;
    let resolveB: ((snapshot: ReturnType<typeof makeSnapshot>) => void) | undefined;
    const repositoryA = makeRepository(
      () =>
        new Promise((_resolve, reject) => {
          rejectA = reject;
        }),
    );
    const repositoryB = makeRepository(
      () =>
        new Promise((resolve) => {
          resolveB = resolve;
        }),
    );
    const view = render(
      <PrototypeProvider repository={repositoryA}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    view.rerender(
      <PrototypeProvider repository={repositoryB}>
        <SnapshotReader />
      </PrototypeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      resolveB?.(makeSnapshot({ recipes: [makeRecipe({ name: "สูตร B" })] }));
      await Promise.resolve();
    });
    await act(async () => {
      rejectA?.(new Error("A ล้มเหลวล่าช้า"));
      await Promise.resolve();
    });

    expect(screen.getByText("สูตร B")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("resets session state when the explicit initial snapshot object changes", async () => {
    const first = makeSnapshot({ recipes: [makeRecipe({ name: "สูตรแรก" })] });
    const second = makeSnapshot({ recipes: [makeRecipe({ name: "สูตรใหม่" })] });
    const view = render(
      <PrototypeProvider initialSnapshot={first}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    screen.getByRole("button", { name: "แก้ไข" }).click();
    expect(await screen.findByText("dirty")).toBeInTheDocument();
    view.rerender(
      <PrototypeProvider initialSnapshot={second}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    expect(screen.getByText("สูตรใหม่")).toBeInTheDocument();
    expect(screen.getByText("clean")).toBeInTheDocument();
  });

  test("deduplicates repository loading during StrictMode effect replay", async () => {
    const loadSnapshot = vi.fn(async () => makeSnapshot());
    const repository = makeRepository(loadSnapshot);

    render(
      <StrictMode>
        <PrototypeProvider repository={repository}>
          <SnapshotReader />
        </PrototypeProvider>
      </StrictMode>,
    );

    expect(await screen.findByText("สูตรทดสอบ")).toBeInTheDocument();
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["Error", "ข้อความที่โยน", () => {
      throw new Error("ข้อความที่โยน");
    }],
    ["Error", "สตริงที่โยน", () => {
      throw "สตริงที่โยน";
    }],
  ])(
    "surfaces a synchronous %s repository failure",
    async (_kind, message, loadSnapshot) => {
      const repository = makeRepository(loadSnapshot);

      render(
        <PrototypeProvider repository={repository}>
          <SnapshotReader />
        </PrototypeProvider>,
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        `Error: ${message}`,
      );
    },
  );

  test("keeps A loading on an A to B to A round trip until the new A generation resolves", async () => {
    const resolveA: Array<
      (snapshot: ReturnType<typeof makeSnapshot>) => void
    > = [];
    const resolveB: Array<
      (snapshot: ReturnType<typeof makeSnapshot>) => void
    > = [];
    const loadA = vi.fn(
      () =>
        new Promise<ReturnType<typeof makeSnapshot>>((resolve) => {
          resolveA.push(resolve);
        }),
    );
    const loadB = vi.fn(
      () =>
        new Promise<ReturnType<typeof makeSnapshot>>((resolve) => {
          resolveB.push(resolve);
        }),
    );
    const repositoryA = makeRepository(loadA);
    const repositoryB = makeRepository(loadB);
    const view = render(
      <StrictMode>
        <PrototypeProvider repository={repositoryA}>
          <SnapshotReader />
        </PrototypeProvider>
      </StrictMode>,
    );

    await act(async () => {
      await Promise.resolve();
      resolveA[0]?.(
        makeSnapshot({ recipes: [makeRecipe({ name: "สูตร A เก่า" })] }),
      );
      await Promise.resolve();
    });
    expect(screen.getByText("สูตร A เก่า")).toBeInTheDocument();

    view.rerender(
      <StrictMode>
        <PrototypeProvider repository={repositoryB}>
          <SnapshotReader />
        </PrototypeProvider>
      </StrictMode>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลด");
    await act(async () => {
      await Promise.resolve();
    });

    view.rerender(
      <StrictMode>
        <PrototypeProvider repository={repositoryA}>
          <SnapshotReader />
        </PrototypeProvider>
      </StrictMode>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลด");
    expect(screen.queryByText("สูตร A เก่า")).not.toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(loadA).toHaveBeenCalledTimes(2);
    expect(loadB).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveA[1]?.(
        makeSnapshot({ recipes: [makeRecipe({ name: "สูตร A ใหม่" })] }),
      );
      await Promise.resolve();
    });
    expect(screen.getByText("สูตร A ใหม่")).toBeInTheDocument();
    expect(screen.getByText("clean")).toBeInTheDocument();

    await act(async () => {
      resolveB[0]?.(
        makeSnapshot({ recipes: [makeRecipe({ name: "สูตร B ล่าช้า" })] }),
      );
      await Promise.resolve();
    });
    expect(screen.getByText("สูตร A ใหม่")).toBeInTheDocument();
    expect(screen.queryByText("สูตร B ล่าช้า")).not.toBeInTheDocument();
  });

  test("shows the new A generation error and ignores a late B rejection", async () => {
    const resolveA: Array<
      (snapshot: ReturnType<typeof makeSnapshot>) => void
    > = [];
    const rejectA: Array<(error: Error) => void> = [];
    const rejectB: Array<(error: Error) => void> = [];
    const loadA = vi.fn(
      () =>
        new Promise<ReturnType<typeof makeSnapshot>>((resolve, reject) => {
          resolveA.push(resolve);
          rejectA.push(reject);
        }),
    );
    const loadB = vi.fn(
      () =>
        new Promise<ReturnType<typeof makeSnapshot>>((_resolve, reject) => {
          rejectB.push(reject);
        }),
    );
    const repositoryA = makeRepository(loadA);
    const repositoryB = makeRepository(loadB);
    const view = render(
      <PrototypeProvider repository={repositoryA}>
        <SnapshotReader />
      </PrototypeProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      resolveA[0]?.(
        makeSnapshot({ recipes: [makeRecipe({ name: "สูตร A เก่า" })] }),
      );
      await Promise.resolve();
    });
    view.rerender(
      <PrototypeProvider repository={repositoryB}>
        <SnapshotReader />
      </PrototypeProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    view.rerender(
      <PrototypeProvider repository={repositoryA}>
        <SnapshotReader />
      </PrototypeProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("กำลังโหลด");
    expect(screen.queryByText("สูตร A เก่า")).not.toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
      rejectA[1]?.(new Error("A รุ่นใหม่โหลดไม่สำเร็จ"));
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Error: A รุ่นใหม่โหลดไม่สำเร็จ",
    );
    expect(screen.queryByText("สูตร A เก่า")).not.toBeInTheDocument();

    await act(async () => {
      rejectB[0]?.(new Error("B ล้มเหลวล่าช้า"));
      await Promise.resolve();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Error: A รุ่นใหม่โหลดไม่สำเร็จ",
    );
    expect(loadA).toHaveBeenCalledTimes(2);
    expect(loadB).toHaveBeenCalledTimes(1);
  });
});
