import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState, AppStateStatus } from "react-native";
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
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      supabase.auth.signOut();
      setUser(null);
      setAuthToken(null); setAuthFetchToken(null);
    }, SESSION_TIMEOUT_MS);
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
        // Sync with backend to ensure patient_id is resolved
        if (appUser) {
          try {
            const sync = await syncProfile(appUser.name, (appUser.role as UserRole) ?? "caregiver");
            if (sync?.patient_id) appUser.patient_id = sync.patient_id;
          } catch {}
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
      } catch {}

      setUser(appUser);
      resetInactivityTimer();
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
    } catch {}

    setUser(appUser);
    resetInactivityTimer();

  }, [resetInactivityTimer]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthToken(null); setAuthFetchToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updated: AppUser) => {
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
