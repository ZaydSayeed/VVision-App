import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNetwork } from "../context/NetworkContext";
import { setOnNetworkChange } from "../api/client";
import { LoginScreen } from "../screens/LoginScreen";
import { CaregiverTabNavigator } from "./CaregiverTabNavigator";
import { PatientTabNavigator } from "./PatientTabNavigator";
import { HelpHistoryScreen } from "../screens/caregiver/HelpHistoryScreen";
import CheckInScreen from "../screens/caregiver/CheckInScreen";
import CheckInTextScreen from "../screens/caregiver/CheckInTextScreen";
import VisitReportsScreen from "../screens/caregiver/VisitReportsScreen";
import { CaregiverHealthScreen } from "../screens/caregiver/CaregiverHealthScreen";
import PaywallScreen from "../screens/caregiver/PaywallScreen";
import InviteSeatScreen from "../screens/caregiver/InviteSeatScreen";
import { startHomeKitListeners } from "../lib/homekit";
import { useSensorPrefs } from "../hooks/useSensorPrefs";
import { flush } from "../lib/eventBatcher";
import { OfflineBanner } from "../components/OfflineBanner";
import { SideDrawer } from "../components/SideDrawer";
import { VisionSheet } from "../components/VisionSheet";
import { BackgroundDecor } from "../components/BackgroundDecor";
import { AppHeader } from "../components/AppHeader";
import { UrgentAlertOverlay } from "../components/UrgentAlertOverlay";
import { useHelpAlert } from "../hooks/useHelpAlert";
import { usePushRegistration } from "../hooks/usePushRegistration";
import { useInviteDeepLink } from "../hooks/useInviteDeepLink";
import { usePasswordResetDeepLink } from "../hooks/usePasswordResetDeepLink";
import { ResetPasswordScreen } from "../screens/ResetPasswordScreen";
import { ResolveSheet, HelpCause } from "../components/ResolveSheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { HealthOnboardingScreen } from "../screens/patient/HealthOnboardingScreen";
import { useOnboarding } from "../hooks/useOnboarding";
import OnboardingNavigator from "./OnboardingNavigator";
import AcceptInviteScreen from "../screens/AcceptInviteScreen";
import { fonts, spacing, gradients, radius } from "../config/theme";
import { formatRelativeTime } from "../hooks/useDashboardData";
import { registerOnboardingReset } from "../utils/reminderEvents";

// Show help/reminder pushes even when the app is in the foreground — otherwise a
// caregiver with the app open would silently miss an SOS banner (NOTIF-7).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CaregiverStack = createNativeStackNavigator();
const PatientStack = createNativeStackNavigator();

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const PANEL_W = SCREEN_W * 0.85;

export function RootNavigator() {
  const { user, loading, pendingInviteToken, clearPendingInviteToken, recoveryMode, startRecovery } = useAuth();
  const { colors, isDark } = useTheme();
  const { setOffline } = useNetwork();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visionOpen, setVisionOpen] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setOnboardingDone(null);
      return;
    }
    const timeout = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 3000));
    Promise.race([
      AsyncStorage.getItem(`@vela/onboarding_complete:${user.id}`),
      timeout,
    ]).then((val) => setOnboardingDone(val === "true"));
  }, [user]);

  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true);
  }, []);

  useEffect(() => {
    registerOnboardingReset(async () => {
      if (!user) return;
      await AsyncStorage.removeItem(`@vela/onboarding_complete:${user.id}`);
      setOnboardingDone(false);
    });
  }, [user]);

  // Invite deep links (cold start / foreground / post-login) — see hook.
  useInviteDeepLink(user, pendingInviteToken, clearPendingInviteToken, onboardingDone);

  // Password-reset deep links — opens ResetPasswordScreen via recoveryMode.
  usePasswordResetDeepLink(startRecovery);

  // Expo push-token registration (caregiver livestream + patient reminders).
  usePushRegistration(user);

  useEffect(() => {
    setOnNetworkChange(setOffline);
  }, [setOffline]);

  useEffect(() => {
    if (!loading) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    splash: {
      flex: 1, backgroundColor: colors.bg,
      alignItems: "center", justifyContent: "center", gap: 16,
    },
    splashLogo: { width: 160, height: 196 },
    visionFab: {
      position: "absolute", bottom: 108, right: 24,
      width: 56, height: 56, borderRadius: 28,
      shadowColor: colors.violet, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45, shadowRadius: 14, elevation: 12, overflow: "hidden",
    },
    visionFabGradient: {
      width: 56, height: 56, borderRadius: 28,
      alignItems: "center", justifyContent: "center",
    },
  }), [colors]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <Image
          source={isDark ? require("../../assets/logo-stacked-light.png") : require("../../assets/logo-stacked-dark.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (recoveryMode) return <ResetPasswordScreen />;

  if (!user) return <LoginScreen />;

  if (onboardingDone === null) {
    return (
      <View style={styles.splash}>
        <Image
          source={isDark ? require("../../assets/logo-stacked-light.png") : require("../../assets/logo-stacked-dark.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (!onboardingDone) {
    return <OnboardingScreen onComplete={completeOnboarding} />;
  }

  if (user.role === "caregiver") {
    return (
      <Animated.View style={[styles.root, { opacity: contentOpacity }]}>
        <CaregiverView
          user={user}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.root, { opacity: contentOpacity }]}>
      <AppHeader onOpenDrawer={() => setDrawerOpen(true)} user={user} />
      <OfflineBanner />
      <PatientStack.Navigator screenOptions={{ headerShown: false }}>
        <PatientStack.Screen name="PatientTabs">
          {() => <PatientTabNavigator patientName={user.name} />}
        </PatientStack.Screen>
        <PatientStack.Screen
          name="HealthOnboarding"
          component={HealthOnboardingScreen}
          options={{ headerShown: false }}
        />
        <PatientStack.Screen name="AcceptInvite" component={AcceptInviteScreen} options={{ headerShown: false }} />
      </PatientStack.Navigator>
      <BackgroundDecor />
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <VisionSheet visible={visionOpen} onClose={() => setVisionOpen(false)} />
      <TouchableOpacity onPress={() => setVisionOpen(true)} style={styles.visionFab} activeOpacity={0.85}>
        <LinearGradient colors={[...gradients.primary]} style={styles.visionFabGradient}>
          <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Caregiver root wrapper (owns help alert state) ──────────────────────────

function CaregiverView({
  user, drawerOpen, onOpenDrawer, onCloseDrawer,
}: {
  user: import("../types").AppUser;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
}) {
  const { colors } = useTheme();
  const { completed: onboardingCompleted, ready: onboardingReady } = useOnboarding();
  const { alerts: helpAlerts, pendingCount, dismissAlert: dismissHelp, resolveAlert, acknowledgeAlert } = useHelpAlert();
  const { prefs } = useSensorPrefs();

  // HomeKit listeners + periodic flush when smart home enabled
  useEffect(() => {
    if (!prefs.smartHomeEnabled || !user.patient_id) return;
    let dispose: (() => void) | null = null;
    startHomeKitListeners(user.patient_id).then(d => { dispose = d; });
    const flushInterval = setInterval(() => flush(), 2 * 60 * 1000);
    return () => { dispose?.(); clearInterval(flushInterval); };
  }, [prefs.smartHomeEnabled, user.patient_id]);

  const [visionOpen, setVisionOpen] = useState(false);

  // Notifications slide panel
  const [notifOpen, setNotifOpen] = useState(false);
  const notifX = useRef(new Animated.Value(SCREEN_W)).current;

  const openNotif = useCallback(() => {
    setNotifOpen(true);
    Animated.spring(notifX, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  }, [notifX]);

  const closeNotif = useCallback(() => {
    Animated.spring(notifX, { toValue: SCREEN_W, useNativeDriver: true, bounciness: 0, speed: 20 }).start(() => setNotifOpen(false));
  }, [notifX]);

  // Urgent alert overlay — animations/haptics/a11y live in <UrgentAlertOverlay>.
  const [urgentVisible, setUrgentVisible] = useState(false);
  const [resolveSheetVisible, setResolveSheetVisible] = useState(false);
  const prevCountRef = useRef<number | null>(null);

  // Show urgent overlay when pending count increases
  useEffect(() => {
    const isFirst = prevCountRef.current === null;
    const prev = prevCountRef.current ?? 0;
    prevCountRef.current = pendingCount;

    if (pendingCount > 0 && (isFirst || pendingCount > prev)) {
      setUrgentVisible(true);
    }
    if (pendingCount === 0) {
      setUrgentVisible(false);
    }
  }, [pendingCount]);

  const pendingHelp = helpAlerts.filter((a) => !a.dismissed && !a.acknowledged);
  const latestAlert = pendingHelp[0];

  const handleRespondingNow = useCallback(async () => {
    // Acknowledge every currently-pending alert so escalation stops re-paging the
    // team for something a caregiver is already handling (CG-8). Keep the overlay
    // if the server can't be reached — never tell the caregiver it's handled when
    // it isn't (the server would otherwise keep escalating).
    const toAck = pendingHelp;
    try {
      await Promise.all(toAck.map((a) => acknowledgeAlert(a.id)));
      setUrgentVisible(false);
    } catch {
      Alert.alert(
        "Couldn't confirm",
        "We couldn't reach the server. Please check your connection — the alert is still active."
      );
    }
  }, [pendingHelp, acknowledgeAlert]);

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1 },

    // Notifications panel overlay
    notifBackdrop: {
      position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
      backgroundColor: "rgba(0,0,0,0.35)", zIndex: 50,
    },
    notifPanel: {
      position: "absolute", top: 0, bottom: 0, right: 0,
      width: PANEL_W, backgroundColor: colors.bg, zIndex: 60,
      shadowColor: "#000", shadowOffset: { width: -3, height: 0 },
      shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
    },
    panelHeader: {
      paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    panelTitle: { fontSize: 24, color: colors.text, ...fonts.medium },
    closeBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    panelContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 60 },
    notifSectionLabel: {
      fontSize: 11, ...fonts.medium, letterSpacing: 1.2,
      textTransform: "uppercase", color: colors.coral, marginBottom: spacing.sm,
    },
    helpCard: {
      backgroundColor: colors.bg, borderRadius: radius.xl, padding: spacing.xl,
      borderLeftWidth: 4, borderLeftColor: colors.coral,
      shadowColor: colors.coral, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12, shadowRadius: 12, elevation: 3,
    },
    helpTop: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
    helpIconCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.coralSoft, alignItems: "center", justifyContent: "center",
    },
    helpInfo: { flex: 1 },
    helpTitle: { fontSize: 15, color: colors.text, ...fonts.medium },
    helpTime: { fontSize: 12, color: colors.muted, ...fonts.regular, marginTop: 2 },
    helpDismissBtn: {
      backgroundColor: colors.coral, borderRadius: radius.pill,
      paddingHorizontal: spacing.xl, paddingVertical: 10, alignItems: "center",
    },
    helpDismissText: { fontSize: 13, color: "#FFFFFF", ...fonts.medium },
    emptyWrap: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.muted, ...fonts.regular },
  }), [colors]);

  if (onboardingReady && !onboardingCompleted && !user.patient_id) {
    return <OnboardingNavigator />;
  }

  return (
    <View style={styles.root}>
      <AppHeader onOpenDrawer={onOpenDrawer} user={user} notifCount={pendingCount} onOpenNotif={openNotif} />
      <OfflineBanner />
      <CaregiverStack.Navigator screenOptions={{ headerShown: false }}>
        <CaregiverStack.Screen name="CaregiverHome">
          {() => <CaregiverTabNavigator helpPendingCount={pendingCount} />}
        </CaregiverStack.Screen>
        <CaregiverStack.Screen name="HelpHistory" component={HelpHistoryScreen} />
        <CaregiverStack.Screen name="CheckIn" component={CheckInScreen} options={{ headerShown: true, title: "Check In" }} />
        <CaregiverStack.Screen name="CheckInText" component={CheckInTextScreen} options={{ headerShown: true, title: "Text Check-In" }} />
        <CaregiverStack.Screen name="VisitReports" options={{ headerShown: false }}>
          {({ route, navigation }: any) => {
            const { patientId, patientName } = route.params || {};
            return <VisitReportsScreen patientId={patientId} patientName={patientName} onBack={() => navigation.goBack()} />;
          }}
        </CaregiverStack.Screen>
        <CaregiverStack.Screen name="CaregiverHealth" component={CaregiverHealthScreen} options={{ headerShown: true, title: "Health", headerBackTitle: "Back" }} />
        <CaregiverStack.Screen name="AcceptInvite" component={AcceptInviteScreen} options={{ headerShown: false }} />
        <CaregiverStack.Screen name="Paywall" component={PaywallScreen} options={{ headerShown: false }} />
        <CaregiverStack.Screen name="InviteSeat" component={InviteSeatScreen} options={{ headerShown: false }} />
      </CaregiverStack.Navigator>
      <BackgroundDecor />
      <SideDrawer visible={drawerOpen} onClose={onCloseDrawer} />
      <VisionSheet visible={visionOpen} onClose={() => setVisionOpen(false)} />
      <TouchableOpacity
        onPress={() => setVisionOpen(true)}
        style={{
          position: "absolute", bottom: 108, right: 24,
          width: 56, height: 56, borderRadius: 28,
          shadowColor: colors.violet, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45, shadowRadius: 14, elevation: 12, overflow: "hidden",
        }}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[...gradients.primary]} style={{
          width: 56, height: 56, borderRadius: 28,
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Notifications panel */}
      {notifOpen && (
        <>
          <TouchableOpacity style={styles.notifBackdrop} activeOpacity={1} onPress={closeNotif} />
          <Animated.View style={[styles.notifPanel, { transform: [{ translateX: notifX }] }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeNotif} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.notifSectionLabel}>Help Requests</Text>
              {pendingHelp.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="checkmark-circle" size={40} color={colors.border} />
                  <Text style={styles.emptyText}>No pending help requests</Text>
                </View>
              ) : (
                pendingHelp.map((alert) => (
                  <View key={alert.id} style={styles.helpCard}>
                    <View style={styles.helpTop}>
                      <View style={styles.helpIconCircle}>
                        <Ionicons name="hand-left" size={20} color={colors.coral} />
                      </View>
                      <View style={styles.helpInfo}>
                        <Text style={styles.helpTitle}>Patient needs help</Text>
                        <Text style={styles.helpTime}>{formatRelativeTime(alert.timestamp)}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.helpDismissBtn} onPress={() => dismissHelp(alert.id)} activeOpacity={0.85}>
                      <Text style={styles.helpDismissText}>Mark as handled</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* ── URGENT ALERT OVERLAY ─────────────────────────────────────────── */}
      <UrgentAlertOverlay
        visible={urgentVisible}
        pendingCount={pendingHelp.length}
        latestTimestamp={latestAlert?.timestamp}
        onRespond={handleRespondingNow}
        onMarkHandled={() => setResolveSheetVisible(true)}
      />
      <ResolveSheet
        visible={resolveSheetVisible}
        onResolve={async (cause: HelpCause, note: string) => {
          if (latestAlert) {
            try { await resolveAlert(latestAlert.id, cause, note || undefined); } catch { /* ignore */ }
          }
          setResolveSheetVisible(false);
          setUrgentVisible(false);
        }}
        onSkip={async () => {
          if (latestAlert) {
            try { await dismissHelp(latestAlert.id); } catch { /* ignore */ }
          }
          setResolveSheetVisible(false);
          setUrgentVisible(false);
        }}
        onCancel={() => setResolveSheetVisible(false)}
      />
    </View>
  );
}

// Header extracted to ../components/AppHeader.tsx
