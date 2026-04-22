import React from "react";
import { View } from "react-native";
import PaywallScreen from "../caregiver/PaywallScreen";
import { useOnboarding } from "../../hooks/useOnboarding";
import OnboardingProgress from "../../components/OnboardingProgress";

export default function PaywallStep(props: any) {
  const { complete } = useOnboarding();
  return (
    <View style={{ flex: 1 }}>
      <OnboardingProgress />
      <PaywallScreen
        {...props}
        navigation={{
          ...props.navigation,
          replace: async (route: string) => {
            await complete("paywall");
            props.navigation.replace(route);
          },
        }}
      />
    </View>
  );
}
