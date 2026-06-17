import { Router } from "express";
import { z } from "zod";
import Groq from "groq-sdk";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";
import { config } from "../server-core/config";
import rateLimit from "express-rate-limit";
import { buildAssistantTools, normalizeMedicationArgs } from "./assistantTools";
import { getConsent, hasConsent } from "../server-core/consent";

const router = Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { detail: "Too many requests. Please wait a moment." },
});

const chatSchema = z.object({
  message: z.string().min(1).max(2000).trim(),
});

// POST /api/assistant/chat
router.post("/chat", chatLimiter, authMiddleware, resolvePatientId, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ detail: parsed.error.issues[0].message });
    return;
  }

  try {
    const db = getDb();
    const patientId = req.patientId!;

    // Gate the AI on explicit consent — patient data is sent to a third-party
    // LLM, so don't process anything until aiAssistant consent is on (SEC-02).
    const consent = await getConsent(db, patientId);
    if (!hasConsent(consent, "aiAssistant")) {
      res.json({
        reply: "AI help is turned off for this profile. You can turn it on under Privacy & Sharing.",
        reminderCreated: false,
        taskCreated: false,
        medicationCreated: false,
      });
      return;
    }

    // Fetch context in parallel
    const [convDocs, routineDocs, medDocs, reminderDocs] = await Promise.all([
      db.collection("conversations").find({ patient_id: patientId }).sort({ created_at: 1 }).limit(20).toArray(),
      db.collection("routines").find({ patient_id: patientId }).limit(50).toArray(),
      db.collection("medications").find({ patient_id: patientId }).limit(50).toArray(),
      db.collection("reminders").find({ patient_id: patientId }).sort({ created_at: -1 }).limit(20).toArray(),
    ]);

    // Who is asking? Patients get a READ-ONLY assistant (no write tools).
    const requester = await db.collection("users").findOne({ supabase_uid: req.auth!.userId });
    const requesterRole: "patient" | "caregiver" = requester?.role === "patient" ? "patient" : "caregiver";

    // Patient first name (for tone) — prefer the patient's own user record.
    const patientUser = await db.collection("users").findOne({ patient_id: patientId, role: "patient" });
    const firstName = (patientUser?.name ?? requester?.name)?.split(" ")[0] ?? "there";

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

    const routinesText = routineDocs.length
      ? routineDocs.map((r) => `- ${r.label}${r.time ? ` at ${r.time}` : ""}`).join("\n")
      : "No routine tasks.";

    const medsText = medDocs.length
      ? medDocs.map((m) => `- ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.time ? ` at ${m.time}` : ""}`).join("\n")
      : "No medications.";

    const remindersText = reminderDocs.length
      ? reminderDocs.map((r) => `- ${r.text}${r.time ? ` at ${r.time}` : ""}${r.recurrence ? ` (${r.recurrence})` : ""}`).join("\n")
      : "No reminders.";

    const conversationHistory = convDocs
      .map((c) => `${c.role === "user" ? firstName : "Vision"}: ${c.content}`)
      .join("\n");

    const systemPrompt = `You are Vision, a warm and patient AI assistant built into smart glasses and a companion app for someone who needs help remembering things.

Keep responses to 1-3 short sentences. Use a warm, reassuring tone.
You are an AI assistant — if asked, you may say so plainly; never claim to be a person or a doctor.
Never give medical advice.
Never guess clinical details like a medication dosage or time — if they were not stated, ask for the exact value.
It is okay to repeat information — the person may ask the same thing multiple times.

PATIENT: ${firstName}
CURRENT TIME: ${timeStr}
TODAY: ${dateStr}

TODAY'S ROUTINE:
${routinesText}

TODAY'S MEDICATIONS:
${medsText}

UPCOMING REMINDERS:
${remindersText}

RECENT CONVERSATION:
${conversationHistory}`;

    const groq = new Groq({ apiKey: config.groqApiKey });

    // Read-only for patients; caregivers get propose-write tools.
    const tools = buildAssistantTools(requesterRole);

    const firstCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: parsed.data.message },
      ],
      ...(tools.length ? { tools, tool_choice: "auto" as const } : {}),
      max_tokens: 300,
      temperature: 0.7,
    });

    const firstChoice = firstCompletion.choices[0];
    let reply: string;
    let reminderCreated = false;
    let taskCreated = false;
    let medicationCreated = false;

    if (firstChoice?.finish_reason === "tool_calls" && firstChoice.message.tool_calls?.length) {
      const toolResults = await Promise.all(
        firstChoice.message.tool_calls.map(async (toolCall) => {
          let result = "Done.";

          if (toolCall.function.name === "create_reminder") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              await db.collection("reminders").insertOne({
                patient_id: patientId,
                text: args.text,
                time: args.time ?? null,
                recurrence: args.recurrence ?? null,
                source: "app",
                created_at: new Date().toISOString(),
                completed_date: null,
              });
              result = "Reminder created.";
              reminderCreated = true;
            } catch (e) {
              result = "Sorry, I couldn't save that reminder.";
              console.error("create_reminder tool error:", e);
            }
          } else if (toolCall.function.name === "create_task") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              await db.collection("routines").insertOne({
                label: args.label,
                time: args.time ?? null,
                completed_date: null,
                patient_id: patientId,
              });
              result = "Task added to routine.";
              taskCreated = true;
            } catch (e) {
              result = "Sorry, I couldn't add that task.";
              console.error("create_task tool error:", e);
            }
          } else if (toolCall.function.name === "create_medication") {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const med = normalizeMedicationArgs(args);
              if (med.missing.length) {
                // Refuse to fabricate clinical fields — ask the human instead.
                result = `I can't add that yet — I still need the ${med.missing.join(" and ")}. Please tell me the exact value${med.missing.length > 1 ? "s" : ""}; I won't guess.`;
              } else {
                // Safety: never auto-commit a medication to the live list. Hand the
                // details back so the caregiver adds and confirms it themselves in
                // the Medications screen — no unreviewed AI dose goes live (AI-1).
                result = `For safety I don't add medications automatically. Please add "${med.name}" (${med.dosage}, ${med.time}) from the Medications screen so it's confirmed by you.`;
              }
            } catch (e) {
              result = "Sorry, I couldn't add that medication.";
              console.error("create_medication tool error:", e);
            }
          }

          return { toolCall, result };
        })
      );

      const secondCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: parsed.data.message },
          firstChoice.message,
          ...toolResults.map(({ toolCall, result }) => ({
            role: "tool" as const,
            tool_call_id: toolCall.id,
            content: result,
          })),
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      reply = secondCompletion.choices[0]?.message?.content?.trim() ?? "Done! I've taken care of that for you.";
    } else {
      reply = firstChoice?.message?.content?.trim() ?? "Sorry, I couldn't respond right now.";
    }

    res.json({ reply, reminderCreated, taskCreated, medicationCreated });
  } catch (err) {
    console.error("assistant chat error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
