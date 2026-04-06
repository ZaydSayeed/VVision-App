import { useState, useEffect, useCallback } from "react";
import { RoutineTask } from "../types";
import { isDoneToday } from "../config/storage";
import {
  fetchRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
} from "../api/client";

export function useRoutine(patientId?: string) {
  const [tasks, setTasks] = useState<RoutineTask[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchRoutines();
      setTasks(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load routine");
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const addTask = useCallback(async (label: string, time: string) => {
    const data = await createRoutine(label, time);
    setTasks((prev) => [...prev, data]);
  }, []);

  const toggleComplete = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const today = new Date().toISOString().slice(0, 10);
      const newDate = task.completed_date === today ? null : today;
      const data = await updateRoutine(id, { completed_date: newDate });
      setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
    },
    [tasks]
  );

  const deleteTask = useCallback(async (id: string) => {
    await deleteRoutine(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const isCompletedToday = (task: RoutineTask) => isDoneToday(task.completed_date);

  return { tasks, addTask, toggleComplete, deleteTask, isCompletedToday, loadError, reload: load };
}
