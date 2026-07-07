import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius, shadow, patientType, patientTouch } from "../../config/theme";
import { RoutineTask, Medication } from "../../types";

interface UpNextCardProps {
  tasks: RoutineTask[];
  meds: Medication[];
  isCompletedToday: (task: RoutineTask) => boolean;
  isTakenToday: (med: Medication) => boolean;
  onCompleteTask: (id: string) => void;
  onTakeMed: (id: string) => void;
  onSeeSchedule: () => void;
}

type NextItem =
  | { kind: "task"; id: string; label: string; time: string }
  | { kind: "med"; id: string; label: string; time: string };

function timeDisplay(time: string): string {
  if (!time || !time.includes(":")) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `${h12}:${String(m).padStart(2, "0")} ${ampm} · this ${part}`;
}

/**
 * The single most important thing on the patient home: one item, one action.
 * A dementia-friendly screen answers "what do I do now?" before showing anything else.
 */
export function UpNextCard({
  tasks, meds, isCompletedToday, isTakenToday, onCompleteTask, onTakeMed, onSeeSchedule,
}: UpNextCardProps) {
  const { colors } = useTheme();

  const pending: NextItem[] = [
    ...tasks.filter((t) => !isCompletedToday(t)).map((t) => ({ kind: "task" as const, id: t.id, label: t.label, time: t.time ?? "" })),
    ...meds.filter((m) => !isTakenToday(m)).map((m) => ({ kind: "med" as const, id: m.id, label: m.name, time: m.time ?? "" })),
  ].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  // Earliest item still ahead of us today; if everything is overdue, the earliest overdue one
  const next = pending.find((i) => i.time >= nowStr) ?? pending[0];

  const total = tasks.length + meds.length;
  const done = total - pending.length;

  const accent = next?.kind === "med" ? colors.amber : colors.sage;

  const styles = useMemo(() => StyleSheet.create({
    card: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
      backgroundColor: colors.bg,
      borderRadius: radius.xxl,
      padding: spacing.xl,
      ...shadow.md,
    },
    label: {
      ...patientType.label,
      ...fonts.medium,
      color: colors.violet,
      marginBottom: spacing.sm,
    },
    time: {
      ...patientType.secondary,
      ...fonts.regular,
      color: colors.subtext,
      marginBottom: spacing.xs,
    },
    itemLabel: {
      ...patientType.title,
      ...fonts.medium,
      color: colors.text,
      marginBottom: spacing.lg,
    },
    doneBtn: {
      minHeight: patientTouch.min + 4,
      borderRadius: radius.pill,
      backgroundColor: accent,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    doneBtnText: {
      fontSize: 20,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.lg,
      minHeight: 44,
    },
    footerText: {
      ...patientType.secondary,
      ...fonts.regular,
      color: colors.muted,
    },
    scheduleLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: 44,
      paddingHorizontal: spacing.xs,
    },
    scheduleLinkText: {
      fontSize: 16,
      color: colors.violet,
      ...fonts.medium,
    },
    // All-done state
    allDoneWrap: {
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    allDoneIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.sageSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
    },
    allDoneTitle: {
      ...patientType.title,
      ...fonts.medium,
      color: colors.text,
      textAlign: "center",
    },
    allDoneSub: {
      ...patientType.secondary,
      ...fonts.regular,
      color: colors.subtext,
      textAlign: "center",
      marginTop: spacing.xs,
    },
  }), [colors, accent]);

  if (!next) {
    return (
      <View style={styles.card}>
        <View style={styles.allDoneWrap}>
          <View style={styles.allDoneIcon}>
            <Ionicons name="checkmark" size={40} color={colors.sage} />
          </View>
          <Text style={styles.allDoneTitle}>
            {total > 0 ? "All done for today" : "Nothing scheduled today"}
          </Text>
          <Text style={styles.allDoneSub}>
            {total > 0 ? "Everything on your list is finished. Well done." : "Enjoy your day."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Up next</Text>
      {!!next.time && <Text style={styles.time}>{timeDisplay(next.time)}</Text>}
      <Text style={styles.itemLabel}>
        {next.kind === "med" ? `Take your medication: ${next.label}` : next.label}
      </Text>
      <TouchableOpacity
        style={styles.doneBtn}
        onPress={() => (next.kind === "med" ? onTakeMed(next.id) : onCompleteTask(next.id))}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={next.kind === "med" ? `Mark ${next.label} as taken` : `Mark ${next.label} as done`}
      >
        <Ionicons name="checkmark-circle" size={26} color="#FFFFFF" />
        <Text style={styles.doneBtnText}>{next.kind === "med" ? "I took it" : "I did it"}</Text>
      </TouchableOpacity>
      <View style={styles.footerRow}>
        <Text style={styles.footerText}>{done} of {total} done today</Text>
        <TouchableOpacity
          style={styles.scheduleLink}
          onPress={onSeeSchedule}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="See today's schedule"
        >
          <Text style={styles.scheduleLinkText}>See schedule</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.violet} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
