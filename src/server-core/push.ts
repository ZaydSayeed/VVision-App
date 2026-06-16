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

/**
 * High-priority help-request push messages, one per caregiver token.
 * `level` >= 2 means the alert is still unanswered and the copy escalates.
 */
export function buildHelpPushMessages(
  tokens: string[],
  patientName: string,
  level = 1
): ExpoPushMessage[] {
  const escalated = level >= 2;
  const title = escalated ? "⚠️ Still unanswered — help needed" : "🚨 Help requested";
  const body = escalated
    ? `${patientName} tapped Help and no one has responded yet. Please respond or call them now.`
    : `${patientName} tapped the Help button and needs assistance now.`;
  return tokens.map((to) => ({
    to,
    title,
    body,
    data: { type: "help_request", escalation: level },
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
  patientName: string,
  level = 1
): Promise<number> {
  const tokens = await getCaregiverPushTokens(db, patientId);
  const messages = buildHelpPushMessages(tokens, patientName, level);
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

/** The patient's own Expo push token (for reassurance pushes back to them). */
export async function getPatientPushToken(db: Db, patientId: string): Promise<string | null> {
  const doc = await db.collection("patientPushTokens").findOne({ patientId });
  return isValidExpoToken(doc?.expoPushToken) ? doc!.expoPushToken : null;
}

/**
 * Tell the patient that help is on the way once a caregiver acknowledges — the
 * dignity/reassurance side of the help loop (EMO). Returns false if the patient
 * has no registered device.
 */
export async function notifyPatientHelpAcknowledged(
  db: Db,
  patientId: string,
  responderName?: string
): Promise<boolean> {
  const token = await getPatientPushToken(db, patientId);
  if (!token) return false;
  const body = responderName
    ? `${responderName} is on the way to help you.`
    : "Someone is on the way to help you.";
  await sendExpoPush([
    {
      to: token,
      title: "💜 Help is on the way",
      body,
      data: { type: "help_acknowledged" },
      priority: "high",
      sound: "default",
    },
  ]);
  return true;
}
