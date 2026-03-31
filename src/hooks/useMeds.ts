import { useState, useEffect, useCallback } from "react";
import { supabase } from "../config/supabase";
import { Medication } from "../types";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function useMeds(patientId?: string) {
  const [meds, setMeds] = useState<Medication[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const targetId = patientId ?? user.id;
    const { data } = await supabase
      .from("medications")
      .select("*")
      .eq("patient_id", targetId)
      .order("created_at");
    if (data) setMeds(data);
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const addMed = useCallback(async (name: string, dosage: string, time: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");
    const { data, error } = await supabase
      .from("medications")
      .insert({ patient_id: user.id, name, dosage, time })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setMeds((prev) => [...prev, data]);
  }, []);

  const toggleTaken = useCallback(async (id: string) => {
    const med = meds.find((m) => m.id === id);
    if (!med) return;
    const newDate = med.taken_date === today() ? null : today();
    const { data, error } = await supabase
      .from("medications")
      .update({ taken_date: newDate })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    setMeds((prev) => prev.map((m) => (m.id === id ? data : m)));
  }, [meds]);

  const deleteMed = useCallback(async (id: string) => {
    await supabase.from("medications").delete().eq("id", id);
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const isTakenToday = (med: Medication) => med.taken_date === today();

  return { meds, addMed, toggleTaken, deleteMed, isTakenToday };
}
