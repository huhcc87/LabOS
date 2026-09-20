/**
 * Built-in error tracking — sends frontend errors to the LabOS backend.
 * Zero cost, no external service. Errors are logged server-side.
 */
interface ErrorReport {
  message: string;
  stack?: string;
  component?: string;
  url?: string;
  user_agent?: string;
  extra?: Record<string, unknown>;
}

// Debounce: don't flood the backend with duplicate errors
const _reported = new Set<string>();
const MAX_CACHE = 100;

function dedupKey(msg: string, stack?: string): string {
  return `${msg}::${(stack ?? "").slice(0, 100)}`;
}

/**
 * Report an error to the backend. Safe to call anywhere — never throws.
 */
export function reportError(
  error: unknown,
  context?: { component?: string; extra?: Record<string, unknown> }
) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const key = dedupKey(err.message, err.stack);

    // Skip if already reported this session
    if (_reported.has(key)) return;
    if (_reported.size >= MAX_CACHE) _reported.clear();
    _reported.add(key);

    const report: ErrorReport = {
      message: err.message,
      stack: err.stack?.slice(0, 4000), // Cap stack size
      url: window.location.href,
      user_agent: navigator.userAgent,
      component: context?.component,
      extra: context?.extra,
    };

    // Fire-and-forget via plain fetch — no app imports to avoid hook contamination
    const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
    fetch(`${base}/errors/client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    }).catch(() => {
      // Silently fail — if the backend is down, we can't report errors anyway
    });
  } catch {
    // Never let error tracking itself crash the app
  }
}

/**
 * Install global handlers for uncaught errors and unhandled promise rejections.
 * Call once at app startup.
 */
export function initErrorTracking() {
  if (import.meta.env.DEV) return; // Only track in production

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message, { component: "window.onerror" });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, { component: "unhandledrejection" });
  });
}
