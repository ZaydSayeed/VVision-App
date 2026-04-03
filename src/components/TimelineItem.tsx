import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";
import { TimelineEvent } from "../types";
import { formatTimeShort } from "../hooks/useDashboardData";

interface TimelineItemProps {
  event: TimelineEvent;
}

export function TimelineItem({ event }: TimelineItemProps) {
  const { colors } = useTheme();

  const iconConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; bgColor: string }> = {
    seen: { icon: "eye-outline", bgColor: colors.violet50 },
    interaction: { icon: "chatbubble-outline", bgColor: colors.violet50 },
    alert: { icon: "warning-outline", bgColor: colors.violet100 },
  };

  const config = iconConfig[event.type];

  const styles = useMemo(() => StyleSheet.create({
    item: {
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.lg,
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      marginBottom: spacing.sm,
      alignItems: "flex-start",
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
      marginBottom: 3,
    },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
    },
    time: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
      ...fonts.regular,
    },
  }), [colors]);

  return (
    <View style={styles.item}>
      <View style={[styles.icon, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={16} color={colors.violet} />
      </View>
      <View style={styles.body}>
        {event.type === "alert" ? (
          <>
            <Text style={[styles.title, { color: colors.violet }]}>
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
