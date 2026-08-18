import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CookbookDocumentHttpError,
  type CookbookDocumentClient,
} from "../../data/CookbookDocumentClient";
import type { CookbookSnapshot, RecipeIdentity } from "../../domain/cookbook/types";
import { applyCookbookV6Edits, type CookbookV6Edit } from "../../domain/cookbookV6/editCookbookV6";
import { projectCookbookV6 } from "../../domain/cookbookV6/projectCookbookV6";
import type { CookbookV6Document } from "../../domain/cookbookV6/types";

export interface CookbookDocumentContextValue {
  document: CookbookV6Document;
  loadedDocument: CookbookV6Document;
  snapshot: CookbookSnapshot;
  recipeDraftById: ReadonlyMap<RecipeIdentity, boolean>;
  origin: "synthesized" | "v6-draft";
  dirty: boolean;
  saveState: "idle" | "saving" | "saved" | "stale" | "error";
  saveMessage: string | null;
  applyEdits(edits: readonly CookbookV6Edit[]): void;
  save(): Promise<void>;
}

type ReadyState = {
  status: "ready";
  client: CookbookDocumentClient;
  loadedDocument: CookbookV6Document;
  document: CookbookV6Document;
  baseSha256: string;
  origin: "synthesized" | "v6-draft";
  dirty: boolean;
  saveState: CookbookDocumentContextValue["saveState"];
  saveMessage: string | null;
};

type State =
  | { status: "loading"; client: CookbookDocumentClient }
  | { status: "error"; client: CookbookDocumentClient; error: Error }
  | ReadyState;

const Context = createContext<CookbookDocumentContextValue | null>(null);

function normalizeError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function CookbookDocumentProvider({
  children,
  client,
  mediaSnapshot,
}: {
  children: ReactNode;
  client: CookbookDocumentClient;
  mediaSnapshot: CookbookSnapshot;
}) {
  const [state, setState] = useState<State>({ status: "loading", client });
  const stateRef = useRef(state);
  const generationRef = useRef(0);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const generation = ++generationRef.current;
    savingRef.current = false;
    void client.load().then((loaded) => {
      if (!active || generation !== generationRef.current) return;
      const ready: ReadyState = {
        status: "ready",
        client,
        loadedDocument: structuredClone(loaded.document),
        document: structuredClone(loaded.document),
        baseSha256: loaded.baseSha256,
        origin: loaded.origin,
        dirty: false,
        saveState: "idle",
        saveMessage: null,
      };
      stateRef.current = ready;
      setState(ready);
    }).catch((caught: unknown) => {
      if (!active || generation !== generationRef.current) return;
      const failed: State = { status: "error", client, error: normalizeError(caught) };
      stateRef.current = failed;
      setState(failed);
    });
    return () => {
      active = false;
      if (generationRef.current === generation) generationRef.current += 1;
      savingRef.current = false;
    };
  }, [client]);

  if (state.client !== client || state.status === "loading") return <p role="status">กำลังโหลดสูตรอาหาร…</p>;
  if (state.status === "error") return <p role="alert">เปิดข้อมูลสูตรอาหารไม่ได้ กรุณาลองใหม่อีกครั้ง</p>;

  function applyEdits(edits: readonly CookbookV6Edit[]): void {
    const current = stateRef.current;
    if (current.status !== "ready" || current.client !== client || savingRef.current) return;
    try {
      const next: ReadyState = {
        ...current,
        document: applyCookbookV6Edits(current.document, edits),
        dirty: true,
        saveState: current.saveState === "stale" ? "stale" : "idle",
        saveMessage: current.saveState === "stale" ? current.saveMessage : null,
      };
      stateRef.current = next;
      setState(next);
    } catch {
      const next: ReadyState = { ...current, saveState: "error", saveMessage: "แก้ไขสูตรไม่สำเร็จ" };
      stateRef.current = next;
      setState(next);
    }
  }

  async function save(): Promise<void> {
    const current = stateRef.current;
    if (current.status !== "ready" || current.client !== client || savingRef.current || current.saveState === "stale") return;
    if (!current.dirty) {
      const next: ReadyState = { ...current, saveState: "error", saveMessage: "ยังไม่มีรายการที่แก้ไข" };
      stateRef.current = next;
      setState(next);
      return;
    }
    savingRef.current = true;
    const generation = generationRef.current;
    const submitted = structuredClone(current.document);
    submitted.generatedAt = new Date().toISOString();
    const saving: ReadyState = { ...current, saveState: "saving", saveMessage: "กำลังบันทึก…" };
    stateRef.current = saving;
    setState(saving);
    try {
      const receipt = await client.save(submitted, current.baseSha256);
      if (generation !== generationRef.current || stateRef.current.client !== client) return;
      const persisted = structuredClone(receipt.document);
      const saved: ReadyState = {
        ...current,
        loadedDocument: structuredClone(persisted),
        document: persisted,
        baseSha256: receipt.base_sha256,
        origin: "v6-draft",
        dirty: false,
        saveState: "saved",
        saveMessage: "บันทึกสูตรแล้ว",
      };
      stateRef.current = saved;
      setState(saved);
    } catch (caught: unknown) {
      if (generation !== generationRef.current || stateRef.current.client !== client) return;
      const stale = caught instanceof CookbookDocumentHttpError && caught.code === "STALE_DRAFT";
      const failed: ReadyState = {
        ...current,
        saveState: stale ? "stale" : "error",
        saveMessage: stale
          ? "มีการบันทึกจากหน้าต่างอื่น กรุณาคัดลอกข้อมูลที่แก้ไว้แล้วโหลดหน้าใหม่"
          : "บันทึกสูตรไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      };
      stateRef.current = failed;
      setState(failed);
    } finally {
      if (generation === generationRef.current) savingRef.current = false;
    }
  }

  const projection = projectCookbookV6(state.document, mediaSnapshot);
  const value: CookbookDocumentContextValue = {
    document: state.document,
    loadedDocument: state.loadedDocument,
    snapshot: projection.snapshot,
    recipeDraftById: projection.recipeDraftById,
    origin: state.origin,
    dirty: state.dirty,
    saveState: state.saveState,
    saveMessage: state.saveMessage,
    applyEdits,
    save,
  };
  return (
    <Context.Provider value={value}>
      {(state.saveState === "error" || state.saveState === "stale") && state.saveMessage !== null && (
        <p role="alert">{state.saveMessage}</p>
      )}
      {state.saveState === "saved" && state.saveMessage !== null && <p role="status">{state.saveMessage}</p>}
      {children}
    </Context.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCookbookDocument(): CookbookDocumentContextValue {
  const context = useContext(Context);
  if (context === null) throw new Error("useCookbookDocument must be used within CookbookDocumentProvider");
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalCookbookDocument(): CookbookDocumentContextValue | null {
  return useContext(Context);
}
