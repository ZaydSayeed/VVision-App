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
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    info: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      flex: 1,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.violet50,
      alignItems: "center",
      justifyContent: "center",
    },
    textWrap: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      color: colors.text,
      ...fonts.medium,
    },
    time: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
      ...fonts.regular,
    },
    dismissBtn: {
      backgroundColor: colors.violet50,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: radius.pill,
    },
    dismissText: {
      color: colors.violet,
      fontSize: 12,
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
