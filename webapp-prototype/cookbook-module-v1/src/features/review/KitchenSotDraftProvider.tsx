import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  KitchenSotHttpError,
  type KitchenSotDraftClient,
} from "../../data/KitchenSotDraftClient";
import {
  cloneKitchenSotDocument,
  deriveFillSummary,
  type FillSummary,
  type KitchenSotDocument,
} from "../../domain/sot/kitchenSotDocument";
import {
  applyKitchenSotEdit,
  buildV5Draft,
  type DerivedFrom,
  type KitchenSotEdit,
} from "../../domain/sot/kitchenSotEdits";

export type KitchenSotFillSummary = FillSummary;

export interface KitchenSotDraftContextValue {
  document: KitchenSotDocument;
  summary: KitchenSotFillSummary;
  origin: "v4" | "v5-draft";
  dirty: boolean;
  saveState: "idle" | "saving" | "saved" | "stale" | "error";
  saveMessage: string | null;
  applyEdit(edit: KitchenSotEdit): void;
  save(): Promise<void>;
}

type DraftProviderProps = {
  children: ReactNode;
  client: KitchenSotDraftClient;
};

type DraftState =
  | { status: "loading"; client: KitchenSotDraftClient }
  | { status: "error"; client: KitchenSotDraftClient; error: Error }
  | ReadyDraftState;

type ReadyDraftState = {
  status: "ready";
  client: KitchenSotDraftClient;
  baseline: KitchenSotDocument;
  document: KitchenSotDocument;
  origin: "v4" | "v5-draft";
  lineage: DerivedFrom;
  baseSha256: string;
  dirty: boolean;
  saveState: KitchenSotDraftContextValue["saveState"];
  saveMessage: string | null;
};

const KitchenSotDraftContext = createContext<KitchenSotDraftContextValue | null>(null);

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function errorLabel(error: Error): string {
  if (error instanceof KitchenSotHttpError) return error.code;
  return error.name;
}

function savedMessage(path: string, sha256: string, generatedAt: string): string {
  return `บันทึกแล้ว: ${path} · SHA-256 ${sha256} · ${generatedAt}`;
}

export function KitchenSotDraftProvider({ children, client }: DraftProviderProps) {
  const [state, setState] = useState<DraftState>({ status: "loading", client });
  const stateRef = useRef(state);
  const generationRef = useRef(0);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    const generation = ++generationRef.current;
    saveInFlightRef.current = false;

    void Promise.resolve()
      .then(() => client.load())
      .then((loaded) => {
        if (!active || generationRef.current !== generation) return;
        const document = cloneKitchenSotDocument(loaded.document);
        const ready: ReadyDraftState = {
          status: "ready",
          client,
          baseline: cloneKitchenSotDocument(document),
          document,
          origin: loaded.origin,
          lineage: {
            path: loaded.sourcePath as DerivedFrom["path"],
            sha256: loaded.sourceSha256,
          },
          baseSha256: loaded.baseSha256,
          dirty: false,
          saveState: "idle",
          saveMessage: null,
        };
        stateRef.current = ready;
        setState(ready);
      })
      .catch((caught: unknown) => {
        if (!active || generationRef.current !== generation) return;
        const failed: DraftState = {
          status: "error",
          client,
          error: normalizeError(caught),
        };
        stateRef.current = failed;
        setState(failed);
      });

    return () => {
      active = false;
      if (generationRef.current === generation) generationRef.current += 1;
      saveInFlightRef.current = false;
    };
  }, [client]);

  if (state.client !== client || state.status === "loading") {
    return <p role="status">กำลังโหลดร่าง Kitchen SOT…</p>;
  }

  if (state.status === "error") {
    return (
      <p role="alert">
        โหลดร่าง Kitchen SOT ไม่สำเร็จ: {errorLabel(state.error)}
      </p>
    );
  }

  function applyEdit(edit: KitchenSotEdit): void {
    const current = stateRef.current;
    if (current.status !== "ready" || current.client !== client) return;
    try {
      const edited = applyKitchenSotEdit(current.document, edit);
      const next: ReadyDraftState = {
        ...current,
        document: edited,
        dirty: true,
        saveState: current.saveState === "stale" ? "stale" : "idle",
        saveMessage: current.saveState === "stale"
          ? current.saveMessage
          : null,
      };
      stateRef.current = next;
      setState(next);
    } catch (caught: unknown) {
      const error = normalizeError(caught);
      const next: ReadyDraftState = {
        ...current,
        saveState: "error",
        saveMessage: `แก้ไขไม่สำเร็จ: ${errorLabel(error)}`,
      };
      stateRef.current = next;
      setState(next);
    }
  }

  async function save(): Promise<void> {
    const current = stateRef.current;
    if (
      current.status !== "ready" ||
      current.client !== client ||
      saveInFlightRef.current
    ) {
      return;
    }
    if (current.saveState === "stale") return;
    if (!current.dirty) {
      const clean: ReadyDraftState = {
        ...current,
        saveState: "error",
        saveMessage: "ไม่มีการแก้ไขที่ต้องบันทึก",
      };
      stateRef.current = clean;
      setState(clean);
      return;
    }

    saveInFlightRef.current = true;
    const generation = generationRef.current;
    const saving: ReadyDraftState = {
      ...current,
      saveState: "saving",
      saveMessage: "กำลังบันทึกร่าง…",
    };
    stateRef.current = saving;
    setState(saving);

    try {
      const submitted = buildV5Draft(
        current.document,
        new Date().toISOString(),
        current.lineage,
      );
      const receipt = await client.save(submitted, current.baseSha256);
      if (generationRef.current !== generation || stateRef.current.client !== client) return;
      const persisted = cloneKitchenSotDocument(receipt.document);
      const saved: ReadyDraftState = {
        ...current,
        baseline: cloneKitchenSotDocument(persisted),
        document: persisted,
        origin: "v5-draft",
        baseSha256: receipt.base_sha256,
        dirty: false,
        saveState: "saved",
        saveMessage: savedMessage(receipt.path, receipt.sha256, receipt.generatedAt),
      };
      stateRef.current = saved;
      setState(saved);
    } catch (caught: unknown) {
      if (generationRef.current !== generation || stateRef.current.client !== client) return;
      const error = normalizeError(caught);
      const stale = error instanceof KitchenSotHttpError && error.code === "STALE_DRAFT";
      const failed: ReadyDraftState = {
        ...current,
        saveState: stale ? "stale" : "error",
        saveMessage: stale
          ? "ร่างบนดิสก์เปลี่ยนแล้ว ต้องโหลดหน้าใหม่ก่อนบันทึกอีกครั้ง"
          : `บันทึกไม่สำเร็จ: ${errorLabel(error)}`,
      };
      stateRef.current = failed;
      setState(failed);
    } finally {
      if (generationRef.current === generation) saveInFlightRef.current = false;
    }
  }

  const value: KitchenSotDraftContextValue = {
    document: state.document,
    summary: deriveFillSummary(state.document),
    origin: state.origin,
    dirty: state.dirty,
    saveState: state.saveState,
    saveMessage: state.saveMessage,
    applyEdit,
    save,
  };

  return (
    <KitchenSotDraftContext.Provider value={value}>
      {state.saveState === "error" && state.saveMessage !== null && (
        <p role="alert">{state.saveMessage}</p>
      )}
      {state.saveState === "stale" && state.saveMessage !== null && (
        <p role="alert">{state.saveMessage}</p>
      )}
      {children}
    </KitchenSotDraftContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useKitchenSotDraft(): KitchenSotDraftContextValue {
  const value = useContext(KitchenSotDraftContext);
  if (value === null) {
    throw new Error("useKitchenSotDraft must be used within KitchenSotDraftProvider");
  }
  return value;
}
