import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CaregiverNote } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";
import { formatRelativeTime } from "../hooks/useDashboardData";

interface Props {
  visible: boolean;
  notes: CaregiverNote[];
  onClose: () => void;
}

export function NotesHistoryModal({ visible, notes, onClose }: Props) {
  const { colors } = useTheme();
  const pinnedNote = notes.find((n) => n.pinned) ?? null;
  const previousNotes = notes.filter((n) => !n.pinned);
  const caregiverName = notes[0]?.caregiverName ?? "your caregiver";

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 48,
      maxHeight: "85%",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    headerTitle: { flex: 1, fontSize: 20, color: colors.text, ...fonts.medium },
    closeBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    sectionLabel: {
      fontSize: 11, color: colors.muted, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
      paddingHorizontal: spacing.xl, marginBottom: spacing.sm,
    },
    card: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    pinnedCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.violet,
    },
    pinnedLabel: {
      fontSize: 10, color: colors.violet, ...fonts.medium,
      letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.xs,
    },
    noteText: { fontSize: 14, color: colors.text, ...fonts.regular, lineHeight: 21 },
    timestamp: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: spacing.xs },
    emptyText: {
      textAlign: "center", color: colors.muted, ...fonts.regular,
      fontSize: 14, paddingVertical: spacing.xxxl,
    },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notes from {caregiverName}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {notes.length === 0 && (
              <Text style={styles.emptyText}>No notes yet.</Text>
            )}

            {pinnedNote && (
              <>
                <Text style={styles.sectionLabel}>Pinned</Text>
                <View style={[styles.card, styles.pinnedCard]}>
                  <Text style={styles.pinnedLabel}>Pinned</Text>
                  <Text style={styles.noteText}>{pinnedNote.text}</Text>
                  <Text style={styles.timestamp}>{formatRelativeTime(pinnedNote.timestamp)}</Text>
                </View>
              </>
            )}

            {previousNotes.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Previous Notes</Text>
                {previousNotes.map((note) => (
                  <View key={note.id} style={styles.card}>
                    <Text style={styles.noteText}>{note.text}</Text>
                    <Text style={styles.timestamp}>{formatRelativeTime(note.timestamp)}</Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
