import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { spacing, fonts, radius } from "../../config/theme";
import { MOCK_PATIENT_CONFIG, PatientProfileConfig } from "../../data/glassesMockData";

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionHeader({ title, icon, color, bg }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md, marginTop: spacing.xl }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={{ fontSize: 13, ...fonts.medium, color: colors.muted, letterSpacing: 1.1, textTransform: "uppercase" }}>
        {title}
      </Text>
    </View>
  );
}

function ToggleRow({ label, sublabel, value, onToggle }: {
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: colors.text, ...fonts.regular }}>{label}</Text>
        {sublabel && <Text style={{ fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 }}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(v);
        }}
        trackColor={{ false: "#E0DBF5", true: "#7B5CE7" }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function StepperRow({ label, value, unit, min, max, step, onChange }: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      <Text style={{ flex: 1, fontSize: 15, color: colors.text, ...fonts.regular }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(min, value - step))}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.surface,
            alignItems: "center", justifyContent: "center",
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={16} color={colors.muted} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, color: colors.text, ...fonts.medium, minWidth: 52, textAlign: "center" }}>
          {value} {unit}
        </Text>
        <TouchableOpacity
          onPress={() => onChange(Math.min(max, value + step))}
          style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.surface,
            alignItems: "center", justifyContent: "center",
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HourRow({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  function fmt(h: number): string {
    const ampm = h < 12 ? "AM" : "PM";
    const hh = h === 0 || h === 24 ? 12 : h > 12 ? h - 12 : h;
    return `${hh}:00 ${ampm}`;
  }
  return (
    <StepperRow
      label={label}
      value={value}
      unit=""
      min={0}
      max={23}
      step={1}
      onChange={(v) => onChange(v)}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function PatientProfileConfigScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const [config, setConfig] = useState<PatientProfileConfig>(MOCK_PATIENT_CONFIG);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof PatientProfileConfig>(key: K, val: PatientProfileConfig[K]) {
    setConfig((c) => ({ ...c, [key]: val }));
    setSaved(false);
  }

  function updateNightMode<K extends keyof PatientProfileConfig["night_mode"]>(
    key: K,
    val: PatientProfileConfig["night_mode"][K]
  ) {
    setConfig((c) => ({ ...c, night_mode: { ...c.night_mode, [key]: val } }));
    setSaved(false);
  }

  function updateNutrition<K extends keyof PatientProfileConfig["nutrition"]>(
    key: K,
    val: PatientProfileConfig["nutrition"][K]
  ) {
    setConfig((c) => ({ ...c, nutrition: { ...c.nutrition, [key]: val } }));
    setSaved(false);
  }

  function handleSave() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    // TODO: write to MongoDB `patient_profile` + `night_mode_config` collections
  }

  function fmtHour(h: number): string {
    const ampm = h < 12 ? "AM" : "PM";
    const hh = h === 0 || h === 24 ? 12 : h > 12 ? h - 12 : h;
    return `${hh}:00 ${ampm}`;
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.md,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: "center", justifyContent: "center",
    },
    headerMeta: { flex: 1 },
    headerTitle: { fontSize: 24, color: colors.text, ...fonts.medium },
    headerSub: { fontSize: 13, color: colors.muted, ...fonts.regular, marginTop: 2 },
    saveBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: saved ? colors.sageSoft : colors.violet,
    },
    saveBtnText: { fontSize: 14, color: saved ? colors.sage : "#FFFFFF", ...fonts.medium },
    content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
      paddingTop: spacing.md,
      marginBottom: spacing.sm,
    },
    infoCard: {
      backgroundColor: colors.violet50,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    infoText: { flex: 1, fontSize: 13, color: colors.subtext, ...fonts.regular, lineHeight: 18 },
  }), [colors, saved]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Glasses Config</Text>
          <Text style={styles.headerSub}>Controls how the glasses behave</Text>
        </View>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{saved ? "Saved ✓" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.infoCard}>
          <Ionicons name="glasses" size={18} color={colors.violet} />
          <Text style={styles.infoText}>
            These settings are read by the glasses. Changes will take effect on the next glasses restart.
          </Text>
        </View>

        {/* Night Mode */}
        <SectionHeader title="Night Mode" icon="moon" color={colors.violet} bg={colors.violet50} />
        <View style={styles.card}>
          <ToggleRow
            label="Enable night mode"
            sublabel="Suppresses check-ins and dims responses"
            value={config.night_mode.enabled}
            onToggle={(v) => updateNightMode("enabled", v)}
          />
          {config.night_mode.enabled && (
            <>
              <StepperRow
                label="Start"
                value={config.night_mode.start_hour}
                unit={fmtHour(config.night_mode.start_hour).split(" ")[1]}
                min={18}
                max={23}
                step={1}
                onChange={(v) => updateNightMode("start_hour", v)}
              />
              <StepperRow
                label="End"
                value={config.night_mode.end_hour}
                unit={fmtHour(config.night_mode.end_hour).split(" ")[1]}
                min={4}
                max={10}
                step={1}
                onChange={(v) => updateNightMode("end_hour", v)}
              />
              <ToggleRow
                label="Movement alerts"
                sublabel="Alert if patient leaves bed for 5+ minutes"
                value={config.night_mode.movement_alert}
                onToggle={(v) => updateNightMode("movement_alert", v)}
              />
            </>
          )}
        </View>

        {/* Nutrition */}
        <SectionHeader title="Nutrition Thresholds" icon="restaurant" color={colors.sage} bg={colors.sageSoft} />
        <View style={styles.card}>
          <StepperRow
            label="Warn if no meal by"
            value={config.nutrition.warn_no_meal_by_hour}
            unit={fmtHour(config.nutrition.warn_no_meal_by_hour)}
            min={10}
            max={16}
            step={1}
            onChange={(v) => updateNutrition("warn_no_meal_by_hour", v)}
          />
          <StepperRow
            label="Alert if no meal by"
            value={config.nutrition.alert_no_meal_by_hour}
            unit={fmtHour(config.nutrition.alert_no_meal_by_hour)}
            min={12}
            max={18}
            step={1}
            onChange={(v) => updateNutrition("alert_no_meal_by_hour", v)}
          />
          <StepperRow
            label="Alert if no drink for"
            value={config.nutrition.alert_no_drink_by_hours}
            unit="hrs"
            min={1}
            max={6}
            step={1}
            onChange={(v) => updateNutrition("alert_no_drink_by_hours", v)}
          />
        </View>

        {/* Daily Digest */}
        <SectionHeader title="Daily Digest" icon="document-text" color={colors.amber} bg={colors.amberSoft} />
        <View style={styles.card}>
          <StepperRow
            label="Send digest at"
            value={config.digest_hour}
            unit={fmtHour(config.digest_hour)}
            min={17}
            max={23}
            step={1}
            onChange={(v) => update("digest_hour", v)}
          />
        </View>

        {/* Sundowning */}
        <SectionHeader title="Sundowning Window" icon="partly-sunny" color={colors.amber} bg={colors.amberSoft} />
        <View style={styles.card}>
          <ToggleRow
            label="Auto-detect window"
            sublabel="Glasses learn the patient's personal pattern"
            value={config.sundowning_auto}
            onToggle={(v) => update("sundowning_auto", v)}
          />
          {!config.sundowning_auto && (
            <>
              <StepperRow
                label="Window start"
                value={config.sundowning_start_hour}
                unit={fmtHour(config.sundowning_start_hour)}
                min={12}
                max={18}
                step={1}
                onChange={(v) => update("sundowning_start_hour", v)}
              />
              <StepperRow
                label="Window end"
                value={config.sundowning_end_hour}
                unit={fmtHour(config.sundowning_end_hour)}
                min={16}
                max={22}
                step={1}
                onChange={(v) => update("sundowning_end_hour", v)}
              />
            </>
          )}
        </View>

      </ScrollView>
    </View>
  );
}
