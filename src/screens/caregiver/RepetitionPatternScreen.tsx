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
import { MOCK_REPETITION_WEEK, RepetitionDay } from "../../data/glassesMockData";

const SCREEN_W = Dimensions.get("window").width;
const GRID_PADDING = spacing.xl * 2 + spacing.md;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
const HOUR_LABELS = ["8a", "10a", "12p", "2p", "4p", "6p", "8p"];
const HOURS = [8, 10, 12, 14, 16, 18, 20];
const CELL_COUNT = 7;
const LABEL_W = 36;
const CELL_W = Math.floor((SCREEN_W - GRID_PADDING - LABEL_W) / CELL_COUNT);

function getIntensity(entries: RepetitionDay["entries"], hour: number): number {
  const total = entries.filter((e) => e.hour >= hour && e.hour < hour + 2).reduce((s, e) => s + e.count, 0);
  if (total === 0) return 0;
  if (total <= 2) return 0.25;
  if (total <= 4) return 0.55;
  return 1;
}

function HeatCell({ intensity, color }: { intensity: number; color: string }) {
  if (intensity === 0) {
    return <View style={{ width: CELL_W - 4, height: CELL_W - 4, borderRadius: 4 }} />;
  }
  return (
    <View
      style={{
        width: CELL_W - 4,
        height: CELL_W - 4,
        borderRadius: 4,
        backgroundColor: color,
        opacity: intensity,
      }}
    />
  );
}

interface Props {
  onBack: () => void;
}

export default function RepetitionPatternScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const [week] = useState<RepetitionDay[]>(MOCK_REPETITION_WEEK);
  const [selectedDayIdx, setSelectedDayIdx] = useState(week.length - 1);

  const selectedDay = week[selectedDayIdx];
  const sortedPhrases = useMemo(
    () => [...(selectedDay?.entries ?? [])].sort((a, b) => b.count - a.count),
    [selectedDay]
  );

  const maxCount = useMemo(
    () => Math.max(...week.flatMap((d) => d.entries.map((e) => e.count)), 1),
    [week]
  );

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
    cardTitle: { fontSize: 13, color: colors.muted, ...fonts.regular, marginBottom: spacing.md },

    // Heatmap grid
    gridWrap: {},
    gridRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    hourLabel: {
      width: LABEL_W,
      fontSize: 10,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "right",
      paddingRight: 6,
    },
    cells: { flexDirection: "row", gap: 4 },

    // Day header row
    dayRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
    },
    dayLabelSpacer: { width: LABEL_W },
    dayLabel: {
      width: CELL_W,
      fontSize: 9,
      color: colors.muted,
      ...fonts.medium,
      textAlign: "center",
      letterSpacing: 0.3,
    },
    dayLabelActive: { color: colors.violet },

    // Legend
    legend: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    legendLabel: { fontSize: 10, color: colors.muted, ...fonts.regular },
    legendGradient: { flexDirection: "row", gap: 3 },
    legendCell: { width: 14, height: 14, borderRadius: 3 },

    // Day selector tabs
    dayTabs: {
      flexDirection: "row",
      gap: spacing.xs,
      marginBottom: spacing.md,
      flexWrap: "wrap",
    },
    dayTab: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
    dayTabActive: { backgroundColor: colors.violet },
    dayTabText: { fontSize: 12, color: colors.muted, ...fonts.medium },
    dayTabTextActive: { color: "#FFFFFF" },

    // Phrase list
    sectionLabel: {
      fontSize: 11,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: colors.muted,
      marginTop: spacing.xl,
      marginBottom: spacing.md,
    },
    phraseCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
    },
    phraseTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: 8,
    },
    phraseText: { flex: 1, fontSize: 15, color: colors.text, ...fonts.regular, fontStyle: "italic" },
    countBadge: {
      backgroundColor: colors.amberSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    countText: { fontSize: 13, color: colors.amber, ...fonts.medium },
    barTrack: { height: 5, backgroundColor: colors.border, borderRadius: radius.pill, overflow: "hidden" },
    barFill: { height: 5, borderRadius: radius.pill, backgroundColor: colors.amber },
    timeText: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 4 },

    emptyWrap: { alignItems: "center", paddingVertical: 40, gap: spacing.sm },
    emptyText: { fontSize: 14, color: colors.muted, ...fonts.regular },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Repetitions</Text>
          <Text style={styles.headerSub}>Weekly patterns of repeated questions</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Heatmap */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity by time of day — this week</Text>

          {/* Day labels */}
          <View style={styles.dayRow}>
            <View style={styles.dayLabelSpacer} />
            {week.map((d, i) => (
              <Text
                key={i}
                style={[styles.dayLabel, i === selectedDayIdx && styles.dayLabelActive]}
              >
                {d.label}
              </Text>
            ))}
          </View>

          {/* Grid rows */}
          {HOURS.map((h, hi) => (
            <View key={h} style={styles.gridRow}>
              <Text style={styles.hourLabel}>{HOUR_LABELS[hi]}</Text>
              <View style={styles.cells}>
                {week.map((day, di) => {
                  const intensity = getIntensity(day.entries, h);
                  return (
                    <TouchableOpacity
                      key={di}
                      onPress={() => setSelectedDayIdx(di)}
                      activeOpacity={0.7}
                    >
                      <HeatCell intensity={intensity} color={colors.amber} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendLabel}>Less</Text>
            <View style={styles.legendGradient}>
              {[0.15, 0.35, 0.55, 0.75, 1].map((op, i) => (
                <View key={i} style={[styles.legendCell, { backgroundColor: colors.amber, opacity: op }]} />
              ))}
            </View>
            <Text style={styles.legendLabel}>More</Text>
          </View>
        </View>

        {/* Day selector */}
        <View style={styles.dayTabs}>
          {week.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.dayTab, i === selectedDayIdx && styles.dayTabActive]}
              onPress={() => setSelectedDayIdx(i)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayTabText, i === selectedDayIdx && styles.dayTabTextActive]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phrase list for selected day */}
        <Text style={styles.sectionLabel}>
          {selectedDay?.label === "Today" ? "Today" : selectedDay?.label} — Repeated Phrases
        </Text>

        {sortedPhrases.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubble-outline" size={28} color={colors.muted} />
            <Text style={styles.emptyText}>No repetitions recorded</Text>
          </View>
        ) : (
          sortedPhrases.map((p, i) => (
            <View key={i} style={styles.phraseCard}>
              <View style={styles.phraseTop}>
                <Text style={styles.phraseText}>{p.phrase}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{p.count}×</Text>
                </View>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(p.count / maxCount) * 100}%` }]} />
              </View>
              <Text style={styles.timeText}>Around {p.hour < 12 ? `${p.hour}:00 AM` : `${p.hour - 12}:00 PM`}</Text>
            </View>
          ))
        )}

      </ScrollView>
    </View>
  );
}
