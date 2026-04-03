import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { StatChip } from "../components/StatChip";
import { TimelineItem } from "../components/TimelineItem";
import { spacing, fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";
import { DashboardStats, TimelineEvent } from "../types";

interface TimelineScreenProps {
  stats: DashboardStats;
  timeline: TimelineEvent[];
  loading: boolean;
  onRefresh: () => void;
}

export function TimelineScreen({
  stats,
  timeline,
  loading,
  onRefresh,
}: TimelineScreenProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingBottom: 100,
    },
    // Screen header
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },
    screenTitle: {
      fontSize: 28,
      color: colors.text,
      ...fonts.medium,
    },
    screenSubtitle: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 4,
    },
    statsStrip: {
      paddingVertical: spacing.md,
      backgroundColor: colors.bg,
    },
    statsContent: {
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    section: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    sectionLabel: {
      fontSize: 18,
      color: colors.text,
      ...fonts.medium,
      paddingVertical: spacing.sm,
      paddingBottom: spacing.md,
    },
    empty: {
      alignItems: "center",
      paddingVertical: 48,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 15,
      ...fonts.regular,
    },
  }), [colors]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={colors.violet}
        />
      }
    >
      {/* Screen Header */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Timeline</Text>
        <Text style={styles.screenSubtitle}>{new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</Text>
      </View>

      {/* Stats Strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsStrip}
        contentContainerStyle={styles.statsContent}
      >
        <StatChip
          value={stats.seenToday}
          label="Seen Today"
          color={colors.violet}
        />
        <StatChip
          value={stats.alertCount}
          label="Alerts"
          color={colors.subtext}
        />
        <StatChip
          value={stats.mostFrequent}
          label="Most Visits"
          color={colors.violet}
        />
        <StatChip
          value={stats.lastActivity}
          label="Last Activity"
          color={colors.subtext}
        />
      </ScrollView>

      {/* Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Today's Activity</Text>
        {timeline.length > 0 ? (
          timeline.map((event, idx) => (
            <TimelineItem key={`${event.type}-${event.time}-${idx}`} event={event} />
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No activity yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
