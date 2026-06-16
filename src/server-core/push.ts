import { Db } from "mongodb";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: "default" | "normal" | "high";
  sound?: "default" | null;
}

function isValidExpoToken(t: unknown): t is string {
  return typeof t === "string" && t.startsWith("ExponentPushToken[");
}

/**
 * All valid caregiver Expo push tokens for a patient.
 *
 * Returns every token (fan-out), not just one, so a help alert reaches the
 * whole care team rather than a single device (SAFE-3 partial mitigation).
 */
export async function getCaregiverPushTokens(db: Db, patientId: string): Promise<string[]> {
  const docs = await db.collection("pushTokens").find({ patientId }).toArray();
  return docs.map((d) => d.expoPushToken).filter(isValidExpoToken);
}

/** High-priority help-request push messages, one per caregiver token. */
export function buildHelpPushMessages(tokens: string[], patientName: string): ExpoPushMessage[] {
  return tokens.map((to) => ({
    to,
    title: "🚨 Help requested",
    body: `${patientName} tapped the Help button and needs assistance now.`,
    data: { type: "help_request" },
    priority: "high",
    sound: "default",
  }));
}

export interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

/** POST a batch of messages to Expo. Best-effort: logs but never throws. Returns the per-message tickets (same order as input). */
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoTicket[]> {
  if (!messages.length) return [];
  try {
    const res = await fetch("https://exp.host/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[push] exp.host error:", res.status, json);
      return [];
    }
    return Array.isArray(json?.data) ? (json.data as ExpoTicket[]) : [];
  } catch (err) {
    console.error("[push] send failed:", err);
    return [];
  }
}

/**
 * Notify all of a patient's caregivers that help was requested.
 * Returns the number of devices a push was sent to (0 if none registered).
 * Prunes any token Expo reports as no-longer-registered so it doesn't linger.
 */
export async function notifyCaregiversOfHelp(
  db: Db,
  patientId: string,
  patientName: string
): Promise<number> {
  const tokens = await getCaregiverPushTokens(db, patientId);
  const messages = buildHelpPushMessages(tokens, patientName);
  const tickets = await sendExpoPush(messages);

  await Promise.all(
    tickets.map((t, i) =>
      t?.details?.error === "DeviceNotRegistered" && tokens[i]
        ? db.collection("pushTokens").deleteOne({ expoPushToken: tokens[i] })
        : Promise.resolve()
    )
  );

  return messages.length;
}
