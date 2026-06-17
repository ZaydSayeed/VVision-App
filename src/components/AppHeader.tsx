import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useClock } from "../hooks/useClock";
import { fonts, spacing, gradients } from "../config/theme";
import { AppUser } from "../types";

interface AppHeaderProps {
  onOpenDrawer: () => void;
  user: AppUser | null;
  notifCount?: number;
  onOpenNotif?: () => void;
}

/** Global top header: logo (opens drawer), notifications bell, and the live time banner. */
export function AppHeader({ onOpenDrawer, notifCount, onOpenNotif }: AppHeaderProps) {
  const { colors, isDark } = useTheme();
  const clock = useClock();

  const timeStr = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <View style={[headerStyles.wrap, { backgroundColor: colors.bg }]}>
      <View style={[headerStyles.bar, { shadowColor: colors.border }]}>
        <TouchableOpacity style={headerStyles.logo} onPress={onOpenDrawer} activeOpacity={0.8}>
          <Image
            source={isDark ? require("../../assets/logo-flame-light.png") : require("../../assets/logo-flame-dark.png")}
            style={headerStyles.logoIcon}
            resizeMode="contain"
          />
          <Text style={[headerStyles.logoText, { color: colors.text }]}>Vela Vision</Text>
        </TouchableOpacity>

        <View style={headerStyles.rightRow}>
          {onOpenNotif && (
            <TouchableOpacity onPress={onOpenNotif} activeOpacity={0.7} style={headerStyles.bellBtn} accessibilityRole="button" accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
              {notifCount != null && notifCount > 0 && (
                <View style={[headerStyles.badge, { backgroundColor: colors.coral }]}>
                  <Text style={headerStyles.badgeText}>{notifCount > 9 ? "9+" : notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onOpenDrawer} activeOpacity={0.7} style={headerStyles.menuBtn} accessibilityRole="button" accessibilityLabel="Open menu">
            <Ionicons name="menu-outline" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

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
  wrap: { zIndex: 10 },
  bar: {
    paddingTop: 54, paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoIcon: { width: 24, height: 28 },
  logoText: { fontSize: 17, ...fonts.medium, letterSpacing: 0.2 },
  rightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bellBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute", top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: "#FFFFFF", ...fonts.medium },
  menuBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  timeBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  timeText: { fontSize: 22, color: "#FFFFFF", ...fonts.medium },
  dateText: { fontSize: 14, color: "rgba(255,255,255,0.85)", ...fonts.regular },
});
