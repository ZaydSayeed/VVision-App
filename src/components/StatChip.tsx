import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { radius, spacing, fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";

interface StatChipProps {
  value: string | number;
  label: string;
  color: string;
}

export function StatChip({ value, label, color }: StatChipProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    chip: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      minWidth: 120,
      gap: 4,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    value: {
      fontSize: 28,
      ...fonts.medium,
    },
    label: {
      fontSize: 11,
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      ...fonts.medium,
    },
  }), [colors]);

  return (
    <View style={styles.chip}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
