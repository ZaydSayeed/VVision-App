import { useState, useEffect, useCallback } from "react";
import { RoutineTask } from "../types";
import { STORAGE_KEYS, readStorage, writeStorage, today } from "../config/storage";

export function useRoutine() {
  const [tasks, setTasks] = useState<RoutineTask[]>([]);

  useEffect(() => {
    readStorage<RoutineTask[]>(STORAGE_KEYS.ROUTINE_TASKS, []).then(setTasks);
  }, []);

  const persist = useCallback(async (updated: RoutineTask[]) => {
    setTasks(updated);
    await writeStorage(STORAGE_KEYS.ROUTINE_TASKS, updated);
  }, []);

  const addTask = useCallback(async (label: string, time: string) => {
    const task: RoutineTask = {
      id: Date.now().toString(),
      label,
      time,
      completedDate: null,
    };
    const current = await readStorage<RoutineTask[]>(STORAGE_KEYS.ROUTINE_TASKS, []);
    await persist([...current, task]);
  }, [persist]);

  const toggleComplete = useCallback(async (id: string) => {
    const current = await readStorage<RoutineTask[]>(STORAGE_KEYS.ROUTINE_TASKS, []);
    const t = today();
    const updated = current.map((task) =>
      task.id === id
        ? { ...task, completedDate: task.completedDate === t ? null : t }
        : task
    );
    await persist(updated);
  }, [persist]);

  const deleteTask = useCallback(async (id: string) => {
    const current = await readStorage<RoutineTask[]>(STORAGE_KEYS.ROUTINE_TASKS, []);
    await persist(current.filter((t) => t.id !== id));
  }, [persist]);

  const isCompletedToday = (task: RoutineTask) => task.completedDate === today();

  return { tasks, addTask, toggleComplete, deleteTask, isCompletedToday };
}
