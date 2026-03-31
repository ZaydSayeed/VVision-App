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
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: 28,
      color: colors.text,
      ...fonts.display,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.violet,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    addBtnText: {
      fontSize: 14,
      color: "#FAF8F4",
      ...fonts.medium,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.xl,
      marginBottom: spacing.md,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 20,
      color: "#FAF8F4",
      ...fonts.medium,
    },
    patientName: {
      fontSize: 20,
      color: colors.text,
      ...fonts.display,
    },
    statsRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: radius.sm,
      padding: spacing.md,
      alignItems: "center",
    },
    statValue: {
      fontSize: 22,
      color: colors.violet,
      ...fonts.display,
    },
    statLabel: {
      fontSize: 10,
      color: colors.muted,
      ...fonts.medium,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: 2,
      textAlign: "center",
    },
    chevron: {
      position: "absolute",
      right: spacing.xl,
      top: "50%",
    },
    emptyWrap: {
      alignItems: "center",
      paddingTop: 80,
      gap: spacing.md,
    },
    emptyTitle: {
      fontSize: 24,
      color: colors.text,
      ...fonts.display,
    },
    emptySub: {
      fontSize: 15,
      color: colors.muted,
      ...fonts.regular,
      textAlign: "center",
      lineHeight: 22,
    },
    bigAddBtn: {
      width: 100,
      height: 100,
      borderRadius: 50,
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.violet} />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Patients</Text>
        {patients.length > 0 && (
          <TouchableOpacity style={styles.addBtn} onPress={onAddPatient} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color="#FAF8F4" />
            <Text style={styles.addBtnText}>Add Patient</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} />
      ) : patients.length === 0 ? (
        <View style={styles.emptyWrap}>
          <TouchableOpacity style={styles.bigAddBtn} onPress={onAddPatient} activeOpacity={0.85}>
            <Ionicons name="add" size={52} color="#FAF8F4" />
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
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {patient.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.patientName}>{patient.name}</Text>
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
  );
}
