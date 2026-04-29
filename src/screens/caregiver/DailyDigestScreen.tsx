import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { spacing, fonts, radius } from "../../config/theme";
import { MOCK_DAILY_DIGEST, DailyDigest } from "../../data/glassesMockData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.07)", borderRadius: 999, overflow: "hidden", flex: 1 }}>
      <View style={{ height: 6, borderRadius: 999, backgroundColor: color, width: `${Math.round(score * 100)}%` }} />
    </View>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Section({ title, icon, iconColor, iconBg, children, warning }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  children: React.ReactNode;
  warning?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.sm,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    iconWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: iconBg,
      alignItems: "center", justifyContent: "center",
    },
    titleText: { flex: 1, fontSize: 15, color: colors.text, ...fonts.medium },
    warnDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  }), [colors, iconBg]);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.titleText}>{title}</Text>
        {warning && <View style={styles.warnDot} />}
      </View>
      {children}
    </View>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function DigestRow({ label, value, ok, warn }: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
}) {
  const { colors } = useTheme();
  const accent = ok ? colors.sage : warn ? colors.amber : colors.muted;
  const icon: keyof typeof Ionicons.glyphMap = ok ? "checkmark-circle" : warn ? "alert-circle" : "remove-circle-outline";

  const styles = useMemo(() => StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: 6,
    },
    label: { flex: 1, fontSize: 14, color: colors.text, ...fonts.regular },
    value: { fontSize: 13, color: colors.muted, ...fonts.regular },
  }), [colors]);

  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={accent} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function DailyDigestScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const [digest] = useState<DailyDigest>(MOCK_DAILY_DIGEST);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
      gap: spacing.md,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    headerMeta: { flex: 1 },
    headerTitle: { fontSize: 24, color: colors.text, ...fonts.medium },
    headerDate: { fontSize: 13, color: colors.muted, ...fonts.regular, marginTop: 2 },
    warnPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.amberSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    warnText: { fontSize: 12, color: colors.amber, ...fonts.medium },
    content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 100 },

    // Mood card
    moodCard: {
      backgroundColor: colors.violet50,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    moodIconWrap: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.violet100,
      alignItems: "center", justifyContent: "center",
    },
    moodText: { flex: 1, fontSize: 14, color: colors.subtext, ...fonts.regular, lineHeight: 20 },

    // Repetition phrase
    phraseRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 7,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    phraseText: { flex: 1, fontSize: 14, color: colors.text, ...fonts.regular, fontStyle: "italic" },
    phraseCount: {
      backgroundColor: colors.amberSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    phraseCountText: { fontSize: 12, color: colors.amber, ...fonts.medium },
    phraseTime: { fontSize: 12, color: colors.muted, ...fonts.regular },

    // Sundowning bar row
    scoreRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: 6,
    },
    scoreLabel: { fontSize: 13, color: colors.muted, ...fonts.regular, width: 70 },
    scoreValue: { fontSize: 13, color: colors.text, ...fonts.medium, width: 36, textAlign: "right" },

    // visitor row
    visitorRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 7,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    visitorAvatar: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.violet100,
      alignItems: "center", justifyContent: "center",
    },
    visitorInitial: { fontSize: 14, color: colors.violet, ...fonts.medium },
    visitorName: { flex: 1, fontSize: 14, color: colors.text, ...fonts.medium },
    visitorMeta: { fontSize: 12, color: colors.muted, ...fonts.regular },
  }), [colors]);

  const hasSundowningWarning = (digest.sundowning.peak_score ?? 0) > 0.5;
  const hasMedWarning = digest.medications.some((m) => !m.confirmed);
  const hasNutritionWarning = digest.meals.some((m) => !m.observed);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Daily Digest</Text>
          <Text style={styles.headerDate}>{formatDate(digest.date)}</Text>
        </View>
        {digest.warnings > 0 && (
          <View style={styles.warnPill}>
            <Ionicons name="warning" size={12} color={colors.amber} />
            <Text style={styles.warnText}>{digest.warnings} warnings</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Mood */}
        <View style={styles.moodCard}>
          <View style={styles.moodIconWrap}>
            <Ionicons name="heart" size={20} color={colors.violet} />
          </View>
          <Text style={styles.moodText}>{digest.mood}</Text>
        </View>

        {/* Visitors */}
        <Section title="Visitors" icon="people" iconColor={colors.violet} iconBg={colors.violet50}>
          {digest.visitors.length === 0 ? (
            <DigestRow label="No visitors today" value="" />
          ) : (
            digest.visitors.map((v, i) => (
              <View key={i} style={[styles.visitorRow, i === digest.visitors.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.visitorAvatar}>
                  <Text style={styles.visitorInitial}>{v.name[0]}</Text>
                </View>
                <Text style={styles.visitorName}>{v.name}</Text>
                <Text style={styles.visitorMeta}>{v.arrival}{v.departure ? ` – ${v.departure}` : " · Still here"}</Text>
              </View>
            ))
          )}
        </Section>

        {/* Meals & Hydration */}
        <Section
          title="Meals & Hydration"
          icon="restaurant"
          iconColor={colors.sage}
          iconBg={colors.sageSoft}
          warning={hasNutritionWarning}
        >
          {digest.meals.map((m, i) => (
            <DigestRow
              key={i}
              label={m.label}
              value={m.observed ? (m.time ?? "Observed") : "Not observed"}
              ok={m.observed}
              warn={!m.observed}
            />
          ))}
          <DigestRow label="Hydration events" value={`${digest.hydration_events} recorded`} ok={digest.hydration_events >= 3} warn={digest.hydration_events < 2} />
        </Section>

        {/* Sleep */}
        <Section title="Sleep" icon="moon" iconColor={colors.violet} iconBg={colors.violet50}>
          {digest.sleep.wake_time && (
            <DigestRow label="Awake by" value={digest.sleep.wake_time} ok />
          )}
          {digest.sleep.nap ? (
            <DigestRow label="Nap" value={`${digest.sleep.nap.start} – ${digest.sleep.nap.end}`} ok />
          ) : (
            <DigestRow label="No nap detected" value="" />
          )}
        </Section>

        {/* Safety */}
        <Section title="Safety" icon="shield-checkmark" iconColor={colors.sage} iconBg={colors.sageSoft}>
          <DigestRow label="Falls" value={digest.safety.falls === 0 ? "None" : `${digest.safety.falls} detected`} ok={digest.safety.falls === 0} warn={digest.safety.falls > 0} />
          <DigestRow label="Wandering" value={digest.safety.wandering ? "Detected" : "None"} ok={!digest.safety.wandering} warn={digest.safety.wandering} />
          <DigestRow
            label="Confusion episodes"
            value={digest.safety.confusion_episodes === 0 ? "None" : `${digest.safety.confusion_episodes} (${digest.safety.confusion_times.join(", ")})`}
            ok={digest.safety.confusion_episodes === 0}
            warn={digest.safety.confusion_episodes > 0}
          />
        </Section>

        {/* Sundowning */}
        {digest.sundowning.active_window && (
          <Section title="Sundowning" icon="partly-sunny" iconColor={colors.amber} iconBg={colors.amberSoft} warning={hasSundowningWarning}>
            <DigestRow label="Active window" value={digest.sundowning.active_window} />
            {digest.sundowning.peak_time && (
              <DigestRow label="Peak agitation" value={digest.sundowning.peak_time} warn={hasSundowningWarning} />
            )}
            {digest.sundowning.peak_score != null && (
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Intensity</Text>
                <ScoreBar score={digest.sundowning.peak_score} color={colors.amber} />
                <Text style={styles.scoreValue}>{Math.round(digest.sundowning.peak_score * 100)}%</Text>
              </View>
            )}
          </Section>
        )}

        {/* Medications */}
        <Section title="Medications" icon="medical" iconColor={colors.coral} iconBg={colors.coralSoft} warning={hasMedWarning}>
          {digest.medications.map((m, i) => (
            <DigestRow key={i} label={`${m.time} — ${m.label}`} value={m.confirmed ? "Confirmed" : "Unconfirmed"} ok={m.confirmed} warn={!m.confirmed} />
          ))}
        </Section>

        {/* Repetitions */}
        {digest.repetitions.length > 0 && (
          <Section title="Repeated Questions" icon="repeat" iconColor={colors.violet} iconBg={colors.violet50}>
            {digest.repetitions.map((r, i) => (
              <View key={i} style={[styles.phraseRow, i === digest.repetitions.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.phraseText}>{r.phrase}</Text>
                <View style={styles.phraseCount}>
                  <Text style={styles.phraseCountText}>{r.count}×</Text>
                </View>
                <Text style={styles.phraseTime}>{r.time_range}</Text>
              </View>
            ))}
          </Section>
        )}

      </ScrollView>
    </View>
  );
}
