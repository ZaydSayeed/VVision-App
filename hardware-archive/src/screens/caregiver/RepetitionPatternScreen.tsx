import React from "react";
import { GlassesComingSoon } from "../../components/GlassesComingSoon";

export default function RepetitionPatternScreen({ onBack }: { onBack?: () => void }) {
  return (
    <GlassesComingSoon
      onBack={onBack}
      icon="repeat"
      title="Repetition Patterns"
      description="A weekly view of repeated questions and behaviors the glasses pick up — a window into how your loved one is doing over time, and when sundowning tends to hit."
      bullets={[
        "See repetition trends, not just isolated moments",
        "Spot the times of day that are hardest",
        "Useful context to share with their doctor",
      ]}
    />
  );
}
