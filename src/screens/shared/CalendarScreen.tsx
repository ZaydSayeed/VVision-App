import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius, shadow } from "../../config/theme";
import {
  listCalendarEvents,
  completeCalendarEventOccurrence,
  CalendarEventOccurrence,
} from "../../services/calendarApi";
import {
  CALENDAR_CATEGORY_COLORS,
  CALENDAR_CATEGORY_LABELS,
} from "../../config/calendarCategories";

interface Props {
  patientId?: string;
  patientName?: string;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function endOfWeek(start: Date): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + 7);
  return d;
}

function formatWeekRange(start: Date, end: Date): string {
  const last = new Date(end.getTime() - 1);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, opts)}`;
}

function formatOccurrenceTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CalendarScreen({ patientId: propPatientId, patientName }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const patientId = propPatientId ?? user?.patient_id ?? undefined;

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalendarEventOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const weekEnd = useMemo(() => endOfWeek(weekStart), [weekStart]);

  const load = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    try {
      setLoadError(false);
      const data = await listCalendarEvents(patientId, weekStart.toISOString(), weekEnd.toISOString());
      setEvents(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId, weekStart, weekEnd]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const goPrevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  const goNextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const onToggleComplete = async (occurrence: CalendarEventOccurrence) => {
    if (occurrence.completed || !patientId) return;
    // Optimistic update.
    setEvents((prev) =>
      prev.map((e) =>
        e.id === occurrence.id && e.occurrenceAt === occurrence.occurrenceAt
          ? { ...e, completed: true }
          : e
      )
    );
    try {
      const dateKey = occurrence.occurrenceAt.slice(0, 10);
      await completeCalendarEventOccurrence(patientId, occurrence.id, dateKey);
    } catch {
      // Revert on failure.
      setEvents((prev) =>
        prev.map((e) =>
          e.id === occurrence.id && e.occurrenceAt === occurrence.occurrenceAt
            ? { ...e, completed: false }
            : e
        )
      );
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    weekNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    weekNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    weekLabel: {
      fontSize: 16,
      color: colors.text,
      ...fonts.medium,
    },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 120 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow.sm,
    },
    categoryDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: spacing.md,
    },
    cardInfo: { flex: 1 },
    cardTitle: {
      fontSize: 16,
      color: colors.text,
      ...fonts.medium,
    },
    cardTitleDone: {
      textDecorationLine: "line-through",
      color: colors.muted,
    },
    cardMeta: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 2,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: spacing.md,
    },
    checkboxDone: {
      backgroundColor: colors.sage,
      borderColor: colors.sage,
    },
    emptyWrap: {
      alignItems: "center",
      paddingTop: 80,
      gap: spacing.md,
    },
    emptyTitle: {
      fontSize: 20,
      color: colors.text,
      ...fonts.medium,
    },
    emptySub: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
    },
    errorBanner: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      backgroundColor: colors.coralSoft,
      borderRadius: radius.lg,
      padding: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    errorText: {
      fontSize: 14,
      color: colors.coral,
      ...fonts.regular,
      flex: 1,
    },
    fab: {
      position: "absolute",
      bottom: 32,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.fab,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.weekNav}>
        <TouchableOpacity
          style={styles.weekNavBtn}
          onPress={goPrevWeek}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
        >
          <Ionicons name="chevron-back" size={20} color={colors.violet} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{formatWeekRange(weekStart, weekEnd)}</Text>
        <TouchableOpacity
          style={styles.weekNavBtn}
          onPress={goNextWeek}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Next week"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.violet} />
        </TouchableOpacity>
      </View>

      {loadError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="wifi-outline" size={16} color={colors.coral} />
          <Text style={styles.errorText}>Couldn't load calendar events. Pull to refresh.</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => `${item.id}:${item.occurrenceAt}`}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.violet} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="calendar-outline" size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>No events this week</Text>
              <Text style={styles.emptySub}>Tap the + button to add one.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("CalendarEventEditor", { eventId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${CALENDAR_CATEGORY_LABELS[item.category]}, ${formatOccurrenceTime(item.occurrenceAt)}`}
            >
              <View style={[styles.categoryDot, { backgroundColor: CALENDAR_CATEGORY_COLORS[item.category] }]} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardTitle, item.completed && styles.cardTitleDone]}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta}>
                  {CALENDAR_CATEGORY_LABELS[item.category]} · {formatOccurrenceTime(item.occurrenceAt)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.checkbox, item.completed && styles.checkboxDone]}
                onPress={() => onToggleComplete(item)}
                disabled={item.completed}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={item.completed ? "Completed" : "Mark as complete"}
              >
                {item.completed ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("CalendarEventEditor")}
        accessibilityRole="button"
        accessibilityLabel="Add calendar event"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
