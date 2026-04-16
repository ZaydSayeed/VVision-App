import React, { useState, useMemo } from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { cacheDirectory, writeAsStringAsync, EncodingType } from "expo-file-system/legacy";
import * as Clipboard from "expo-clipboard";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../context/ThemeContext";
import { fonts, spacing, radius } from "../config/theme";
import { generateReport, emailReport, generateReportLink } from "../api/reports";
import { Doctor } from "../api/doctors";
import { DoctorPickerSheet } from "./DoctorPickerSheet";

interface Props {
  visible: boolean;
  patientId: string;
  visitId?: string;
  onClose: () => void;
}

type Step = "range" | "deliver";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export function ExportFlowSheet({ visible, patientId, visitId, onClose }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>("range");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(new Date(Date.now() - 30 * 86400000));
  const [customEnd, setCustomEnd] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [doctorPickerOpen, setDoctorPickerOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const pickPreset = (days: number) => {
    setStartDate(daysAgo(days));
    setEndDate(today);
    setStep("deliver");
  };

  const confirmCustom = () => {
    setStartDate(customStart.toISOString().slice(0, 10));
    setEndDate(customEnd.toISOString().slice(0, 10));
    setShowCustom(false);
    setStep("deliver");
  };

  const reset = () => {
    setStep("range");
    setStartDate("");
    setEndDate("");
    setShowCustom(false);
    setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  // --- Share via native share sheet ---
  const handleShare = async () => {
    setLoading(true);
    try {
      const blob = await generateReport(patientId, startDate, endDate, visitId);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const fileUri = cacheDirectory + "care_report.pdf";
        await writeAsStringAsync(fileUri, base64, { encoding: EncodingType.Base64 });
        await Sharing.shareAsync(fileUri, { mimeType: "application/pdf" });
        handleClose();
      };
      reader.readAsDataURL(blob);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); }
  };

  // --- Email to doctor ---
  const handleEmailSelect = (doctor: Doctor) => {
    setDoctorPickerOpen(false);
    sendEmail(doctor);
  };

  const sendEmail = async (doctor: Doctor) => {
    setLoading(true);
    try {
      const result = await emailReport(patientId, startDate, endDate, doctor.id, visitId);
      Alert.alert("Sent", `Report emailed to ${result.sentTo}`);
      handleClose();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); }
  };

  // --- Copy link ---
  const handleCopyLink = async () => {
    setLoading(true);
    try {
      const result = await generateReportLink(patientId, startDate, endDate, visitId);
      await Clipboard.setStringAsync(result.url);
      Alert.alert("Link Copied", "The report link has been copied to your clipboard. It expires in 24 hours.");
      handleClose();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); }
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
      paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxxl,
    },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
    title: { fontSize: 18, color: colors.text, ...fonts.medium, marginBottom: spacing.sm },
    subtitle: { fontSize: 13, color: colors.muted, ...fonts.regular, marginBottom: spacing.xl },
    presetBtn: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
      marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    presetText: { fontSize: 15, color: colors.text, ...fonts.medium },
    deliverBtn: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
      marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md,
    },
    deliverIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.violet50, alignItems: "center", justifyContent: "center" },
    deliverText: { fontSize: 15, color: colors.text, ...fonts.medium },
    deliverSub: { fontSize: 12, color: colors.muted, ...fonts.regular },
    backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.lg },
    backText: { fontSize: 14, color: colors.violet, ...fonts.regular },
    customRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
    customLabel: { fontSize: 12, color: colors.muted, ...fonts.medium, marginBottom: spacing.xs },
    confirmBtn: {
      backgroundColor: colors.violet, borderRadius: radius.pill,
      paddingVertical: spacing.md, alignItems: "center",
    },
    confirmText: { fontSize: 15, color: "#FFFFFF", ...fonts.medium },
  }), [colors]);

  return (
    <>
      <Modal visible={visible && !doctorPickerOpen} transparent animationType="slide" onRequestClose={handleClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />

            {loading ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.xxxxl }}>
                <ActivityIndicator size="large" color={colors.violet} />
                <Text style={{ ...fonts.regular, color: colors.muted, marginTop: spacing.lg, fontSize: 14 }}>
                  Generating report…
                </Text>
              </View>
            ) : step === "range" ? (
              <>
                <Text style={styles.title}>Generate Report</Text>
                <Text style={styles.subtitle}>Pick a time range for the report.</Text>

                <TouchableOpacity style={styles.presetBtn} onPress={() => pickPreset(7)} activeOpacity={0.7}>
                  <Text style={styles.presetText}>Last 7 days</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetBtn} onPress={() => pickPreset(30)} activeOpacity={0.7}>
                  <Text style={styles.presetText}>Last 30 days</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetBtn} onPress={() => pickPreset(90)} activeOpacity={0.7}>
                  <Text style={styles.presetText}>Last 90 days</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetBtn} onPress={() => setShowCustom(true)} activeOpacity={0.7}>
                  <Text style={styles.presetText}>Custom range</Text>
                  <Ionicons name="calendar-outline" size={16} color={colors.muted} />
                </TouchableOpacity>

                {showCustom && (
                  <View style={{ marginTop: spacing.lg }}>
                    <View style={styles.customRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customLabel}>From</Text>
                        <DateTimePicker value={customStart} mode="date" display="default" maximumDate={customEnd} onChange={(_, d) => d && setCustomStart(d)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customLabel}>To</Text>
                        <DateTimePicker value={customEnd} mode="date" display="default" maximumDate={new Date()} minimumDate={customStart} onChange={(_, d) => d && setCustomEnd(d)} />
                      </View>
                    </View>
                    <TouchableOpacity style={styles.confirmBtn} onPress={confirmCustom} activeOpacity={0.8}>
                      <Text style={styles.confirmText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep("range")} activeOpacity={0.7}>
                  <Ionicons name="chevron-back" size={16} color={colors.violet} />
                  <Text style={styles.backText}>Change dates</Text>
                </TouchableOpacity>
                <Text style={styles.title}>How do you want to share?</Text>
                <Text style={styles.subtitle}>{startDate} — {endDate}</Text>

                <TouchableOpacity style={styles.deliverBtn} onPress={handleShare} activeOpacity={0.7}>
                  <View style={styles.deliverIcon}>
                    <Ionicons name="share-outline" size={20} color={colors.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliverText}>Share</Text>
                    <Text style={styles.deliverSub}>AirDrop, Mail, Messages, Files…</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deliverBtn} onPress={() => setDoctorPickerOpen(true)} activeOpacity={0.7}>
                  <View style={styles.deliverIcon}>
                    <Ionicons name="mail-outline" size={20} color={colors.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliverText}>Email to doctor</Text>
                    <Text style={styles.deliverSub}>Send directly from the app</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deliverBtn} onPress={handleCopyLink} activeOpacity={0.7}>
                  <View style={styles.deliverIcon}>
                    <Ionicons name="link-outline" size={20} color={colors.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliverText}>Copy link</Text>
                    <Text style={styles.deliverSub}>Shareable link, expires in 24h</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <DoctorPickerSheet
        visible={doctorPickerOpen}
        patientId={patientId}
        onSelect={handleEmailSelect}
        onClose={() => setDoctorPickerOpen(false)}
      />
    </>
  );
}
