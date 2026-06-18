import React, { useMemo, useCallback, useState } from "react";
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

import { useHelpAlert } from "../hooks/useHelpAlert";
import { EmptyState } from "../components/shared/EmptyState";
import { spacing, fonts, radius } from "../config/theme";
import { useTheme } from "../context/ThemeContext";
import { formatRelativeTime } from "../hooks/useDashboardData";
import { useNavigation } from "@react-navigation/native";
import { ResolveSheet, HelpCause } from "../components/ResolveSheet";

export function AlertsScreen() {
  const { colors } = useTheme();
  const { alerts: helpAlerts, dismissAlert: dismissHelp, resolveAlert, reload: reloadHelp } = useHelpAlert();
  // Acknowledged ("someone is responding") alerts drop out of the active list;
  // they remain unresolved server-side but no longer read as unhandled.
  const pendingHelp = helpAlerts.filter((a) => !a.dismissed && !a.acknowledged);
  const navigation = useNavigation();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await reloadHelp(); } finally { setRefreshing(false); }
  }, [reloadHelp]);

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
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
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

    historyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.xs,
    },
    historyLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flexWrap: "wrap",
    },
    historyTime: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
    },
    causePill: {
      backgroundColor: colors.coralSoft,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 3,
    },
    causePillCancelled: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 3,
    },
    causePillText: {
      fontSize: 11,
      color: colors.coral,
      ...fonts.medium,
    },
    causePillTextCancelled: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
    },
    historyNote: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.regular,
      lineHeight: 18,
    },
    viewAllBtn: {
      marginTop: spacing.sm,
      alignItems: "flex-end",
    },
    viewAllText: {
      fontSize: 13,
      color: colors.violet,
      ...fonts.medium,
    },
  }), [colors]);

  const totalAlerts = pendingHelp.length;

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
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.violet} />
        }
      >
        {/* ── Help Requests ── */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: colors.coral }]} />
            <Text style={[styles.sectionLabel, { color: colors.coral }]}>Help Requests</Text>
          </View>
          {pendingHelp.length === 0 ? (
            <EmptyState icon="hand-left" title="All clear" subtitle="No help requests from patients" />
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
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setResolvingId(alert.id);
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Mark help request as handled"
                >
                  <Text style={styles.helpDismissText}>Mark as handled</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ── Today's History ── */}
        {(() => {
          const today = new Date().toISOString().slice(0, 10);
          const todayHistory = helpAlerts.filter(
            (a) => (a.resolved || a.cancelled) && a.timestamp.slice(0, 10) === today
          );
          if (todayHistory.length === 0) return null;
          return (
            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <View style={[styles.sectionDot, { backgroundColor: colors.muted }]} />
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>Today's History</Text>
              </View>
              {todayHistory.map((alert) => (
                <View key={alert.id} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyTime}>{formatRelativeTime(alert.timestamp)}</Text>
                    {alert.cause && !alert.cancelled && (
                      <View style={styles.causePill}>
                        <Text style={styles.causePillText}>{alert.cause}</Text>
                      </View>
                    )}
                    {alert.cancelled && (
                      <View style={styles.causePillCancelled}>
                        <Text style={styles.causePillTextCancelled}>Cancelled</Text>
                      </View>
                    )}
                  </View>
                  {alert.note ? (
                    <Text style={styles.historyNote} numberOfLines={2}>{alert.note}</Text>
                  ) : null}
                </View>
              ))}
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => (navigation as any).navigate("HelpHistory")}
                activeOpacity={0.8}
              >
                <Text style={styles.viewAllText}>View All History →</Text>
              </TouchableOpacity>
            </View>
          );
        })()}
      </ScrollView>
      <ResolveSheet
        visible={resolvingId !== null}
        onResolve={async (cause: HelpCause, note: string) => {
          if (!resolvingId) return;
          try {
            await resolveAlert(resolvingId, cause, note || undefined);
          } catch {
            // silently fail — polling will reconcile
          }
          setResolvingId(null);
        }}
        onSkip={async () => {
          if (!resolvingId) return;
          try { await dismissHelp(resolvingId); } catch { /* ignore */ }
          setResolvingId(null);
        }}
        onCancel={() => setResolvingId(null)}
      />
    </View>
  );
}
