import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts, spacing, radius } from "../../config/theme";

interface CheckRowProps {
  label: string;
  subLabel?: string;
  checked: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}

export function CheckRow({ label, subLabel, checked, onToggle, onDelete }: CheckRowProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.checkbox, checked && styles.checkboxChecked]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.labelWrap} onPress={onToggle} activeOpacity={0.8}>
        <Text style={[styles.label, checked && styles.labelChecked]}>{label}</Text>
        {subLabel ? (
          <Text style={styles.subLabel}>{subLabel}</Text>
        ) : null}
      </TouchableOpacity>

      {onDelete ? (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
    minHeight: 56,
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
  checkmark: {
    color: "#FAF8F4",
    fontSize: 16,
    ...fonts.medium,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    fontSize: 20,
    color: colors.text,
    ...fonts.regular,
  },
  labelChecked: {
    textDecorationLine: "line-through",
    color: colors.muted,
  },
  subLabel: {
    fontSize: 14,
    color: colors.muted,
    ...fonts.regular,
    marginTop: 2,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    fontSize: 14,
    color: colors.muted,
  },
});
