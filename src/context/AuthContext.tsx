import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../config/supabase";
import { AppUser, UserRole } from "../types";
import { setAuthToken, setOnAuthExpired, syncProfile } from "../api/client";

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

async function loadPatientId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("patient_id")
    .eq("id", userId)
    .single();
  return data?.patient_id ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    setOnAuthExpired(() => {
      supabase.auth.signOut();
      setUser(null);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.access_token) {
        setAuthToken(session.access_token);
        const appUser = sessionToUser(session);
        setUser(appUser);
        if (appUser) {
          const patientId = await loadPatientId(appUser.id);
          if (patientId) setUser({ ...appUser, patient_id: patientId });
        }
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
        setAuthToken(session.access_token);
        const appUser = sessionToUser(session);
        setUser(appUser);
        if (appUser) {
          const patientId = await loadPatientId(appUser.id);
          if (patientId) setUser({ ...appUser, patient_id: patientId });
        }
      } else {
        setAuthToken(null);
        setUser(null);
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

      setAuthToken(data.session.access_token);
      const appUser = sessionToUser(data.session);
      setUser(appUser);

      // Try to sync to glasses backend (non-fatal)
      try { await syncProfile(name, role); } catch {}

      // Load patient_id from Supabase profiles table
      if (appUser) {
        const patientId = await loadPatientId(appUser.id);
        if (patientId) setUser({ ...appUser, patient_id: patientId });
      }
    },
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);

    setAuthToken(data.session.access_token);
    const appUser = sessionToUser(data.session);
    setUser(appUser);

    // Try to sync to glasses backend (non-fatal)
    try { await syncProfile(appUser?.name ?? "", (appUser?.role as UserRole) ?? "caregiver"); } catch {}

    // Load patient_id from Supabase profiles table
    if (appUser) {
      const patientId = await loadPatientId(appUser.id);
      if (patientId) setUser({ ...appUser, patient_id: patientId });
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthToken(null);
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
