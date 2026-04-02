import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, spacing, gradients } from "../config/theme";
import { useTheme } from "../context/ThemeContext";

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  paddingTop?: number;
}

export function GradientHeader({
  title,
  subtitle,
  rightElement,
  leftElement,
  paddingTop = 0,
}: GradientHeaderProps) {
  const { isDark } = useTheme();

  return (
    <LinearGradient
      colors={isDark ? [...gradients.dark] : [...gradients.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.gradient, { paddingTop: paddingTop + spacing.xl }]}
    >
      <View style={styles.row}>
        {leftElement ? <View style={styles.side}>{leftElement}</View> : null}
        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightElement ? <View style={styles.side}>{rightElement}</View> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  center: {
    flex: 1,
  },
  side: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    color: "#FFFFFF",
    ...fonts.medium,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
    ...fonts.regular,
  },
});
