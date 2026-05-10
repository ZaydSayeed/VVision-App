import React, { useMemo } from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius, gradients, shadow } from "../config/theme";

export interface HeroStat {
  label: string;
  value: string | number;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

interface HeroStatCardProps {
  stats: [HeroStat, HeroStat];
  toggle?: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    iconName?: keyof typeof Ionicons.glyphMap;
  };
  cta?: {
    label: string;
    onPress: () => void;
  };
}

export function HeroStatCard({ stats, toggle, cta }: HeroStatCardProps) {
  const { colors } = useTheme();
  const [left, right] = stats;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          marginHorizontal: spacing.xl,
          marginBottom: spacing.lg,
          borderRadius: radius.xxl,
          overflow: "hidden",
          ...shadow.lg,
        },
        gradient: {
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        },
        statsRow: {
          flexDirection: "row",
          alignItems: "stretch",
          paddingBottom: spacing.lg,
        },
        statCol: {
          flex: 1,
          paddingHorizontal: spacing.sm,
        },
        statLabel: {
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.65)",
          ...fonts.medium,
          marginBottom: spacing.sm,
        },
        statValueRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
        },
        statValue: {
          fontSize: 30,
          lineHeight: 34,
          color: "#FFFFFF",
          ...fonts.medium,
        },
        divider: {
          width: 1,
          backgroundColor: "rgba(255,255,255,0.18)",
          marginVertical: 4,
        },
        subRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: spacing.md,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.14)",
        },
        subRowLeft: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          flex: 1,
        },
        subLabel: {
          fontSize: 15,
          color: "#FFFFFF",
          ...fonts.medium,
        },
        ctaText: {
          fontSize: 14,
          color: "rgba(255,255,255,0.85)",
          ...fonts.regular,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[...gradients.dark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>{left.label}</Text>
            <View style={styles.statValueRow}>
              <Ionicons name={left.iconName} size={20} color={left.iconColor} />
              <Text style={styles.statValue}>{left.value}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>{right.label}</Text>
            <View style={styles.statValueRow}>
              <Ionicons name={right.iconName} size={20} color={right.iconColor} />
              <Text style={styles.statValue}>{right.value}</Text>
            </View>
          </View>
        </View>

        {toggle && (
          <View style={styles.subRow}>
            <View style={styles.subRowLeft}>
              <Ionicons
                name={toggle.iconName ?? "notifications-outline"}
                size={18}
                color="rgba(255,255,255,0.85)"
              />
              <Text style={styles.subLabel}>{toggle.label}</Text>
            </View>
            <Switch
              value={toggle.value}
              onValueChange={toggle.onChange}
              trackColor={{ false: "rgba(255,255,255,0.18)", true: colors.violet300 }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}

        {cta && (
          <TouchableOpacity
            onPress={cta.onPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={cta.label}
            style={styles.subRow}
          >
            <Text style={styles.ctaText}>{cta.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}
