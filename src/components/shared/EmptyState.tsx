import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, spacing, radius } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}

export function EmptyState({ icon = "layers-outline", title, subtitle }: EmptyStateProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: "center",
      paddingVertical: spacing.xxxxl,
      gap: spacing.md,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: radius.pill,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 20,
      color: colors.text,
      ...fonts.medium,
    },
    subtitle: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 260,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={colors.violet} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}
