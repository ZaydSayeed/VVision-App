import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TodayScreen } from "../screens/patient/TodayScreen";
import { FacesScreen } from "../screens/patient/FacesScreen";
import { HelpScreen } from "../screens/patient/HelpScreen";
import { fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";

interface PatientTabNavigatorProps {
  patientName: string;
}

const Tab = createBottomTabNavigator();

const iconNames: Record<string, keyof typeof Ionicons.glyphMap> = {
  Today: "home",
  Faces: "people",
  Help: "hand-left",
};

export function PatientTabNavigator({ patientName }: PatientTabNavigatorProps) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    tabBar: {
      backgroundColor: colors.warm,
      borderTopWidth: 0,
      height: 88,
      paddingTop: 8,
      paddingBottom: 22,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 8,
    },
    tabLabel: {
      fontSize: 13,
      ...fonts.medium,
    },
    fabWrapper: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    fabButton: {
      top: -20,
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.coral,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 10,
      overflow: "hidden",
    },
    fabGradient: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
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
          <Ionicons name={iconNames[route.name]} size={28} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen
        name="Help"
        options={{
          tabBarButton: (props) => (
            <View style={styles.fabWrapper}>
              <TouchableOpacity onPress={props.onPress} style={styles.fabButton}>
                <LinearGradient
                  colors={["#D95F5F", "#E87878"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fabGradient}
                >
                  <Ionicons name="hand-left" size={28} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ),
        }}
      >
        {() => <HelpScreen patientName={patientName} />}
      </Tab.Screen>
      <Tab.Screen name="Faces" component={FacesScreen} />
    </Tab.Navigator>
  );
}
