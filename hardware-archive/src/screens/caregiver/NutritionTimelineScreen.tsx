import React from "react";
import { GlassesComingSoon } from "../../components/GlassesComingSoon";

export default function NutritionTimelineScreen({ onBack }: { onBack?: () => void }) {
  return (
    <GlassesComingSoon
      onBack={onBack}
      icon="restaurant"
      title="Eating & Hydration"
      description="A timeline of meals and drinks the glasses notice through the day, so you can see at a glance whether your loved one is eating and staying hydrated."
      bullets={[
        "Spot missed meals or low fluid intake early",
        "Gentle nudges when something looks off",
        "Patterns over days and weeks",
      ]}
    />
  );
}
