import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing } from "../../config/theme";
import { GreetingIcon } from "../../utils/greeting";

interface GreetingHeaderProps {
  greeting: { text: string; icon: GreetingIcon };
  firstName: string;
  notifCount: number;
  onOpenNotifs: () => void;
}

/** Patient home top header: time-of-day greeting, first name, and the reminders bell. */
export function GreetingHeader({ greeting, firstName, notifCount, onOpenNotifs }: GreetingHeaderProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      backgroundColor: colors.warm,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    greetingGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      flex: 1,
    },
    buddyEmoji: {
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    greetingLineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    greetingLine: {
      fontSize: 20,
      color: colors.subtext,
      ...fonts.regular,
    },
    greetingName: {
      fontSize: 40,
      color: colors.text,
      ...fonts.medium,
      lineHeight: 46,
    },
    greetingAccent: {
      color: colors.violet,
    },
    notifBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.warmSurface,
      alignItems: "center",
      justifyContent: "center",
    },
    notifBadge: {
      position: "absolute",
      top: 6,
      right: 6,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: colors.warm,
    },
    notifBadgeText: { fontSize: 12, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.greetingGroup}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.buddyEmoji}
          >
            <Ionicons name="flower-outline" size={44} color={colors.violet} />
          </View>
          <View>
            <View style={styles.greetingLineRow}>
              <Ionicons name={greeting.icon} size={16} color={colors.amber} />
              <Text style={styles.greetingLine}>{greeting.text},</Text>
            </View>
            <Text style={styles.greetingName}>
              <Text style={styles.greetingAccent}>{firstName}</Text>
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={onOpenNotifs} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="Reminders">
          <Ionicons name="notifications" size={22} color={colors.violet} />
          {notifCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{notifCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
