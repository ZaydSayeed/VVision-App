import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileBasicsStep from "../screens/onboarding/ProfileBasicsStep";
import ProfileStoryStep from "../screens/onboarding/ProfileStoryStep";
import InviteSiblingsStep from "../screens/onboarding/InviteSiblingsStep";
import SmartHomeStep from "../screens/onboarding/SmartHomeStep";
import CallerSetupStep from "../screens/onboarding/CallerSetupStep";
import PaywallStep from "../screens/onboarding/PaywallStep";

const Stack = createNativeStackNavigator();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true, title: "Setting up" }}>
      <Stack.Screen name="ProfileBasics" component={ProfileBasicsStep} />
      <Stack.Screen name="ProfileStory" component={ProfileStoryStep} />
      <Stack.Screen name="InviteSiblingsStep" component={InviteSiblingsStep} />
      <Stack.Screen name="SmartHomeStep" component={SmartHomeStep} />
      <Stack.Screen name="CallerSetupStep" component={CallerSetupStep} />
      <Stack.Screen name="PaywallStep" component={PaywallStep} options={{ title: "Start your trial" }} />
    </Stack.Navigator>
  );
}
