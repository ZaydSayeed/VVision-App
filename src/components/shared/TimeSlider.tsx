import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";

interface TimeSliderProps {
  value: string; // "HH:MM" 24-hour, or ""
  onChange: (value: string) => void;
}

function parse(value: string): { hour: number; minute: number; ampm: "AM" | "PM" } {
  if (!value || !value.includes(":")) return { hour: 9, minute: 0, ampm: "AM" };
  const [h, m] = value.split(":").map(Number);
  return {
    hour: h === 0 ? 12 : h > 12 ? h - 12 : h,
    minute: Math.round(m / 5) * 5,
    ampm: h >= 12 ? "PM" : "AM",
  };
}

function format(hour: number, minute: number, ampm: "AM" | "PM"): string {
  let h24 = hour;
  if (ampm === "AM") {
    if (hour === 12) h24 = 0;
  } else {
    if (hour !== 12) h24 = hour + 12;
  }
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimeSlider({ value, onChange }: TimeSliderProps) {
  const { colors } = useTheme();
  const initial = parse(value);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [ampm, setAmpm] = useState<"AM" | "PM">(initial.ampm);

  // Sync internal state when value changes from outside (e.g. modal opens with existing time)
  useEffect(() => {
    const p = parse(value);
    setHour(p.hour);
    setMinute(p.minute);
    setAmpm(p.ampm);
  }, [value]);

  // Sync parent on mount so parent state matches the displayed default
  useEffect(() => {
    onChange(format(initial.hour, initial.minute, initial.ampm));
  }, []);

  function update(h: number, m: number, a: "AM" | "PM") {
    onChange(format(h, m, a));
  }

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
      marginBottom: spacing.lg,
      letterSpacing: 1,
    },
    sliderRow: {
      marginBottom: spacing.md,
    },
    sliderLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    ampmRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    ampmBtn: {
      flex: 1,
      height: 44,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    ampmActive: {
      backgroundColor: colors.violet,
      borderColor: colors.violet,
    },
    ampmText: {
      fontSize: 16,
      color: colors.muted,
      ...fonts.medium,
    },
    ampmActiveText: {
      color: "#FFFFFF",
    },
  }), [colors]);

  const displayMin = String(minute).padStart(2, "0");

  return (
    <View style={styles.container}>
      <Text style={styles.timeDisplay}>{hour}:{displayMin} {ampm}</Text>

      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>Hour</Text>
        <Slider
          minimumValue={1}
          maximumValue={12}
          step={1}
          value={hour}
          onValueChange={(v) => { setHour(v); update(v, minute, ampm); }}
          minimumTrackTintColor={colors.violet}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.violet}
        />
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.sliderLabel}>Minute</Text>
        <Slider
          minimumValue={0}
          maximumValue={55}
          step={5}
          value={minute}
          onValueChange={(v) => { setMinute(v); update(hour, v, ampm); }}
          minimumTrackTintColor={colors.violet}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.violet}
        />
      </View>

      <View style={styles.ampmRow}>
        <TouchableOpacity
          style={[styles.ampmBtn, ampm === "AM" && styles.ampmActive]}
          onPress={() => { setAmpm("AM"); update(hour, minute, "AM"); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.ampmText, ampm === "AM" && styles.ampmActiveText]}>AM</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ampmBtn, ampm === "PM" && styles.ampmActive]}
          onPress={() => { setAmpm("PM"); update(hour, minute, "PM"); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.ampmText, ampm === "PM" && styles.ampmActiveText]}>PM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
