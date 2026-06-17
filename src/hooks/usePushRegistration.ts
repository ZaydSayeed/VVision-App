import { useEffect, useRef } from "react";
import { Platform, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authHeaders } from "../api/client";
import { API_BASE_URL } from "../config/api";
import { AppUser } from "../types";

/**
 * Registers this device's Expo push token with the backend once per login.
 * Caregivers register for livestream-invite pushes; patients register for
 * reminder pushes. Both paths are non-fatal — a denied permission or an
 * offline backend logs and returns, never blocking the app.
 *
 * Extracted verbatim from RootNavigator so the navigator stays focused on
 * routing; behavior (refs, dep arrays, endpoints) is unchanged.
 */
export function usePushRegistration(user: AppUser | null) {
  const pushRegisteredRef = useRef(false);
  const patientPushRegisteredRef = useRef(false);

  // Register Expo push token once when a caregiver logs in (for livestream invites)
  useEffect(() => {
    if (!user || user.role !== "caregiver" || pushRegisteredRef.current) return;
    pushRegisteredRef.current = true;

    (async () => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("livestream", {
            name: "Live View Requests",
            importance: Notifications.AndroidImportance.MAX,
          });
        }
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          const notifAlertKey = `@vela/notif_alert_shown:${user.id}`;
          const alreadyShown = await AsyncStorage.getItem(notifAlertKey);
          if (!alreadyShown) {
            await AsyncStorage.setItem(notifAlertKey, "1");
            Alert.alert(
              "Notifications off",
              "To get help alerts, go to Settings → Notifications → Vela Vision and turn on notifications.",
              [{ text: "OK" }]
            );
          }
          return;
        }
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        await fetch(`${API_BASE_URL}/api/stream/register-push-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ expoPushToken: tokenData.data }),
        });
      } catch (err) {
        console.error("Push token registration failed (non-fatal):", err);
      }
    })();
  }, [user]);

  // Register Expo push token for patient (for reminder notifications)
  useEffect(() => {
    if (!user || user.role !== "patient" || patientPushRegisteredRef.current) return;
    patientPushRegisteredRef.current = true;

    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        await fetch(`${API_BASE_URL}/api/notifications/register-patient-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ expoPushToken: tokenData.data }),
        });
      } catch (err) {
        console.error("Patient push token registration failed (non-fatal):", err);
      }
    })();
  }, [user]);
}
