import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, fonts, gradients } from "../config/theme";
import { Person } from "../types";
import { updateNotes } from "../api/client";
import { formatRelativeTime, formatTimeShort } from "../hooks/useDashboardData";

interface PersonCardProps {
  person: Person;
  onRefresh: () => void;
}

export function PersonCard({ person, onRefresh }: PersonCardProps) {
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState(person.notes ?? "");
  const [showHistory, setShowHistory] = useState(false);

  const initials = person.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const recentInteractions = (person.interactions ?? []).slice(-5).reverse();

  async function handleSaveNotes() {
    try {
      await updateNotes(person.name, noteText);
      setEditing(false);
      onRefresh();
    } catch {
      Alert.alert("Error", "Failed to save notes");
    }
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[gradients.secondary[0], gradients.secondary[1]]}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <View style={styles.info}>
            <Text style={styles.name}>{person.name}</Text>
            <Text style={styles.relation}>
              {person.relation || "No relation set"}
            </Text>
          </View>
        </View>
        <View style={styles.seenBadge}>
          <Text style={styles.seenBadgeText}>{person.seen_count}x</Text>
        </View>
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          Last seen:{" "}
          <Text style={styles.metaValue}>
            {formatRelativeTime(person.last_seen ?? "")}
          </Text>
        </Text>
      </View>

      {/* Notes */}
      {editing ? (
        <View>
          <TextInput
            style={styles.notesInput}
            value={noteText}
            onChangeText={setNoteText}
            placeholder="Enter caregiver notes..."
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <View style={styles.notesActions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveNotes}>
              <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnGhost}
              onPress={() => {
                setEditing(false);
                setNoteText(person.notes ?? "");
              }}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.notesBox, !person.notes && styles.notesBoxEmpty]}
          onPress={() => setEditing(true)}
        >
          <Text
            style={[
              styles.notesText,
              !person.notes && styles.notesTextEmpty,
            ]}
          >
            {person.notes || "Tap to add caregiver notes..."}
          </Text>
        </TouchableOpacity>
      )}

      {/* Interaction History */}
      <TouchableOpacity
        style={styles.historyToggle}
        onPress={() => setShowHistory(!showHistory)}
      >
        <Text style={styles.historyToggleText}>
          {showHistory ? "▾" : "▸"} Interaction history
        </Text>
      </TouchableOpacity>

      {showHistory && (
        <View style={styles.historyList}>
          {recentInteractions.length > 0 ? (
            recentInteractions.map((i, idx) => (
              <View
                key={idx}
                style={[
                  styles.historyItem,
                  idx < recentInteractions.length - 1 && styles.historyItemBorder,
                ]}
              >
                <Text style={styles.historyText}>
                  {formatTimeShort(i.timestamp)}: {i.summary}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.historyText}>No interactions recorded</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm + 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    color: "#fff",
    ...fonts.bold,
  },
  info: {
    marginLeft: spacing.md,
  },
  name: {
    fontSize: 16,
    color: colors.textPrimary,
    ...fonts.bold,
    letterSpacing: -0.2,
  },
  relation: {
    fontSize: 13,
    color: colors.accentIndigo,
    marginTop: 1,
    ...fonts.medium,
  },
  seenBadge: {
    backgroundColor: "rgba(56,189,248,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.xl,
  },
  seenBadgeText: {
    fontSize: 12,
    color: colors.accentBlue,
    ...fonts.semibold,
  },
  meta: {
    marginBottom: spacing.sm + 2,
  },
  metaText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  metaValue: {
    color: colors.textSecondary,
    ...fonts.medium,
  },
  notesBox: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 38,
  },
  notesBoxEmpty: {},
  notesText: {
    fontSize: 14,
    color: colors.accentIndigo,
    lineHeight: 20,
  },
  notesTextEmpty: {
    color: colors.textMuted,
    fontStyle: "italic",
  },
  notesInput: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: colors.borderFocus,
    borderRadius: radius.sm,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
  },
  notesActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: colors.accentIndigo,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 13,
    ...fonts.semibold,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnGhostText: {
    color: colors.textMuted,
    fontSize: 13,
    ...fonts.semibold,
  },
  historyToggle: {
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
  historyToggleText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  historyList: {
    marginTop: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 8,
    padding: spacing.sm + 2,
  },
  historyItem: {
    paddingVertical: 4,
  },
  historyItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
