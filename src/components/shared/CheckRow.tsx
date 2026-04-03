import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, spacing, radius } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

interface CheckRowProps {
  label: string;
  subLabel?: string;
  checked: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}

export function CheckRow({ label, subLabel, checked, onToggle, onDelete }: CheckRowProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      minHeight: 64,
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      marginBottom: spacing.md,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
    },
    checkbox: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: colors.violet,
      borderColor: colors.violet,
    },
    checkmark: {},
    labelWrap: {
      flex: 1,
    },
    label: {
      fontSize: 16,
      color: colors.text,
      ...fonts.medium,
    },
    labelChecked: {
      textDecorationLine: "line-through",
      color: colors.muted,
    },
    subLabel: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 2,
    },
    deleteBtn: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderRadius: 16,
    },
    deleteText: {},
  }), [colors]);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.checkbox, checked && styles.checkboxChecked]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
      </TouchableOpacity>

      <TouchableOpacity style={styles.labelWrap} onPress={onToggle} activeOpacity={0.8}>
        <Text style={[styles.label, checked && styles.labelChecked]}>{label}</Text>
        {subLabel ? (
          <Text style={styles.subLabel}>{subLabel}</Text>
        ) : null}
      </TouchableOpacity>

      {onDelete ? (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="close" size={16} color={colors.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
