import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing } from "../../config/theme";

interface TimeSliderProps {
  value: string; // "HH:MM" 24-hour or ""
  onChange: (value: string) => void;
}

// 96 steps: step 0 = 12:00 AM, step 95 = 11:45 PM, each step = 15 min
function stepToTime(step: number): { display: string; value: string } {
  const totalMinutes = step * 15;
  const h24 = Math.floor(totalMinutes / 60);
  const min = totalMinutes % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const minStr = String(min).padStart(2, "0");
  const h24Str = String(h24).padStart(2, "0");
  return {
    display: `${h12}:${minStr} ${ampm}`,
    value: `${h24Str}:${minStr}`,
  };
}

function timeToStep(value: string): number {
  if (!value || !value.includes(":")) return 36; // default 9:00 AM
  const [h, m] = value.split(":").map(Number);
  return Math.round((h * 60 + m) / 15);
}

export function TimeSlider({ value, onChange }: TimeSliderProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState(timeToStep(value));

  useEffect(() => {
    setStep(timeToStep(value));
  }, [value]);

  // Sync parent on mount with the default so parent state is never empty
  useEffect(() => {
    onChange(stepToTime(timeToStep(value)).value);
  }, []);

  const { display } = stepToTime(step);

  const adjust = (delta: number) => {
    const next = Math.min(95, Math.max(0, step + delta));
    setStep(next);
    onChange(stepToTime(next).value);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      alignItems: "center",
    },
    timeDisplay: {
      fontSize: 38,
      color: colors.violet,
      ...fonts.medium,
      textAlign: "center",
      marginBottom: spacing.md,
      letterSpacing: 1,
    },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    btn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    btnText: {
      fontSize: 24,
      color: colors.violet,
      ...fonts.medium,
      lineHeight: 28,
    },
    stepLabel: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.regular,
      minWidth: 80,
      textAlign: "center",
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.timeDisplay}>{display}</Text>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.btn} onPress={() => adjust(-1)} activeOpacity={0.7}>
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepLabel}>15 min steps</Text>
        <TouchableOpacity style={styles.btn} onPress={() => adjust(1)} activeOpacity={0.7}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
