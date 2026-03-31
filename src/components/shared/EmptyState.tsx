import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { fonts, spacing } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle: string;
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: "center",
      paddingVertical: spacing.xxxxl,
      gap: spacing.sm,
    },
    title: {
      fontSize: 22,
      color: colors.text,
      ...fonts.display,
    },
    subtitle: {
      fontSize: 15,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}
