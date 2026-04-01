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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      minWidth: 110,
      gap: 2,
    },
    value: {
      fontSize: 22,
      ...fonts.display,
    },
    label: {
      fontSize: 10,
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
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
