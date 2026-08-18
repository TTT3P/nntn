import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CookbookRepository } from "../data/CookbookRepository";
import type { CookbookSnapshot } from "../domain/cookbook/types";
import {
  createPrototypeState,
  prototypeReducer,
  type PrototypeAction,
} from "./prototypeReducer";

export interface PrototypeContextValue {
  snapshot: CookbookSnapshot;
  dirty: boolean;
  persistence: "session";
  dispatch: (action: PrototypeAction) => PrototypeDispatchResult;
  createSessionObjectUrl: (file: Blob) => string;
  releaseSessionObjectUrl: (url: string) => void;
  isSessionObjectUrl: (url: string) => boolean;
}

export type PrototypeDispatchResult =
  | { ok: true }
  | { ok: false; error: Error };

// Shared for Task 6 test utilities that need the real prototype state boundary.
// eslint-disable-next-line react-refresh/only-export-components
export const PrototypeContext = createContext<PrototypeContextValue | null>(
  null,
);

type PrototypeProviderProps = {
  children: ReactNode;
  repository?: CookbookRepository;
  initialSnapshot?: CookbookSnapshot;
};

type LoadState =
  | {
      status: "loading";
      repository: CookbookRepository;
      generation: number;
    }
  | {
      status: "ready";
      repository: CookbookRepository;
      generation: number;
      snapshot: CookbookSnapshot;
    }
  | {
      status: "error";
      repository: CookbookRepository;
      generation: number;
      error: Error;
    };

interface RepositoryLoad {
  repository: CookbookRepository;
  generation: number;
  promise: Promise<CookbookSnapshot>;
}

function localSessionObjectUrls(snapshot: CookbookSnapshot): Set<string> {
  const urls = new Set<string>();
  if (typeof snapshot !== "object" || snapshot === null) return urls;
  const media = (snapshot as unknown as Record<string, unknown>).media;
  if (!Array.isArray(media)) return urls;
  for (const asset of media) {
    if (typeof asset !== "object" || asset === null) continue;
    const candidate = asset as Record<string, unknown>;
    if (
      candidate.localSessionOnly === true &&
      typeof candidate.url === "string" &&
      candidate.url.startsWith("blob:")
    ) {
      urls.add(candidate.url);
    }
  }
  return urls;
}

function revokeInactiveOwnedUrls(
  ownedUrls: Set<string>,
  activeUrls: Set<string>,
): void {
  for (const url of ownedUrls) {
    if (!activeUrls.has(url)) {
      URL.revokeObjectURL(url);
      ownedUrls.delete(url);
    }
  }
}

function normalizeError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}

function SessionStateProvider({
  children,
  snapshot,
}: {
  children: ReactNode;
  snapshot: CookbookSnapshot;
}) {
  const [state, setState] = useState(() => createPrototypeState(snapshot));
  const stateRef = useRef(state);
  const [actionError, setActionError] = useState<Error | null>(null);
  const sessionObjectUrls = useRef<Set<string>>(new Set());

  function dispatch(action: PrototypeAction): PrototypeDispatchResult {
    try {
      const nextState = prototypeReducer(stateRef.current, action);
      stateRef.current = nextState;
      setState(nextState);
      setActionError(null);
      return { ok: true };
    } catch (error) {
      const normalized = normalizeError(error);
      setActionError(normalized);
      return { ok: false, error: normalized };
    }
  }

  function createSessionObjectUrl(file: Blob): string {
    const url = URL.createObjectURL(file);
    sessionObjectUrls.current.add(url);
    return url;
  }

  function releaseSessionObjectUrl(url: string): void {
    if (sessionObjectUrls.current.delete(url)) {
      URL.revokeObjectURL(url);
    }
  }

  useEffect(() => {
    revokeInactiveOwnedUrls(
      sessionObjectUrls.current,
      localSessionObjectUrls(state.snapshot),
    );
  }, [state.snapshot]);

  useEffect(
    () => () => {
      for (const url of sessionObjectUrls.current) {
        URL.revokeObjectURL(url);
      }
      sessionObjectUrls.current.clear();
    },
    [],
  );

  return (
    <PrototypeContext.Provider
      value={{
        snapshot: state.snapshot,
        dirty: state.dirty,
        persistence: state.persistence,
        dispatch,
        createSessionObjectUrl,
        releaseSessionObjectUrl,
        isSessionObjectUrl: (url) => sessionObjectUrls.current.has(url),
      }}
    >
      {actionError !== null && (
        <p role="alert">
          การแก้ไข session ไม่สำเร็จ: {actionError.name}: {actionError.message}
        </p>
      )}
      {children}
    </PrototypeContext.Provider>
  );
}

function RepositoryLoader({
  children,
  repository,
}: {
  children: ReactNode;
  repository: CookbookRepository;
}) {
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
    repository,
    generation: 1,
  });
  const loadRef = useRef<RepositoryLoad | null>(null);

  if (loadState.repository !== repository) {
    setLoadState({
      status: "loading",
      repository,
      generation: loadState.generation + 1,
    });
  }

  useEffect(() => {
    let mounted = true;
    let load = loadRef.current;
    const generation = loadState.generation;

    if (
      load === null ||
      load.repository !== repository ||
      load.generation !== generation
    ) {
      load = {
        repository,
        generation,
        promise: Promise.resolve().then(() => repository.loadSnapshot()),
      };
      loadRef.current = load;
    }

    void load.promise.then(
      (snapshot) => {
        if (mounted) {
          setLoadState((current) =>
            current.repository === repository &&
            current.generation === generation
              ? {
                  status: "ready",
                  repository,
                  generation,
                  snapshot,
                }
              : current,
          );
        }
      },
      (error: unknown) => {
        if (mounted) {
          setLoadState((current) =>
            current.repository === repository &&
            current.generation === generation
              ? {
                  status: "error",
                  repository,
                  generation,
                  error: normalizeError(error),
                }
              : current,
          );
        }
      },
    );

    return () => {
      mounted = false;
    };
  }, [loadState.generation, repository]);

  if (loadState.repository !== repository || loadState.status === "loading") {
    return <p role="status">กำลังโหลดข้อมูลตำราอาหาร…</p>;
  }

  if (loadState.status === "error") {
    return (
      <p role="alert">
        โหลดข้อมูลต้นแบบไม่สำเร็จ: {loadState.error.name}: {loadState.error.message}
      </p>
    );
  }

  return (
    <SessionStateProvider
      key={`repository:${loadState.generation}`}
      snapshot={loadState.snapshot}
    >
      {children}
    </SessionStateProvider>
  );
}

function ExplicitSnapshotProvider({
  children,
  snapshot,
}: {
  children: ReactNode;
  snapshot: CookbookSnapshot;
}) {
  const [source, setSource] = useState({ snapshot, generation: 1 });

  if (source.snapshot !== snapshot) {
    setSource({ snapshot, generation: source.generation + 1 });
  }

  return (
    <SessionStateProvider
      key={`initial:${source.generation}`}
      snapshot={snapshot}
    >
      {children}
    </SessionStateProvider>
  );
}

export function PrototypeProvider({
  children,
  repository,
  initialSnapshot,
}: PrototypeProviderProps) {
  if (initialSnapshot !== undefined) {
    return (
      <ExplicitSnapshotProvider snapshot={initialSnapshot}>
        {children}
      </ExplicitSnapshotProvider>
    );
  }

  if (repository === undefined) {
    throw new Error(
      "PrototypeProvider requires a repository or an initial snapshot",
    );
  }

  return (
    <RepositoryLoader repository={repository}>{children}</RepositoryLoader>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrototype(): PrototypeContextValue {
  const context = useContext(PrototypeContext);
  if (context === null) {
    throw new Error("usePrototype must be used within PrototypeProvider");
  }
  return context;
}
