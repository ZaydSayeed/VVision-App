import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { radius } from "../config/theme";
import { useTheme } from "../context/ThemeContext";

interface ShadowCardProps {
  style?: ViewStyle;
  children: React.ReactNode;
}

export function ShadowCard({ style, children }: ShadowCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    shadowColor: "#7B5CE7",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
});
