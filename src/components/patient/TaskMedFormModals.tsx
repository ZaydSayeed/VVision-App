import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, TextInput, Modal, Pressable, TouchableOpacity,
  KeyboardAvoidingView, Platform, StyleSheet, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { TimeSlider } from "../shared/TimeSlider";
import { fonts, spacing, radius } from "../../config/theme";
import { RoutineTask } from "../../types";

const SCREEN_H = Dimensions.get("window").height;

/** Shared bottom-sheet form chrome used by the add/edit modals (verbatim from TodayScreen). */
function useFormSheetStyles() {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: "rgba(30,27,58,0.45)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
      padding: spacing.xxl, gap: spacing.sm,
      maxHeight: SCREEN_H * 0.80,
    },
    modalHandle: {
      width: 40, height: 4, borderRadius: radius.pill,
      backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: 22, color: colors.text, ...fonts.medium, marginBottom: spacing.sm },
    fieldLabel: {
      fontSize: 11, color: colors.muted, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
      marginTop: spacing.md, marginBottom: spacing.xs,
    },
    input: {
      height: 54, backgroundColor: colors.surface,
      borderRadius: radius.lg, paddingHorizontal: spacing.lg,
      fontSize: 16, color: colors.text, ...fonts.regular,
    },
    error: { fontSize: 13, color: "#E05050", ...fonts.regular },
    modalBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
    btnOutline: {
      flex: 1, height: 54, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    },
    btnOutlineText: { fontSize: 16, color: colors.text, ...fonts.medium },
    btnPrimary: {
      flex: 1, height: 54, backgroundColor: colors.violet,
      borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    },
    btnPrimaryText: { fontSize: 16, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);
}

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (label: string, time: string) => Promise<unknown>;
}

/** "Add a Task" bottom sheet. Owns its own form state; calls onAdd then closes. */
export function AddTaskModal({ visible, onClose, onAdd }: AddTaskModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useFormSheetStyles();
  const [taskLabel, setTaskLabel] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [taskError, setTaskError] = useState("");

  const close = () => { onClose(); setTaskError(""); };

  async function handleAddTask() {
    if (!taskLabel.trim() || !taskTime.trim()) { setTaskError("Please fill in both fields."); return; }
    setTaskError("");
    try {
      await onAdd(taskLabel.trim(), taskTime.trim());
      setTaskLabel(""); setTaskTime(""); setTaskError("");
      onClose();
    } catch {
      setTaskError("Couldn't save. Check your connection and try again.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add a Task</Text>
          <Text style={styles.fieldLabel}>WHAT DO I NEED TO DO?</Text>
          <TextInput style={styles.input} value={taskLabel} onChangeText={setTaskLabel} placeholder="e.g. Morning walk" placeholderTextColor={colors.muted} autoFocus />
          <Text style={styles.fieldLabel}>TIME</Text>
          <TimeSlider value={taskTime} onChange={setTaskTime} />
          {taskError ? <Text style={styles.error}>{taskError}</Text> : null}
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnOutline} onPress={close}>
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleAddTask}>
              <Text style={styles.btnPrimaryText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface EditTaskModalProps {
  task: RoutineTask | null;
  onClose: () => void;
  onSave: (id: string, patch: { label: string; time: string }) => Promise<unknown>;
}

/** "Edit Task" bottom sheet. Opens when `task` is non-null; pre-fills from it. */
export function EditTaskModal({ task, onClose, onSave }: EditTaskModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useFormSheetStyles();
  const [editLabel, setEditLabel] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (task) {
      setEditLabel(task.label);
      setEditTime(task.time ?? "");
    }
  }, [task]);

  const close = () => { onClose(); setEditError(""); };

  async function handleEditTask() {
    if (!editLabel.trim() || !editTime.trim()) { setEditError("Please fill in both fields."); return; }
    setEditError("");
    try {
      await onSave(task!.id, { label: editLabel.trim(), time: editTime.trim() });
      onClose();
      setEditError("");
    } catch {
      setEditError("Couldn't save. Check your connection and try again.");
    }
  }

  return (
    <Modal visible={task !== null} transparent animationType="slide">
      <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Edit Task</Text>
          <Text style={styles.fieldLabel}>WHAT DO I NEED TO DO?</Text>
          <TextInput style={styles.input} value={editLabel} onChangeText={setEditLabel} placeholder="e.g. Morning walk" placeholderTextColor={colors.muted} autoFocus />
          <Text style={styles.fieldLabel}>TIME</Text>
          <TimeSlider value={editTime} onChange={setEditTime} />
          {editError ? <Text style={styles.error}>{editError}</Text> : null}
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnOutline} onPress={close}>
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleEditTask}>
              <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface AddMedModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, dosage: string, time: string) => Promise<unknown>;
}

/** "Add Medication" bottom sheet. Owns its own form state; calls onAdd then closes. */
export function AddMedModal({ visible, onClose, onAdd }: AddMedModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useFormSheetStyles();
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medTime, setMedTime] = useState("");
  const [medError, setMedError] = useState("");

  const close = () => { onClose(); setMedError(""); };

  async function handleAddMed() {
    if (!medName.trim() || !medDosage.trim() || !medTime.trim()) { setMedError("Please fill in all fields."); return; }
    setMedError("");
    try {
      await onAdd(medName.trim(), medDosage.trim(), medTime.trim());
      setMedName(""); setMedDosage(""); setMedTime(""); setMedError("");
      onClose();
    } catch {
      setMedError("Couldn't save. Check your connection and try again.");
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={[styles.modalOverlay, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Medication</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput style={styles.input} value={medName} onChangeText={setMedName} placeholder="e.g. Donepezil" placeholderTextColor={colors.muted} autoFocus />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>DOSAGE</Text>
              <TextInput style={styles.input} value={medDosage} onChangeText={setMedDosage} placeholder="e.g. 1 tablet" placeholderTextColor={colors.muted} />
            </View>
          </View>
          <Text style={styles.fieldLabel}>TIME</Text>
          <TimeSlider value={medTime} onChange={setMedTime} />
          {medError ? <Text style={styles.error}>{medError}</Text> : null}
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnOutline} onPress={close}>
              <Text style={styles.btnOutlineText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleAddMed}>
              <Text style={styles.btnPrimaryText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
