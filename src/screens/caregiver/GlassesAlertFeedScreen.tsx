import React from "react";
import { GlassesComingSoon } from "../../components/GlassesComingSoon";

export default function GlassesAlertFeedScreen({ onBack }: { onBack?: () => void }) {
  return (
    <GlassesComingSoon
      onBack={onBack}
      icon="notifications"
      title="Glasses Alert Feed"
      description="Real-time safety alerts from the glasses — falls, leaving a safe zone, distress, and unrecognized faces — prioritized so the urgent ones reach you first."
      bullets={[
        "Prioritized alerts, not a firehose of notifications",
        "See what the glasses saw, then respond",
        "Quiet hours and per-type controls",
      ]}
    />
  );
}
