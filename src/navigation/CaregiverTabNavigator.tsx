import React from "react";
import { Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { TimelineScreen } from "../screens/TimelineScreen";
import { PeopleScreen } from "../screens/PeopleScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { PatientStatusScreen } from "../screens/caregiver/PatientStatusScreen";
import { AddCaregiverScreen } from "../screens/caregiver/AddCaregiverScreen";
import { useDashboardData } from "../hooks/useDashboardData";
import { useHelpAlert } from "../hooks/useHelpAlert";
import { colors, fonts } from "../config/theme";

const Tab = createBottomTabNavigator();

const icons: Record<string, string> = {
  Timeline: "📋",
  People: "👥",
  Alerts: "🔔",
  Patient: "📊",
  "Care Team": "➕",
};

export function CaregiverTabNavigator() {
  const { people, alerts, stats, timeline, loading, refresh } = useDashboardData();
  const { pendingCount } = useHelpAlert();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.violet,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: () => (
          <Text style={styles.tabIcon}>{icons[route.name]}</Text>
        ),
        tabBarBadge:
          route.name === "Alerts" && (alerts.length + pendingCount) > 0
            ? alerts.length + pendingCount
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
          <PeopleScreen people={people} loading={loading} onRefresh={refresh} />
        )}
      </Tab.Screen>
      <Tab.Screen name="Alerts">
        {() => (
          <AlertsScreen alerts={alerts} loading={loading} onRefresh={refresh} />
        )}
      </Tab.Screen>
      <Tab.Screen name="Patient" component={PatientStatusScreen} />
      <Tab.Screen name="Care Team" component={AddCaregiverScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 85,
    paddingTop: 8,
    paddingBottom: 20,
  },
  tabLabel: {
    fontSize: 10,
    ...fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tabIcon: { fontSize: 20 },
  tabBadge: {
    backgroundColor: colors.violet,
    fontSize: 10,
    ...fonts.medium,
  },
});
