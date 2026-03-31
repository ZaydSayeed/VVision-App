import { useState, useEffect, useCallback } from "react";
import { supabase } from "../config/supabase";
import { PatientSummary } from "../types";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function usePatients() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: links } = await supabase
      .from("caregiver_patients")
      .select("patient_id, patient_name")
      .eq("caregiver_id", user.id);

    if (!links || links.length === 0) {
      setPatients([]);
      setLoading(false);
      return;
    }

    const summaries = await Promise.all(
      links.map(async (link) => {
        const pid = link.patient_id;

        const [{ data: tasks }, { data: meds }] = await Promise.all([
          supabase.from("routine_tasks").select("completed_date").eq("patient_id", pid),
          supabase.from("medications").select("taken_date").eq("patient_id", pid),
        ]);

        const tasksTotal = tasks?.length ?? 0;
        const tasksDone = tasks?.filter((t) => t.completed_date === today()).length ?? 0;
        const medsTotal = meds?.length ?? 0;
        const medsDone = meds?.filter((m) => m.taken_date === today()).length ?? 0;

        return {
          id: pid,
          name: link.patient_name ?? "Unknown",
          tasksTotal,
          tasksDone,
          medsTotal,
          medsDone,
        } as PatientSummary;
      })
    );

    setPatients(summaries);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { patients, loading, refresh: load };
}
