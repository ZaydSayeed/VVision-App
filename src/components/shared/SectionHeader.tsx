import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts, spacing } from "../../config/theme";

interface SectionHeaderProps {
  label: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ label, action }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {action ? (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={styles.action}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.md,
  },
  label: {
    fontSize: 10,
    color: colors.lavender,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    ...fonts.medium,
  },
  action: {
    fontSize: 13,
    color: colors.violet,
    ...fonts.medium,
  },
});
