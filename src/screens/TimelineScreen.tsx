import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import PatternsCard from "../components/PatternsCard";
import OnboardingReminderBanner from "../components/OnboardingReminderBanner";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fonts, radius, shadow } from "../config/theme";
import { useTheme } from "../context/ThemeContext";
import { DashboardStats, TimelineEvent } from "../types";
import { formatTimeShort } from "../hooks/useDashboardData";

interface TimelineScreenProps {
  stats: DashboardStats;
  timeline: TimelineEvent[];
  loading: boolean;
  onRefresh: () => void;
}

function getEventStyle(type: string, colors: any) {
  switch (type) {
    case "seen":
      return {
        borderColor: colors.sage,
        iconName: "eye" as keyof typeof Ionicons.glyphMap,
        iconColor: colors.sage,
        iconBg: colors.sageSoft,
      };
    case "alert":
      return {
        borderColor: colors.coral,
        iconName: "scan-circle" as keyof typeof Ionicons.glyphMap,
        iconColor: colors.coral,
        iconBg: colors.coralSoft,
      };
    case "interaction":
    default:
      return {
        borderColor: colors.violet,
        iconName: "chatbubble" as keyof typeof Ionicons.glyphMap,
        iconColor: colors.violet,
        iconBg: colors.violet50,
      };
  }
}

function getEventTitle(event: TimelineEvent): string {
  if (event.type === "alert") return "Unrecognized face detected";
  if (event.type === "seen") return event.name || "Someone recognized";
  return event.name || "Activity";
}

function getEventSubtitle(event: TimelineEvent): string {
  if (event.type === "alert") return "AI alert · Glasses detected an unknown person";
  if (event.type === "seen") return `${event.relation || "Contact"} · Seen ${event.count ?? 1}x today`;
  return event.summary || "Interaction recorded";
}

export function TimelineScreen({ stats, timeline, loading, onRefresh }: TimelineScreenProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const todayLabel = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingBottom: 100 },

    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    eyebrow: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      marginBottom: spacing.xs,
    },
    screenTitle: {
      fontSize: 30,
      color: colors.text,
      ...fonts.medium,
      lineHeight: 36,
    },
    dateLabel: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 4,
    },

    statStrip: {
      marginHorizontal: spacing.xl,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      flexDirection: "row",
      marginBottom: spacing.xxl,
      overflow: "hidden",
    },
    statCell: {
      flex: 1,
      paddingVertical: spacing.xl,
      alignItems: "center",
      justifyContent: "center",
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    statValue: {
      fontSize: 30,
      color: colors.text,
      ...fonts.medium,
      lineHeight: 34,
    },
    statLabel: {
      fontSize: 10,
      color: colors.muted,
      ...fonts.medium,
      textTransform: "uppercase",
      letterSpacing: 0.9,
      marginTop: 4,
      textAlign: "center",
    },

    timelineSection: { paddingHorizontal: spacing.xl },
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
      backgroundColor: colors.violet,
    },
    sectionLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },

    eventCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      flexDirection: "row",
      gap: spacing.md,
      alignItems: "flex-start",
      borderLeftWidth: 4,
      ...shadow.sm,
    },
    eventIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    eventBody: { flex: 1 },
    eventTitle: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
      marginBottom: 3,
    },
    eventSubtitle: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      lineHeight: 18,
    },
    eventTime: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.regular,
    },

    empty: {
      alignItems: "center",
      paddingVertical: 48,
      gap: spacing.sm,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 15,
      ...fonts.regular,
    },
    emptySubtext: {
      color: colors.muted,
      fontSize: 13,
      ...fonts.regular,
      opacity: 0.6,
    },
  }), [colors]);

  const renderHeader = () => (
    <>
      <OnboardingReminderBanner navigation={navigation} />
      <View style={styles.screenHeader}>
        <Text style={styles.eyebrow}>Command Center</Text>
        <Text style={styles.screenTitle} accessibilityRole="header">Today at a Glance</Text>
        <Text style={styles.dateLabel}>{todayLabel}</Text>
      </View>

      <View
        style={styles.statStrip}
        accessibilityLabel={`Stats: ${stats.seenToday ?? 0} seen today, ${stats.alertCount ?? 0} alerts, most visits by ${stats.mostFrequent || "nobody"}`}
      >
        <View style={styles.statCell} accessibilityElementsHidden>
          <Text style={styles.statValue}>{stats.seenToday ?? 0}</Text>
          <Text style={styles.statLabel}>Seen Today</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell} accessibilityElementsHidden>
          <Text style={[styles.statValue, stats.alertCount > 0 && { color: colors.coral }]}>
            {stats.alertCount ?? 0}
          </Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell} accessibilityElementsHidden>
          <Text style={[styles.statValue, { fontSize: 18, lineHeight: 22, paddingHorizontal: 4 }]} numberOfLines={1}>
            {stats.mostFrequent || "—"}
          </Text>
          <Text style={styles.statLabel}>Most Visits</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => navigation.navigate("CheckIn")}
        style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: "#6366f1", padding: 16, borderRadius: radius.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        activeOpacity={0.85}
      >
        <Ionicons name="mic" size={18} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Check In</Text>
      </TouchableOpacity>

      {/* Glasses Dashboard shortcut */}
      <TouchableOpacity
        onPress={() => navigation.navigate("GlassesHub")}
        style={{
          marginHorizontal: 20, marginBottom: 16,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        activeOpacity={0.82}
      >
        <Ionicons name="glasses" size={20} color={colors.violet} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, color: colors.text, ...fonts.medium }}>Glasses Dashboard</Text>
          <Text style={{ fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 }}>Alerts, digest, nutrition, patterns</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </TouchableOpacity>

      <View style={{ marginHorizontal: 20 }}>
        <PatternsCard />
      </View>

      <View style={styles.timelineSection}>
        <View style={styles.sectionLabelRow}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionLabel}>Today's Activity</Text>
        </View>
      </View>
    </>
  );

  const renderEmpty = () => (
    <View style={[styles.timelineSection, styles.empty]}>
      <View style={styles.emptyIcon}>
        <Ionicons name="time-outline" size={24} color={colors.muted} />
      </View>
      <Text style={styles.emptyText}>No activity yet</Text>
      <Text style={styles.emptySubtext}>Events will appear as the day unfolds</Text>
    </View>
  );

  const renderItem = useCallback(({ item: event, index }: { item: TimelineEvent; index: number }) => {
    const style = getEventStyle(event.type, colors);
    const title = getEventTitle(event);
    const subtitle = getEventSubtitle(event);
    const time = formatTimeShort(event.time);
    return (
      <View
        style={[styles.timelineSection, { paddingBottom: 0 }]}
        key={`${event.type}-${event.time}-${index}`}
      >
        <View
          style={[styles.eventCard, { borderLeftColor: style.borderColor }]}
          accessibilityLabel={`${title}, ${subtitle}${time ? `, at ${time}` : ""}`}
        >
          <View style={[styles.eventIconCircle, { backgroundColor: style.iconBg }]}>
            <Ionicons name={style.iconName} size={18} color={style.iconColor} />
          </View>
          <View style={styles.eventBody}>
            <Text style={styles.eventTitle}>{title}</Text>
            <Text style={styles.eventSubtitle}>{subtitle}</Text>
          </View>
          <Text style={styles.eventTime}>{time}</Text>
        </View>
      </View>
    );
  }, [colors, styles]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={timeline}
      keyExtractor={(item, index) => `${item.type}-${item.time}-${index}`}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.violet} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
