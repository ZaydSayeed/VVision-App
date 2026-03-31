import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  CormorantGaramond_300Light,
  CormorantGaramond_400Regular,
} from "@expo-google-fonts/cormorant-garamond";
import {
  DMSans_400Regular,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";

import { AuthProvider } from "./src/context/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { SplashScreen } from "./src/components/SplashScreen";

const MIN_SPLASH_MS = 2000;

export default function App() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
  });
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const appReady = fontsLoaded && minTimePassed;

  return (
    <SafeAreaProvider>
      {fontsLoaded && (
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      )}
      {showSplash && (
        <SplashScreen
          appReady={appReady}
          onDone={() => setShowSplash(false)}
        />
      )}
    </SafeAreaProvider>
  );
}
