import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
} from "react-native";
import { useRoutine } from "../../hooks/useRoutine";
import { CheckRow } from "../../components/shared/CheckRow";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { colors, fonts, spacing, radius } from "../../config/theme";

export function RoutineScreen() {
  const { tasks, addTask, toggleComplete, deleteTask, isCompletedToday } = useRoutine();
  const [showModal, setShowModal] = useState(false);
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = clock.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  async function handleAdd() {
    if (!label.trim() || !time.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setError("");
    await addTask(label.trim(), time.trim());
    setLabel("");
    setTime("");
    setShowModal(false);
  }

  return (
    <View style={styles.container}>
      {/* Clock */}
      <View style={styles.clockBox}>
        <Text style={styles.clockTime}>{timeStr}</Text>
        <Text style={styles.clockDate}>{dateStr}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader
          label="My Daily Routine"
          action={{ label: "+ Add Task", onPress: () => setShowModal(true) }}
        />

        {tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            subtitle="Tap '+ Add Task' to add your daily routine"
          />
        ) : (
          tasks.map((task) => (
            <CheckRow
              key={task.id}
              label={task.label}
              subLabel={task.time}
              checked={isCompletedToday(task)}
              onToggle={() => toggleComplete(task.id)}
              onDelete={() => deleteTask(task.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Add Task Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add a Task</Text>

            <Text style={styles.fieldLabel}>WHAT DO I NEED TO DO?</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Use the restroom"
              placeholderTextColor={colors.muted}
              autoFocus
            />

            <Text style={styles.fieldLabel}>TIME (e.g. 09:00)</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="09:00"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.btnOutline}
                onPress={() => { setShowModal(false); setError(""); }}
              >
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleAdd}>
                <Text style={styles.btnPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  clockBox: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  clockTime: {
    fontSize: 56,
    color: colors.text,
    ...fonts.displayLight,
  },
  clockDate: {
    fontSize: 16,
    color: colors.muted,
    ...fonts.regular,
    marginTop: spacing.xs,
  },
  content: { padding: spacing.xl, paddingBottom: 100 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(43,35,64,0.3)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 26,
    color: colors.text,
    ...fonts.display,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 10,
    color: colors.lavender,
    ...fonts.medium,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    height: 56,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    fontSize: 20,
    color: colors.text,
    ...fonts.regular,
  },
  error: {
    fontSize: 14,
    color: colors.violet,
    ...fonts.regular,
  },
  modalBtns: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  btnOutline: {
    flex: 1,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.violet,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  btnOutlineText: { fontSize: 17, color: colors.violet, ...fonts.medium },
  btnPrimary: {
    flex: 1,
    height: 56,
    backgroundColor: colors.violet,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: { fontSize: 17, color: "#F5F0E8", ...fonts.medium },
});
