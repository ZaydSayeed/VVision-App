import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { TimelineScreen } from "./src/screens/TimelineScreen";
import { PeopleScreen } from "./src/screens/PeopleScreen";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { useDashboardData } from "./src/hooks/useDashboardData";
import { colors, gradients, fonts } from "./src/config/theme";

const Tab = createBottomTabNavigator();

function Header({ alertCount }: { alertCount: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.logo}>
          <LinearGradient
            colors={[gradients.primary[0], gradients.primary[1]]}
            style={styles.logoIcon}
          >
            <Text style={styles.logoLetter}>V</Text>
          </LinearGradient>
          <Text style={styles.logoText}>Vela Vision</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>
    </View>
  );
}

const tabIcons: Record<string, { active: string; inactive: string }> = {
  Timeline: { active: "📋", inactive: "📋" },
  People: { active: "👥", inactive: "👥" },
  Alerts: { active: "🔔", inactive: "🔔" },
};

export default function App() {
  const { people, alerts, stats, timeline, loading, refresh } =
    useDashboardData();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Header alertCount={alerts.length} />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarStyle: styles.tabBar,
              tabBarActiveTintColor: colors.accentBlue,
              tabBarInactiveTintColor: colors.textMuted,
              tabBarLabelStyle: styles.tabLabel,
              tabBarIcon: ({ focused }) => (
                <Text style={styles.tabIcon}>
                  {focused
                    ? tabIcons[route.name].active
                    : tabIcons[route.name].inactive}
                </Text>
              ),
              tabBarBadge:
                route.name === "Alerts" && alerts.length > 0
                  ? alerts.length
                  : undefined,
              tabBarBadgeStyle: styles.tabBadge,
            })}
          >
            <Tab.Screen name="Timeline">
              {() => (
                <TimelineScreen
                  stats={stats}
                  timeline={timeline}
                  loading={loading}
                  onRefresh={refresh}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="People">
              {() => (
                <PeopleScreen
                  people={people}
                  loading={loading}
                  onRefresh={refresh}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Alerts">
              {() => (
                <AlertsScreen
                  alerts={alerts}
                  loading={loading}
                  onRefresh={refresh}
                />
              )}
            </Tab.Screen>
          </Tab.Navigator>
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    backgroundColor: "rgba(10,14,26,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: {
    fontSize: 18,
    color: "#fff",
    ...fonts.bold,
  },
  logoText: {
    fontSize: 17,
    color: colors.textPrimary,
    ...fonts.bold,
    letterSpacing: -0.3,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accentGreen,
  },
  liveText: {
    fontSize: 10,
    color: colors.accentGreen,
    ...fonts.semibold,
    letterSpacing: 0.5,
  },
  tabBar: {
    backgroundColor: "rgba(10,14,26,0.95)",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 85,
    paddingTop: 8,
    paddingBottom: 20,
  },
  tabLabel: {
    fontSize: 10,
    ...fonts.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tabIcon: {
    fontSize: 22,
  },
  tabBadge: {
    backgroundColor: colors.accentRed,
    fontSize: 10,
    ...fonts.bold,
  },
});
