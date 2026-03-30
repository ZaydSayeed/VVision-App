import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { colors, fonts, spacing, gradients } from "../../config/theme";
import { formatRelativeTime } from "../../hooks/useDashboardData";

interface HelpScreenProps {
  patientName: string;
}

export function HelpScreen({ patientName }: HelpScreenProps) {
  const { alerts, sendHelp } = useHelpAlert();
  const [sent, setSent] = useState(false);

  async function handlePress() {
    await sendHelp();
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  }

  const recent = alerts.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Greeting */}
      <Text style={styles.greeting}>Hi, {patientName}.</Text>
      <Text style={styles.sub}>Press the button if you need help.</Text>

      {/* Big Help Button */}
      <View style={styles.btnWrap}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.85}
          disabled={sent}
          style={styles.btnOuter}
        >
          <LinearGradient
            colors={[gradients.primary[0], gradients.primary[1]]}
            style={styles.btnGradient}
          >
            {sent ? (
              <>
                <Ionicons name="checkmark-circle-outline" size={64} color="#FAF8F4" />
                <Text style={styles.btnLabelSent}>Help is on the way!</Text>
              </>
            ) : (
              <>
                <Ionicons name="alert-circle-outline" size={64} color="#FAF8F4" />
                <Text style={styles.btnLabel}>I Need Help</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        Your caregiver will be notified immediately.
      </Text>

      {/* Recent Alerts */}
      {recent.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentLabel}>RECENT REQUESTS</Text>
          {recent.map((a) => (
            <View key={a.id} style={styles.recentRow}>
              <Text style={styles.recentDot}>·</Text>
              <Text style={styles.recentTime}>
                {formatRelativeTime(a.timestamp)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    paddingTop: spacing.xxxxl,
    paddingHorizontal: spacing.xxl,
  },
  greeting: {
    fontSize: 36,
    color: colors.text,
    ...fonts.displayLight,
  },
  sub: {
    fontSize: 18,
    color: colors.muted,
    ...fonts.regular,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  btnWrap: {
    marginTop: spacing.xxxxl,
    marginBottom: spacing.xl,
  },
  btnOuter: {
    borderRadius: 120,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#6B5AE0",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  btnGradient: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  btnLabel: {
    fontSize: 26,
    color: "#FAF8F4",
    ...fonts.display,
  },
  btnLabelSent: {
    fontSize: 20,
    color: "#FAF8F4",
    ...fonts.display,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  hint: {
    fontSize: 15,
    color: colors.muted,
    ...fonts.regular,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  recentSection: {
    marginTop: spacing.xxxxl,
    alignSelf: "stretch",
  },
  recentLabel: {
    fontSize: 10,
    color: colors.lavender,
    ...fonts.medium,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  recentRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recentDot: {
    fontSize: 18,
    color: colors.muted,
  },
  recentTime: {
    fontSize: 16,
    color: colors.muted,
    ...fonts.regular,
  },
});
