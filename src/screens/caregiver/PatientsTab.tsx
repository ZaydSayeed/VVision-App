import React, { useState, useEffect } from "react";
import * as Notifications from "expo-notifications";
import { PatientSummary } from "../../types";
import { PatientsDashboardScreen } from "./PatientsDashboardScreen";
import { PatientDetailScreen } from "./PatientDetailScreen";
import { PatientLogsScreen } from "./PatientLogsScreen";
import { LogDetailScreen } from "./LogDetailScreen";
import { LinkPatientScreen } from "./LinkPatientScreen";
import { LiveStreamScreen } from "./LiveStreamScreen";
import { API_BASE_URL } from "../../config/api";
import { authHeaders } from "../../api/client";
import { usePatients } from "../../hooks/usePatients";
import { CheckInLog } from "../../api/logs";

interface LiveStreamParams {
  roomUrl: string;
  token: string;
}

export function PatientsTab() {
  const [view, setView] = useState<"dashboard" | "detail" | "link" | "logs" | "logDetail" | "livestream">("dashboard");
  const [selected, setSelected] = useState<PatientSummary | null>(null);
  const [selectedLog, setSelectedLog] = useState<CheckInLog | null>(null);
  const [liveParams, setLiveParams] = useState<LiveStreamParams | null>(null);
  const { patients } = usePatients();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data;
      if (data?.type !== "livestream_invite") return;
      const patientId = data.patientId as string;
      if (!patientId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/stream/status/${patientId}`, {
          headers: { ...authHeaders() },
        });
        if (!res.ok) return;
        const session = await res.json();
        if (session.status === "requested" || session.status === "invited") {
          const match = patients.find((p) => p.id === patientId);
          setSelected(match ?? { id: patientId, name: "Patient", tasksTotal: 0, tasksDone: 0, medsTotal: 0, medsDone: 0 });
          setView("detail");
        }
      } catch {
        // non-fatal
      }
    });
    return () => subscription.remove();
  }, [patients]);

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
        patientName={selected.name}
        roomUrl={liveParams.roomUrl}
        token={liveParams.token}
        onEnd={() => setView("detail")}
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
