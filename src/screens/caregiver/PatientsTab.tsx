import React, { useState } from "react";
import { PatientSummary } from "../../types";
import { PatientsDashboardScreen } from "./PatientsDashboardScreen";
import { PatientDetailScreen } from "./PatientDetailScreen";
import { LinkPatientScreen } from "./LinkPatientScreen";
import { LiveStreamScreen } from "./LiveStreamScreen";

interface LiveStreamParams {
  roomUrl: string;
  token: string;
}

export function PatientsTab() {
  const [view, setView] = useState<"dashboard" | "detail" | "link" | "livestream">("dashboard");
  const [selected, setSelected] = useState<PatientSummary | null>(null);
  const [liveParams, setLiveParams] = useState<LiveStreamParams | null>(null);

  if (view === "link") {
    return (
      <LinkPatientScreen
        onLinked={() => setView("dashboard")}
        onCancel={() => setView("dashboard")}
      />
    );
  }

  if (view === "livestream" && selected && liveParams) {
    return (
      <LiveStreamScreen
        patientId={selected.id}
        roomUrl={liveParams.roomUrl}
        token={liveParams.token}
        onEnd={() => setView("detail")}
      />
    );
  }

  if (view === "detail" && selected) {
    return (
      <PatientDetailScreen
        patientId={selected.id}
        patientName={selected.name}
        onBack={() => setView("dashboard")}
        onStartLiveView={(roomUrl, token) => {
          setLiveParams({ roomUrl, token });
          setView("livestream");
        }}
      />
    );
  }

  return (
    <PatientsDashboardScreen
      onSelectPatient={(p) => { setSelected(p); setView("detail"); }}
      onAddPatient={() => setView("link")}
    />
  );
}
