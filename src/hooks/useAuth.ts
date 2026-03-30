import { useState, useEffect, useCallback } from "react";
import { AppUser, UserRole } from "../types";
import { STORAGE_KEYS, readStorage, writeStorage } from "../config/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readStorage<AppUser | null>(STORAGE_KEYS.CURRENT_USER, null).then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (name: string, role: UserRole) => {
    const u: AppUser = { name, role };
    await writeStorage(STORAGE_KEYS.CURRENT_USER, u);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
