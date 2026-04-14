/**
 * Compute typing metrics from an array of keystroke timestamps (ms).
 * WPM uses standard 5-char word. General wellness signal only.
 */
export interface TypingMetrics { wpm: number; avgIntervalMs: number; keystrokes: number }

export function computeTypingMetrics(timestampsMs: number[]): TypingMetrics {
  if (timestampsMs.length < 2) return { wpm: 0, avgIntervalMs: 0, keystrokes: timestampsMs.length };
  const intervals: number[] = [];
  for (let i = 1; i < timestampsMs.length; i++) intervals.push(timestampsMs[i] - timestampsMs[i - 1]);
  const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const durationMs = timestampsMs[timestampsMs.length - 1] - timestampsMs[0];
  const wpm = Math.round((timestampsMs.length / 5) / (durationMs / 60000));
  return { wpm, avgIntervalMs: Math.round(avgIntervalMs), keystrokes: timestampsMs.length };
}
