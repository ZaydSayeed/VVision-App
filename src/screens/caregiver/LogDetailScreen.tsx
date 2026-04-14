import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { CheckInLog, LogSummary, summarizeLog } from "../../api/logs";

interface Props {
  patientId: string;
  log: CheckInLog;
  onBack: () => void;
}

export function LogDetailScreen({ patientId, log, onBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateStr = new Date(log.capturedAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const timeStr = new Date(log.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleSummarize = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await summarizeLog(patientId, log);
      setSummary(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    backBar: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    },
    backText: { fontSize: 16, color: colors.text, ...fonts.medium },
    content: { padding: spacing.xl, paddingBottom: 100 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
    metaText: { fontSize: 13, color: colors.muted, ...fonts.regular },
    sourceChip: {
      backgroundColor: colors.violet50, borderRadius: radius.pill,
      paddingHorizontal: spacing.md, paddingVertical: 4,
    },
    sourceText: { fontSize: 11, color: colors.violet, ...fonts.medium },
    sectionLabel: {
      fontSize: 11, color: colors.muted, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.md,
    },
    noteCard: {
      backgroundColor: colors.surface, borderRadius: radius.xl,
      padding: spacing.xl, marginBottom: spacing.xxl,
    },
    noteText: { fontSize: 15, color: colors.text, ...fonts.regular, lineHeight: 24 },
    summarizeBtn: {
      backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: 16, alignItems: "center", marginBottom: spacing.xl,
      flexDirection: "row", justifyContent: "center", gap: spacing.sm,
    },
    summarizeBtnText: { fontSize: 15, color: "#fff", ...fonts.medium },
    summaryCard: {
      backgroundColor: colors.surface, borderRadius: radius.xl,
      padding: spacing.xl, marginBottom: spacing.xl,
    },
    summaryLabel: {
      fontSize: 11, color: colors.violet, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.md,
    },
    bulletRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, alignItems: "flex-start" },
    bullet: { fontSize: 16, color: colors.violet, lineHeight: 22 },
    bulletText: { fontSize: 14, color: colors.text, ...fonts.regular, lineHeight: 22, flex: 1 },
    trendCard: {
      backgroundColor: colors.violet50, borderRadius: radius.xl,
      padding: spacing.xl, borderLeftWidth: 4, borderLeftColor: colors.violet,
    },
    trendLabel: {
      fontSize: 11, color: colors.violet, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase", marginBottom: spacing.sm,
    },
    trendText: { fontSize: 14, color: colors.text, ...fonts.regular, lineHeight: 22 },
    errorText: { fontSize: 13, color: "#dc2626", ...fonts.regular, textAlign: "center", marginBottom: spacing.lg },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={[styles.backBar, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.backText}>{dateStr}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{timeStr}</Text>
          <View style={styles.sourceChip}>
            <Text style={styles.sourceText}>
              {log.source === "voice_check_in" ? "Voice" : "Text"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Note</Text>
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>{log.content}</Text>
        </View>

        {!summary && (
          <TouchableOpacity style={styles.summarizeBtn} onPress={handleSummarize} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.summarizeBtnText}>Summarize with AI</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {summary && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Summary</Text>
              {summary.bullets.map((b, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>

            {summary.trend ? (
              <View style={styles.trendCard}>
                <Text style={styles.trendLabel}>Trend</Text>
                <Text style={styles.trendText}>{summary.trend}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
