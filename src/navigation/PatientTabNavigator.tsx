import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TodayScreen } from "../screens/patient/TodayScreen";
import { HelpScreen } from "../screens/patient/HelpScreen";
import { HealthScreen } from "../screens/patient/HealthScreen";
import { fonts } from "../config/theme";
import { useTheme } from "../context/ThemeContext";

interface PatientTabNavigatorProps {
  patientName: string;
}

const Tab = createBottomTabNavigator();

const iconNames: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: "home",
  Help: "hand-left",
  Health: "pulse",
};

export function PatientTabNavigator({ patientName }: PatientTabNavigatorProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => StyleSheet.create({
    tabBar: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: Math.max(insets.bottom, 14),
      backgroundColor: colors.warm,
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
    fabWrapper: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    fabButton: {
      top: -34,
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
    fabLabel: {
      fontSize: 13,
      ...fonts.medium,
      position: "absolute",
      bottom: 3,
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
          <Text style={[styles.tabLabel, { color }]}>{route.name}</Text>
        ),
        tabBarIcon: ({ color }) => (
          <Ionicons name={iconNames[route.name]} size={28} color={color} accessibilityLabel={route.name} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={TodayScreen} />
      <Tab.Screen
        name="Help"
        options={{
          tabBarButton: (props) => (
            <View style={styles.fabWrapper}>
              <TouchableOpacity
                onPress={props.onPress}
                style={styles.fabButton}
                accessibilityRole="button"
                accessibilityLabel="Get help. Tap to alert your caregivers."
              >
                <LinearGradient
                  colors={["#D95F5F", "#E87878"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fabGradient}
                >
                  <Ionicons name="hand-left" size={28} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={[styles.fabLabel, { color: props.accessibilityState?.selected ? colors.coral : colors.muted }]}>
                Help
              </Text>
            </View>
          ),
        }}
      >
        {() => <HelpScreen patientName={patientName} />}
      </Tab.Screen>
      <Tab.Screen name="Health" component={HealthScreen} />
    </Tab.Navigator>
  );
}
