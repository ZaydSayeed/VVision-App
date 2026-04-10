import { useState, useEffect, useCallback } from "react";
import { CaregiverNote } from "../types";
import { fetchNotes } from "../api/client";

export function useNotes(patientId: string | undefined) {
  const [notes, setNotes] = useState<CaregiverNote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await fetchNotes(patientId);
      setNotes(data);
    } catch {
      // keep current state — non-critical
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const pinnedNote = notes.find((n) => n.pinned) ?? null;

  return { notes, pinnedNote, loading, reload: load };
}
