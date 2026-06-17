import { useEffect } from "react";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { navigationRef } from "../navigation/navigationRef";
import { AppUser } from "../types";

const INVITE_PATH = /\/invite\/([a-f0-9]+)/;

/**
 * Handles `…/invite/<token>` deep links into the seat-invite flow.
 *
 * Three paths, extracted verbatim from RootNavigator:
 *  - Cold start: stash the token in AsyncStorage (user may still be loading).
 *  - Foreground: navigate straight to AcceptInvite if signed in, else stash.
 *  - After login: when AuthContext surfaces a pendingInviteToken, navigate.
 *
 * `onboardingDone` is a dependency of the post-login effect so it re-fires
 * once the navigator stack has mounted.
 */
export function useInviteDeepLink(
  user: AppUser | null,
  pendingInviteToken: string | null,
  clearPendingInviteToken: () => void,
  onboardingDone: boolean | null
) {
  // Cold start: check if app was opened via an invite link.
  // Runs once — user may still be loading, so always save to AsyncStorage.
  // Authenticated users are navigated by the pendingInviteToken effect once the stack mounts;
  // unauthenticated users get the token picked up after login.
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      const match = url.match(INVITE_PATH);
      if (!match) return;
      AsyncStorage.setItem("@vela/pending_invite", match[1]);
    });
  }, []);

  // Foreground: handle invite URL when app is already running.
  useEffect(() => {
    function handleForegroundUrl({ url }: { url: string }) {
      const match = url.match(INVITE_PATH);
      if (!match) return;
      const token = match[1];
      if (user && navigationRef.isReady()) {
        (navigationRef.navigate as Function)("AcceptInvite", { token });
      } else {
        AsyncStorage.setItem("@vela/pending_invite", token);
      }
    }
    const subscription = Linking.addEventListener("url", handleForegroundUrl);
    return () => subscription.remove();
  }, [user]);

  // After login: navigate to AcceptInvite when pendingInviteToken is set.
  // onboardingDone is a dep so this re-runs once the navigator stack is mounted.
  useEffect(() => {
    if (!pendingInviteToken || !navigationRef.isReady()) return;
    (navigationRef.navigate as Function)("AcceptInvite", { token: pendingInviteToken });
    clearPendingInviteToken();
  }, [pendingInviteToken, clearPendingInviteToken, onboardingDone]);
}
