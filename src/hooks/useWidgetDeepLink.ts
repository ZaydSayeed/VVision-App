import { useEffect } from "react";
import * as Linking from "expo-linking";
import { navigationRef } from "../navigation/navigationRef";
import { AppUser } from "../types";

// Matches the widget's .widgetURL format exactly:
// targets/EvaluVisionWidget/EvaluVisionWidget.swift builds
// "vela://calendar/<patientId>". Keep this in sync with that file — it is
// frozen/approved from Task 3, so this hook adapts to it, not the other way
// around.
const WIDGET_CALENDAR_PATH = /\/calendar\/([^/?#]+)/;

/**
 * Handles the home-screen widget's `vela://calendar/<patientId>` deep link,
 * routing straight to that patient's Calendar screen. Mirrors
 * useInviteDeepLink's cold-start + foreground split.
 */
export function useWidgetDeepLink(user: AppUser | null) {
  useEffect(() => {
    function navigateToCalendar(url: string, attempt = 0) {
      const match = url.match(WIDGET_CALENDAR_PATH);
      if (!match) return;
      const patientId = decodeURIComponent(match[1]);

      // Cold start: the navigator may not have mounted yet when this fires.
      // Retry briefly rather than silently dropping the link.
      if (!navigationRef.isReady()) {
        if (attempt < 10) setTimeout(() => navigateToCalendar(url, attempt + 1), 300);
        return;
      }
      (navigationRef.navigate as Function)("Calendar", { patientId });
    }

    // Cold start: app opened directly by tapping the widget.
    Linking.getInitialURL().then((url) => {
      if (url) navigateToCalendar(url);
    });

    // Foreground: widget tapped while the app is already running.
    const subscription = Linking.addEventListener("url", ({ url }) => navigateToCalendar(url));
    return () => subscription.remove();
  }, [user]);
}
