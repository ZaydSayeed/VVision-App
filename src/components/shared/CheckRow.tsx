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
  accentColor?: string;
}

export function CheckRow({ label, subLabel, checked, onToggle, onDelete, accentColor }: CheckRowProps) {
  const { colors } = useTheme();
  const accent = accentColor ?? colors.violet;

  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 18,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      minHeight: 72,
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
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    labelWrap: {
      flex: 1,
    },
    label: {
      fontSize: 20,
      color: colors.text,
      ...fonts.medium,
      lineHeight: 26,
    },
    labelChecked: {
      textDecorationLine: "line-through",
      color: colors.muted,
    },
    subLabel: {
      fontSize: 16,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 3,
    },
    subLabelChecked: {
      opacity: 0.45,
    },
    deleteBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderRadius: 18,
    },
  }), [colors]);

  const checkboxStyle = [
    styles.checkbox,
    checked && { backgroundColor: accent, borderColor: accent },
  ];

  return (
    <View style={styles.row}>
      <TouchableOpacity style={checkboxStyle} onPress={onToggle} activeOpacity={0.8}>
        {checked && <Ionicons name="checkmark" size={22} color="#FFFFFF" />}
      </TouchableOpacity>

      <TouchableOpacity style={styles.labelWrap} onPress={onToggle} activeOpacity={0.8}>
        <Text style={[styles.label, checked && styles.labelChecked]}>{label}</Text>
        {subLabel ? <Text style={[styles.subLabel, checked && styles.subLabelChecked]}>{subLabel}</Text> : null}
      </TouchableOpacity>

      {onDelete ? (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="close" size={18} color={colors.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
