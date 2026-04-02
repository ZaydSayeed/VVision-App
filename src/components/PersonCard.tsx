import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { radius, spacing, fonts, gradients } from "../config/theme";
import { useTheme } from "../context/ThemeContext";
import { Person } from "../types";
import { updateNotes, deletePerson } from "../api/client";
import { formatRelativeTime, formatTimeShort } from "../hooks/useDashboardData";

interface PersonCardProps {
  person: Person;
  onRefresh: () => void;
}

export function PersonCard({ person, onRefresh }: PersonCardProps) {
  const { colors } = useTheme();
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

  function handleDelete() {
    Alert.alert(
      "Remove person?",
      `This will remove ${person.name} from the glasses recognition system.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePerson(person.id ?? person._id);
              onRefresh();
            } catch {
              Alert.alert("Error", "Could not remove person. Make sure you're on the same network as the glasses system.");
            }
          },
        },
      ]
    );
  }

  async function handleSaveNotes() {
    try {
      await updateNotes(person.id ?? person._id, noteText);
      setEditing(false);
      onRefresh();
    } catch {
      Alert.alert("Error", "Failed to save notes");
    }
  }

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: 18,
      marginBottom: spacing.md,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
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
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 15,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    info: {
      marginLeft: spacing.md,
    },
    name: {
      fontSize: 18,
      color: colors.text,
      ...fonts.medium,
    },
    relation: {
      fontSize: 13,
      color: colors.lavender,
      marginTop: 1,
      ...fonts.medium,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    seenBadge: {
      backgroundColor: colors.violet50,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    seenBadgeText: {
      fontSize: 12,
      color: colors.violet,
      ...fonts.medium,
    },
    meta: {
      marginBottom: spacing.sm + 2,
    },
    metaText: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
    },
    metaValue: {
      color: colors.subtext,
      ...fonts.medium,
    },
    notesBox: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.md,
      minHeight: 38,
    },
    notesBoxEmpty: {},
    notesText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
      ...fonts.regular,
    },
    notesTextEmpty: {
      color: colors.muted,
      fontStyle: "italic",
    },
    notesInput: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.violet,
      borderRadius: radius.sm,
      padding: spacing.md,
      color: colors.text,
      fontSize: 14,
      minHeight: 60,
      textAlignVertical: "top",
      ...fonts.regular,
    },
    notesActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    btnPrimary: {
      backgroundColor: colors.violet,
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderRadius: radius.pill,
    },
    btnPrimaryText: {
      color: "#FFFFFF",
      fontSize: 13,
      ...fonts.medium,
    },
    btnOutline: {
      borderWidth: 1.5,
      borderColor: colors.violet,
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderRadius: radius.pill,
    },
    btnOutlineText: {
      color: colors.violet,
      fontSize: 13,
      ...fonts.medium,
    },
    historyToggle: {
      marginTop: spacing.sm,
      paddingVertical: 4,
    },
    historyToggleText: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.regular,
    },
    historyList: {
      marginTop: spacing.sm,
      backgroundColor: colors.bg,
      borderRadius: radius.sm,
      padding: spacing.sm + 2,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.muted,
      ...fonts.regular,
    },
  }), [colors]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[gradients.primary[0], gradients.primary[1]]}
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
        <View style={styles.headerRight}>
          <View style={styles.seenBadge}>
            <Text style={styles.seenBadgeText}>{person.seen_count}x</Text>
          </View>
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={16} color={colors.muted} />
          </TouchableOpacity>
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
            placeholderTextColor={colors.muted}
            multiline
          />
          <View style={styles.notesActions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveNotes}>
              <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnOutline}
              onPress={() => {
                setEditing(false);
                setNoteText(person.notes ?? "");
              }}
            >
              <Text style={styles.btnOutlineText}>Cancel</Text>
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
