import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { fonts, spacing } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

interface SectionHeaderProps {
  label: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ label, action }: SectionHeaderProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: spacing.md,
    },
    label: {
      fontSize: 13,
      color: colors.text,
      letterSpacing: 0.2,
      ...fonts.medium,
    },
    action: {
      fontSize: 13,
      color: colors.violet,
      ...fonts.medium,
    },
  }), [colors]);

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
