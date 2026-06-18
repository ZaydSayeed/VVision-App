import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../context/ThemeContext";
import { spacing, fonts, radius, gradients } from "../config/theme";

interface Props {
  onBack?: () => void;
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Short list of what this feature will do once the glasses ship. */
  bullets?: string[];
}

/**
 * Honest placeholder for a glasses-dependent feature.
 *
 * The app ships before the Vela glasses hardware exists, so every glasses
 * surface shows this preview instead of fabricated "Live" data — that fake
 * data was a deceptive-data App Store risk and a false-safety risk (CG-2).
 */
export function GlassesComingSoon({ onBack, title, description, icon = "glasses", bullets }: Props) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    backRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    backText: { fontSize: 14, color: colors.muted, ...fonts.regular },

    content: { alignItems: "center", paddingHorizontal: spacing.xxl, paddingTop: spacing.xxxl, paddingBottom: 120 },
    iconWrap: { width: 88, height: 88, borderRadius: 44, overflow: "hidden", marginBottom: spacing.xl },
    iconGradient: { width: 88, height: 88, alignItems: "center", justifyContent: "center" },

    chip: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: colors.violet50 ?? colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md, paddingVertical: 6,
      marginBottom: spacing.lg,
    },
    chipText: {
      fontSize: 11, color: colors.violet, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
    },

    title: { fontSize: 26, color: colors.text, ...fonts.medium, textAlign: "center", marginBottom: spacing.sm },
    desc: { fontSize: 15, color: colors.muted, ...fonts.regular, textAlign: "center", lineHeight: 22, marginBottom: spacing.xl },

    bulletCard: {
      width: "100%", backgroundColor: colors.surface, borderRadius: radius.xl,
      padding: spacing.xl, gap: spacing.md, marginBottom: spacing.xl,
    },
    bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    bulletText: { flex: 1, fontSize: 14, color: colors.text, ...fonts.regular, lineHeight: 20 },

    note: { fontSize: 13, color: colors.muted, ...fonts.regular, textAlign: "center", lineHeight: 19 },
  }), [colors]);

  return (
    <View style={styles.container}>
      {onBack && (
        <View style={styles.header}>
          <View style={styles.backRow}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.backText}>Back</Text>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <LinearGradient colors={[...gradients.primary]} style={styles.iconGradient}>
            <Ionicons name={icon} size={40} color="#FFFFFF" />
          </LinearGradient>
        </View>

        <View style={styles.chip}>
          <Ionicons name="time-outline" size={13} color={colors.violet} />
          <Text style={styles.chipText}>Coming soon</Text>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{description}</Text>

        {bullets && bullets.length > 0 && (
          <View style={styles.bulletCard}>
            {bullets.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.violet} />
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.note}>
          This unlocks when your Vela glasses arrive. We'll let you know the moment it's ready.
        </Text>
      </ScrollView>
    </View>
  );
}
