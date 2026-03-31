import React, { useState } from "react";
import { PatientSummary } from "../../types";
import { PatientsDashboardScreen } from "./PatientsDashboardScreen";
import { PatientDetailScreen } from "./PatientDetailScreen";
import { LinkPatientScreen } from "./LinkPatientScreen";

export function PatientsTab() {
  const [view, setView] = useState<"dashboard" | "detail" | "link">("dashboard");
  const [selected, setSelected] = useState<PatientSummary | null>(null);

  if (view === "link") {
    return (
      <LinkPatientScreen
        onLinked={() => setView("dashboard")}
        onCancel={() => setView("dashboard")}
      />
    );
  }

  if (view === "detail" && selected) {
    return (
      <PatientDetailScreen
        patientId={selected.id}
        patientName={selected.name}
        onBack={() => setView("dashboard")}
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
