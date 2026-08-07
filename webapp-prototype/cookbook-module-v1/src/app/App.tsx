import { useEffect, useRef, useState } from "react";
import { brandConfig } from "../config/brand";
import type { CookbookRepository } from "../data/CookbookRepository";
import { FixtureCookbookRepository } from "../data/FixtureCookbookRepository";
import { PrototypeProvider, usePrototype } from "../prototype/PrototypeProvider";
import { exportPrototypeSnapshot } from "../prototype/snapshotExport";
import { AppRouter } from "./router";
import "./styles.css";

const fixtureRepository = new FixtureCookbookRepository();
const DOWNLOAD_URL_GRACE_MS = 1_000;

function hasUnsafeDiagnosticControl(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    ) {
      return true;
    }
  }
  return false;
}

function errorMessage(error: unknown): string {
  let isError: boolean;
  try {
    isError = error instanceof Error;
  } catch {
    return "Unknown error";
  }
  if (!isError) return "Unknown error";
  try {
    const candidate = error as Error;
    const name = candidate.name;
    const message = candidate.message;
    if (
      typeof name !== "string" ||
      !/^[A-Za-z][A-Za-z0-9]*$/u.test(name) ||
      typeof message !== "string" ||
      hasUnsafeDiagnosticControl(message)
    ) {
      return "Unknown error";
    }
    return `${name}: ${message.slice(0, 240)}`;
  } catch {
    return "Unknown error";
  }
}

function ExportPrototypeSnapshot() {
  const { snapshot } = usePrototype();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function reportReleaseError(caught: unknown): void {
    if (mounted.current) {
      setStatus(null);
      setError(`ส่งออก snapshot ไม่สำเร็จ · Export failed: ${errorMessage(caught)}`);
    }
  }

  function retryReleaseOnce(downloadUrl: string): void {
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(downloadUrl);
      } catch {
        // The browser refused both bounded cleanup attempts; no broader owner exists.
      }
    }, DOWNLOAD_URL_GRACE_MS);
  }

  function releaseDownloadUrl(downloadUrl: string, reportFailure: boolean): void {
    try {
      URL.revokeObjectURL(downloadUrl);
    } catch (caught) {
      if (reportFailure) reportReleaseError(caught);
      retryReleaseOnce(downloadUrl);
    }
  }

  function releaseAfterBrowserConsumption(downloadUrl: string): void {
    window.setTimeout(
      () => releaseDownloadUrl(downloadUrl, true),
      DOWNLOAD_URL_GRACE_MS,
    );
  }

  function downloadSnapshot(): void {
    setStatus(null);
    setError(null);
    let anchor: HTMLAnchorElement | null = null;
    let downloadUrl: string | null = null;
    let clickCompleted = false;
    let operationError: unknown = null;

    try {
      const exported = exportPrototypeSnapshot(snapshot);
      const contents = JSON.stringify(exported, null, 2);
      const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
      downloadUrl = URL.createObjectURL(blob);
      anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = "cookbook-prototype-snapshot.json";
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      clickCompleted = true;
    } catch (caught) {
      operationError = caught;
    } finally {
      if (anchor !== null) {
        try {
          anchor.remove();
        } catch (caught) {
          operationError ??= caught;
        }
      }
      if (downloadUrl !== null) {
        if (clickCompleted) releaseAfterBrowserConsumption(downloadUrl);
        else releaseDownloadUrl(downloadUrl, false);
      }
    }

    if (operationError === null) {
      setStatus("ดาวน์โหลด snapshot แล้ว · Prototype snapshot downloaded");
    } else {
      setError(`ส่งออก snapshot ไม่สำเร็จ · Export failed: ${errorMessage(operationError)}`);
    }
  }

  return (
    <section className="prototype-snapshot-export" aria-label="Prototype snapshot export">
      <button type="button" onClick={downloadSnapshot}>
        Export prototype snapshot
      </button>
      <p>
        ไฟล์รูปที่เพิ่มใน session จะไม่รวมอยู่ใน JSON · Session file binaries are not included.
        การส่งออกนี้ไม่ใช่การบันทึกถาวรหรือการอนุมัติข้อมูล
      </p>
      {status !== null && <p role="status">{status}</p>}
      {error !== null && <p role="alert">{error}</p>}
    </section>
  );
}

export function App({
  repository = fixtureRepository,
}: {
  repository?: CookbookRepository;
}) {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-organization">{brandConfig.organizationName}</p>
        <h1>{brandConfig.productName}</h1>
        <p className="app-prototype-label">{brandConfig.prototypeLabel}</p>
        <p className="app-session-notice">
          การแก้ไขอยู่เฉพาะเซสชันนี้และจะรีเซ็ตเมื่อโหลดหน้าใหม่
        </p>
      </header>
      <PrototypeProvider repository={repository}>
        <ExportPrototypeSnapshot />
        <AppRouter />
      </PrototypeProvider>
    </main>
  );
}
