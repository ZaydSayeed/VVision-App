import React, { useMemo, useEffect, useState, useRef } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated } from "react-native";
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
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setOnNetworkChange(setOffline);
  }, [setOffline]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const styles = useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    splash: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    },
    splashLogo: {
      width: 72,
      height: 72,
    },
    splashText: {
      fontSize: 20,
      color: colors.violet,
      ...fonts.medium,
      letterSpacing: 0.3,
    },
  }), [colors]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <Image
          source={require("../../assets/icon.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={styles.splashText}>Vela Vision</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (user.role === "caregiver") {
    return (
      <Animated.View style={[styles.root, { opacity: contentOpacity }]}>
        <Header onOpenDrawer={() => setDrawerOpen(true)} />
        <OfflineBanner />
        <CaregiverTabNavigator />
        <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.root, { opacity: contentOpacity }]}>
      <Header onOpenDrawer={() => setDrawerOpen(true)} />
      <OfflineBanner />
      <PatientTabNavigator patientName={user.name} />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Animated.View>
  );
}

function Header({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { colors, isDark } = useTheme();
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const timeStr = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <View style={[headerStyles.wrap, { backgroundColor: colors.bg }]}>
      {/* Logo row */}
      <View style={[headerStyles.bar, { shadowColor: colors.border }]}>
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
          <Text style={[headerStyles.logoText, { color: colors.text }]}>Vela Vision</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenDrawer} activeOpacity={0.7} style={headerStyles.menuBtn}>
          <Ionicons name="menu-outline" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Time banner */}
      <LinearGradient
        colors={isDark ? [...gradients.dark] : [...gradients.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={headerStyles.timeBanner}
      >
        <Text style={headerStyles.timeText}>{timeStr}</Text>
        <Text style={headerStyles.dateText}>{dateStr}</Text>
      </LinearGradient>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {
    zIndex: 10,
  },
  bar: {
    paddingTop: 54,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
  },
  logoText: {
    fontSize: 17,
    ...fonts.medium,
    letterSpacing: 0.2,
  },
  menuBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  timeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  timeText: {
    fontSize: 22,
    color: "#FFFFFF",
    ...fonts.medium,
  },
  dateText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    ...fonts.regular,
  },
});
