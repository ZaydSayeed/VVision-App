import React, { useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePatients } from "../../hooks/usePatients";
import { PatientSummary } from "../../types";
import { fonts, spacing, radius } from "../../config/theme";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  onSelectPatient: (patient: PatientSummary) => void;
  onAddPatient: () => void;
}

// Animated progress bar sub-component
function AnimatedBar({ ratio, color }: { ratio: number; color: string }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: ratio,
      duration: 600,
      useNativeDriver: false,
      delay: 100,
    }).start();
  }, [ratio]);

  return (
    <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 999, overflow: "hidden" }}>
      <Animated.View
        style={{
          height: 6,
          borderRadius: 999,
          backgroundColor: color,
          width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
        }}
      />
    </View>
  );
}

function getCompletionRatio(patient: PatientSummary): number {
  const total = (patient.tasksTotal ?? 0) + (patient.medsTotal ?? 0);
  if (total === 0) return 1;
  const done = (patient.tasksDone ?? 0) + (patient.medsDone ?? 0);
  return done / total;
}

export function PatientsDashboardScreen({ onSelectPatient, onAddPatient }: Props) {
  const { colors } = useTheme();
  const { patients, loading, refresh } = usePatients();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 100 },

    // Screen header
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: { flex: 1 },
    screenTitle: {
      fontSize: 28,
      color: colors.text,
      ...fonts.medium,
    },
    patientCount: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 2,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.violet,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      gap: spacing.xs,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 5,
    },
    addBtnText: {
      fontSize: 14,
      color: "#FFFFFF",
      ...fonts.medium,
    },

    // Card
    card: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      marginBottom: spacing.md,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
      overflow: "hidden",
      flexDirection: "row",
    },
    cardAccentStrip: {
      width: 5,
      borderTopLeftRadius: radius.xl,
      borderBottomLeftRadius: radius.xl,
    },
    cardBody: {
      flex: 1,
      padding: spacing.xl,
    },

    // Card top row
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 20,
      color: "#FFFFFF",
      ...fonts.medium,
    },
    cardInfo: { flex: 1 },
    patientName: {
      fontSize: 18,
      color: colors.text,
      ...fonts.medium,
    },
    statusPill: {
      marginTop: 4,
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    statusPillText: {
      fontSize: 11,
      ...fonts.medium,
      letterSpacing: 0.3,
    },
    chevronWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },

    // Progress bars
    progressSection: { gap: spacing.sm },
    progressRow: { gap: 5 },
    progressLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    progressLabel: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.medium,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    progressFraction: {
      fontSize: 11,
      color: colors.muted,
      ...fonts.regular,
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    progressFill: {
      height: 6,
      borderRadius: radius.pill,
    },

    // Empty state
    emptyWrap: {
      alignItems: "center",
      paddingTop: 80,
      gap: spacing.md,
    },
    emptyTitle: {
      fontSize: 22,
      color: colors.text,
      ...fonts.medium,
    },
    emptySub: {
      fontSize: 14,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 22,
    },
    bigAddBtn: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
      marginBottom: spacing.sm,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.screenHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>My Patients</Text>
          {patients.length > 0 && (
            <Text style={styles.patientCount}>{patients.length} under your care</Text>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onAddPatient} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add Patient</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.violet} />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} />
        ) : patients.length === 0 ? (
          <View style={styles.emptyWrap}>
            <TouchableOpacity style={styles.bigAddBtn} onPress={onAddPatient} activeOpacity={0.85}>
              <Ionicons name="add" size={44} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.emptyTitle}>Add a Patient</Text>
            <Text style={styles.emptySub}>
              Link to your first patient using{"\n"}their 6-character code
            </Text>
          </View>
        ) : (
          patients.map((patient) => {
            const ratio = getCompletionRatio(patient);
            const isGood = ratio >= 0.7;
            const accentColor = isGood ? colors.sage : colors.amber;
            const softColor = isGood ? colors.sageSoft : colors.amberSoft;

            const taskRatio = (patient.tasksTotal ?? 0) > 0
              ? (patient.tasksDone ?? 0) / (patient.tasksTotal ?? 1)
              : 1;
            const medRatio = (patient.medsTotal ?? 0) > 0
              ? (patient.medsDone ?? 0) / (patient.medsTotal ?? 1)
              : 1;

            const statusLabel = isGood ? "On track" : "Needs attention";

            return (
              <TouchableOpacity
                key={patient.id}
                style={styles.card}
                onPress={() => onSelectPatient(patient)}
                activeOpacity={0.88}
              >
                {/* Left accent strip */}
                <View style={[styles.cardAccentStrip, { backgroundColor: accentColor }]} />

                <View style={styles.cardBody}>
                  {/* Top row */}
                  <View style={styles.cardRow}>
                    <View style={[styles.avatar, { backgroundColor: accentColor }]}>
                      <Text style={styles.avatarText}>
                        {patient.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.patientName}>{patient.name}</Text>
                      <View style={[styles.statusPill, { backgroundColor: softColor }]}>
                        <Text style={[styles.statusPillText, { color: accentColor }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.chevronWrap}>
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    </View>
                  </View>

                  {/* Progress bars */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressRow}>
                      <View style={styles.progressLabelRow}>
                        <Text style={styles.progressLabel}>Routine</Text>
                        <Text style={styles.progressFraction}>
                          {patient.tasksDone ?? 0}/{patient.tasksTotal ?? 0}
                        </Text>
                      </View>
                      <AnimatedBar ratio={taskRatio} color={colors.sage} />
                    </View>
                    <View style={styles.progressRow}>
                      <View style={styles.progressLabelRow}>
                        <Text style={styles.progressLabel}>Medications</Text>
                        <Text style={styles.progressFraction}>
                          {patient.medsDone ?? 0}/{patient.medsTotal ?? 0}
                        </Text>
                      </View>
                      <AnimatedBar ratio={medRatio} color={colors.amber} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
