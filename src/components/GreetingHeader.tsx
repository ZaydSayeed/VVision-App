import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius, shadows } from "../config/theme";

interface GreetingHeaderProps {
  name: string;
  onLogout: () => void;
}

export function GreetingHeader({ name, onLogout }: GreetingHeaderProps) {
  const { colors } = useTheme();
  const firstName = name.split(" ")[0] || name;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: 60,
      paddingBottom: spacing.lg,
    },
    textBlock: {
      flex: 1,
    },
    greeting: {
      fontSize: 16,
      color: colors.muted,
      ...fonts.regular,
    },
    name: {
      fontSize: 28,
      color: colors.text,
      ...fonts.display,
      marginTop: 2,
    },
    avatarRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.md,
    },
    avatarText: {
      fontSize: 18,
      color: "#fff",
      ...fonts.medium,
    },
    logoutBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.greeting}>Hello,</Text>
        <Text style={styles.name}>{firstName}!</Text>
      </View>
      <View style={styles.avatarRow}>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={colors.muted} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>
    </View>
  );
}
