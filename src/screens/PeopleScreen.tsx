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
          tintColor={colors.violet}
        />
      }
    >
      <Text style={styles.sectionLabel}>Known People</Text>
      {people.length > 0 ? (
        people.map((person) => (
          <PersonCard
            key={person.id ?? person._id}
            person={person}
            onRefresh={onRefresh}
          />
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No people enrolled yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: 100,
  },
  sectionLabel: {
    fontSize: 10,
    color: colors.lavender,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    ...fonts.medium,
    paddingBottom: spacing.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    ...fonts.regular,
  },
});
