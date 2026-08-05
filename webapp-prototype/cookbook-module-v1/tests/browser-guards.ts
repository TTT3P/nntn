import {
  test as base,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from "@playwright/test";

const DEFAULT_STABLE_IDLE_MS = 250;
const DEFAULT_DRAIN_TIMEOUT_MS = 3_000;
const FORBIDDEN_SERVICE_PATTERN =
  /supabase|googleapis|analytics|segment|sentry|cloudfront|cloudflare|(?:^|[./-])cdn(?:[./-]|$)/iu;

type BrowserProblem = {
  kind: string;
  detail: string;
};

export type GuardDrainOptions = {
  stableIdleMs?: number;
  timeoutMs?: number;
};

export interface StrictPageGuard {
  drain(options?: GuardDrainOptions): Promise<void>;
  assertClean(): Promise<void>;
  detach(): void;
}

function describeProblems(problems: BrowserProblem[]): string {
  return problems.map(({ kind, detail }) => `${kind}: ${detail}`).join("\n");
}

export function isAllowedLoopbackHttpUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;

  let hostname = url.hostname.toLowerCase();
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  if (hostname.endsWith(".")) return false;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

function isHttpRequest(request: Request): boolean {
  const protocol = new URL(request.url()).protocol;
  return protocol === "http:" || protocol === "https:";
}

export function installStrictPageGuard(page: Page): StrictPageGuard {
  const problems: BrowserProblem[] = [];
  const inflight = new Set<Request>();
  const activityWaiters = new Set<() => void>();
  let activityVersion = 0;
  let detached = false;

  function noteActivity(): void {
    activityVersion += 1;
    const waiters = [...activityWaiters];
    activityWaiters.clear();
    for (const resolve of waiters) resolve();
  }

  function addProblem(kind: string, detail: string): void {
    problems.push({ kind, detail });
  }

  const onRequest = (request: Request): void => {
    inflight.add(request);
    noteActivity();
    if (!isHttpRequest(request)) return;
    if (!isAllowedLoopbackHttpUrl(request.url())) {
      addProblem("external request", request.url());
    }
    if (FORBIDDEN_SERVICE_PATTERN.test(request.url())) {
      addProblem("forbidden service request", request.url());
    }
    const method = request.method().toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      addProblem("disallowed method", `${method} ${request.url()}`);
    }
    const body = request.postData();
    if (body !== null && body.length > 0) {
      addProblem("request body", `${method} ${request.url()} (${String(body.length)} bytes)`);
    }
  };
  const onRequestFinished = (request: Request): void => {
    inflight.delete(request);
    noteActivity();
  };
  const onRequestFailed = (request: Request): void => {
    inflight.delete(request);
    addProblem(
      "failed request",
      `${request.url()} (${request.failure()?.errorText ?? "unknown failure"})`,
    );
    noteActivity();
  };
  const onResponse = (response: Response): void => {
    if (response.status() >= 400) {
      addProblem(`HTTP ${String(response.status())}`, response.url());
    }
    noteActivity();
  };
  const onPageError = (error: Error): void => {
    addProblem("page error", error.message);
    noteActivity();
  };
  const onConsole = (message: ConsoleMessage): void => {
    if (message.type() === "error" || message.type() === "warning") {
      addProblem(`console ${message.type()}`, message.text());
    }
    noteActivity();
  };

  page.on("request", onRequest);
  page.on("requestfinished", onRequestFinished);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  function waitForActivityOrTimeout(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const complete = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        activityWaiters.delete(complete);
        resolve();
      };
      const timer = setTimeout(complete, timeoutMs);
      activityWaiters.add(complete);
    });
  }

  async function drain(options: GuardDrainOptions = {}): Promise<void> {
    const stableIdleMs = options.stableIdleMs ?? DEFAULT_STABLE_IDLE_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS;
    if (!Number.isFinite(stableIdleMs) || stableIdleMs < 0) {
      throw new Error("Guard stableIdleMs must be a non-negative finite number");
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error("Guard timeoutMs must be a positive finite number");
    }

    const deadline = Date.now() + timeoutMs;
    let stableVersion = -1;
    let stableSince = 0;
    while (true) {
      const now = Date.now();
      if (now >= deadline) {
        throw new Error(`Browser guard drain timed out with ${String(inflight.size)} request(s) in flight`);
      }
      if (inflight.size > 0) {
        stableVersion = -1;
        await waitForActivityOrTimeout(deadline - now);
        continue;
      }
      if (stableVersion !== activityVersion) {
        stableVersion = activityVersion;
        stableSince = now;
      }
      const stableRemaining = stableIdleMs - (now - stableSince);
      if (stableRemaining <= 0) return;
      await waitForActivityOrTimeout(Math.min(stableRemaining, deadline - now));
    }
  }

  async function assertClean(): Promise<void> {
    const brokenImages = await page.locator("img").evaluateAll((images) =>
      images
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.getAttribute("src") || "<missing src>"),
    );
    for (const image of brokenImages) addProblem("broken image", image);
    if (problems.length > 0) throw new Error(describeProblems(problems));
  }

  function detach(): void {
    if (detached) return;
    detached = true;
    page.off("request", onRequest);
    page.off("requestfinished", onRequestFinished);
    page.off("requestfailed", onRequestFailed);
    page.off("response", onResponse);
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
    const waiters = [...activityWaiters];
    activityWaiters.clear();
    for (const resolve of waiters) resolve();
  }

  return { drain, assertClean, detach };
}

export const test = base.extend<{ strictBrowserBoundary: StrictPageGuard }>({
  strictBrowserBoundary: [
    async ({ page }, runTest) => {
      const guard = installStrictPageGuard(page);
      const failures: unknown[] = [];
      try {
        await runTest(guard);
      } catch (error) {
        failures.push(error);
      }
      try {
        await guard.drain();
        await guard.assertClean();
      } catch (error) {
        failures.push(error);
      } finally {
        guard.detach();
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) throw new AggregateError(failures, "Test and browser boundary both failed");
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
