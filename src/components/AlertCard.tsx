import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radius, spacing, fonts } from "../config/theme";
import { Alert as AlertType } from "../types";
import { formatRelativeTime, formatTimeShort } from "../hooks/useDashboardData";

interface AlertCardProps {
  alert: AlertType;
  onDismiss: (id: string) => void;
}

export function AlertCard({ alert, onDismiss }: AlertCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>👤</Text>
        </View>
        <View>
          <Text style={styles.text}>Unknown person detected</Text>
          <Text style={styles.time}>
            {formatTimeShort(alert.timestamp)} ·{" "}
            {formatRelativeTime(alert.timestamp)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={() => onDismiss(alert._id)}
      >
        <Text style={styles.dismissText}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(127,29,29,0.15)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.2)",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm + 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: "rgba(248,113,113,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 18,
  },
  text: {
    fontSize: 14,
    color: "#fca5a5",
    ...fonts.medium,
  },
  time: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  dismissBtn: {
    backgroundColor: "rgba(248,113,113,0.15)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dismissText: {
    color: "#fca5a5",
    fontSize: 11.5,
    ...fonts.semibold,
  },
});
