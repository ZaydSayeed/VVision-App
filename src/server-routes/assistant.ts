import { Router } from "express";
import { z } from "zod";
import Groq from "groq-sdk";
import { getDb } from "../server-core/database";
import { authMiddleware } from "../server-core/security";
import { resolvePatientId } from "../server-core/patientResolver";
import { config } from "../server-core/config";
import rateLimit from "express-rate-limit";

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

    // Fetch context in parallel
    const [convDocs, routineDocs, medDocs, reminderDocs] = await Promise.all([
      db.collection("conversations").find({ patient_id: patientId }).sort({ created_at: 1 }).limit(20).toArray(),
      db.collection("routines").find({ patient_id: patientId }).limit(50).toArray(),
      db.collection("medications").find({ patient_id: patientId }).limit(50).toArray(),
      db.collection("reminders").find({ patient_id: patientId }).sort({ created_at: -1 }).limit(20).toArray(),
    ]);

    // Find patient first name from users collection
    const userDoc = await db.collection("users").findOne({ patient_id: patientId });
    const firstName = userDoc?.name?.split(" ")[0] ?? "there";

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
Never give medical advice. Never mention that you are AI.
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

    const tools: Groq.Chat.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "create_reminder",
          description: "Create a reminder for the patient. Call this when the patient asks to be reminded about something.",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: "What to remind the patient about, e.g. 'Take a walk'" },
              time: { type: "string", description: "Time for the reminder, e.g. '6:00 PM'. Omit if no specific time mentioned." },
              recurrence: { type: "string", description: "How often: 'once', 'daily', 'every 2 hours', etc. Omit if not mentioned." },
            },
            required: ["text"],
          },
        },
      },
    ];

    const firstCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: parsed.data.message },
      ],
      tools,
      tool_choice: "auto",
      max_tokens: 300,
      temperature: 0.7,
    });

    const firstChoice = firstCompletion.choices[0];
    let reply: string;

    if (firstChoice?.finish_reason === "tool_calls" && firstChoice.message.tool_calls?.length) {
      const toolCall = firstChoice.message.tool_calls[0];
      let toolResult = "Reminder created.";

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
        } catch (e) {
          toolResult = "Sorry, I couldn't save that reminder.";
          console.error("create_reminder tool error:", e);
        }
      }

      // Second call so Groq generates a natural confirmation reply
      const secondCompletion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: parsed.data.message },
          firstChoice.message,
          { role: "tool", tool_call_id: toolCall.id, content: toolResult },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      reply = secondCompletion.choices[0]?.message?.content?.trim() ?? "Done! I've set that reminder for you.";
    } else {
      reply = firstChoice?.message?.content?.trim() ?? "Sorry, I couldn't respond right now.";
    }

    res.json({ reply });
  } catch (err) {
    console.error("assistant chat error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
