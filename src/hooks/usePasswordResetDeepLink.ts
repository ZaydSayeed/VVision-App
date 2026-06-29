import { useEffect } from "react";
import { Alert } from "react-native";
import * as Linking from "expo-linking";

/**
 * Handles `…/reset-password#access_token=…&refresh_token=…&type=recovery`
 * deep links from the Supabase password-reset email.
 *
 * Supabase puts the recovery tokens in the URL *fragment* (after `#`), and the
 * client is configured with `detectSessionInUrl: false`, so we parse them here
 * and hand them to AuthContext.startRecovery, which establishes the session and
 * flips recoveryMode on. Mirrors useInviteDeepLink's cold-start + foreground
 * split.
 */
function parseRecoveryTokens(url: string): { accessToken: string; refreshToken: string } | null {
  if (!url.includes("reset-password")) return null;
  const hash = url.split("#")[1];
  if (!hash) return null;
  const params: Record<string, string> = {};
  for (const pair of hash.split("&")) {
    const [key, value] = pair.split("=");
    if (key) params[key] = decodeURIComponent(value ?? "");
  }
  if (params.type !== "recovery" || !params.access_token || !params.refresh_token) return null;
  return { accessToken: params.access_token, refreshToken: params.refresh_token };
}

export function usePasswordResetDeepLink(
  startRecovery: (accessToken: string, refreshToken: string) => Promise<void>
) {
  useEffect(() => {
    async function handle(url: string | null) {
      if (!url) return;
      const tokens = parseRecoveryTokens(url);
      if (!tokens) return;
      try {
        await startRecovery(tokens.accessToken, tokens.refreshToken);
      } catch {
        Alert.alert(
          "Link expired",
          "This password reset link has expired. Please request a new one from the sign-in screen."
        );
      }
    }

    // Cold start: app opened directly from the reset link.
    Linking.getInitialURL().then(handle);

    // Foreground: reset link tapped while the app is already running.
    const subscription = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => subscription.remove();
  }, [startRecovery]);
}
