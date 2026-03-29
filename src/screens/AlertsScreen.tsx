import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from "react-native";
import * as Haptics from "expo-haptics";
import { AlertCard } from "../components/AlertCard";
import { dismissAlert } from "../api/client";
import { colors, spacing, fonts } from "../config/theme";
import { Alert as AlertType } from "../types";

interface AlertsScreenProps {
  alerts: AlertType[];
  loading: boolean;
  onRefresh: () => void;
}

export function AlertsScreen({
  alerts,
  loading,
  onRefresh,
}: AlertsScreenProps) {
  async function handleDismiss(id: string) {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await dismissAlert(id);
      onRefresh();
    } catch {
      // Silently fail — will refresh on next poll
    }
  }

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
      <Text style={styles.sectionLabel}>Unrecognized Face Alerts</Text>
      {alerts.length > 0 ? (
        alerts.map((alert) => (
          <AlertCard
            key={alert._id}
            alert={alert}
            onDismiss={handleDismiss}
          />
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>No alerts — all clear</Text>
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
