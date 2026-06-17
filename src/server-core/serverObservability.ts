/**
 * Server-side crash reporting (RPT-1). `@sentry/node` is resolved dynamically so
 * this is a no-op until `npm i @sentry/node` and a SENTRY_DSN env var are set.
 */
const SENTRY_MODULE = "@sentry/node";
let sentry: any = null;

export async function initServerObservability(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const S: any = await import(SENTRY_MODULE as string).catch(() => null);
    if (!S?.init) return;
    S.init({ dsn, tracesSampleRate: 0.1 });
    sentry = S;
    console.log("[observability] Sentry (server) initialized");
  } catch {
    /* optional */
  }
}

export function captureServerError(error: unknown, context?: Record<string, unknown>): void {
  if (sentry?.captureException) {
    try {
      sentry.captureException(error, context ? { extra: context } : undefined);
    } catch {
      /* reporter must never break the server */
    }
  }
}
