import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { TimelineScreen } from "../screens/TimelineScreen";
import { PeopleScreen } from "../screens/PeopleScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { PatientsTab } from "../screens/caregiver/PatientsTab";
import { AddCaregiverScreen } from "../screens/caregiver/AddCaregiverScreen";
import { useDashboardData } from "../hooks/useDashboardData";
import { useHelpAlert } from "../hooks/useHelpAlert";
import { fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";

const Tab = createBottomTabNavigator();

const iconNames: Record<string, keyof typeof Ionicons.glyphMap> = {
  Timeline: "list-outline",
  People: "people-outline",
  Alerts: "notifications-outline",
  Patients: "pulse-outline",
  "Care Team": "person-add-outline",
};

export function CaregiverTabNavigator() {
  const { colors } = useTheme();
  const { people, alerts, stats, timeline, loading, refresh } = useDashboardData();
  const { pendingCount } = useHelpAlert();

  const styles = useMemo(() => StyleSheet.create({
    tabBar: {
      backgroundColor: "#FFFFFF",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      height: 88,
      paddingTop: 8,
      paddingBottom: 20,
    },
    tabLabel: {
      fontSize: 10,
      ...fonts.medium,
      letterSpacing: 0.8,
    },
    tabIcon: {},
    tabBadge: {
      backgroundColor: colors.violet,
    },
  }), [colors]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.violet,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: ({ color }) => (
          <Text style={[styles.tabLabel, { color }]}>
            {route.name.toUpperCase()}
          </Text>
        ),
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={iconNames[route.name]} size={22} color={color} />
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
      <Tab.Screen name="Patients" component={PatientsTab} />
      <Tab.Screen name="Care Team" component={AddCaregiverScreen} />
    </Tab.Navigator>
  );
}
