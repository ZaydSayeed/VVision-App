import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors, AppColors } from "../config/theme";

const STORAGE_KEY = "vela_theme_preference";

interface ThemeContextValue {
  colors: AppColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === "light" || val === "dark") setPreference(val);
    });
  }, []);

  const isDark =
    preference === "system" ? systemScheme === "dark" : preference === "dark";

  const toggleTheme = useCallback(() => {
    const next = isDark ? "light" : "dark";
    setPreference(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ colors: isDark ? darkColors : lightColors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
