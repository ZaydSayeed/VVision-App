import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authHeaders } from "../../api/client";
import { API_BASE_URL } from "../../config/api";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { AppUser } from "../../types";

const MOODS = [
  { mood: "happy", emoji: "😊", label: "Happy" },
  { mood: "tired", emoji: "😴", label: "Tired" },
  { mood: "confused", emoji: "😕", label: "Confused" },
  { mood: "sad", emoji: "😢", label: "Sad" },
] as const;

interface MoodCheckInProps {
  user: AppUser | null;
}

/**
 * Once-per-day mood check-in card for the patient. Submits to /api/mood and
 * remembers the response per-user, per-day in AsyncStorage so the card
 * disappears after one tap. Extracted verbatim from TodayScreen.
 */
export function MoodCheckIn({ user }: MoodCheckInProps) {
  const { colors } = useTheme();
  const [moodSubmitted, setMoodSubmitted] = useState(false);
  const [moodSubmitting, setMoodSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem(`@vela/mood_submitted:${user.id}:${today}`).then((val) => {
      if (val) setMoodSubmitted(true);
    });
  }, [user]);

  const handleMoodSelect = useCallback(async (mood: string) => {
    if (moodSubmitting || moodSubmitted) return;
    setMoodSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mood`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ mood }),
      });
      if (res.ok || res.status === 409) {
        const today = new Date().toISOString().slice(0, 10);
        await AsyncStorage.setItem(`@vela/mood_submitted:${user!.id}:${today}`, "1");
        setMoodSubmitted(true);
      }
    } catch (err) {
      console.error("mood submit error:", err);
    } finally {
      setMoodSubmitting(false);
    }
  }, [moodSubmitting, moodSubmitted, user]);

  const styles = useMemo(() => StyleSheet.create({
    moodCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    moodQuestion: { fontSize: 15, ...fonts.medium, color: colors.text },
    moodRow: { flexDirection: "row", justifyContent: "space-between" },
    moodBtn: { alignItems: "center", gap: 4, flex: 1 },
    moodEmoji: { fontSize: 28 },
    moodLabel: { fontSize: 11, ...fonts.regular, color: colors.muted },
  }), [colors]);

  if (moodSubmitted) return null;

  return (
    <View style={styles.moodCard}>
      <Text style={styles.moodQuestion}>How are you feeling today?</Text>
      <View style={styles.moodRow}>
        {MOODS.map(({ mood, emoji, label }) => (
          <TouchableOpacity
            key={mood}
            style={styles.moodBtn}
            onPress={() => handleMoodSelect(mood)}
            disabled={moodSubmitting}
            accessibilityLabel={label}
          >
            <Text style={styles.moodEmoji}>{emoji}</Text>
            <Text style={styles.moodLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
