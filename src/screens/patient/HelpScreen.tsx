import React, { useMemo, useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHelpAlert } from "../../hooks/useHelpAlert";
import { fonts, spacing, radius } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";
import { formatRelativeTime } from "../../hooks/useDashboardData";

interface HelpScreenProps {
  patientName: string;
  caregiverName?: string;
}

export function HelpScreen({ patientName, caregiverName }: HelpScreenProps) {
  const { colors } = useTheme();
  const { alerts, sendHelp, sending, sentAt, sendError, clearSentState, reload } = useHelpAlert();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const sent = !!sentAt;
  const failed = !!sendError;

  async function handlePress() {
    clearSentState();
    await sendHelp();
    if (sentAt) {
      setTimeout(clearSentState, 4000);
    }
  }

  const recent = alerts.slice(0, 3);
  const caregiverDisplay = caregiverName ?? "your caregiver";

  // Breathing pulse on the outer ring — slow, calm, alive
  const ringPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1.04, duration: 1800, useNativeDriver: true }),
        Animated.timing(ringPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1 },

    // Warm gradient background — white at top, coral wash at bottom
    background: {
      ...StyleSheet.absoluteFillObject,
    },

    // ── Header ────────────────────────────────────────────────
    headerSection: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    headerTitle: {
      fontSize: 32,
      color: colors.text,
      ...fonts.medium,
      lineHeight: 38,
    },
    headerSub: {
      fontSize: 17,
      color: colors.muted,
      ...fonts.regular,
      marginTop: spacing.xs,
    },
    headerSubName: {
      color: colors.coral,
      ...fonts.medium,
    },

    // ── Button area ───────────────────────────────────────────
    btnArea: {
      flexGrow: 1,
      minHeight: 360,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: spacing.xxl,
    },
    btnRing: {
      width: 270,
      height: 270,
      borderRadius: 135,
      backgroundColor: colors.coralSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xl,
    },
    btnOuter: {
      borderRadius: 110,
      overflow: "hidden",
      shadowColor: colors.coral,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
      elevation: 14,
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
      lineHeight: 28,
    },
    hint: {
      fontSize: 16,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      paddingHorizontal: spacing.xl,
      lineHeight: 24,
    },
    hintName: {
      color: colors.coral,
      ...fonts.medium,
    },

    // ── Error banner ──────────────────────────────────────────
    errorBanner: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
      backgroundColor: colors.coralSoft,
      borderRadius: radius.lg,
      borderLeftWidth: 3,
      borderLeftColor: colors.coral,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    errorBannerText: {
      fontSize: 16,
      color: colors.coral,
      ...fonts.medium,
      flex: 1,
      lineHeight: 22,
    },

    // ── Recent section ────────────────────────────────────────
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
      shadowColor: colors.coral,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    recentDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.coral,
    },
    recentTime: {
      fontSize: 15,
      color: colors.muted,
      ...fonts.regular,
      flex: 1,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Warm background gradient */}
      <LinearGradient
        colors={[colors.bg, colors.bg, colors.coralSoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.background}
      />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />
        }
      >

      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>
          {sent ? "Help is coming!" : "Need help?"}
        </Text>
        <Text style={styles.headerSub}>
          {sent
            ? <Text><Text style={styles.headerSubName}>{caregiverDisplay}</Text> has been notified.</Text>
            : <Text>Don't worry, <Text style={styles.headerSubName}>{patientName}</Text>. We're here.</Text>
          }
        </Text>
      </View>

      {/* Error banner */}
      {failed && (
        <View style={styles.errorBanner}>
          <Ionicons name="wifi" size={20} color={colors.coral} />
          <Text style={styles.errorBannerText}>
            Couldn't reach your caregiver.{"\n"}Check your connection and try again.
          </Text>
        </View>
      )}

      {/* Big Help Button */}
      <View style={styles.btnArea}>
        <Animated.View style={[styles.btnRing, { transform: [{ scale: ringPulse }] }]}>
          <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.88}
            disabled={sent || sending}
            style={styles.btnOuter}
            accessibilityRole="button"
            accessibilityLabel="Send help alert to caregiver"
            accessibilityHint="Double tap to immediately notify your caregiver that you need assistance"
            accessibilityState={{ disabled: sent || sending }}
          >
            <LinearGradient
              colors={["#D95F5F", "#E87878"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnGradient}
            >
              {sent ? (
                <>
                  <Ionicons name="checkmark-circle" size={72} color="#FFFFFF" />
                  <Text style={styles.btnLabelSent}>Help is on{"\n"}the way!</Text>
                </>
              ) : sending ? (
                <>
                  <Ionicons name="radio-outline" size={72} color="#FFFFFF" />
                  <Text style={styles.btnLabelSent}>Sending…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="hand-left" size={72} color="#FFFFFF" />
                  <Text style={styles.btnLabel}>I Need Help</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {!sent && (
          <Text style={styles.hint}>
            Tap to alert{" "}
            <Text style={styles.hintName}>{caregiverDisplay}</Text>
            {" "}immediately
          </Text>
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

      </ScrollView>
    </View>
  );
}
