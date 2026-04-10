import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";

export const HELP_CAUSES = ["Confusion", "Pain", "Anxiety", "Fell", "Wandered", "Sundowning", "Other"] as const;
export type HelpCause = typeof HELP_CAUSES[number];

interface ResolveSheetProps {
  visible: boolean;
  onResolve: (cause: HelpCause, note: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function ResolveSheet({ visible, onResolve, onSkip, onCancel }: ResolveSheetProps) {
  const { colors } = useTheme();
  const [selectedCause, setSelectedCause] = useState<HelpCause | null>(null);
  const [note, setNote] = useState("");

  function handleResolve() {
    if (!selectedCause) return;
    onResolve(selectedCause, note.trim());
    setSelectedCause(null);
    setNote("");
  }

  function handleSkip() {
    setSelectedCause(null);
    setNote("");
    onSkip();
  }

  function handleCancel() {
    setSelectedCause(null);
    setNote("");
    onCancel();
  }

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: spacing.xl,
      paddingBottom: 40,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 20,
      color: colors.text,
      ...fonts.medium,
      marginBottom: spacing.xs,
    },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginBottom: spacing.lg,
    },
    sectionLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: spacing.sm,
    },
    causeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    causeChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    causeChipSelected: {
      borderColor: colors.coral,
      backgroundColor: colors.coralSoft,
    },
    causeChipText: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.medium,
    },
    causeChipTextSelected: {
      color: colors.coral,
    },
    noteInput: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      fontSize: 14,
      color: colors.text,
      ...fonts.regular,
      minHeight: 72,
      textAlignVertical: "top",
      marginBottom: spacing.lg,
    },
    btnRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    btnSkip: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
    },
    btnSkipText: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.medium,
    },
    btnResolve: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.coral,
      alignItems: "center",
    },
    btnResolveDisabled: {
      backgroundColor: colors.border,
    },
    btnResolveText: {
      fontSize: 14,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    btnCancelRow: {
      marginTop: spacing.md,
      alignItems: "center",
    },
    btnCancelText: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
    },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>What happened?</Text>
          <Text style={styles.subtitle}>Select a cause to log this request. This helps track patterns over time.</Text>

          <Text style={styles.sectionLabel}>Cause</Text>
          <View style={styles.causeRow}>
            {HELP_CAUSES.map((cause) => (
              <TouchableOpacity
                key={cause}
                style={[styles.causeChip, selectedCause === cause && styles.causeChipSelected]}
                onPress={() => setSelectedCause(cause)}
                activeOpacity={0.75}
              >
                <Text style={[styles.causeChipText, selectedCause === cause && styles.causeChipTextSelected]}>
                  {cause}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Patient was disoriented, needed reassurance"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
          />

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnSkip} onPress={handleSkip} activeOpacity={0.75}>
              <Text style={styles.btnSkipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnResolve, !selectedCause && styles.btnResolveDisabled]}
              onPress={handleResolve}
              disabled={!selectedCause}
              activeOpacity={0.85}
            >
              <Text style={styles.btnResolveText}>Mark as Handled</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btnCancelRow} onPress={handleCancel} activeOpacity={0.7}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
