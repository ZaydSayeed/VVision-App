import { useState, useEffect } from "react";

/**
 * A ticking clock. Returns the current `Date`, refreshed every `intervalMs`
 * (default 60s — enough for time-of-day greetings and HH:MM banners). The
 * interval is cleared on unmount.
 */
export function useClock(intervalMs: number = 60000): Date {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return now;
}
