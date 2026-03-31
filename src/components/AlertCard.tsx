import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, spacing, fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";
import { Alert as AlertType } from "../types";
import { formatRelativeTime, formatTimeShort } from "../hooks/useDashboardData";

interface AlertCardProps {
  alert: AlertType;
  onDismiss: (id: string) => void;
}

export function AlertCard({ alert, onDismiss }: AlertCardProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.violet100,
      borderRadius: radius.md,
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
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: radius.sm,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
    },
    textWrap: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      color: colors.text,
      ...fonts.medium,
    },
    time: {
      fontSize: 11.5,
      color: colors.muted,
      marginTop: 2,
      ...fonts.regular,
    },
    dismissBtn: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.violet,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: radius.sm,
    },
    dismissText: {
      color: colors.violet,
      fontSize: 11.5,
      ...fonts.medium,
    },
  }), [colors]);

  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <View style={styles.iconWrap}>
          <Ionicons name="person-outline" size={18} color={colors.violet} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Unknown person detected</Text>
          <Text style={styles.time}>
            {formatTimeShort(alert.timestamp)} ·{" "}
            {formatRelativeTime(alert.timestamp)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={() => onDismiss(alert.id ?? alert._id ?? "")}
      >
        <Text style={styles.dismissText}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
}
