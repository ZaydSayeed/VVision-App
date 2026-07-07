import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";

interface TimeSliderProps {
  value: string; // "HH:MM" 24-hour or ""
  onChange: (value: string) => void;
}

// Day-part presets: one tap lands near the intended time, ± fine-tunes.
// Words, not clock abstractions — matches how the audience talks about time.
const PRESETS: { label: string; minutes: number }[] = [
  { label: "Morning", minutes: 9 * 60 },
  { label: "Noon", minutes: 12 * 60 },
  { label: "Afternoon", minutes: 15 * 60 },
  { label: "Evening", minutes: 18 * 60 },
  { label: "Night", minutes: 20 * 60 },
];

function minutesToTime(totalMinutes: number): { display: string; value: string } {
  const clamped = Math.min(23 * 60 + 45, Math.max(0, totalMinutes));
  const h24 = Math.floor(clamped / 60);
  const min = clamped % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return {
    display: `${h12}:${String(min).padStart(2, "0")} ${ampm}`,
    value: `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
  };
}

function timeToMinutes(value: string): number {
  if (!value || !value.includes(":")) return 9 * 60; // default 9:00 AM
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function TimeSlider({ value, onChange }: TimeSliderProps) {
  const { colors } = useTheme();
  const [minutes, setMinutes] = useState(timeToMinutes(value));

  useEffect(() => {
    setMinutes(timeToMinutes(value));
  }, [value]);

  // Sync parent on mount with the default so parent state is never empty
  useEffect(() => {
    onChange(minutesToTime(timeToMinutes(value)).value);
  }, []);

  const { display } = minutesToTime(minutes);

  const set = (next: number) => {
    const clamped = Math.min(23 * 60 + 45, Math.max(0, next));
    setMinutes(clamped);
    onChange(minutesToTime(clamped).value);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      alignItems: "center",
    },
    timeDisplay: {
      fontSize: 40,
      color: colors.violet,
      ...fonts.medium,
      textAlign: "center",
      marginBottom: spacing.md,
      letterSpacing: 1,
    },
    presetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    presetChip: {
      paddingHorizontal: spacing.lg,
      minHeight: 48,
      justifyContent: "center",
      borderRadius: radius.pill,
      borderWidth: 1.5,
    },
    presetChipText: {
      fontSize: 16,
      ...fonts.medium,
    },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    btn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: {
      fontSize: 26,
      color: colors.violet,
      ...fonts.medium,
      lineHeight: 30,
    },
    stepLabel: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      minWidth: 88,
      textAlign: "center",
    },
  }), [colors]);

  // Which preset is the current time closest to (within 90 min) — for chip highlight
  const activePreset = PRESETS.find((p) => Math.abs(p.minutes - minutes) <= 90)?.label;

  return (
    <View style={styles.container}>
      <Text style={styles.timeDisplay}>{display}</Text>

      <View style={styles.presetRow}>
        {PRESETS.map((p) => {
          const active = activePreset === p.label;
          return (
            <TouchableOpacity
              key={p.label}
              style={[styles.presetChip, {
                backgroundColor: active ? colors.violet : colors.surface,
                borderColor: active ? colors.violet : colors.border,
              }]}
              onPress={() => set(p.minutes)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Set time to ${p.label.toLowerCase()}, ${minutesToTime(p.minutes).display}`}
            >
              <Text style={[styles.presetChipText, { color: active ? "#FFFFFF" : colors.subtext }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => set(minutes - 30)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="30 minutes earlier"
        >
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>30 min</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => set(minutes + 30)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="30 minutes later"
        >
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
