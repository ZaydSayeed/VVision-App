import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { TimelineScreen } from "../screens/TimelineScreen";
import { PeopleScreen } from "../screens/PeopleScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { PatientsTab } from "../screens/caregiver/PatientsTab";
import { AddCaregiverScreen } from "../screens/caregiver/AddCaregiverScreen";
import { useDashboardData } from "../hooks/useDashboardData";
import { fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";

const Tab = createBottomTabNavigator();

const iconNames: Record<string, keyof typeof Ionicons.glyphMap> = {
  Timeline: "list",
  People: "people",
  Alerts: "notifications",
  Patients: "pulse",
  "Care Team": "person-add",
};

interface CaregiverTabNavigatorProps {
  helpPendingCount: number;
}

export function CaregiverTabNavigator({ helpPendingCount }: CaregiverTabNavigatorProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { people, alerts, stats, timeline, loading, refresh } = useDashboardData();

  const styles = useMemo(() => StyleSheet.create({
    tabBar: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: Math.max(insets.bottom, 14),
      backgroundColor: colors.bg,
      borderTopWidth: 0,
      borderWidth: 1,
      borderColor: colors.violet100,
      borderRadius: 32,
      height: 72,
      paddingTop: 8,
      paddingBottom: 8,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 12,
    },
    tabLabel: {
      fontSize: 13,
      ...fonts.medium,
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
            {route.name}
          </Text>
        ),
        tabBarIcon: ({ color }) => (
          <Ionicons name={iconNames[route.name]} size={26} color={color} />
        ),
        tabBarBadge:
          route.name === "Alerts" && (alerts.length + helpPendingCount) > 0
            ? alerts.length + helpPendingCount
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
