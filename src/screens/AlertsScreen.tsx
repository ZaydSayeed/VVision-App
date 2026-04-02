import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AlertCard } from "../components/AlertCard";
import { dismissAlert } from "../api/client";
import { useHelpAlert } from "../hooks/useHelpAlert";
import { SectionHeader } from "../components/shared/SectionHeader";
import { EmptyState } from "../components/shared/EmptyState";
import { spacing, fonts, radius } from "../config/theme";
import { useTheme } from "../context/ThemeContext";
import { Alert as AlertType } from "../types";
import { formatRelativeTime } from "../hooks/useDashboardData";

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
  const { colors } = useTheme();
  const { alerts: helpAlerts, dismissAlert: dismissHelp } = useHelpAlert();
  const pendingHelp = helpAlerts.filter((a) => !a.dismissed);

  async function handleDismissApiAlert(id: string) {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await dismissAlert(id);
      onRefresh();
    } catch {
      // Silently fail — will refresh on next poll
    }
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 100 },
    helpCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: spacing.md,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 3,
    },
    helpIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
    },
    helpIconText: {},
    helpInfo: { flex: 1 },
    helpTitle: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
    },
    helpTime: {
      fontSize: 12,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 2,
    },
    dismissBtn: {
      borderWidth: 1.5,
      borderColor: colors.violet,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    dismissText: {
      fontSize: 12,
      color: colors.violet,
      ...fonts.medium,
    },
    section: { marginTop: spacing.xxl },
  }), [colors]);

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
      {/* Help Requests Section */}
      <SectionHeader label="Help Requests" />
      {pendingHelp.length === 0 ? (
        <EmptyState
          title="All clear"
          subtitle="No help requests from patient"
        />
      ) : (
        pendingHelp.map((alert) => (
          <View key={alert.id} style={styles.helpCard}>
            <View style={styles.helpIcon}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.violet} />
            </View>
            <View style={styles.helpInfo}>
              <Text style={styles.helpTitle}>Patient needs help</Text>
              <Text style={styles.helpTime}>
                {formatRelativeTime(alert.timestamp)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => dismissHelp(alert.id)}
            >
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Face Recognition Alerts Section */}
      <View style={styles.section}>
        <SectionHeader label="Unrecognized Faces" />
        {alerts.length === 0 ? (
          <EmptyState
            title="No alerts"
            subtitle="All detected faces are recognized"
          />
        ) : (
          alerts.map((alert) => (
            <AlertCard
              key={alert.id ?? alert._id}
              alert={alert}
              onDismiss={handleDismissApiAlert}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}
