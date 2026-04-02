import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useNetwork } from "../context/NetworkContext";
import { fonts, spacing } from "../config/theme";

export function OfflineBanner() {
  const { colors } = useTheme();
  const { isOffline } = useNetwork();

  const styles = useMemo(() => StyleSheet.create({
    banner: {
      backgroundColor: colors.violet800,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    text: {
      fontSize: 12,
      color: "#FFFFFF",
      ...fonts.medium,
      letterSpacing: 0.3,
    },
  }), [colors]);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
      <Text style={styles.text}>Offline — showing cached data</Text>
    </View>
  );
}
