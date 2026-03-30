import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppUser, UserRole } from "../types";
import { STORAGE_KEYS } from "../config/storage";
import {
  signup as apiSignup,
  loginApi,
  fetchMe,
  setAuthToken,
  setOnAuthExpired,
} from "../api/client";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(async () => {
    setAuthToken(null);
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.CURRENT_USER,
    ]);
    setUser(null);
  }, []);

  // On mount — restore token and validate
  useEffect(() => {
    setOnAuthExpired(() => clearAuth());

    (async () => {
      try {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          setAuthToken(token);
          const me = await fetchMe();
          setUser(me);
        }
      } catch {
        await clearAuth();
      } finally {
        setLoading(false);
      }
    })();
  }, [clearAuth]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password);
    setAuthToken(res.access_token);
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, res.access_token);
    await AsyncStorage.setItem(
      STORAGE_KEYS.CURRENT_USER,
      JSON.stringify(res.user)
    );
    setUser(res.user);
  }, []);

  const signup = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      role: UserRole
    ) => {
      const res = await apiSignup(email, password, name, role);
      setAuthToken(res.access_token);
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, res.access_token);
      await AsyncStorage.setItem(
        STORAGE_KEYS.CURRENT_USER,
        JSON.stringify(res.user)
      );
      setUser(res.user);
    },
    []
  );

  const logout = useCallback(async () => {
    await clearAuth();
  }, [clearAuth]);

  const updateUser = useCallback((updated: AppUser) => {
    setUser(updated);
    AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updated));
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
