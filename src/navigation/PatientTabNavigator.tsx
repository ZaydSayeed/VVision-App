import React from "react";
import { Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { RoutineScreen } from "../screens/patient/RoutineScreen";
import { MedsScreen } from "../screens/patient/MedsScreen";
import { FacesScreen } from "../screens/patient/FacesScreen";
import { HelpScreen } from "../screens/patient/HelpScreen";
import { colors, fonts } from "../config/theme";

interface PatientTabNavigatorProps {
  patientName: string;
}

const Tab = createBottomTabNavigator();

const icons: Record<string, string> = {
  Routine: "📋",
  Medications: "💊",
  Faces: "👤",
  Help: "🆘",
};

export function PatientTabNavigator({ patientName }: PatientTabNavigatorProps) {
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
      })}
    >
      <Tab.Screen name="Routine" component={RoutineScreen} />
      <Tab.Screen name="Medications" component={MedsScreen} />
      <Tab.Screen name="Faces" component={FacesScreen} />
      <Tab.Screen name="Help">
        {() => <HelpScreen patientName={patientName} />}
      </Tab.Screen>
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
    fontSize: 11,
    ...fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tabIcon: { fontSize: 22 },
});
