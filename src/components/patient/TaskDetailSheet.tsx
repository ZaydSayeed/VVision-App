import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  Animated, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { RoutineTask } from "../../types";

interface Props {
  task: RoutineTask | null;
  onClose: () => void;
  onComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onSaveNotes: (taskId: string, notes: string) => Promise<void>;
  onEdit: (task: RoutineTask) => void;
  isCompletedToday: (task: RoutineTask) => boolean;
}

export function TaskDetailSheet({ task, onClose, onComplete, onDelete, onSaveNotes, onEdit, isCompletedToday }: Props) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setNotes(task.notes ?? "");
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start();
    }
  }, [task, slideAnim]);

  const handleSaveNotes = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await onSaveNotes(task.id, notes);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!task) return;
    Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { onDelete(task.id); onClose(); } },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 40,
      maxHeight: "85%",
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: colors.border, alignSelf: "center", marginTop: 12, marginBottom: 4,
    },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { ...fonts.medium, fontSize: 16, color: colors.text },
    closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing.xl, gap: spacing.lg },
    label: { ...fonts.medium, fontSize: 22, color: colors.text, lineHeight: 30 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: { ...fonts.regular, fontSize: 14, color: colors.muted },
    sectionLabel: {
      ...fonts.medium, fontSize: 11, color: colors.muted,
      textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6,
    },
    notesInput: {
      backgroundColor: colors.surface,
      borderRadius: radius.md, padding: spacing.md,
      ...fonts.regular, fontSize: 15, color: colors.text,
      minHeight: 80, textAlignVertical: "top",
      borderWidth: 1, borderColor: colors.border,
    },
    saveBtn: {
      backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: 10, paddingHorizontal: spacing.xl,
      alignSelf: "flex-end",
    },
    saveBtnText: { ...fonts.medium, fontSize: 13, color: "#FFFFFF" },
    doneToggle: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.surface, borderRadius: radius.md,
      padding: spacing.md,
    },
    doneToggleText: { ...fonts.medium, fontSize: 15, color: colors.text },
    actionRow: { flexDirection: "row", gap: spacing.md },
    editBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 12,
      borderWidth: 1, borderColor: colors.border,
    },
    editBtnText: { ...fonts.medium, fontSize: 14, color: colors.text },
    deleteBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      backgroundColor: colors.coral + "22", borderRadius: radius.md, paddingVertical: 12,
    },
    deleteBtnText: { ...fonts.medium, fontSize: 14, color: colors.coral },
  }), [colors]);

  const completed = task ? isCompletedToday(task) : false;

  return (
    <Modal visible={!!task} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Task Detail</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Ionicons name="close" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>{task?.label}</Text>

                {task?.time ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="time-outline" size={16} color={colors.muted} />
                    <Text style={styles.metaText}>{task.time}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.doneToggle}
                  onPress={() => task && onComplete(task.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={completed ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={completed ? "#22C55E" : colors.muted}
                  />
                  <Text style={styles.doneToggleText}>{completed ? "Completed today" : "Mark as complete"}</Text>
                </TouchableOpacity>

                <View>
                  <Text style={styles.sectionLabel}>Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add a note..."
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={3}
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, { marginTop: 8 }]}
                    onPress={handleSaveNotes}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save Notes"}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => task && onEdit(task)} activeOpacity={0.8}>
                    <Ionicons name="pencil-outline" size={16} color={colors.text} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={16} color={colors.coral} />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}
