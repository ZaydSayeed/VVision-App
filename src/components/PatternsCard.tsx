import React, { useEffect, useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { listPatterns, dismissPattern } from "../api/patterns";
import { useCurrentProfile } from "../hooks/useCurrentProfile";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius, typography } from "../config/theme";

export default function PatternsCard() {
  const { patientId } = useCurrentProfile();
  const { colors } = useTheme();
  const [patterns, setPatterns] = useState<any[]>([]);

  const load = async () => {
    if (patientId) {
      try {
        const r = await listPatterns(patientId);
        setPatterns(r.patterns.filter((p: any) => !p.dismissedAt));
      } catch {}
    }
  };
  useEffect(() => { load(); }, [patientId]);

  const styles = useMemo(() => StyleSheet.create({
    wrap: {
      backgroundColor: colors.violet50,
      padding: spacing.lg,
      borderRadius: radius.lg,
      marginVertical: spacing.md,
    },
    label: {
      ...typography.labelStyle,
      ...fonts.medium,
      color: colors.violet,
      marginBottom: spacing.sm,
    },
    patternCard: {
      width: 260,
      marginRight: spacing.md,
      backgroundColor: colors.bg,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    patternTitle: { fontSize: 14, ...fonts.medium, color: colors.text },
    patternDesc: { fontSize: 13, lineHeight: 19, ...fonts.regular, color: colors.subtext, marginTop: spacing.xs },
    dismissBtn: { marginTop: spacing.sm, minHeight: 32, justifyContent: "center" as const, alignSelf: "flex-start" as const },
    dismissText: { color: colors.violet, fontSize: 13, ...fonts.medium },
  }), [colors]);

  if (patterns.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Patterns we've noticed</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {patterns.slice(0, 5).map((p: any) => (
          <View key={p._id} style={styles.patternCard}>
            <Text style={styles.patternTitle}>{p.title}</Text>
            <Text style={styles.patternDesc}>{p.description}</Text>
            <Pressable
              onPress={async () => { if (patientId) { await dismissPattern(patientId, p._id); load(); } }}
              style={styles.dismissBtn}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
