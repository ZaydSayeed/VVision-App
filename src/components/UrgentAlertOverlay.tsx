import React, { useRef, useEffect } from "react";
import { View, Text, Animated, TouchableOpacity, StyleSheet, AccessibilityInfo } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { formatRelativeTime } from "../hooks/useDashboardData";
import { fonts, spacing, radius } from "../config/theme";

interface UrgentAlertOverlayProps {
  /** Whether the full-screen SOS overlay is shown. */
  visible: boolean;
  /** Number of currently-pending help requests (drives the "N pending" line). */
  pendingCount: number;
  /** Timestamp of the most recent pending alert, for the relative-time chip. */
  latestTimestamp?: string;
  /** "I'm Responding Now" — acknowledges every pending alert. */
  onRespond: () => void;
  /** "Mark as Handled" — opens the resolve sheet. */
  onMarkHandled: () => void;
}

/**
 * Full-screen, safety-critical SOS overlay shown to a caregiver when a linked
 * patient requests help. Owns its own pulse/fade animations, the haptic burst,
 * and the VoiceOver announcement; the parent owns when to show it (count) and
 * what the action buttons do. Extracted verbatim from RootNavigator's
 * CaregiverView so the navigator stays focused on routing.
 */
export function UrgentAlertOverlay({
  visible, pendingCount, latestTimestamp, onRespond, onMarkHandled,
}: UrgentAlertOverlayProps) {
  const reducedMotion = useReducedMotion();
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;
  const urgentFadeIn = useRef(new Animated.Value(0)).current;

  // Pulse animation + haptic when overlay appears
  useEffect(() => {
    if (!visible) {
      pulse1.stopAnimation();
      pulse2.stopAnimation();
      pulse3.stopAnimation();
      urgentFadeIn.setValue(0);
      return;
    }

    // Haptic burst + spoken announcement — the overlay was otherwise silent to
    // VoiceOver users, who'd get no cue that their patient needs help (A11Y-4).
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 800);
    AccessibilityInfo.announceForAccessibility(
      "Urgent. Your patient has requested help and needs immediate assistance. Please respond now."
    );

    // Fade in overlay
    Animated.timing(urgentFadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    // Staggered pulsing rings — skipped under Reduce Motion (A11Y-10)
    if (reducedMotion) return;
    const startRing = (anim: Animated.Value, delay: number) => {
      anim.setValue(0);
      setTimeout(() => {
        Animated.loop(
          Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true })
        ).start();
      }, delay);
    };

    startRing(pulse1, 0);
    startRing(pulse2, 733);
    startRing(pulse3, 1466);
  }, [visible, reducedMotion]);

  // Ring interpolations
  const makeRing = (anim: Animated.Value) => ({
    scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }),
    opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] }),
  });
  const ring1 = makeRing(pulse1);
  const ring2 = makeRing(pulse2);
  const ring3 = makeRing(pulse3);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.urgentOverlay, { opacity: urgentFadeIn }]}
      accessibilityViewIsModal
      accessibilityLiveRegion="assertive"
    >
      <LinearGradient
        colors={["#7B0000", "#C0392B", "#E74C3C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={styles.urgentGradient}
      >
        {/* Top — icon + rings + text */}
        <View style={styles.urgentTop}>
          {/* Pulsing rings */}
          <View style={styles.ringContainer}>
            <Animated.View style={[styles.ringAbsolute, { transform: [{ scale: ring1.scale }], opacity: ring1.opacity }]} />
            <Animated.View style={[styles.ringAbsolute, { transform: [{ scale: ring2.scale }], opacity: ring2.opacity }]} />
            <Animated.View style={[styles.ringAbsolute, { transform: [{ scale: ring3.scale }], opacity: ring3.opacity }]} />
            <View style={styles.urgentIconCircle}>
              <Ionicons name="hand-left" size={52} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.urgentLabel}>Urgent</Text>
          <Text style={styles.urgentTitle}>Help Requested</Text>
          <Text style={styles.urgentSubtitle}>
            Your patient needs immediate assistance. Please respond now.
          </Text>

          {latestTimestamp && (
            <View style={styles.urgentTimeWrap}>
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.urgentTime}>{formatRelativeTime(latestTimestamp)}</Text>
            </View>
          )}
        </View>

        {/* Bottom — actions */}
        <View style={styles.urgentBottom}>
          {pendingCount > 1 && (
            <View style={styles.urgentCountWrap}>
              <Text style={styles.urgentCount}>
                {pendingCount} pending request{pendingCount !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.btnHandled}
            onPress={onMarkHandled}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Mark this help request as handled"
          >
            <Text style={styles.btnHandledText}>Mark as Handled</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnResponding}
            onPress={onRespond}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="I'm responding now"
          >
            <Text style={styles.btnRespondingText}>I'm Responding Now</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  urgentOverlay: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999,
  },
  urgentGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  urgentTop: {
    flex: 1, alignItems: "center", justifyContent: "center", width: "100%",
  },
  ringContainer: {
    width: 120, height: 120,
    alignItems: "center", justifyContent: "center",
  },
  ringAbsolute: {
    position: "absolute",
    width: 120, height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  urgentIconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2.5, borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  urgentLabel: {
    fontSize: 11, color: "rgba(255,255,255,0.7)", ...fonts.medium,
    letterSpacing: 4, textTransform: "uppercase", marginTop: 36,
  },
  urgentTitle: {
    fontSize: 38, color: "#FFFFFF", ...fonts.medium,
    letterSpacing: -0.5, marginTop: 8, textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
  urgentSubtitle: {
    fontSize: 15, color: "rgba(255,255,255,0.75)", ...fonts.regular,
    textAlign: "center", marginTop: 10, paddingHorizontal: spacing.xxxl,
    lineHeight: 22,
  },
  urgentTimeWrap: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.2)", borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: 7, marginTop: 20,
  },
  urgentTime: { fontSize: 13, color: "rgba(255,255,255,0.85)", ...fonts.medium },
  urgentBottom: {
    width: "100%", paddingHorizontal: spacing.xl,
    paddingBottom: 52, gap: spacing.md,
  },
  urgentCountWrap: {
    alignItems: "center", marginBottom: spacing.md,
  },
  urgentCount: {
    fontSize: 13, color: "rgba(255,255,255,0.65)", ...fonts.regular, letterSpacing: 0.3,
  },
  btnHandled: {
    backgroundColor: "#FFFFFF", borderRadius: radius.pill,
    paddingVertical: 17, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  btnHandledText: { fontSize: 16, color: "#C0392B", ...fonts.medium },
  btnResponding: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.pill, borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    paddingVertical: 16, alignItems: "center",
  },
  btnRespondingText: { fontSize: 16, color: "#FFFFFF", ...fonts.medium },
});
