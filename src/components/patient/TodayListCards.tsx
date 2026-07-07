import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius, shadow, patientType, patientTouch } from "../../config/theme";
import { RoutineTask, Medication, Reminder } from "../../types";

/** Shared "full-width status card" chrome for the meds + tasks lists (verbatim from TodayScreen). */
function useFullCardStyles() {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
    fullCard: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.lg,
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      overflow: "hidden",
      padding: spacing.lg,
      paddingLeft: spacing.lg + 4,
      ...shadow.md,
    },
    fullCardAccent: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      borderTopLeftRadius: radius.xl,
      borderBottomLeftRadius: radius.xl,
    },
    fullCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    fullCardTitle: {
      ...patientType.label,
      ...fonts.medium,
      marginRight: "auto" as const,
    },
    fullCardPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    fullCardPillText: { fontSize: 14, ...fonts.medium },
    fullCardPlusBtn: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: "center", justifyContent: "center",
    },
    fullCardPlusBtnText: { color: "#fff", fontSize: 26, lineHeight: 30, ...fonts.regular },
    fullCardItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      minHeight: patientTouch.min,
    },
    fullCardCheckboxBtn: {
      width: patientTouch.min,
      height: patientTouch.min,
      alignItems: "center",
      justifyContent: "center",
    },
    fullCardCheckbox: {
      width: 34, height: 34, borderRadius: radius.sm,
      alignItems: "center", justifyContent: "center",
    },
    fullCardItemText: { ...patientType.item, color: colors.text, ...fonts.regular },
    fullCardItemDone: { color: colors.muted, textDecorationLine: "line-through" },
    fullCardEmpty: { ...patientType.secondary, color: colors.muted, ...fonts.regular },
    fullCardProgressTrack: {
      height: 6, borderRadius: radius.pill,
      backgroundColor: colors.surface,
      marginTop: spacing.sm,
    },
    fullCardProgressFill: { height: 6, borderRadius: radius.pill },
    fullCardProgressText: { fontSize: 14, color: colors.muted, ...fonts.regular, marginTop: 5 },
  }), [colors]);
}

interface MedicationsCardProps {
  meds: Medication[];
  medsDone: number;
  isTakenToday: (med: Medication) => boolean;
  onToggleTaken: (id: string) => void;
  onAddMed: () => void;
}

/** Today's medications list with per-med taken checkboxes and a progress bar. */
export function MedicationsCard({ meds, medsDone, isTakenToday, onToggleTaken, onAddMed }: MedicationsCardProps) {
  const { colors } = useTheme();
  const styles = useFullCardStyles();

  return (
    <View style={styles.fullCard}>
      <View style={[styles.fullCardAccent, { backgroundColor: colors.amber }]} />
      <View style={styles.fullCardHeader}>
        <Text style={[styles.fullCardTitle, { color: colors.amber }]}>Medications</Text>
        <View style={[styles.fullCardPill, { backgroundColor: colors.amberSoft }]}>
          <Text style={[styles.fullCardPillText, { color: colors.amber }]}>{medsDone} of {meds.length} taken</Text>
        </View>
        <TouchableOpacity
          style={[styles.fullCardPlusBtn, { backgroundColor: colors.amber }]}
          onPress={onAddMed}
          activeOpacity={0.8}
          accessibilityLabel="Add medication"
          accessibilityRole="button"
        >
          <Text style={styles.fullCardPlusBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {meds.length === 0 ? (
        <Text style={styles.fullCardEmpty}>No meds added yet.</Text>
      ) : (
        meds
          .slice()
          .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
          .map((med) => {
            const taken = isTakenToday(med);
            return (
              <View key={med.id} style={styles.fullCardItem}>
                <TouchableOpacity style={styles.fullCardCheckboxBtn} onPress={() => onToggleTaken(med.id)} activeOpacity={0.75} accessibilityLabel={`Mark ${med.name} as ${taken ? "not taken" : "taken"}`} accessibilityRole="checkbox" accessibilityState={{ checked: taken }}>
                  <View style={[styles.fullCardCheckbox, { backgroundColor: taken ? colors.amber : "transparent", borderWidth: taken ? 0 : 1.5, borderColor: colors.amber }]}>
                    {taken && <Ionicons name="checkmark" size={20} color="#fff" />}
                  </View>
                </TouchableOpacity>
                <Text style={[styles.fullCardItemText, taken && styles.fullCardItemDone]} numberOfLines={2}>
                  {med.name}
                </Text>
              </View>
            );
          })
      )}

      <View style={styles.fullCardProgressTrack}>
        <View style={[styles.fullCardProgressFill, {
          backgroundColor: colors.amber,
          width: `${meds.length > 0 ? Math.round((medsDone / meds.length) * 100) : 0}%`,
        }]} />
      </View>
      <Text style={styles.fullCardProgressText}>{medsDone} of {meds.length} taken</Text>
    </View>
  );
}

interface TasksCardProps {
  tasks: RoutineTask[];
  reminders: Reminder[];
  isCompletedToday: (task: RoutineTask) => boolean;
  onToggleComplete: (id: string) => void;
  onOpenTaskDetail: (task: RoutineTask) => void;
  onDeleteReminder: (id: string) => void;
  onAddTask: () => void;
}

/** Today's tasks + reminders list with checkboxes, detail open, and reminder removal. */
export function TasksCard({
  tasks, reminders, isCompletedToday, onToggleComplete, onOpenTaskDetail, onDeleteReminder, onAddTask,
}: TasksCardProps) {
  const { colors } = useTheme();
  const styles = useFullCardStyles();

  const allItems = tasks.length + reminders.length;
  const doneItems = tasks.filter(isCompletedToday).length + reminders.filter((r) => !!r.completed_date).length;

  return (
    <View style={styles.fullCard}>
      <View style={[styles.fullCardAccent, { backgroundColor: colors.sage }]} />
      <View style={styles.fullCardHeader}>
        <Text style={[styles.fullCardTitle, { color: colors.sage }]}>Tasks</Text>
        <View style={[styles.fullCardPill, { backgroundColor: colors.sageSoft }]}>
          <Text style={[styles.fullCardPillText, { color: colors.sage }]}>{doneItems} of {allItems} done</Text>
        </View>
        <TouchableOpacity
          style={[styles.fullCardPlusBtn, { backgroundColor: colors.sage }]}
          onPress={onAddTask}
          activeOpacity={0.8}
          accessibilityLabel="Add task"
          accessibilityRole="button"
        >
          <Text style={styles.fullCardPlusBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {tasks.length === 0 && reminders.length === 0 ? (
        <Text style={styles.fullCardEmpty}>No tasks yet.</Text>
      ) : (
        [...tasks.map((t) => ({ id: t.id, label: t.label, time: t.time, done: isCompletedToday(t), type: "task" as const, task: t })),
         ...reminders.map((r) => ({ id: r.id, label: r.text, time: r.time ?? "", done: !!r.completed_date, type: "reminder" as const, task: null as RoutineTask | null }))]
          .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
          .map((item) => (
            <View key={item.id} style={styles.fullCardItem}>
              <TouchableOpacity
                style={styles.fullCardCheckboxBtn}
                onPress={() => { if (item.type === "task") onToggleComplete(item.id); }}
                activeOpacity={0.75}
                accessibilityLabel={`Mark ${item.label} as ${item.done ? "incomplete" : "complete"}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.done }}
              >
                <View style={[styles.fullCardCheckbox, { backgroundColor: item.done ? colors.sage : "transparent", borderWidth: item.done ? 0 : 1.5, borderColor: colors.sage }]}>
                  {item.done && <Ionicons name="checkmark" size={20} color="#fff" />}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, justifyContent: "center" }}
                onPress={() => item.type === "task" && item.task ? onOpenTaskDetail(item.task) : undefined}
                activeOpacity={item.type === "task" ? 0.6 : 1}
              >
                <Text style={[styles.fullCardItemText, item.done && styles.fullCardItemDone]} numberOfLines={2}>
                  {item.label}
                </Text>
              </TouchableOpacity>
              {item.type === "reminder" && (
                <TouchableOpacity
                  style={styles.fullCardCheckboxBtn}
                  onPress={() => Alert.alert("Remove reminder?", `"${item.label}" will be removed.`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => onDeleteReminder(item.id) },
                  ])}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close-circle-outline" size={28} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>
          ))
      )}

      <View style={styles.fullCardProgressTrack}>
        <View style={[styles.fullCardProgressFill, {
          backgroundColor: colors.sage,
          width: `${allItems > 0 ? Math.round((doneItems / allItems) * 100) : 0}%`,
        }]} />
      </View>
      <Text style={styles.fullCardProgressText}>{doneItems} of {allItems} done</Text>
    </View>
  );
}
