import React, { useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Modal, Pressable, Animated, StyleSheet, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { fonts, spacing, radius, shadow } from "../../config/theme";
import { RoutineTask, Medication } from "../../types";

const SCREEN_W = Dimensions.get("window").width;
const PANEL_WIDTH = Math.min(SCREEN_W * 0.82, 340);

interface NotificationPanelProps {
  visible: boolean;
  slideAnim: Animated.Value;
  backdropAnim: Animated.Value;
  onClose: () => void;
  totalNotifs: number;
  pendingTasks: RoutineTask[];
  pendingMeds: Medication[];
}

/**
 * Slide-out "Reminders" panel listing today's pending routine tasks and
 * medications. The parent owns the open/close animation values (the header
 * bell and a reminder card both trigger it) and passes them in. Extracted
 * verbatim from TodayScreen.
 */
export function NotificationPanel({
  visible, slideAnim, backdropAnim, onClose, totalNotifs, pendingTasks, pendingMeds,
}: NotificationPanelProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,7,30,0.38)" },
    panelWrapper: {
      position: "absolute", top: 0, right: 0, bottom: 0, width: PANEL_WIDTH,
      shadowColor: "#000", shadowOffset: { width: -6, height: 0 },
      shadowOpacity: 0.14, shadowRadius: 20, elevation: 16,
    },
    panel: { flex: 1, backgroundColor: colors.bg, overflow: "hidden" },
    panelTopGradient: { paddingTop: 48, paddingHorizontal: 24, paddingBottom: 20 },
    panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    panelTitle: { fontSize: 24, color: colors.text, ...fonts.medium, letterSpacing: -0.3 },
    panelSubtitle: { fontSize: 13, color: colors.muted, ...fonts.regular, marginTop: 4 },
    panelClose: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: colors.violet50, alignItems: "center", justifyContent: "center",
    },
    panelBody: { flex: 1, paddingHorizontal: 24 },
    panelSectionLabel: {
      fontSize: 10, color: colors.violet, ...fonts.medium,
      textTransform: "uppercase", letterSpacing: 1.6,
      marginBottom: 10, marginTop: 20, paddingLeft: 10,
      borderLeftWidth: 2, borderLeftColor: colors.violet,
    },
    notifRow: {
      flexDirection: "row", alignItems: "center", backgroundColor: colors.bg,
      borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 14,
      marginBottom: 8, gap: 14,
      ...shadow.sm,
    },
    notifIconCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.violet50, alignItems: "center", justifyContent: "center",
    },
    notifRowBody: { flex: 1 },
    notifRowLabel: { fontSize: 15, color: colors.text, ...fonts.medium, lineHeight: 20 },
    notifRowSub: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 3 },
    sectionDivider: { height: 1, backgroundColor: "rgba(123,92,231,0.07)", marginTop: 8 },
    emptyNotif: { alignItems: "center", paddingTop: 48, paddingBottom: 32, gap: 12 },
    emptyIconRing: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: colors.violet50, alignItems: "center", justifyContent: "center", marginBottom: 4,
    },
    emptyNotifTitle: { fontSize: 17, color: colors.text, ...fonts.medium },
    emptyNotifText: { fontSize: 13, color: colors.muted, ...fonts.regular, textAlign: "center", lineHeight: 18 },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.panelWrapper, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.panel}>
          <LinearGradient
            colors={[colors.violet50, colors.surface, colors.bg]}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={styles.panelTopGradient}
          >
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelTitle}>Reminders</Text>
                <Text style={styles.panelSubtitle}>
                  {totalNotifs > 0
                    ? `${totalNotifs} item${totalNotifs === 1 ? "" : "s"} pending today`
                    : "Nothing pending"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.panelClose}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close reminders"
              >
                <Ionicons name="close" size={18} color={colors.violet} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
          <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
            {totalNotifs === 0 ? (
              <View style={styles.emptyNotif}>
                <View style={styles.emptyIconRing}>
                  <Ionicons name="checkmark" size={36} color={colors.violet} />
                </View>
                <Text style={styles.emptyNotifTitle}>You're all caught up!</Text>
                <Text style={styles.emptyNotifText}>All tasks and medications{"\n"}for today are complete.</Text>
              </View>
            ) : (
              <>
                {pendingTasks.length > 0 && (
                  <>
                    <Text style={styles.panelSectionLabel}>Routine Tasks</Text>
                    {pendingTasks.map((task) => (
                      <View key={task.id} style={styles.notifRow}>
                        <View style={styles.notifIconCircle}>
                          <Ionicons name="calendar-clear" size={20} color={colors.violet} />
                        </View>
                        <View style={styles.notifRowBody}>
                          <Text style={styles.notifRowLabel}>{task.label}</Text>
                          {task.time ? <Text style={styles.notifRowSub}>{task.time}</Text> : null}
                        </View>
                      </View>
                    ))}
                  </>
                )}
                {pendingTasks.length > 0 && pendingMeds.length > 0 && <View style={styles.sectionDivider} />}
                {pendingMeds.length > 0 && (
                  <>
                    <Text style={styles.panelSectionLabel}>Medications</Text>
                    {pendingMeds.map((med) => (
                      <View key={med.id} style={styles.notifRow}>
                        <View style={styles.notifIconCircle}>
                          <Ionicons name="medkit" size={20} color={colors.amber} />
                        </View>
                        <View style={styles.notifRowBody}>
                          <Text style={styles.notifRowLabel}>{med.name}</Text>
                          <Text style={styles.notifRowSub}>{[med.dosage, med.time].filter(Boolean).join(" · ")}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}
