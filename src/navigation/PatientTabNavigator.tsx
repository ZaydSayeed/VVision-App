import React, { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { PatientStatusScreen } from "../screens/caregiver/PatientStatusScreen";
import { RoutineScreen } from "../screens/patient/RoutineScreen";
import { MedsScreen } from "../screens/patient/MedsScreen";
import { FacesScreen } from "../screens/patient/FacesScreen";
import { HelpScreen } from "../screens/patient/HelpScreen";
import { SettingsScreen } from "../screens/patient/SettingsScreen";
import { fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";

interface PatientTabNavigatorProps {
  patientName: string;
}

const Tab = createBottomTabNavigator();

const iconNames: Record<string, keyof typeof Ionicons.glyphMap> = {
  Status: "home-outline",
  Routine: "calendar-outline",
  Meds: "medkit-outline",
  Faces: "person-outline",
  Help: "alert-circle-outline",
  Profile: "person-circle-outline",
};

export function PatientTabNavigator({ patientName }: PatientTabNavigatorProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    tabBar: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      height: 85,
      paddingTop: 8,
      paddingBottom: 20,
    },
    tabLabel: {
      fontSize: 11,
      ...fonts.medium,
      letterSpacing: 0.8,
    },
    tabIcon: {},
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
        tabBarIcon: ({ color }) => (
          <Ionicons name={iconNames[route.name]} size={22} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Status" component={PatientStatusScreen} />
      <Tab.Screen name="Routine" component={RoutineScreen} />
      <Tab.Screen name="Meds" component={MedsScreen} />
      <Tab.Screen name="Faces" component={FacesScreen} />
      <Tab.Screen name="Help">
        {() => <HelpScreen patientName={patientName} />}
      </Tab.Screen>
      <Tab.Screen name="Profile" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
