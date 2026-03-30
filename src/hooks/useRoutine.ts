import { useState, useEffect, useCallback } from "react";
import { RoutineTask } from "../types";
import {
  fetchRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
} from "../api/client";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function useRoutine() {
  const [tasks, setTasks] = useState<RoutineTask[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await fetchRoutines();
      setTasks(data);
    } catch {
      // Keep current state on error
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addTask = useCallback(
    async (label: string, time: string) => {
      const task = await createRoutine(label, time);
      setTasks((prev) => [...prev, task]);
    },
    []
  );

  const toggleComplete = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      const t = today();
      const newDate = task.completed_date === t ? null : t;
      const updated = await updateRoutine(id, { completed_date: newDate });
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    },
    [tasks]
  );

  const deleteTask = useCallback(async (id: string) => {
    await deleteRoutine(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const isCompletedToday = (task: RoutineTask) =>
    task.completed_date === today();

  return { tasks, addTask, toggleComplete, deleteTask, isCompletedToday };
}
