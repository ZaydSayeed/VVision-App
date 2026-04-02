import React, { useMemo, useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNetwork } from "../context/NetworkContext";
import { setOnNetworkChange } from "../api/client";
import { LoginScreen } from "../screens/LoginScreen";
import { CaregiverTabNavigator } from "./CaregiverTabNavigator";
import { PatientTabNavigator } from "./PatientTabNavigator";
import { OfflineBanner } from "../components/OfflineBanner";
import { SideDrawer } from "../components/SideDrawer";
import { fonts, spacing, gradients } from "../config/theme";

export function RootNavigator() {
  const { user, loading, logout } = useAuth();
  const { colors } = useTheme();
  const { setOffline } = useNetwork();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setOnNetworkChange(setOffline);
  }, [setOffline]);

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
        <Header onOpenDrawer={() => setDrawerOpen(true)} />
        <OfflineBanner />
        <CaregiverTabNavigator />
        <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header onOpenDrawer={() => setDrawerOpen(true)} />
      <OfflineBanner />
      <PatientTabNavigator patientName={user.name} />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

function Header({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { isDark } = useTheme();

  const gradientColors = isDark ? gradients.dark : gradients.primary;

  return (
    <LinearGradient
      colors={[...gradientColors]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={headerStyles.gradient}
    >
      <View style={headerStyles.inner}>
        <TouchableOpacity
          style={headerStyles.logo}
          onPress={onOpenDrawer}
          activeOpacity={0.8}
        >
          <Image
            source={require("../../assets/icon.png")}
            style={headerStyles.logoIcon}
            resizeMode="contain"
          />
          <View style={headerStyles.logoWordmark}>
            <Text style={headerStyles.logoText}>Vela Vision</Text>
          </View>
          <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const headerStyles = StyleSheet.create({
  gradient: {
    paddingTop: 54,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
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
    borderLeftColor: "rgba(255,255,255,0.4)",
    paddingLeft: 10,
    marginLeft: 2,
  },
  logoText: {
    fontSize: 18,
    color: "#FFFFFF",
    ...fonts.medium,
    letterSpacing: 0.2,
  },
});
