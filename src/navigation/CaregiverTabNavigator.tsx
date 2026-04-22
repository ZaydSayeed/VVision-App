import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { TimelineScreen } from "../screens/TimelineScreen";
import { PeopleScreen } from "../screens/PeopleScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { PatientsTab } from "../screens/caregiver/PatientsTab";
import { AddCaregiverScreen } from "../screens/caregiver/AddCaregiverScreen";
import FamilyCircleScreen from "../screens/caregiver/FamilyCircleScreen";
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
  Family: "people-outline",
};

interface CaregiverTabNavigatorProps {
  helpPendingCount: number;
}

export function CaregiverTabNavigator({ helpPendingCount }: CaregiverTabNavigatorProps) {
  const { colors } = useTheme();
  const { people, alerts, stats, timeline, loading, refresh } = useDashboardData();

  const styles = useMemo(() => StyleSheet.create({
    tabBar: {
      backgroundColor: colors.bg,
      borderTopWidth: 0,
      height: 88,
      paddingTop: 8,
      paddingBottom: 22,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 8,
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
      <Tab.Screen name="Family" component={FamilyCircleScreen} />
    </Tab.Navigator>
  );
}
