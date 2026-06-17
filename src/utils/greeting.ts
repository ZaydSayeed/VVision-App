/** Ionicons glyph names used by the time-of-day greeting. */
export type GreetingIcon = "sunny" | "partly-sunny" | "moon";

/**
 * Time-of-day greeting for the patient home screen, keyed on a 24-hour `hour`.
 * Boundaries: morning [5,12), afternoon [12,17), evening [17,21), else night.
 */
export function getGreeting(hour: number): { text: string; icon: GreetingIcon } {
  if (hour >= 5 && hour < 12) return { text: "Good morning", icon: "sunny" };
  if (hour >= 12 && hour < 17) return { text: "Good afternoon", icon: "partly-sunny" };
  if (hour >= 17 && hour < 21) return { text: "Good evening", icon: "moon" };
  return { text: "Good night", icon: "moon" };
}
