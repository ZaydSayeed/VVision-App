import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing, fonts } from "../config/theme";
import { TimelineEvent } from "../types";
import { formatTimeShort } from "../hooks/useDashboardData";

interface TimelineItemProps {
  event: TimelineEvent;
}

const iconConfig = {
  seen: { emoji: "👁️", bgColor: "rgba(52,211,153,0.12)" },
  interaction: { emoji: "💬", bgColor: "rgba(56,189,248,0.12)" },
  alert: { emoji: "⚠️", bgColor: "rgba(248,113,113,0.12)" },
};

export function TimelineItem({ event }: TimelineItemProps) {
  const config = iconConfig[event.type];

  return (
    <View style={styles.item}>
      <View style={[styles.icon, { backgroundColor: config.bgColor }]}>
        <Text style={styles.emoji}>{config.emoji}</Text>
      </View>
      <View style={styles.body}>
        {event.type === "alert" ? (
          <>
            <Text style={[styles.title, { color: colors.accentRed }]}>
              Unknown person detected
            </Text>
            <Text style={styles.subtitle}>Caregiver notification sent</Text>
          </>
        ) : event.type === "interaction" ? (
          <>
            <Text style={styles.title}>{event.name}</Text>
            <Text style={styles.subtitle}>{event.summary}</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>{event.name}</Text>
            <Text style={styles.subtitle}>
              {event.relation || "Recognized"} · Seen {event.count}x total
            </Text>
          </>
        )}
      </View>
      <Text style={styles.time}>{formatTimeShort(event.time)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: "flex-start",
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 16,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 14.5,
    color: colors.textPrimary,
    ...fonts.semibold,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  time: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
});
