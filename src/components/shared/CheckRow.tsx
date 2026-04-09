import React, { useEffect, useRef, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

  // Checkmark scale spring — pops in when checked, fades out when unchecked
  const checkScale = useRef(new Animated.Value(checked ? 1 : 0)).current;
  // Row flash overlay — uses native driver (opacity only, no background color interpolation)
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (checked) {
      Animated.spring(checkScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 200,
      }).start();
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(checkScale, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [checked]);

  async function handleToggle() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  }

  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 18,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      minHeight: 72,
      borderRadius: radius.xl,
      marginBottom: spacing.md,
      borderLeftWidth: 4,
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
    <View style={[styles.row, { backgroundColor: colors.bg, borderLeftColor: accent }]}>
      {/* Native-driver flash overlay — avoids layout thread for better frame rate */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius.lg,
            backgroundColor: accentColor ? `${accentColor}18` : colors.violet50,
            opacity: flashOpacity,
          },
        ]}
        pointerEvents="none"
      />
      <TouchableOpacity
        style={checkboxStyle}
        onPress={handleToggle}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${label}, ${checked ? "completed" : "not completed"}`}
      >
        <Animated.View style={{ transform: [{ scale: checkScale }] }}>
          <Ionicons name="checkmark" size={22} color="#FFFFFF" />
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.labelWrap} onPress={handleToggle} activeOpacity={0.8}>
        <Text style={[styles.label, checked && styles.labelChecked]}>{label}</Text>
        {subLabel ? <Text style={[styles.subLabel, checked && styles.subLabelChecked]}>{subLabel}</Text> : null}
      </TouchableOpacity>

      {onDelete ? (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          accessibilityLabel={`Remove ${label}`}
          accessibilityRole="button"
        >
          <Ionicons name="close" size={18} color={colors.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
