import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
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

  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    timeDisplay: {
      fontSize: 38,
      color: colors.violet,
      ...fonts.medium,
      textAlign: "center",
      marginBottom: spacing.md,
      letterSpacing: 1,
    },
    sliderLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 4,
      textAlign: "center",
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.timeDisplay}>{display}</Text>
      <Slider
        minimumValue={0}
        maximumValue={95}
        step={1}
        value={step}
        onValueChange={(v) => {
          setStep(v);
          onChange(stepToTime(v).value);
        }}
        minimumTrackTintColor={colors.violet}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.violet}
      />
    </View>
  );
}
