import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { PersonCard } from "../components/PersonCard";
import { colors, spacing, fonts } from "../config/theme";
import { Person } from "../types";

interface PeopleScreenProps {
  people: Person[];
  loading: boolean;
  onRefresh: () => void;
}

export function PeopleScreen({ people, loading, onRefresh }: PeopleScreenProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={colors.accentBlue}
        />
      }
    >
      <Text style={styles.sectionLabel}>Known People</Text>
      {people.length > 0 ? (
        people.map((person) => (
          <PersonCard
            key={person._id}
            person={person}
            onRefresh={onRefresh}
          />
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>No people enrolled yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 100,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    ...fonts.bold,
    paddingBottom: spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    opacity: 0.5,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
