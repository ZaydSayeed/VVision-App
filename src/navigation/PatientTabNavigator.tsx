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
    },
    fabWrapper: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    fabButton: {
      top: -20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.violet,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 8,
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
          <Ionicons name={iconNames[route.name]} size={22} color={color} />
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
