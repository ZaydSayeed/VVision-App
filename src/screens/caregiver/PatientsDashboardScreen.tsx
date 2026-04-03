import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
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

export function PatientsDashboardScreen({ onSelectPatient, onAddPatient }: Props) {
  const { colors } = useTheme();
  const { patients, loading, refresh } = usePatients();

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.xl, paddingBottom: 100 },

    // Screen header
    screenHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    screenTitle: {
      fontSize: 28,
      color: colors.text,
      ...fonts.medium,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.violet,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    addBtnText: {
      fontSize: 13,
      color: "#FFFFFF",
      ...fonts.medium,
    },

    card: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: spacing.xl,
      marginBottom: spacing.md,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    cardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.violet,
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
    patientStats: {
      fontSize: 13,
      color: colors.muted,
      ...fonts.regular,
      marginTop: 3,
    },
    chevronWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },

    // Stats below (shown on tap/expanded — keep simple for now)
    statsRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.surface,
    },
    statBox: {
      flex: 1,
      alignItems: "center",
    },
    statValue: {
      fontSize: 22,
      color: colors.violet,
      ...fonts.medium,
    },
    statLabel: {
      fontSize: 10,
      color: colors.muted,
      ...fonts.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginTop: 2,
      textAlign: "center",
    },

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
        <Text style={styles.screenTitle}>My Patients</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAddPatient} activeOpacity={0.85}>
          <Ionicons name="add" size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
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
          patients.map((patient) => (
            <TouchableOpacity
              key={patient.id}
              style={styles.card}
              onPress={() => onSelectPatient(patient)}
              activeOpacity={0.88}
            >
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {patient.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.patientName}>{patient.name}</Text>
                  <Text style={styles.patientStats}>
                    {patient.tasksDone}/{patient.tasksTotal} tasks · {patient.medsDone}/{patient.medsTotal} meds
                  </Text>
                </View>
                <View style={styles.chevronWrap}>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {patient.tasksDone}/{patient.tasksTotal}
                  </Text>
                  <Text style={styles.statLabel}>Routine Done</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>
                    {patient.medsDone}/{patient.medsTotal}
                  </Text>
                  <Text style={styles.statLabel}>Meds Taken</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
