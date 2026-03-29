import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { StatChip } from "../components/StatChip";
import { TimelineItem } from "../components/TimelineItem";
import { colors, spacing, fonts } from "../config/theme";
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
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={colors.accentBlue}
        />
      }
    >
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
          color={colors.accentBlue}
        />
        <StatChip
          value={stats.alertCount}
          label="Alerts"
          color={colors.accentRed}
        />
        <StatChip
          value={stats.mostFrequent}
          label="Most Visits"
          color={colors.accentGreen}
        />
        <StatChip
          value={stats.lastActivity}
          label="Last Activity"
          color={colors.accentPurple}
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
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No activity yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    paddingBottom: 100,
  },
  statsStrip: {
    paddingVertical: 14,
  },
  statsContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.xl,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    ...fonts.bold,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    opacity: 0.5,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
