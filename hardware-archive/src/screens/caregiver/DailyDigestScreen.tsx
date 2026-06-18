import React from "react";
import { GlassesComingSoon } from "../../components/GlassesComingSoon";

export default function DailyDigestScreen({ onBack }: { onBack?: () => void }) {
  return (
    <GlassesComingSoon
      onBack={onBack}
      icon="document-text"
      title="Daily Digest"
      description="A plain-language summary of your loved one's day, drawn from the glasses — meals, activity, mood, and anything that may need your attention."
      bullets={[
        "One calm end-of-day recap instead of constant checking",
        "Flags only what actually matters",
        "Shareable with the rest of the care team",
      ]}
    />
  );
}
