import { GoogleGenAI } from "@google/genai";
import { Db } from "mongodb";
import { config } from "../server-core/config";
import { patternSchema } from "../server-routes/patterns";

export function parseGeminiResponse(raw: string) {
  const cleaned = raw.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
  let arr: unknown;
  try { arr = JSON.parse(cleaned); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    const r = patternSchema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

export async function inferPatternsForPatient(db: Db, patientId: string) {
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY not set");
  const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const events = await db.collection("profile_events").find({
    patientId, capturedAt: { $gte: since }
  }).sort({ capturedAt: 1 }).toArray();
  if (events.length < 10) return [];

  const compact = events.map(e => ({ t: e.capturedAt, k: e.kind, d: e.data })).slice(0, 400);
  const prompt = [
    "You are analyzing caregiving data for one patient with dementia over the last 30 days.",
    "Identify up to 5 RECURRING patterns that would help the caregiver. Only include patterns supported by at least 3 separate events.",
    "Return a JSON array matching this TypeScript type:",
    `Array<{ title: string; description: string; confidence: number; evidenceCount: number; firstObserved: string; lastObserved: string; tags: string[] }>`,
    "If there are no clear patterns, return [].",
    "Data:",
    JSON.stringify(compact),
  ].join("\n\n");

  const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const result = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  const text = result.text ?? "";
  return parseGeminiResponse(text);
}

export async function runInferenceAll(db: Db) {
  const patientIds = await db.collection("profile_events").distinct("patientId");
  for (const pid of patientIds) {
    try {
      const patterns = await inferPatternsForPatient(db, pid);
      for (const p of patterns) {
        await db.collection("patterns").updateOne(
          { patientId: pid, title: p.title },
          { $set: { ...p, patientId: pid, updatedAt: new Date().toISOString() } },
          { upsert: true }
        );
      }
    } catch (e) { console.error("inference failed for", pid, e); }
  }
}
