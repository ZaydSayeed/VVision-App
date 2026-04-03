import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { fonts, spacing, radius, gradients } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";
import { formatRelativeTime } from "../../hooks/useDashboardData";

interface HelpScreenProps {
  patientName: string;
}

export function HelpScreen({ patientName }: HelpScreenProps) {
  const { colors } = useTheme();
  const { alerts, sendHelp } = useHelpAlert();
  const [sent, setSent] = useState(false);

  async function handlePress() {
    try {
      await sendHelp();
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } catch {
      // Keep button enabled so user can retry
    }
  }

  const recent = alerts.slice(0, 3);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    // Header section
    headerSection: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },
    headerTitle: {
      fontSize: 28,
      color: colors.text,
      ...fonts.medium,
    },
    headerSub: {
      fontSize: 15,
      color: colors.muted,
      ...fonts.regular,
      marginTop: spacing.xs,
    },

    // Button area
    btnArea: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: spacing.xxl,
    },
    btnRing: {
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xl,
    },
    btnOuter: {
      borderRadius: 110,
      overflow: "hidden",
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
    },
    btnGradient: {
      width: 220,
      height: 220,
      borderRadius: 110,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    btnLabel: {
      fontSize: 24,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    btnLabelSent: {
      fontSize: 20,
      color: "#FFFFFF",
      ...fonts.medium,
      textAlign: "center",
      paddingHorizontal: spacing.lg,
    },
    hint: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      paddingHorizontal: spacing.xl,
    },

    // Recent section
    recentSection: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxxl,
    },
    recentLabel: {
      fontSize: 18,
      color: colors.text,
      ...fonts.medium,
      marginBottom: spacing.md,
    },
    recentCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.sm,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    recentDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.violet,
    },
    recentTime: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      flex: 1,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>
          {sent ? "Help is coming!" : "Need help?"}
        </Text>
        <Text style={styles.headerSub}>
          {sent ? "Your caregiver has been notified." : `Press the button, ${patientName}.`}
        </Text>
      </View>

      {/* Big Help Button */}
      <View style={styles.btnArea}>
        <View style={styles.btnRing}>
          <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.88}
            disabled={sent}
            style={styles.btnOuter}
          >
            <LinearGradient
              colors={[gradients.primary[0], gradients.primary[1]]}
              style={styles.btnGradient}
            >
              {sent ? (
                <>
                  <Ionicons name="checkmark-circle" size={72} color="#FFFFFF" />
                  <Text style={styles.btnLabelSent}>Help is on{"\n"}the way!</Text>
                </>
              ) : (
                <>
                  <Ionicons name="hand-left" size={72} color="#FFFFFF" />
                  <Text style={styles.btnLabel}>I Need Help</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
        {!sent && (
          <Text style={styles.hint}>Tap to alert your caregiver immediately</Text>
        )}
      </View>

      {/* Recent Alerts */}
      {recent.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentLabel}>Recent Requests</Text>
          {recent.map((a) => (
            <View key={a.id} style={styles.recentCard}>
              <View style={styles.recentDot} />
              <Text style={styles.recentTime}>{formatRelativeTime(a.timestamp)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
