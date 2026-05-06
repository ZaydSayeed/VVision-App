import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Groq from "npm:groq-sdk";
import { corsHeaders, json } from "../_shared/cors.ts";
import { verifyUser, resolvePatientId, requirePatientAccess, makeSupabase } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname;
  const supabase = makeSupabase();

  const auth = await verifyUser(req);
  if (!auth) return json({ detail: "Missing authorization header" }, 401);

  // POST /assistant/chat
  if (req.method === "POST" && path.endsWith("/assistant/chat")) {
    const resolved = await resolvePatientId(supabase, auth.userId);
    if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
    const { patientId } = resolved;

    let body: { message?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    if (!message) return json({ detail: "message required" }, 400);

    const [{ data: convDocs }, { data: routineDocs }, { data: medDocs }, { data: reminderDocs }, { data: userDoc }] =
      await Promise.all([
        supabase.from("conversations").select("role,content,created_at").eq("patient_id", patientId)
          .order("created_at", { ascending: true }).limit(20),
        supabase.from("routines").select("label,time").eq("patient_id", patientId).limit(50),
        supabase.from("medications").select("name,dosage,time").eq("patient_id", patientId).limit(50),
        supabase.from("reminders").select("text,time,recurrence").eq("patient_id", patientId)
          .order("created_at", { ascending: false }).limit(20),
        supabase.from("users").select("name").eq("patient_id", patientId).maybeSingle(),
      ]);

    const firstName = userDoc?.name?.split(" ")[0] ?? "there";
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

    const routinesText = routineDocs?.length
      ? routineDocs.map(r => `- ${r.label}${r.time ? ` at ${r.time}` : ""}`).join("\n")
      : "No routine tasks.";
    const medsText = medDocs?.length
      ? medDocs.map(m => `- ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.time ? ` at ${m.time}` : ""}`).join("\n")
      : "No medications.";
    const remindersText = reminderDocs?.length
      ? reminderDocs.map(r => `- ${r.text}${r.time ? ` at ${r.time}` : ""}${r.recurrence ? ` (${r.recurrence})` : ""}`).join("\n")
      : "No reminders.";
    const conversationHistory = convDocs?.map(c => `${c.role === "user" ? firstName : "Vision"}: ${c.content}`).join("\n") ?? "";

    const systemPrompt = `You are Vision, a warm and patient AI assistant built into smart glasses and a companion app for someone who needs help remembering things.\n\nKeep responses to 1-3 short sentences. Use a warm, reassuring tone.\nNever give medical advice. Never mention that you are AI.\nIt is okay to repeat information — the person may ask the same thing multiple times.\n\nPATIENT: ${firstName}\nCURRENT TIME: ${timeStr}\nTODAY: ${dateStr}\n\nTODAY'S ROUTINE:\n${routinesText}\n\nTODAY'S MEDICATIONS:\n${medsText}\n\nUPCOMING REMINDERS:\n${remindersText}\n\nRECENT CONVERSATION:\n${conversationHistory}`;

    const groq = new Groq({ apiKey: Deno.env.get("GROQ_API_KEY") });

    const tools: Groq.Chat.ChatCompletionTool[] = [
      { type: "function", function: { name: "create_reminder", description: "Create a reminder for the patient.",
        parameters: { type: "object", properties: { text: { type: "string" }, time: { type: "string" }, recurrence: { type: "string" } }, required: ["text"] } } },
      { type: "function", function: { name: "create_task", description: "Create a daily routine task.",
        parameters: { type: "object", properties: { label: { type: "string" }, time: { type: "string" } }, required: ["label"] } } },
      { type: "function", function: { name: "create_medication", description: "Add a medication.",
        parameters: { type: "object", properties: { name: { type: "string" }, dosage: { type: "string" }, time: { type: "string" } }, required: ["name"] } } },
    ];

    const firstCompletion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message }],
      tools, tool_choice: "auto", max_tokens: 300, temperature: 0.7,
    });

    const firstChoice = firstCompletion.choices[0];
    let reply: string;
    let reminderCreated = false, taskCreated = false, medicationCreated = false;

    if (firstChoice?.finish_reason === "tool_calls" && firstChoice.message.tool_calls?.length) {
      const toolResults = await Promise.all(firstChoice.message.tool_calls.map(async (tc) => {
        let result = "Done.";
        const args = JSON.parse(tc.function.arguments);
        if (tc.function.name === "create_reminder") {
          await supabase.from("reminders").insert({ patient_id: patientId, text: args.text,
            time: args.time ?? null, recurrence: args.recurrence ?? null, source: "app", completed_date: null });
          reminderCreated = true; result = "Reminder created.";
        } else if (tc.function.name === "create_task") {
          await supabase.from("routines").insert({ patient_id: patientId, label: args.label,
            time: args.time ?? "9:00 AM", completed_date: null });
          taskCreated = true; result = "Task added.";
        } else if (tc.function.name === "create_medication") {
          await supabase.from("medications").insert({ patient_id: patientId, name: args.name,
            dosage: args.dosage ?? "as prescribed", time: args.time ?? "9:00 AM", taken_date: null });
          medicationCreated = true; result = "Medication added.";
        }
        return { toolCall: tc, result };
      }));

      const second = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message },
          firstChoice.message,
          ...toolResults.map(({ toolCall, result }) => ({ role: "tool" as const, tool_call_id: toolCall.id, content: result }))],
        max_tokens: 200, temperature: 0.7,
      });
      reply = second.choices[0]?.message?.content?.trim() ?? "Done! I've taken care of that for you.";
    } else {
      reply = firstChoice?.message?.content?.trim() ?? "Sorry, I couldn't respond right now.";
    }

    // Save to conversation history
    await supabase.from("conversations").insert([
      { patient_id: patientId, role: "user", content: message },
      { patient_id: patientId, role: "assistant", content: reply },
    ]);

    return json({ reply, reminderCreated, taskCreated, medicationCreated });
  }

  // GET /:patientId/patterns
  const patternsMatch = path.match(/^\/([^/]+)\/patterns$/);
  if (req.method === "GET" && patternsMatch) {
    const patientId = patternsMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);
    const { data } = await supabase.from("patterns").select("*")
      .eq("patient_id", patientId).order("confidence", { ascending: false }).limit(20);
    return json(data ?? []);
  }

  // POST /:patientId/checkins
  const checkinMatch = path.match(/^\/([^/]+)\/checkins$/);
  if (req.method === "POST" && checkinMatch) {
    const patientId = checkinMatch[1];
    const hasAccess = await requirePatientAccess(supabase, auth.userId, patientId);
    if (!hasAccess) return json({ detail: "No seat on this profile" }, 403);
    let body: { source?: string; content?: string };
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const { data } = await supabase.from("checkin_logs")
      .insert({ patient_id: patientId, source: body.source ?? "app", content: body.content ?? "" })
      .select().single();
    return json(data, 201);
  }

  // GET /memory/logs (checkin logs for caregiver)
  if (req.method === "GET" && path.endsWith("/memory/logs")) {
    const resolved = await resolvePatientId(supabase, auth.userId);
    if ("error" in resolved) return json({ detail: resolved.error }, resolved.status);
    const { patientId } = resolved;
    const { data } = await supabase.from("checkin_logs").select("*")
      .eq("patient_id", patientId).order("created_at", { ascending: false }).limit(50);
    return json(data ?? []);
  }

  // POST /memory/add and POST /memory/search — proxy to Mem0
  if (path.endsWith("/memory/add") || path.endsWith("/memory/search")) {
    const mem0Key = Deno.env.get("MEM0_API_KEY");
    if (!mem0Key) return json({ detail: "Memory service unavailable" }, 503);
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ detail: "Invalid JSON" }, 400); }
    const endpoint = path.endsWith("/add") ? "https://api.mem0.ai/v1/memories/" : "https://api.mem0.ai/v1/memories/search/";
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Token ${mem0Key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return json(data, resp.status);
  }

  return json({ detail: "Not found" }, 404);
});
