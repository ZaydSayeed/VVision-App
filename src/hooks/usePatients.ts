import { useState, useEffect, useCallback, useRef } from "react";
import { PatientSummary } from "../types";
import { fetchLinkedPatients } from "../api/client";
import { writeWidgetPatientsList } from "../../modules/widget-bridge";

const POLL_INTERVAL = 15000;

export function usePatients() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await fetchLinkedPatients();
      setPatients(data);
      // Populates the widget's configuration picker (targets/EvaluVisionWidget/AppIntent.swift)
      // for caregivers managing multiple patients. Non-fatal — the widget
      // degrades gracefully (falls back to the active-patient pointer) if this
      // never lands.
      writeWidgetPatientsList(data.map((p) => ({ id: p.id, name: p.name }))).catch((err) =>
        console.warn("[widget] patients list write failed (non-fatal):", err)
      );
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  return { patients, loading, refresh: load };
}
