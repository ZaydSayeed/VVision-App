import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { LoginScreen } from "../screens/LoginScreen";
import { CaregiverTabNavigator } from "./CaregiverTabNavigator";
import { PatientTabNavigator } from "./PatientTabNavigator";
import { colors, fonts, spacing } from "../config/theme";

export function RootNavigator() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return null;

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  const header = (
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
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (user.role === "caregiver") {
    return (
      <View style={styles.root}>
        {header}
        <CaregiverTabNavigator />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {header}
      <PatientTabNavigator patientName={user.name} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
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
});
