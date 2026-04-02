import React, { useState, useEffect, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoutine } from "../../hooks/useRoutine";
import { CheckRow } from "../../components/shared/CheckRow";
import { SectionHeader } from "../../components/shared/SectionHeader";
import { EmptyState } from "../../components/shared/EmptyState";
import { fonts, spacing, radius, gradients } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

export function RoutineScreen() {
  const { colors, isDark } = useTheme();
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
    try {
      await addTask(label.trim(), time.trim());
      setLabel("");
      setTime("");
      setShowModal(false);
    } catch {
      setError("Could not save — make sure you're connected to the same network as the glasses system.");
    }
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    emptyCTA: {
      alignItems: "center",
      paddingTop: 60,
      gap: spacing.md,
    },
    bigAddBtn: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
      marginBottom: spacing.sm,
    },
    emptyCTATitle: {
      fontSize: 24,
      color: colors.text,
      ...fonts.medium,
    },
    emptyCTASubtitle: {
      fontSize: 15,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 22,
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
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    clockBox: {
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    clockTime: {
      fontSize: 32,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    clockDate: {
      fontSize: 13,
      color: "rgba(255,255,255,0.8)",
      ...fonts.regular,
      marginTop: 2,
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
      fontSize: 22,
      color: colors.text,
      ...fonts.medium,
      marginBottom: spacing.sm,
    },
    fieldLabel: {
      fontSize: 10,
      color: colors.muted,
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
      borderRadius: radius.md,
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
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    btnOutlineText: { fontSize: 17, color: colors.violet, ...fonts.medium },
    btnPrimary: {
      flex: 1,
      height: 56,
      backgroundColor: colors.violet,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimaryText: { fontSize: 17, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Clock */}
      <LinearGradient
        colors={isDark ? [...gradients.dark] : [...gradients.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.clockBox}
      >
        <Text style={styles.clockTime}>{timeStr}</Text>
        <Text style={styles.clockDate}>{dateStr}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader label="My Daily Routine" />

        {tasks.length === 0 ? (
          <View style={styles.emptyCTA}>
            <TouchableOpacity
              style={styles.bigAddBtn}
              onPress={() => setShowModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={52} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.emptyCTATitle}>Add a Task</Text>
            <Text style={styles.emptyCTASubtitle}>
              Build your daily routine{"\n"}and track what you've done
            </Text>
          </View>
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

      {tasks.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={36} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Add Task Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
