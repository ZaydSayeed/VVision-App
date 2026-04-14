import React, { useState } from "react";
import { PatientSummary } from "../../types";
import { PatientsDashboardScreen } from "./PatientsDashboardScreen";
import { PatientDetailScreen } from "./PatientDetailScreen";
import { PatientLogsScreen } from "./PatientLogsScreen";
import { LogDetailScreen } from "./LogDetailScreen";
import { LinkPatientScreen } from "./LinkPatientScreen";
import { CheckInLog } from "../../api/logs";

export function PatientsTab() {
  const [view, setView] = useState<"dashboard" | "detail" | "link" | "logs" | "logDetail">("dashboard");
  const [selected, setSelected] = useState<PatientSummary | null>(null);
  const [selectedLog, setSelectedLog] = useState<CheckInLog | null>(null);

  if (view === "link") {
    return (
      <LinkPatientScreen
        onLinked={() => setView("dashboard")}
        onCancel={() => setView("dashboard")}
      />
    );
  }

  if (view === "logDetail" && selected && selectedLog) {
    return (
      <LogDetailScreen
        patientId={selected.id}
        log={selectedLog}
        onBack={() => setView("logs")}
      />
    );
  }

  if (view === "logs" && selected) {
    return (
      <PatientLogsScreen
        patientId={selected.id}
        patientName={selected.name}
        onBack={() => setView("detail")}
        onSelectLog={(log) => { setSelectedLog(log); setView("logDetail"); }}
      />
    );
  }

  if (view === "detail" && selected) {
    return (
      <PatientDetailScreen
        patientId={selected.id}
        patientName={selected.name}
        onBack={() => setView("dashboard")}
        onViewLogs={() => setView("logs")}
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
