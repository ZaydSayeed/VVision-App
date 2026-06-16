import type Groq from "groq-sdk";

export type AssistantRole = "patient" | "caregiver";

export type MedicationField = "name" | "dosage" | "time";

export interface NormalizedMedication {
  name: string | null;
  dosage: string | null;
  time: string | null;
  /** Safety-critical fields the model did not supply. NEVER defaulted. */
  missing: MedicationField[];
}

function cleanString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Normalize medication tool arguments WITHOUT inventing safety-critical fields.
 *
 * The old assistant defaulted a missing dosage to "as prescribed" and a missing
 * time to "9:00 AM", silently fabricating clinical data (AI-2). This refuses to
 * guess: any missing field is surfaced so the caller can ask the human instead.
 */
export function normalizeMedicationArgs(args: {
  name?: unknown;
  dosage?: unknown;
  time?: unknown;
}): NormalizedMedication {
  const name = cleanString(args?.name);
  const dosage = cleanString(args?.dosage);
  const time = cleanString(args?.time);

  const missing: MedicationField[] = [];
  if (!name) missing.push("name");
  if (!dosage) missing.push("dosage");
  if (!time) missing.push("time");

  return { name, dosage, time, missing };
}

const writeTools: Groq.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_reminder",
      description:
        "Create a reminder. Call this when the caregiver asks to be reminded about something.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "What to remind about, e.g. 'Take a walk'" },
          time: { type: "string", description: "Time, e.g. '6:00 PM'. Omit if none was given." },
          recurrence: { type: "string", description: "How often: 'once', 'daily', etc. Omit if not mentioned." },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Create a daily routine task. Call this when the caregiver asks to add something to the routine.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short description, e.g. 'Morning walk'" },
          time: { type: "string", description: "Time, e.g. '8:00 AM'. Omit if none was given." },
        },
        required: ["label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_medication",
      description:
        "Propose adding a medication. The caregiver must confirm it in the app before it is active. " +
        "NEVER guess the dosage or time — if either was not stated, ask the caregiver for the exact value instead of calling this tool.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the medication, e.g. 'Donepezil'" },
          dosage: { type: "string", description: "Exact dosage as stated, e.g. '10mg'. Do not invent." },
          time: { type: "string", description: "Exact time as stated, e.g. '8:00 AM'. Do not invent." },
        },
        required: ["name", "dosage", "time"],
      },
    },
  },
];

/**
 * Build the tool set for the assistant based on who is asking.
 *
 * Patients get a READ-ONLY assistant — no create_* tools — so the AI can never
 * write a medication/task to a cognitively-impaired patient's record on their
 * own say-so (AI-6). Only caregivers can propose writes.
 */
export function buildAssistantTools(role: AssistantRole): Groq.Chat.ChatCompletionTool[] {
  if (role === "patient") return [];
  return writeTools;
}
