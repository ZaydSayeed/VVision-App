import React, { useState, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";

import { AuthProvider } from "./src/context/AuthContext";
import { PurchasesProvider } from "./src/providers/PurchasesProvider";
import { ThemeProvider } from "./src/context/ThemeContext";
import { NetworkProvider } from "./src/context/NetworkContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { SplashScreen } from "./src/components/SplashScreen";
import { ErrorBoundary } from "./src/components/ErrorBoundary";

const MIN_SPLASH_MS = 2000;

export default function App() {
  const [fontsLoaded] = useFonts({
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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider>
    <NetworkProvider>
    <SafeAreaProvider>
      {fontsLoaded && (
        <ErrorBoundary>
          <AuthProvider>
            <PurchasesProvider>
            <NavigationContainer
              linking={{
                prefixes: ["https://velavision.app", "velavision://"],
                config: {
                  screens: {
                    AcceptInvite: "invite/:token",
                  },
                },
              }}
            >
              <StatusBar style="auto" />
              <RootNavigator />
            </NavigationContainer>
            </PurchasesProvider>
          </AuthProvider>
        </ErrorBoundary>
      )}
      {showSplash && (
        <SplashScreen
          appReady={appReady}
          onDone={() => setShowSplash(false)}
        />
      )}
    </SafeAreaProvider>
    </NetworkProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
