import Constants from "expo-constants";
import { setErrorReporter } from "./observability";

/**
 * Wire crash reporting on the client (RPT-1). `@sentry/react-native` is resolved
 * dynamically (variable specifier) so this is a no-op until both:
 *   1) `npx expo install @sentry/react-native`, and
 *   2) a DSN is set (app.json `expo.extra.sentryDsn` or EXPO_PUBLIC_SENTRY_DSN).
 */
const SENTRY_MODULE = "@sentry/react-native";

export async function initClientObservability(): Promise<void> {
  const dsn =
    (Constants.expoConfig?.extra as any)?.sentryDsn ?? process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry: any = await import(SENTRY_MODULE as string).catch(() => null);
    if (!Sentry?.init) return;
    Sentry.init({ dsn, tracesSampleRate: 0.1 });
    setErrorReporter((e, ctx) => Sentry.captureException(e, { extra: ctx }));
  } catch {
    /* observability is optional — never block app start */
  }
}
