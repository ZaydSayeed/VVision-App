import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, spacing } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

interface SectionHeaderProps {
  label: string;
  action?: { onPress: () => void };
}

export function SectionHeader({ label, action }: SectionHeaderProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: spacing.md,
      paddingVertical: spacing.xs,
    },
    label: {
      fontSize: 18,
      color: colors.text,
      letterSpacing: 0.2,
      ...fonts.medium,
    },
    addBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
  }), [colors]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {action ? (
        <TouchableOpacity onPress={action.onPress} style={styles.addBtn} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={24} color={colors.violet} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
