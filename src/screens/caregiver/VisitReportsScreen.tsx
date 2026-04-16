import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, TextInput, Modal, Platform,
  KeyboardAvoidingView, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius } from "../../config/theme";
import { listVisits, createVisit } from "../../api/visits";
import { fetchDoctors, Doctor, removeDoctor } from "../../api/doctors";
import { ExportFlowSheet } from "../../components/ExportFlowSheet";

interface Props {
  patientId: string;
  patientName: string;
  onBack: () => void;
}

export default function VisitReportsScreen({ patientId, patientName, onBack }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // --- Visits state ---
  const [visits, setVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- Doctors state ---
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  // --- Schedule form ---
  const [showSchedule, setShowSchedule] = useState(false);
  const [formProvider, setFormProvider] = useState("");
  const [formDate, setFormDate] = useState(new Date());
  const [formNotes, setFormNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // --- Export flow ---
  const [exportOpen, setExportOpen] = useState(false);
  const [exportVisitId, setExportVisitId] = useState<string | undefined>(undefined);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoadingVisits(true);
    try {
      const [v, d] = await Promise.all([
        listVisits(patientId).catch(() => ({ visits: [] })),
        fetchDoctors(patientId).catch(() => []),
      ]);
      setVisits(v.visits ?? []);
      setDoctors(d);
    } finally {
      setLoadingVisits(false);
      setRefreshing(false);
    }
  }, [patientId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSchedule = async () => {
    if (!formProvider.trim()) { Alert.alert("Missing", "Enter a provider name."); return; }
    setScheduling(true);
    try {
      await createVisit(patientId, {
        providerName: formProvider.trim(),
        scheduledFor: formDate.toISOString(),
        notes: formNotes.trim() || undefined,
      });
      setShowSchedule(false);
      setFormProvider("");
      setFormNotes("");
      loadAll(true);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setScheduling(false); }
  };

  const handleDeleteDoctor = (doc: Doctor) => {
    Alert.alert("Remove doctor?", `Remove ${doc.name}?`, [
      { text: "Cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await removeDoctor(patientId, doc.id); setDoctors(prev => prev.filter(d => d.id !== doc.id)); }
        catch (e: any) { Alert.alert("Error", e.message); }
      }},
    ]);
  };

  const openExport = (visitId?: string) => {
    setExportVisitId(visitId);
    setExportOpen(true);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 20, color: colors.text, ...fonts.medium, flex: 1 },
    content: { padding: spacing.xl, paddingBottom: 100 },
    sectionLabel: {
      fontSize: 11, color: colors.violet, ...fonts.medium,
      letterSpacing: 1.2, textTransform: "uppercase",
      marginBottom: spacing.sm, marginTop: spacing.xl,
    },
    card: {
      backgroundColor: colors.bg, borderRadius: radius.lg,
      padding: spacing.lg, marginBottom: spacing.sm,
      borderLeftWidth: 4, borderLeftColor: colors.violet,
      shadowColor: colors.violet, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 10, elevation: 2,
      flexDirection: "row", alignItems: "center", gap: spacing.md,
    },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 15, color: colors.text, ...fonts.medium },
    cardSub: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 },
    pillRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
    pill: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill,
      backgroundColor: colors.violet50,
    },
    pillText: { fontSize: 11, color: colors.violet, ...fonts.medium },
    actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
    actionBtn: {
      flex: 1, backgroundColor: colors.violet, borderRadius: radius.lg,
      paddingVertical: spacing.lg, alignItems: "center", flexDirection: "row",
      justifyContent: "center", gap: spacing.sm,
    },
    actionBtnAlt: {
      flex: 1, borderWidth: 1.5, borderColor: colors.violet, borderRadius: radius.lg,
      paddingVertical: spacing.lg, alignItems: "center", flexDirection: "row",
      justifyContent: "center", gap: spacing.sm,
    },
    actionText: { fontSize: 14, color: "#FFFFFF", ...fonts.medium },
    actionTextAlt: { fontSize: 14, color: colors.violet, ...fonts.medium },
    doctorRow: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    doctorAvatar: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.violet50,
      alignItems: "center", justifyContent: "center",
    },
    doctorInitial: { fontSize: 14, color: colors.violet, ...fonts.medium },
    doctorName: { fontSize: 14, color: colors.text, ...fonts.medium },
    doctorEmail: { fontSize: 11, color: colors.muted, ...fonts.regular },
    emptyText: { fontSize: 14, color: colors.muted, ...fonts.regular, textAlign: "center", paddingVertical: spacing.xl },
    // Schedule modal
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    modalSheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxxl,
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
    modalTitle: { fontSize: 18, color: colors.text, ...fonts.medium, marginBottom: spacing.lg },
    input: {
      height: 48, backgroundColor: colors.surface, borderRadius: radius.md,
      paddingHorizontal: spacing.lg, fontSize: 15, color: colors.text, ...fonts.regular,
      marginBottom: spacing.sm,
    },
    submitBtn: {
      backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.md,
    },
    submitText: { fontSize: 15, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{patientName} — Reports</Text>
      </View>

      {loadingVisits ? (
        <ActivityIndicator color={colors.violet} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(true); }} tintColor={colors.violet} />}
        >
          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openExport()} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionText}>Generate Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnAlt} onPress={() => setShowSchedule(true)} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={18} color={colors.violet} />
              <Text style={styles.actionTextAlt}>Schedule Visit</Text>
            </TouchableOpacity>
          </View>

          {/* Visits */}
          <Text style={styles.sectionLabel}>Visits</Text>
          {visits.length === 0 ? (
            <Text style={styles.emptyText}>No visits scheduled yet.</Text>
          ) : (
            visits.map((v: any) => {
              const date = new Date(v.scheduledFor).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const isPast = new Date(v.scheduledFor) < new Date();
              return (
                <TouchableOpacity key={v._id ?? v.id} style={styles.card} activeOpacity={0.75} onPress={() => openExport(v._id ?? v.id)}>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{v.providerName}</Text>
                    <Text style={styles.cardSub}>{date}</Text>
                    <View style={styles.pillRow}>
                      <View style={[styles.pill, isPast && { backgroundColor: colors.surface }]}>
                        <Text style={[styles.pillText, isPast && { color: colors.muted }]}>
                          {isPast ? "Completed" : "Upcoming"}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="document-text-outline" size={20} color={colors.violet} />
                </TouchableOpacity>
              );
            })
          )}

          {/* Doctors */}
          <Text style={styles.sectionLabel}>Saved Doctors</Text>
          {doctors.length === 0 ? (
            <Text style={styles.emptyText}>No doctors saved yet. Add one during your first export.</Text>
          ) : (
            doctors.map(d => (
              <TouchableOpacity key={d.id} style={styles.doctorRow} onLongPress={() => handleDeleteDoctor(d)} activeOpacity={0.7}>
                <View style={styles.doctorAvatar}>
                  <Text style={styles.doctorInitial}>{d.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doctorName}>{d.name}</Text>
                  <Text style={styles.doctorEmail}>{d.email}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Schedule Visit Modal */}
      <Modal visible={showSchedule} transparent animationType="slide" onRequestClose={() => setShowSchedule(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSchedule(false)}>
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Schedule a Visit</Text>
              <TextInput style={styles.input} placeholder="Doctor / provider name" placeholderTextColor={colors.muted} value={formProvider} onChangeText={setFormProvider} />
              <View style={{ marginVertical: spacing.sm }}>
                <Text style={{ fontSize: 12, color: colors.muted, ...fonts.medium, marginBottom: spacing.xs }}>Date & time</Text>
                <DateTimePicker value={formDate} mode="datetime" display="default" minimumDate={new Date()} onChange={(_, d) => d && setFormDate(d)} />
              </View>
              <TextInput style={[styles.input, { height: 72, textAlignVertical: "top" }]} placeholder="Notes (optional)" placeholderTextColor={colors.muted} value={formNotes} onChangeText={setFormNotes} multiline />
              <TouchableOpacity style={styles.submitBtn} onPress={handleSchedule} disabled={scheduling} activeOpacity={0.8}>
                <Text style={styles.submitText}>{scheduling ? "Saving…" : "Schedule"}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Export Flow */}
      <ExportFlowSheet visible={exportOpen} patientId={patientId} visitId={exportVisitId} onClose={() => setExportOpen(false)} />
    </View>
  );
}
