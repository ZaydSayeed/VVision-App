import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  Routine: "calendar-clear-outline",
  Meds: "medkit-outline",
  Faces: "people-outline",
  Help: "hand-left-outline",
  Profile: "person-circle-outline",
};

export function PatientTabNavigator({ patientName }: PatientTabNavigatorProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    tabBar: {
      backgroundColor: "#FFFFFF",
      borderTopWidth: 0,
      height: 84,
      paddingTop: 8,
      paddingBottom: 20,
      shadowColor: "#7B5CE7",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 8,
    },
    tabLabel: {
      fontSize: 10,
      ...fonts.medium,
      letterSpacing: 0.5,
    },
    fabWrapper: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    fabButton: {
      top: -18,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 10,
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
        tabBarIcon: ({ color }) => (
          <Ionicons name={iconNames[route.name]} size={24} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Status" component={PatientStatusScreen} />
      <Tab.Screen name="Routine" component={RoutineScreen} />
      <Tab.Screen
        name="Help"
        options={{
          tabBarButton: (props) => (
            <View style={styles.fabWrapper}>
              <TouchableOpacity
                onPress={props.onPress}
                style={styles.fabButton}
              >
                <Ionicons name="alert-circle-outline" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ),
        }}
      >
        {() => <HelpScreen patientName={patientName} />}
      </Tab.Screen>
      <Tab.Screen name="Meds" component={MedsScreen} />
      <Tab.Screen name="Faces" component={FacesScreen} />
    </Tab.Navigator>
  );
}
