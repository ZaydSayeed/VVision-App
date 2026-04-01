import { useState, useEffect, useCallback } from "react";
import { supabase } from "../config/supabase";
import { RoutineTask } from "../types";
import { today, isDoneToday } from "../config/storage";

export function useRoutine(patientId?: string) {
  const [tasks, setTasks] = useState<RoutineTask[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const targetId = patientId ?? user.id;
    const { data } = await supabase
      .from("routine_tasks")
      .select("*")
      .eq("patient_id", targetId)
      .order("created_at");
    if (data) setTasks(data);
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const addTask = useCallback(async (label: string, time: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");
    const { data, error } = await supabase
      .from("routine_tasks")
      .insert({ patient_id: user.id, label, time })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setTasks((prev) => [...prev, data]);
  }, []);

  const toggleComplete = useCallback(async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newDate = task.completed_date === today() ? null : today();
    const { data, error } = await supabase
      .from("routine_tasks")
      .update({ completed_date: newDate })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from("routine_tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const isCompletedToday = (task: RoutineTask) => isDoneToday(task.completed_date);

  return { tasks, addTask, toggleComplete, deleteTask, isCompletedToday };
}
