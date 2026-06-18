import React from "react";
import { GlassesComingSoon } from "../../components/GlassesComingSoon";

interface Props {
  onBack: () => void;
}

export default function PatientProfileConfigScreen({ onBack }: Props) {
  return (
    <GlassesComingSoon
      onBack={onBack}
      icon="settings"
      title="Glasses Settings"
      description="Fine-tune how the glasses behave for your loved one — night mode, meal and hydration thresholds, the daily digest time, and the sundowning window."
      bullets={[
        "Night mode that suppresses check-ins while they sleep",
        "Nutrition and hydration alert thresholds",
        "A sundowning window the glasses can learn automatically",
      ]}
    />
  );
}
