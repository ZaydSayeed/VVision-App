import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { spacing, fonts, radius, gradients } from "../../config/theme";

interface Props {
  onBack: () => void;
  onNavigate: (screen: "alerts" | "digest" | "config" | "nutrition" | "repetitions") => void;
}

interface HubTile {
  id: "alerts" | "digest" | "config" | "nutrition" | "repetitions";
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: readonly [string, string];
}

export default function GlassesHubScreen({ onBack, onNavigate }: Props) {
  const { colors } = useTheme();

  // No live data yet — the glasses hardware ships later. These tiles preview the
  // features; the data-bearing ones open an honest "Coming soon" screen (CG-2).
  const tiles: HubTile[] = [
    {
      id: "alerts",
      title: "Alert Feed",
      subtitle: "Prioritized safety alerts",
      icon: "notifications",
      gradientColors: ["#C0392B", "#D95F5F"],
    },
    {
      id: "digest",
      title: "Daily Digest",
      subtitle: "Plain-language end-of-day recap",
      icon: "document-text",
      gradientColors: gradients.amber,
    },
    {
      id: "nutrition",
      title: "Nutrition",
      subtitle: "Eating & hydration timeline",
      icon: "restaurant",
      gradientColors: gradients.sage,
    },
    {
      id: "repetitions",
      title: "Repetitions",
      subtitle: "Weekly pattern view",
      icon: "repeat",
      gradientColors: gradients.primary,
    },
    {
      id: "config",
      title: "Glasses Config",
      subtitle: "Night mode, alerts, thresholds",
      icon: "settings",
      gradientColors: ["#5A40D0", "#7B5CE7"],
    },
  ];

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    backText: { fontSize: 14, color: colors.muted, ...fonts.regular },

    // Hero banner
    banner: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginHorizontal: spacing.xl,
      marginBottom: spacing.xl,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    bannerIconWrap: {
      width: 56, height: 56, borderRadius: 28,
      overflow: "hidden",
    },
    bannerGradient: {
      width: 56, height: 56, borderRadius: 28,
      alignItems: "center", justifyContent: "center",
    },
    bannerText: { flex: 1 },
    bannerTitle: { fontSize: 18, color: colors.text, ...fonts.medium },
    bannerSub: { fontSize: 13, color: colors.muted, ...fonts.regular, marginTop: 3 },
    soonChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.violet50 ?? colors.surface,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    soonText: { fontSize: 11, color: colors.violet, ...fonts.medium },

    // Grid
    grid: {
      paddingHorizontal: spacing.xl,
      gap: spacing.sm,
      paddingBottom: 100,
    },
    row: { flexDirection: "row", gap: spacing.sm },

    // Tile
    tile: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      overflow: "hidden",
    },
    tileLarge: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      overflow: "hidden",
      marginBottom: 0,
    },
    tileInner: { padding: spacing.xl },
    tileIconWrap: {
      width: 44, height: 44, borderRadius: 22,
      overflow: "hidden",
      marginBottom: spacing.md,
    },
    tileGradient: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: "center", justifyContent: "center",
    },
    tileTitle: { fontSize: 15, color: colors.text, ...fonts.medium, marginBottom: 3 },
    tileSub: { fontSize: 12, color: colors.muted, ...fonts.regular, lineHeight: 17 },
    chevron: {
      position: "absolute", bottom: spacing.lg, right: spacing.lg,
    },
  }), [colors]);

  function Tile({ tile, large }: { tile: HubTile; large?: boolean }) {
    return (
      <TouchableOpacity
        style={large ? styles.tileLarge : styles.tile}
        onPress={() => onNavigate(tile.id)}
        activeOpacity={0.82}
      >
        <View style={styles.tileInner}>
          <View style={styles.tileIconWrap}>
            <LinearGradient colors={[...tile.gradientColors]} style={styles.tileGradient}>
              <Ionicons name={tile.icon} size={20} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.tileTitle}>{tile.title}</Text>
          <Text style={styles.tileSub}>{tile.subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={colors.muted} style={styles.chevron} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backRow}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.backText}>Back</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIconWrap}>
            <LinearGradient colors={[...gradients.primary]} style={styles.bannerGradient}>
              <Ionicons name="glasses" size={26} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Glasses Dashboard</Text>
            <Text style={styles.bannerSub}>Available when your Vela glasses arrive</Text>
          </View>
          <View style={styles.soonChip}>
            <Ionicons name="time-outline" size={12} color={colors.violet} />
            <Text style={styles.soonText}>Soon</Text>
          </View>
        </View>

        {/* Tiles */}
        <View style={styles.grid}>
          {/* Alert feed — full width */}
          <Tile tile={tiles[0]} large />

          {/* Digest + Nutrition — side by side */}
          <View style={styles.row}>
            <Tile tile={tiles[1]} />
            <Tile tile={tiles[2]} />
          </View>

          {/* Repetitions + Config — side by side */}
          <View style={styles.row}>
            <Tile tile={tiles[3]} />
            <Tile tile={tiles[4]} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
