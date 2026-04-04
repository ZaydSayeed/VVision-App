import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { dismissAlert } from "../api/client";
import { useHelpAlert } from "../hooks/useHelpAlert";
import { EmptyState } from "../components/shared/EmptyState";
import { spacing, fonts, radius } from "../config/theme";
import { useTheme } from "../context/ThemeContext";
import { Alert as AlertType } from "../types";
import { formatRelativeTime, formatTimeShort } from "../hooks/useDashboardData";

interface AlertsScreenProps {
  alerts: AlertType[];
  loading: boolean;
  onRefresh: () => void;
}

export function AlertsScreen({ alerts, loading, onRefresh }: AlertsScreenProps) {
  const { colors } = useTheme();
  const { alerts: helpAlerts, dismissAlert: dismissHelp } = useHelpAlert();
  const pendingHelp = helpAlerts.filter((a) => !a.dismissed);

  async function handleDismissApiAlert(id: string) {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await dismissAlert(id);
      onRefresh();
    } catch {
      // Silently fail — will refresh on next poll
    }
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingBottom: 100 },

    // Screen header
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    screenTitle: {
      fontSize: 28,
      color: colors.text,
      ...fonts.medium,
    },
    screenSubtitle: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 3,
    },

    // Section
    section: { paddingHorizontal: spacing.xl, marginBottom: spacing.xxl },
    sectionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    sectionLabel: {
      fontSize: 11,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },

    // ── Help Request Card ────────────────────────────────────
    helpCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: colors.coral,
      shadowColor: colors.coral,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 3,
    },
    helpTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    helpIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.coralSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    helpInfo: { flex: 1 },
    helpTitle: {
      fontSize: 17,
      color: colors.text,
      ...fonts.medium,
    },
    helpTime: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 3,
    },
    helpDismissBtn: {
      backgroundColor: colors.coral,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xl,
      paddingVertical: 12,
      alignItems: "center",
    },
    helpDismissText: {
      fontSize: 14,
      color: "#FFFFFF",
      ...fonts.medium,
    },

    // ── Face Recognition Card (AI identity) ─────────────────
    faceCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.violet100,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 5,
    },
    faceTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    faceIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.violet50,
      borderWidth: 1.5,
      borderColor: colors.violet300,
      alignItems: "center",
      justifyContent: "center",
    },
    faceInfo: { flex: 1 },
    faceTitle: {
      fontSize: 16,
      color: colors.text,
      ...fonts.medium,
    },
    faceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    faceBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.violet,
    },
    faceBadgeText: {
      fontSize: 11,
      color: colors.violet,
      ...fonts.medium,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    faceTime: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
    },
    faceDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: spacing.md,
    },
    faceDismissBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.violet50,
      borderRadius: radius.pill,
      paddingVertical: 10,
    },
    faceDismissText: {
      fontSize: 13,
      color: colors.violet,
      ...fonts.medium,
    },
  }), [colors]);

  const totalAlerts = alerts.length + pendingHelp.length;

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Alerts</Text>
        <Text style={styles.screenSubtitle}>
          {totalAlerts === 0 ? "Everything looks clear" : `${totalAlerts} item${totalAlerts !== 1 ? "s" : ""} need your attention`}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.violet} />
        }
      >
        {/* ── Help Requests ── */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: colors.coral }]} />
            <Text style={[styles.sectionLabel, { color: colors.coral }]}>Help Requests</Text>
          </View>
          {pendingHelp.length === 0 ? (
            <EmptyState title="All clear" subtitle="No help requests from patients" />
          ) : (
            pendingHelp.map((alert) => (
              <View key={alert.id} style={styles.helpCard}>
                <View style={styles.helpTop}>
                  <View style={styles.helpIconCircle}>
                    <Ionicons name="hand-left" size={22} color={colors.coral} />
                  </View>
                  <View style={styles.helpInfo}>
                    <Text style={styles.helpTitle}>Patient needs help</Text>
                    <Text style={styles.helpTime}>{formatRelativeTime(alert.timestamp)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.helpDismissBtn}
                  onPress={() => dismissHelp(alert.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.helpDismissText}>Mark as handled</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ── Face Recognition Alerts ── */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: colors.violet }]} />
            <Text style={[styles.sectionLabel, { color: colors.violet }]}>AI Detection</Text>
          </View>
          {alerts.length === 0 ? (
            <EmptyState title="No alerts" subtitle="All detected faces are recognized" />
          ) : (
            alerts.map((alert) => (
              <View key={alert.id ?? alert._id} style={styles.faceCard}>
                <View style={styles.faceTop}>
                  <View style={styles.faceIconWrap}>
                    <Ionicons name="scan-circle" size={26} color={colors.violet} />
                  </View>
                  <View style={styles.faceInfo}>
                    <Text style={styles.faceTitle}>Unrecognized person detected</Text>
                    <View style={styles.faceBadge}>
                      <View style={styles.faceBadgeDot} />
                      <Text style={styles.faceBadgeText}>AI Alert</Text>
                    </View>
                  </View>
                  <Text style={styles.faceTime}>{formatTimeShort(alert.timestamp)}</Text>
                </View>
                <View style={styles.faceDivider} />
                <TouchableOpacity
                  style={styles.faceDismissBtn}
                  onPress={() => handleDismissApiAlert(alert.id ?? alert._id ?? "")}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={15} color={colors.violet} />
                  <Text style={styles.faceDismissText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
