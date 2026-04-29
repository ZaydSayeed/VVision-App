import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { spacing, fonts, radius } from "../../config/theme";
import { MOCK_NUTRITION_EVENTS, NutritionEvent } from "../../data/glassesMockData";

const SCREEN_W = Dimensions.get("window").width;
const TIMELINE_PADDING = spacing.xl * 2;
const TIMELINE_W = SCREEN_W - TIMELINE_PADDING;
const HOUR_START = 6;
const HOUR_END = 22;
const HOUR_SPAN = HOUR_END - HOUR_START;

function hourToX(hour: number, min: number = 0): number {
  const frac = (hour + min / 60 - HOUR_START) / HOUR_SPAN;
  return Math.max(0, Math.min(1, frac)) * TIMELINE_W;
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

const HOUR_MARKS = [6, 9, 12, 15, 18, 21];

interface Props {
  onBack: () => void;
}

export default function NutritionTimelineScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const [events] = useState<NutritionEvent[]>(MOCK_NUTRITION_EVENTS);

  const eating = events.filter((e) => e.type === "eating");
  const drinking = events.filter((e) => e.type === "drinking");

  // Gap detection: flag if no eating for 6+ contiguous hours between 8–20
  const gapZones = useMemo(() => {
    const zones: Array<{ start: number; end: number }> = [];
    const eatTimes = eating.map((e) => ({
      start: e.start_hour + e.start_min / 60,
      end: e.start_hour + e.start_min / 60 + (e.duration_min ?? 20) / 60,
    }));
    for (let h = 8; h < 20; h++) {
      const covered = eatTimes.some((t) => t.start <= h + 5 && t.end >= h);
      if (!covered) {
        const prev = zones[zones.length - 1];
        if (prev && prev.end === h) {
          prev.end = h + 1;
        } else {
          zones.push({ start: h, end: h + 1 });
        }
      }
    }
    return zones.filter((z) => z.end - z.start >= 6);
  }, [eating]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.md,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    headerMeta: { flex: 1 },
    headerTitle: { fontSize: 24, color: colors.text, ...fonts.medium },
    headerSub: { fontSize: 13, color: colors.muted, ...fonts.regular, marginTop: 2 },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.sm,
    },

    // Timeline canvas
    timelineWrap: { position: "relative", height: 80, marginTop: spacing.sm },
    track: {
      position: "absolute",
      top: 20,
      left: 0,
      right: 0,
      height: 8,
      backgroundColor: colors.border,
      borderRadius: radius.pill,
    },
    eatSegment: {
      position: "absolute",
      top: 20,
      height: 8,
      backgroundColor: colors.sage,
      borderRadius: radius.pill,
    },
    gapZone: {
      position: "absolute",
      top: 16,
      height: 16,
      backgroundColor: colors.amberSoft,
      borderRadius: 4,
    },
    drinkTick: {
      position: "absolute",
      top: 12,
      width: 3,
      height: 20,
      backgroundColor: colors.violet,
      borderRadius: 2,
    },
    hourLabel: {
      position: "absolute",
      top: 44,
      fontSize: 10,
      color: colors.muted,
      ...fonts.regular,
      transform: [{ translateX: -10 }],
    },

    legend: {
      flexDirection: "row",
      gap: spacing.xl,
      marginTop: spacing.md,
      flexWrap: "wrap",
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendDot: { width: 12, height: 12, borderRadius: 3 },
    legendText: { fontSize: 12, color: colors.muted, ...fonts.regular },

    // Event list
    sectionLabel: {
      fontSize: 11,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: colors.muted,
      marginTop: spacing.xl,
      marginBottom: spacing.md,
    },
    eventRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    eventDot: { width: 10, height: 10, borderRadius: 5 },
    eventTime: { fontSize: 14, color: colors.text, ...fonts.medium, width: 64 },
    eventLabel: { flex: 1, fontSize: 14, color: colors.muted, ...fonts.regular },
    eventDuration: { fontSize: 12, color: colors.muted, ...fonts.regular },

    // Stats strip
    statsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: "center",
    },
    statNum: { fontSize: 26, color: colors.text, ...fonts.medium },
    statLabel: {
      fontSize: 10,
      color: colors.muted,
      ...fonts.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginTop: 2,
      textAlign: "center",
    },

    warnCard: {
      backgroundColor: colors.amberSoft,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    warnText: { flex: 1, fontSize: 13, color: colors.amber, ...fonts.regular, lineHeight: 18 },
  }), [colors]);

  function padTime(h: number, m: number = 0): string {
    const ampm = h < 12 ? "AM" : "PM";
    const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Nutrition</Text>
          <Text style={styles.headerSub}>Today's eating & hydration</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{eating.length}</Text>
            <Text style={styles.statLabel}>Meals observed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{drinking.length}</Text>
            <Text style={styles.statLabel}>Hydration events</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, gapZones.length > 0 && { color: colors.amber }]}>
              {gapZones.length}
            </Text>
            <Text style={styles.statLabel}>Gap warnings</Text>
          </View>
        </View>

        {/* Gap warning */}
        {gapZones.length > 0 && (
          <View style={styles.warnCard}>
            <Ionicons name="warning" size={18} color={colors.amber} />
            <Text style={styles.warnText}>
              Long gap detected — no eating observed for 6+ hours between {formatHour(gapZones[0].start)} and {formatHour(gapZones[0].end)}.
            </Text>
          </View>
        )}

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={{ fontSize: 13, color: colors.muted, ...fonts.regular, marginBottom: 4 }}>
            Timeline — 6 AM to 10 PM
          </Text>

          <View style={styles.timelineWrap}>
            {/* Base track */}
            <View style={styles.track} />

            {/* Gap zones */}
            {gapZones.map((z, i) => (
              <View
                key={i}
                style={[
                  styles.gapZone,
                  {
                    left: hourToX(z.start),
                    width: hourToX(z.end) - hourToX(z.start),
                  },
                ]}
              />
            ))}

            {/* Eating segments */}
            {eating.map((e, i) => {
              const x = hourToX(e.start_hour, e.start_min);
              const w = ((e.duration_min ?? 20) / 60 / HOUR_SPAN) * TIMELINE_W;
              return (
                <View
                  key={i}
                  style={[styles.eatSegment, { left: x, width: Math.max(6, w) }]}
                />
              );
            })}

            {/* Drinking ticks */}
            {drinking.map((e, i) => (
              <View
                key={i}
                style={[styles.drinkTick, { left: hourToX(e.start_hour, e.start_min) - 1.5 }]}
              />
            ))}

            {/* Hour marks */}
            {HOUR_MARKS.map((h) => (
              <Text key={h} style={[styles.hourLabel, { left: hourToX(h) }]}>
                {formatHour(h)}
              </Text>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.sage }]} />
              <Text style={styles.legendText}>Eating</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.violet, borderRadius: 999 }]} />
              <Text style={styles.legendText}>Drinking</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: colors.amber }]} />
              <Text style={styles.legendText}>Gap warning</Text>
            </View>
          </View>
        </View>

        {/* Event list */}
        <Text style={styles.sectionLabel}>Eating Events</Text>
        {eating.length === 0 ? (
          <Text style={{ fontSize: 14, color: colors.muted, ...fonts.regular }}>No eating detected today</Text>
        ) : (
          eating.map((e, i) => (
            <View key={i} style={[styles.eventRow, i === eating.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.eventDot, { backgroundColor: colors.sage }]} />
              <Text style={styles.eventTime}>{padTime(e.start_hour, e.start_min)}</Text>
              <Text style={styles.eventLabel}>Meal observed</Text>
              {e.duration_min && <Text style={styles.eventDuration}>{e.duration_min}m</Text>}
            </View>
          ))
        )}

        <Text style={styles.sectionLabel}>Hydration Events</Text>
        {drinking.length === 0 ? (
          <Text style={{ fontSize: 14, color: colors.muted, ...fonts.regular }}>No drinking detected today</Text>
        ) : (
          drinking.map((e, i) => (
            <View key={i} style={[styles.eventRow, i === drinking.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[styles.eventDot, { backgroundColor: colors.violet, borderRadius: 999 }]} />
              <Text style={styles.eventTime}>{padTime(e.start_hour, e.start_min)}</Text>
              <Text style={styles.eventLabel}>Drinking observed</Text>
            </View>
          ))
        )}

      </ScrollView>
    </View>
  );
}
