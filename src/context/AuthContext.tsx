import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { AppState, AppStateStatus, Alert } from "react-native";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../config/supabase";
import { AppUser, UserRole } from "../types";
import { setAuthToken, setOnAuthExpired, syncProfile } from "../api/client";
import { setAuthFetchToken } from "../api/authFetch";
import { syncNow, startBackgroundObservers, stopBackgroundObservers } from "../services/healthSync";

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AppUser) => void;
  resetPassword: (email: string) => Promise<void>;
  pendingInviteToken: string | null;
  clearPendingInviteToken: () => void;
  recoveryMode: boolean;
  startRecovery: (accessToken: string, refreshToken: string) => Promise<void>;
  endRecovery: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionToUser(
  session: { user: { id: string; email?: string; user_metadata?: any } } | null
): AppUser | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata ?? {};
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: meta.name ?? "",
    role: meta.role ?? "caregiver",
    patient_id: meta.patient_id ?? null,
  };
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef<AppUser | null>(null);

  // Mirror the current user into a ref so timers can read the live role.
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    // Only caregivers are auto-logged-out for inactivity. A patient's session
    // must never silently expire — that would disable their Help button (FAIL-2).
    if (userRef.current?.role === "patient") return;
    inactivityTimer.current = setTimeout(() => {
      // Re-check at fire time: the role may have resolved after the timer armed.
      if (userRef.current?.role === "patient") return;
      supabase.auth.signOut();
      setUser(null);
      setAuthToken(null); setAuthFetchToken(null);
    }, SESSION_TIMEOUT_MS);
  }, []);

  const clearPendingInviteToken = useCallback(() => {
    setPendingInviteToken(null);
  }, []);

  // Password-recovery deep link: establish the temporary recovery session and
  // flag recovery mode so the navigator shows ResetPasswordScreen instead of
  // dropping the user into the app on a half-initialized session.
  const startRecovery = useCallback(async (accessToken: string, refreshToken: string) => {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw new Error(error.message);
    setRecoveryMode(true);
  }, []);

  // Leave recovery mode and sign out so the user logs in fresh with the new
  // password (a clean login runs the full profile sync that recovery skips).
  const endRecovery = useCallback(async () => {
    setRecoveryMode(false);
    await supabase.auth.signOut();
    setAuthToken(null); setAuthFetchToken(null);
    setUser(null);
  }, []);

  // Track app foreground/background to manage session timeout
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        resetInactivityTimer();
      } else if (state === "background") {
        // Background counts as inactivity — restart timer on resume
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      }
    });
    return () => {
      sub.remove();
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  // HealthKit sync: fire initial sync + background observers when a patient logs in
  useEffect(() => {
    if (!user || user.role !== "patient" || !user.patient_id) return;
    const pid = user.patient_id;

    syncNow(pid).catch((e) => console.warn("[health] initial sync failed", e));
    startBackgroundObservers(pid);

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") syncNow(pid).catch(() => {});
    });

    return () => {
      sub.remove();
      stopBackgroundObservers();
    };
  }, [user]);

  // Restore session on mount
  useEffect(() => {
    setOnAuthExpired(() => {
      supabase.auth.signOut();
      setUser(null);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.access_token) {
        setAuthToken(session.access_token); setAuthFetchToken(session.access_token);
        const appUser = sessionToUser(session);
        // Try to refresh patient_id from the backend, but NEVER sign the user
        // out if this fails. A persisted session is already valid — a cold or
        // offline backend must not destroy it, or the user gets logged out
        // every time they reopen the app. patient_id re-syncs on next foreground.
        if (appUser) {
          try {
            const sync = await syncProfile(appUser.name, (appUser.role as UserRole) ?? "caregiver");
            if (sync?.patient_id) appUser.patient_id = sync.patient_id;
          } catch (e) {
            console.warn("[auth] syncProfile failed on restore — keeping session:", e);
          }
        }
        setUser(appUser);
        resetInactivityTimer();
      }
      setLoading(false);
    });

    // Listen for auth changes (token refresh, sign out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // INITIAL_SESSION is handled by getSession above (which also loads patient_id)
      if (_event === "INITIAL_SESSION") return;
      if (session?.access_token) {
        setAuthToken(session.access_token); setAuthFetchToken(session.access_token);
        setUser(sessionToUser(session));
        resetInactivityTimer();
      } else {
        setAuthToken(null); setAuthFetchToken(null);
        setUser(null);
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signup = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      role: UserRole
    ) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role },
        },
      });
      if (error) throw new Error(error.message);
      if (!data.session) {
        throw new Error("Check your email to confirm your account.");
      }

      setAuthToken(data.session.access_token); setAuthFetchToken(data.session.access_token);
      const appUser = sessionToUser(data.session);

      // Sync to glasses backend and capture patient_id
      try {
        const sync = await syncProfile(name, role);
        if (sync?.patient_id && appUser) appUser.patient_id = sync.patient_id;
      } catch (e) {
        console.error("[auth] syncProfile failed:", e);
        Alert.alert(
          "Sign in error",
          "We couldn't set up your account. Please sign in again.",
          [{ text: "OK", onPress: () => supabase.auth.signOut() }]
        );
        setLoading(false);
        return;
      }

      setUser(appUser);
      resetInactivityTimer();

      const pending = await AsyncStorage.getItem("@vela/pending_invite");
      if (pending) {
        setPendingInviteToken(pending);
        await AsyncStorage.removeItem("@vela/pending_invite");
      }
    },
    [resetInactivityTimer]
  );

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);

    setAuthToken(data.session.access_token); setAuthFetchToken(data.session.access_token);
    const appUser = sessionToUser(data.session);

    // Sync to glasses backend and capture patient_id
    try {
      const sync = await syncProfile(appUser?.name ?? "", (appUser?.role as UserRole) ?? "caregiver");
      if (sync?.patient_id && appUser) appUser.patient_id = sync.patient_id;
    } catch (e) {
      console.error("[auth] syncProfile failed:", e);
      Alert.alert(
        "Sign in error",
        "We couldn't set up your account. Please sign in again.",
        [{ text: "OK", onPress: () => supabase.auth.signOut() }]
      );
      setLoading(false);
      return;
    }

    setUser(appUser);
    resetInactivityTimer();

    const pending = await AsyncStorage.getItem("@vela/pending_invite");
    if (pending) {
      setPendingInviteToken(pending);
      await AsyncStorage.removeItem("@vela/pending_invite");
    }

  }, [resetInactivityTimer]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthToken(null); setAuthFetchToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updated: AppUser) => {
    setUser(updated);
  }, []);

  // Account recovery — removes the permanent-lockout path for caregivers (FAIL-3).
  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = Linking.createURL("reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, updateUser, resetPassword, pendingInviteToken, clearPendingInviteToken, recoveryMode, startRecovery, endRecovery }),
    [user, loading, login, signup, logout, updateUser, resetPassword, pendingInviteToken, clearPendingInviteToken, recoveryMode, startRecovery, endRecovery]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
