type ErrorContext = Record<string, unknown>;

let reporter: ((error: unknown, context?: ErrorContext) => void) | null = null;

/**
 * Register a crash reporter once at app start (RPT-1). The app currently ships
 * with NO crash reporting, so production failures are invisible. Wire one here:
 *
 *   import * as Sentry from "@sentry/react-native";
 *   Sentry.init({ dsn: ... });
 *   setErrorReporter((e, ctx) => Sentry.captureException(e, { extra: ctx }));
 *
 * (Add the server equivalent with @sentry/node in src/server.ts.)
 */
export function setErrorReporter(fn: (error: unknown, context?: ErrorContext) => void): void {
  reporter = fn;
}

/** Single funnel for caught/boundary errors. Never throws. */
export function captureError(error: unknown, context?: ErrorContext): void {
  if (reporter) {
    try {
      reporter(error, context);
    } catch {
      /* the reporter must never break the app */
    }
    return;
  }
  // No reporter wired yet — fall back to console (stripped from prod client builds
  // once babel-plugin-transform-remove-console is added).
  console.error("[observability]", error, context ?? "");
}
