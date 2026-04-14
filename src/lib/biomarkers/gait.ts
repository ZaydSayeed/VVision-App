/**
 * Compute walking cadence (steps per minute) from accelerometer magnitudes.
 * Simple peak detection with a 0.3g threshold above running mean.
 * This is a general-wellness signal, not clinically validated.
 */
export function computeCadence(magnitudes: number[], sampleRateHz: number): number {
  if (magnitudes.length < sampleRateHz * 2) return 0;
  const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  const threshold = mean + 0.3;
  let peaks = 0;
  let above = false;
  for (const v of magnitudes) {
    if (v > threshold && !above) { peaks += 1; above = true; }
    else if (v <= threshold) above = false;
  }
  const durationMinutes = magnitudes.length / sampleRateHz / 60;
  if (durationMinutes <= 0) return 0;
  return Math.round(peaks / durationMinutes);
}

export async function captureGaitWindow(durationMs: number): Promise<{ cadence: number; sampleCount: number }> {
  // Dynamic import keeps expo-sensors out of Jest/Vitest (Flow syntax incompatible with Node transform)
  const { Accelerometer } = await import("expo-sensors");
  Accelerometer.setUpdateInterval(20); // 50 Hz
  const magnitudes: number[] = [];
  const sub = Accelerometer.addListener(({ x, y, z }) => {
    magnitudes.push(Math.sqrt(x * x + y * y + z * z));
  });
  await new Promise((r) => setTimeout(r, durationMs));
  sub.remove();
  return {
    cadence: computeCadence(magnitudes, 50),
    sampleCount: magnitudes.length,
  };
}
