import React, { useMemo, useEffect, useRef } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNetwork } from "../context/NetworkContext";
import { setOnNetworkChange, authHeaders } from "../api/client";
import { API_BASE_URL } from "../config/api";
import { LoginScreen } from "../screens/LoginScreen";
import { CaregiverTabNavigator } from "./CaregiverTabNavigator";
import { PatientTabNavigator } from "./PatientTabNavigator";
import { OfflineBanner } from "../components/OfflineBanner";
import { fonts, spacing } from "../config/theme";

export function RootNavigator() {
  const { user, loading, logout } = useAuth();
  const { colors } = useTheme();
  const { setOffline } = useNetwork();
  const pushRegisteredRef = useRef(false);

  // Bridge API client network status to React context
  useEffect(() => {
    setOnNetworkChange(setOffline);
  }, [setOffline]);

  // Register Expo push token once when a caregiver logs in
  useEffect(() => {
    if (!user || user.role !== "caregiver" || pushRegisteredRef.current) return;
    pushRegisteredRef.current = true;

    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const expoPushToken = tokenData.data;

        await fetch(`${API_BASE_URL}/api/stream/register-push-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ expoPushToken }),
        });
      } catch (err) {
        console.error("Push token registration failed (non-fatal):", err);
      }
    })();
  }, [user]);

  const styles = useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
  }), [colors]);

  if (loading) return null;

  if (!user) {
    return <LoginScreen />;
  }

  if (user.role === "caregiver") {
    return (
      <View style={styles.root}>
        <Header onLogout={logout} />
        <OfflineBanner />
        <CaregiverTabNavigator />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header onLogout={logout} />
      <OfflineBanner />
      <PatientTabNavigator patientName={user.name} />
    </View>
  );
}

function Header({ onLogout }: { onLogout: () => void }) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    header: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingTop: 54,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    headerInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    logo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    logoIcon: {
      width: 32,
      height: 32,
    },
    logoWordmark: {
      borderLeftWidth: 0.4,
      borderLeftColor: colors.lavender,
      paddingLeft: 10,
      marginLeft: 2,
    },
    logoText: {
      fontSize: 20,
      color: colors.text,
      ...fonts.display,
      letterSpacing: 0.2,
    },
    logoutBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logoutText: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.medium,
    },
  }), [colors]);

  return (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        <View style={styles.logo}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <View style={styles.logoWordmark}>
            <Text style={styles.logoText}>Vela Vision</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
