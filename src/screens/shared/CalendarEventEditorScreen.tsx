import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { RRule, rrulestr } from "rrule";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  CalendarEventOccurrence,
} from "../../services/calendarApi";
import {
  CalendarCategory,
  CALENDAR_CATEGORY_LABELS,
} from "../../config/calendarCategories";

// Duplicated from src/server-core/recurrence.ts. This screen never shows raw
// RRULE syntax to the user — these two builders exist only so the app doesn't
// need a shared server/app package for two tiny functions (see task brief).
const RRULE_WEEKDAYS = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];

function buildDailyRule(): string {
  return new RRule({ freq: RRule.DAILY }).toString();
}

function buildWeeklyRule(daysOfWeek: number[]): string {
  return new RRule({
    freq: RRule.WEEKLY,
    byweekday: daysOfWeek.map((d) => RRULE_WEEKDAYS[d]),
  }).toString();
}

type RecurrenceType = "none" | "daily" | "weekly";

function parseRecurrenceRule(rule: string | null | undefined): {
  type: RecurrenceType;
  daysOfWeek: number[];
} {
  if (!rule) return { type: "none", daysOfWeek: [] };
  try {
    const parsed = rrulestr(rule);
    if (parsed.options.freq === RRule.DAILY) return { type: "daily", daysOfWeek: [] };
    if (parsed.options.freq === RRule.WEEKLY) {
      const days = (parsed.options.byweekday ?? []).map((wd: any) =>
        RRULE_WEEKDAYS.findIndex((w) => w.weekday === (typeof wd === "number" ? wd : wd.weekday))
      );
      return { type: "weekly", daysOfWeek: days.filter((d) => d >= 0) };
    }
  } catch {
    // fall through to "none" if the rule can't be parsed
  }
  return { type: "none", daysOfWeek: [] };
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function combineDateAndTime(date: Date, time: Date): Date {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

interface Props {
  patientId?: string;
  patientName?: string;
}

export function CalendarEventEditorScreen({ patientId: propPatientId }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    eventId,
    event: existingEvent,
    patientId: routePatientId,
  } = (route.params ?? {}) as {
    eventId?: string;
    event?: CalendarEventOccurrence;
    patientId?: string;
  };

  const patientId = propPatientId ?? routePatientId ?? user?.patient_id ?? undefined;
  const isEditing = !!eventId;

  const initialStart = existingEvent ? new Date(existingEvent.occurrenceAt) : new Date();
  const initialEnd = existingEvent
    ? new Date(existingEvent.endAt)
    : new Date(initialStart.getTime() + 30 * 60 * 1000);
  const initialRecurrence = parseRecurrenceRule(existingEvent?.recurrenceRule);

  const [title, setTitle] = useState(existingEvent?.title ?? "");
  const [category, setCategory] = useState<CalendarCategory>(existingEvent?.category ?? "personal");
  const [date, setDate] = useState(initialStart);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [notes, setNotes] = useState(existingEvent?.notes ?? "");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(initialRecurrence.type);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initialRecurrence.daysOfWeek);
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    if (!patientId) {
      Alert.alert("Missing patient", "Couldn't determine which patient this event belongs to.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Missing title", "Enter a title for this event.");
      return;
    }
    const startAt = combineDateAndTime(date, startTime);
    const endAt = combineDateAndTime(date, endTime);
    if (endAt <= startAt) {
      Alert.alert("Invalid time", "End time must be after start time.");
      return;
    }

    let recurrenceRule: string | null = null;
    if (recurrenceType === "daily") {
      recurrenceRule = buildDailyRule();
    } else if (recurrenceType === "weekly") {
      const days = daysOfWeek.length > 0 ? daysOfWeek : [startAt.getDay()];
      recurrenceRule = buildWeeklyRule(days);
    }

    const input = {
      title: title.trim(),
      category,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      notes: notes.trim() || undefined,
      recurrenceRule,
    };

    setSaving(true);
    try {
      if (isEditing && eventId) {
        await updateCalendarEvent(patientId, eventId, input);
      } else {
        await createCalendarEvent(patientId, input);
      }
      navigation.goBack();
    } catch (e: any) {
      if (typeof e?.message === "string" && e.message.includes("403")) {
        Alert.alert("Can't save", "You can only edit events you created.");
      } else {
        Alert.alert("Couldn't save", e?.message ?? "Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!patientId || !eventId) return;
    Alert.alert("Delete event?", `Delete "${title || "this event"}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCalendarEvent(patientId, eventId);
            navigation.goBack();
          } catch (e: any) {
            if (typeof e?.message === "string" && e.message.includes("403")) {
              Alert.alert("Can't delete", "You can only delete events you created.");
            } else {
              Alert.alert("Couldn't delete", e?.message ?? "Please try again.");
            }
          }
        },
      },
    ]);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        content: { padding: spacing.xl, paddingBottom: spacing.xxxxl },
        label: {
          fontSize: 13,
          color: colors.muted,
          ...fonts.medium,
          marginBottom: spacing.sm,
          marginTop: spacing.lg,
        },
        input: {
          height: 48,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          fontSize: 15,
          color: colors.text,
          ...fonts.regular,
        },
        notesInput: {
          height: 96,
          textAlignVertical: "top",
          paddingTop: spacing.md,
        },
        row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
        chip: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        chipActive: {
          backgroundColor: colors.violet,
          borderColor: colors.violet,
        },
        chipText: {
          fontSize: 14,
          color: colors.text,
          ...fonts.medium,
        },
        chipTextActive: { color: "#FFFFFF" },
        dayChip: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        dayChipActive: {
          backgroundColor: colors.violet,
          borderColor: colors.violet,
        },
        dayChipText: {
          fontSize: 13,
          color: colors.text,
          ...fonts.medium,
        },
        dayChipTextActive: { color: "#FFFFFF" },
        saveBtn: {
          backgroundColor: colors.violet,
          borderRadius: radius.pill,
          paddingVertical: spacing.md,
          alignItems: "center",
          marginTop: spacing.xxl,
        },
        saveBtnDisabled: { opacity: 0.6 },
        saveText: { fontSize: 16, color: "#FFFFFF", ...fonts.medium },
        deleteBtn: {
          borderRadius: radius.pill,
          paddingVertical: spacing.md,
          alignItems: "center",
          marginTop: spacing.md,
          borderWidth: 1,
          borderColor: colors.coral,
        },
        deleteText: { fontSize: 16, color: colors.coral, ...fonts.medium },
      }),
    [colors]
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        placeholder="Event title"
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.row}>
        {(Object.keys(CALENDAR_CATEGORY_LABELS) as CalendarCategory[]).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={CALENDAR_CATEGORY_LABELS[cat]}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
              {CALENDAR_CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Date</Text>
      <DateTimePicker
        value={date}
        mode="date"
        display="default"
        onChange={(_, d) => d && setDate(d)}
      />

      <Text style={styles.label}>Start time</Text>
      <DateTimePicker
        value={startTime}
        mode="time"
        display="default"
        onChange={(_, d) => d && setStartTime(d)}
      />

      <Text style={styles.label}>End time</Text>
      <DateTimePicker
        value={endTime}
        mode="time"
        display="default"
        onChange={(_, d) => d && setEndTime(d)}
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Notes (optional)"
        placeholderTextColor={colors.muted}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Text style={styles.label}>Repeat</Text>
      <View style={styles.row}>
        {[
          { key: "none" as const, label: "Doesn't repeat" },
          { key: "daily" as const, label: "Every day" },
          { key: "weekly" as const, label: "Every week on selected days" },
        ].map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.chip, recurrenceType === opt.key && styles.chipActive]}
            onPress={() => setRecurrenceType(opt.key)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.chipText, recurrenceType === opt.key && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {recurrenceType === "weekly" && (
        <View style={[styles.row, { marginTop: spacing.md }]}>
          {DAY_LABELS.map((label, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.dayChip, daysOfWeek.includes(idx) && styles.dayChipActive]}
              onPress={() => toggleDay(idx)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Toggle ${label}`}
            >
              <Text style={[styles.dayChipText, daysOfWeek.includes(idx) && styles.dayChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={isEditing ? "Save changes" : "Create event"}
      >
        <Text style={styles.saveText}>{saving ? "Saving…" : isEditing ? "Save changes" : "Create event"}</Text>
      </TouchableOpacity>

      {isEditing && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Delete event"
        >
          <Text style={styles.deleteText}>Delete event</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
