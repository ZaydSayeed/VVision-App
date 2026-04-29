import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { spacing, fonts, radius } from "../../config/theme";
import {
  MOCK_GLASSES_ALERTS,
  GlassesAlert,
  AlertPriority,
  AlertType,
} from "../../data/glassesMockData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getPriorityLabel(p: AlertPriority): string {
  return { 4: "CRITICAL", 3: "HIGH", 2: "NORMAL", 1: "INFO" }[p];
}

function getAlertIcon(type: AlertType): keyof typeof Ionicons.glyphMap {
  const map: Record<AlertType, keyof typeof Ionicons.glyphMap> = {
    fall: "body",
    distress: "warning",
    medication: "medical",
    sundowning: "moon",
    visitor: "person-add",
    hydration: "water",
    wandering: "navigate",
    general: "glasses",
  };
  return map[type] ?? "glasses";
}

function usePriorityColors(priority: AlertPriority, colors: any) {
  return useMemo(() => {
    switch (priority) {
      case 4:
        return { border: colors.coral, icon: colors.coral, bg: colors.coralSoft, badge: "#D95F5F", badgeText: "#FFFFFF" };
      case 3:
        return { border: colors.amber, icon: colors.amber, bg: colors.amberSoft, badge: "#E8934A", badgeText: "#FFFFFF" };
      case 2:
        return { border: colors.violet, icon: colors.violet, bg: colors.violet50, badge: colors.violet, badgeText: "#FFFFFF" };
      default:
        return { border: colors.border, icon: colors.muted, bg: colors.surface, badge: colors.surface, badgeText: colors.muted };
    }
  }, [priority, colors]);
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ alert, onAcknowledge, onDismiss }: {
  alert: GlassesAlert;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { colors } = useTheme();
  const pc = usePriorityColors(alert.priority, colors);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: pc.border,
      shadowColor: pc.border,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 3,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: pc.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    meta: { flex: 1 },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: 4,
    },
    badge: {
      backgroundColor: pc.badge,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: {
      fontSize: 10,
      ...fonts.medium,
      color: pc.badgeText,
      letterSpacing: 0.8,
    },
    ackedBadge: {
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ackedText: { fontSize: 10, ...fonts.regular, color: colors.muted },
    message: {
      fontSize: 15,
      color: colors.text,
      ...fonts.regular,
      lineHeight: 21,
    },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    timeText: { fontSize: 12, color: colors.muted, ...fonts.regular },
    divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.md },
    actions: { flexDirection: "row", gap: spacing.sm },
    btnPrimary: {
      flex: 1,
      backgroundColor: pc.border,
      borderRadius: radius.pill,
      paddingVertical: 11,
      alignItems: "center",
    },
    btnPrimaryText: { fontSize: 14, color: "#FFFFFF", ...fonts.medium },
    btnSecondary: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingVertical: 11,
      alignItems: "center",
    },
    btnSecondaryText: { fontSize: 14, color: colors.muted, ...fonts.regular },
  }), [colors, pc]);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.iconCircle}>
            <Ionicons name={getAlertIcon(alert.alert_type)} size={22} color={pc.icon} />
          </View>
          <View style={styles.meta}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{getPriorityLabel(alert.priority)}</Text>
              </View>
              {alert.acknowledged && (
                <View style={styles.ackedBadge}>
                  <Text style={styles.ackedText}>Acknowledged</Text>
                </View>
              )}
            </View>
            <Text style={styles.message}>{alert.message}</Text>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={11} color={colors.muted} />
              <Text style={styles.timeText}>{formatRelative(alert.timestamp)}</Text>
            </View>
          </View>
        </View>

        {(alert.priority >= 3 && !alert.acknowledged) && (
          <>
            <View style={styles.divider} />
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onAcknowledge(alert._id);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>I'm on my way</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => onDismiss(alert._id)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnSecondaryText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {(alert.priority < 3 || alert.acknowledged) && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity
              style={[styles.btnSecondary, { flex: undefined }]}
              onPress={() => onDismiss(alert._id)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnSecondaryText}>Dismiss</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function GlassesAlertFeedScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const [alerts, setAlerts] = useState<GlassesAlert[]>(MOCK_GLASSES_ALERTS.filter((a) => !a.dismissed));
  const [refreshing, setRefreshing] = useState(false);

  const critical = alerts.filter((a) => a.priority === 4 && !a.dismissed);
  const rest = alerts.filter((a) => a.priority < 4 && !a.dismissed);

  const handleAcknowledge = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => a._id === id ? { ...a, acknowledged: true, acknowledged_at: new Date().toISOString() } : a)
    );
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a._id !== id));
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    headerTitle: { fontSize: 24, color: colors.text, ...fonts.medium, flex: 1 },
    countPill: {
      backgroundColor: colors.coral,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    countText: { fontSize: 12, color: "#FFFFFF", ...fonts.medium },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
      marginTop: spacing.md,
    },
    sectionDot: { width: 8, height: 8, borderRadius: 4 },
    sectionLabel: {
      fontSize: 11,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    emptyWrap: {
      alignItems: "center",
      paddingVertical: 56,
      gap: spacing.md,
    },
    emptyIcon: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    emptyTitle: { fontSize: 16, color: colors.text, ...fonts.medium },
    emptySubtitle: { fontSize: 13, color: colors.muted, ...fonts.regular },
    liveChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.sageSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sage },
    liveText: { fontSize: 11, color: colors.sage, ...fonts.medium },
    subheader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    subtext: { fontSize: 13, color: colors.muted, ...fonts.regular },
  }), [colors]);

  const totalActive = alerts.filter((a) => !a.dismissed).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Glasses Alerts</Text>
        {totalActive > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{totalActive}</Text>
          </View>
        )}
      </View>

      <View style={styles.subheader}>
        <Text style={styles.subtext}>
          {totalActive === 0 ? "All clear" : `${totalActive} active alert${totalActive !== 1 ? "s" : ""}`}
        </Text>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {totalActive === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="glasses-outline" size={28} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>All clear</Text>
          <Text style={styles.emptySubtitle}>No active alerts from the glasses</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.violet} />
          }
        >
          {critical.length > 0 && (
            <>
              <View style={styles.sectionRow}>
                <View style={[styles.sectionDot, { backgroundColor: colors.coral }]} />
                <Text style={[styles.sectionLabel, { color: colors.coral }]}>Critical — Pinned</Text>
              </View>
              {critical.map((a) => (
                <AlertCard key={a._id} alert={a} onAcknowledge={handleAcknowledge} onDismiss={handleDismiss} />
              ))}
            </>
          )}

          {rest.length > 0 && (
            <>
              <View style={styles.sectionRow}>
                <View style={[styles.sectionDot, { backgroundColor: colors.muted }]} />
                <Text style={[styles.sectionLabel, { color: colors.muted }]}>Other Alerts</Text>
              </View>
              {rest.map((a) => (
                <AlertCard key={a._id} alert={a} onAcknowledge={handleAcknowledge} onDismiss={handleDismiss} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
