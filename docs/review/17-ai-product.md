## AI Product Review

The AI surface of this app is the single most dangerous part of the product as built. A temperature-0.7 LLM with `tool_choice:"auto"` writes medications, tasks, and reminders directly into a dementia patient's care record with no confirmation, no provenance, no human-in-the-loop, and no undo — and the same write-capable assistant is mounted on the patient side, handing the most cognitively-impaired user the most powerful write capability. Every claim below was verified against the actual code in `assistant.ts`, `VisionSheet.tsx`, `RootNavigator.tsx`, the patterns pipeline, the report/PDF generators, and the biomarker library; none were refuted. The one adjustment is AI-9: the assistant does carry a visible "AI Assistant" label in its header and consent screen, so the real gap is in-use action transparency, not identity disclosure.

### [AI-1] LLM writes medications to the database with no human confirmation
**Severity:** Critical · **Effort:** Medium

- **Issue:** The `create_medication` tool inserts straight into the medications collection the moment the model calls it.
- **Description:** In `assistant.ts` the tool runs at temperature 0.7 with `tool_choice:"auto"`; on a tool call it does `db.collection("medications").insertOne(...)` with no confirmation, review, or approval. The client just fires `triggerMedReload()` and the med appears in the patient's schedule.
- **Why it matters:** Medication management for a dementia patient is a life-safety function. A hallucinated, misheard, or over-eagerly interpreted utterance ("I think I should take more vitamin D") becomes a persisted med with no second human in the loop before the write commits.
- **Impact:** Patient (invented/wrong meds in their schedule, adherence confusion), caregiver (false trust the list is authoritative), business (catastrophic liability and App Store medical-claim exposure).
- **Recommendation:** Make all write tools propose-not-commit — the LLM returns a structured suggestion rendered as a confirmation card ("Add Donepezil 10mg at 8AM? Confirm / Edit / Cancel") requiring an explicit human tap before `insertOne`. For medications, route confirmation to the `primary_caregiver` seat; never auto-commit from a patient utterance.
- **Expected impact:** Eliminates the single highest-liability AI failure mode; converts a silent-write system into an auditable human-in-the-loop one.
- **Evidence:** `src/server-routes/assistant.ts:122-138,196-211`; `src/components/VisionSheet.tsx:144-147`

### [AI-2] Hallucinated medication dosage/time silently defaulted instead of refused
**Severity:** Critical · **Effort:** Small

- **Issue:** Missing safety-critical fields are filled with fabricated defaults rather than a clarifying question.
- **Description:** `create_medication` defaults dosage to `"as prescribed"` and time to `"9:00 AM"` (assistant.ts:201-203), and the tool description instructs the model to default rather than ask (lines 131-132). `create_task` defaults time to `"9:00 AM"` (line 186). So a med with no real dosage gets a confident-looking but invented schedule.
- **Why it matters:** Defaulting safety-critical fields produces output that looks authoritative ("Donepezil — as prescribed — 9:00 AM") but encodes a guess. A caregiver scanning the list cannot distinguish a real prescribed dose from a system-invented placeholder.
- **Impact:** Patient (takes med at fabricated time), caregiver (cannot trust schedule accuracy), business (clinical-claim risk).
- **Recommendation:** Never default safety-critical fields. If dosage or time is missing, return a clarifying question to the user instead of inventing a value. Flag any inferred field as "needs confirmation" in the UI.
- **Expected impact:** Removes fabricated dosages/times from the med list; forces explicit human input for safety fields.
- **Evidence:** `src/server-routes/assistant.ts:116,130-132,184-205`

### [AI-6] Write-capable AI assistant exposed directly to the cognitively-impaired patient
**Severity:** Critical · **Effort:** Medium

- **Issue:** The same VisionSheet that can create meds/tasks/reminders is mounted on the patient side with no caregiver gate.
- **Description:** `VisionSheet` is rendered on both the patient and caregiver branches of `RootNavigator.tsx` (lines 316 and 614). The patient can trigger med/task writes by typing or via suggestion chips, hitting the same `create_medication` tool path.
- **Why it matters:** A dementia patient may repeat, confabulate, or misstate. Letting their utterances auto-write to their own care record (especially meds) with no caregiver in the loop inverts the safety model: the most-impaired user has the most-powerful write capability.
- **Impact:** Patient (self-induced erroneous care data), caregiver (record corrupted by patient confusion without their knowledge).
- **Recommendation:** Disable write tools (`create_medication` especially) on the patient-side assistant, or require caregiver approval for any patient-initiated write. Keep the patient assistant read/comfort-only; reserve writes for the caregiver seat.
- **Expected impact:** Removes the inverted-trust failure mode; aligns write authority with the user best able to validate it.
- **Evidence:** `src/navigation/RootNavigator.tsx:316,614`; `src/components/VisionSheet.tsx:37-41,144-147`; `src/server-routes/assistant.ts:88-138`

### [AI-3] AI-created items are indistinguishable from human-entered items
**Severity:** High · **Effort:** Medium

- **Issue:** Tasks and medications written by the AI carry no provenance field at all.
- **Description:** Reminders get `source:"app"` (assistant.ts:171) but the `routines` and `medications` inserts have no source/createdBy field (lines 184-189, 199-205). No patient or caregiver screen surfaces "created by Vision AI"; a UI grep for `createdBy`/`aiGenerated`/AI-source labels returned zero matches.
- **Why it matters:** Trust and auditability require knowing what the AI did. A caregiver reviewing the med/routine list cannot tell which entries a human clinician typed and which an LLM generated from a patient's possibly-confused statement.
- **Impact:** Caregiver (cannot audit or trust AI actions, cannot spot AI errors), business (no audit trail for incident review).
- **Recommendation:** Stamp every AI write with `createdBy:"vision_ai"`, the source utterance, model id, and timestamp. Render an "AI-suggested" badge on those rows and a caregiver activity feed of all AI writes.
- **Expected impact:** Creates the audit trail required for clinical trust and incident review; lets caregivers spot and correct AI errors.
- **Evidence:** `src/server-routes/assistant.ts:166-211` (reminders have `source:"app"`, tasks/meds none); UI grep for AI-source labels returned no matches

### [AI-4] Inferred patterns presented as fact — confidence and evidence count computed then hidden
**Severity:** High · **Effort:** Small

- **Issue:** Confidence and evidence count are computed and stored but never shown.
- **Description:** `inferPatterns.ts` asks Gemini for patterns with `confidence` (0-1) and `evidenceCount`, and `patternSchema` (patterns.ts:7-15) validates and stores them. But `PatternsCard.tsx` renders only `title` + `description` under the heading "Patterns we've noticed" (lines 23,27-28). Neither field is displayed; a grep for `confidence` across `.tsx` returns zero hits.
- **Why it matters:** An LLM-inferred behavioral pattern over 30 days of sparse events is a hypothesis, not a finding. Stripping confidence and evidence count and titling it "Patterns we've noticed" presents a 0.4-confidence guess identically to a 0.95 one, manufacturing false certainty for a caregiver making care decisions.
- **Impact:** Caregiver (acts on low-confidence guesses as validated), patient (care changes from spurious correlations), business (medical-decision-influence liability).
- **Recommendation:** Display confidence as a band ("Possible pattern" vs "Strong pattern") and show "seen N times" (evidenceCount). Add a "Was this helpful? Yes/No" feedback control. Reframe copy to "Possible patterns — please verify."
- **Expected impact:** Turns over-confident fact-display into calibrated, dismissable hypotheses; adds the only pattern feedback loop in the app.
- **Evidence:** `src/server-jobs/inferPatterns.ts:30-44`; `src/server-routes/patterns.ts:7-15`; `src/components/PatternsCard.tsx:20-28`

### [AI-5] Only guardrail against medical advice is one unenforced system-prompt line
**Severity:** High · **Effort:** Medium

- **Issue:** The sole defense against medical advice is a single prompt instruction, and the same line tells the model to hide that it is AI.
- **Description:** `assistant.ts:69` contains "Never give medical advice. Never mention that you are AI." There is no output classifier, post-generation filter, blocklist, or logging of flagged outputs. The "never mention you are AI" instruction also directly contradicts the UI's own "AI Assistant" label (VisionSheet.tsx:428), undermining transparency.
- **Why it matters:** Prompt-level instructions are routinely bypassed by phrasing, and a temperature-0.7 model talking to a dementia patient about meds/symptoms is exactly where it drifts into advice. Telling the model to deny being AI prevents the user from calibrating trust.
- **Impact:** Patient (may receive and act on unfiltered medical advice from a system told to deny it is AI), business (regulatory/medical-claim exposure, already flagged in App Store review notes).
- **Recommendation:** Add a post-generation safety classifier that blocks/redirects medical-advice outputs to "Please ask your doctor," log every block, and red-team the prompt. Remove "Never mention that you are AI" — disclose AI identity for trust and likely legal-disclosure reasons.
- **Expected impact:** Replaces an unenforced instruction with an actual guardrail; restores user-facing AI transparency.
- **Evidence:** `src/server-routes/assistant.ts:66-69`; `src/components/VisionSheet.tsx:428`

### [AI-8] Doctor-facing PDF embeds an ungrounded AI narrative labeled "professional clinical summary"
**Severity:** High · **Effort:** Small

- **Issue:** Unverified Gemini text is dropped into a clinician PDF with no AI-generated/unverified disclaimer.
- **Description:** `reports.ts:73` prompts Gemini to "Write a professional clinical summary paragraph" from caregiver check-in notes, and the raw output is placed in the PDF under "Summary" (reportPdf.ts:116-117) with no caveat. The patterns section (reportPdf.ts:119-130) likewise lists AI patterns with no uncertainty note. Only the biomarker section carries a "not diagnostic" disclaimer (reportPdf.ts:134-136).
- **Why it matters:** A PDF handed to a real clinician carries implied authority. Calling an unverified LLM narrative a "clinical summary" invites a doctor to treat hallucinated or mis-weighted content as a vetted record.
- **Impact:** Patient (clinician decides partly on AI hallucination), caregiver (presents AI text as their own observation), business (significant medical-document liability).
- **Recommendation:** Prefix the summary with "AI-generated from caregiver notes — please verify against the source logs (appendix)." Drop "clinical" from the prompt. Add the same uncertainty caveat to the patterns section that already exists for biomarkers.
- **Expected impact:** Removes implied clinical authority from unverified AI text in doctor-facing documents; reduces document liability.
- **Evidence:** `src/server-routes/reports.ts:66-85`; `src/server-core/reportPdf.ts:115-130,134-136`

### [AI-10] AI failure/unavailability degrades to a dead-end with no fallback
**Severity:** High · **Effort:** Medium

- **Issue:** Chat failure is a dead-end, and a failed tool write is invisible to the user who may believe the action succeeded.
- **Description:** If Groq is down or times out, `VisionSheet.tsx:159-165` shows "Sorry, I couldn't connect right now. Please try again." with no retry, offline path, or alternative. On the backend a tool insert failure returns a soft "Sorry, I couldn't save that" to the model (assistant.ts:177-179,193-194,208-209), but the failure is invisible to the user, and the second completion can still reply "Done!" Render free-tier cold starts (~30s) make timeouts common.
- **Why it matters:** For a memory-impaired user relying on the assistant for meds/reminders, a silent or dead-end failure is a safety issue — the user believes an action succeeded when it did not. A partial tool failure the LLM glosses over is especially dangerous.
- **Impact:** Patient (believes a med/reminder was set when it failed), caregiver (gap in care record with no error surfaced), business (reliability perception, churn).
- **Recommendation:** Surface tool-write failures explicitly to the user ("I couldn't save that medication — please try again or add it manually"). Verify the write succeeded before the model claims success. Add retry/backoff for the chat call and a clear offline state.
- **Expected impact:** Prevents false-success on failed safety-critical writes; turns dead-ends into recoverable states.
- **Evidence:** `src/components/VisionSheet.tsx:159-168`; `src/server-routes/assistant.ts:177-179,234`

### [AI-7] No way to correct, undo, or flag a wrong AI write
**Severity:** Medium · **Effort:** Medium

- **Issue:** After the assistant inserts a med/task/reminder there is no AI-specific correction, undo, or feedback path.
- **Description:** The insert paths in `assistant.ts:158-239` write with no audit record and no undo token; `VisionSheet.tsx:131-169` has no correction control. The only recourse is the generic delete in the routine/med screens, which doesn't tie back to the AI action or feed any signal.
- **Why it matters:** Trustworthy AI requires a cheap correction loop. Without one, errors silently accumulate in the care record, the system never improves, and caregivers have no first-class way to report a hallucination.
- **Impact:** Caregiver (laborious manual cleanup with no AI context), business (no error telemetry to measure or reduce hallucination rate).
- **Recommendation:** Add an undo on every AI write (toast: "Vision added Donepezil — Undo") and a "Report this" control that logs the utterance, model output, and correction for monitoring and eval improvement.
- **Expected impact:** Establishes the missing feedback loop; produces the hallucination-rate telemetry needed to improve the model.
- **Evidence:** `src/server-routes/assistant.ts:158-239` (no audit/undo); `src/components/VisionSheet.tsx:131-169` (no correction path)

### [AI-9] Patient has no visibility into what the AI is doing or what it knows about them
**Severity:** Medium · **Effort:** Medium

- **Issue:** No in-use action receipts, and no signal that the full care record is injected into every prompt.
- **Description:** The consent screen (VisionSheet.tsx:436-497) is a one-time gate; during use there is no live indication that the patient's full routine, meds, reminders, and 20-turn history are injected into every prompt (assistant.ts:35-86), nor any signal when the AI takes an action (writing a med) versus chatting. Conversations auto-prune to 20 turns, silently dropping context. (Note: a static "AI Assistant" label does exist in the header, line 428 — so identity is disclosed; the gap is action transparency.)
- **Why it matters:** Transparency is a dignity and trust requirement. A patient given no signal that the assistant just modified their medication list cannot meaningfully understand or control the system acting on their care.
- **Impact:** Patient (no agency or understanding of an AI shaping daily care), business (consent/transparency gaps for a vulnerable population).
- **Recommendation:** Show an in-chat action receipt when the AI writes something ("I added a reminder for your walk at 6PM") and give the patient/caregiver a view of what context the AI is using.
- **Expected impact:** Improves patient agency and informed use; closes a transparency gap for a vulnerable cohort.
- **Evidence:** `src/components/VisionSheet.tsx:436-497,428`; `src/server-routes/assistant.ts:35-86`

### [AI-11] Biomarkers fed to caregivers/PDFs come from crude unvalidated heuristics presented as trends
**Severity:** Medium · **Effort:** Medium

- **Issue:** Noisy single-sensor heuristics are rendered as directional trends with arrows and sparklines.
- **Description:** Gait cadence is naive peak detection on phone accelerometer magnitudes with a fixed 0.3g threshold (gait.ts:6-19); typing "cadence" is mean keystroke interval (typing.ts:7-15). The PDF labels these "Wellness Trends" with up/down arrows from a +/-5% threshold (reports.ts:126-129) plus a sparkline (reportPdf.ts:142-152). The "not diagnostic" disclaimer (reportPdf.ts:134-136) is present, but confidence/sample-quality is never shown.
- **Why it matters:** Even labeled "wellness," a trend arrow and sparkline communicate meaningful change. A caregiver seeing "Gait Cadence ↓" may alarm or, worse, dismiss a real decline, based on sensor noise from a phone in a pocket.
- **Impact:** Caregiver (false alarms or false reassurance from noisy heuristics), patient (unwarranted care escalation/de-escalation), business (wellness-vs-medical claim line is legally sensitive per project notes).
- **Recommendation:** Suppress trend arrows below a noise-aware significance threshold and require a minimum sample count/quality. Show data-sufficiency ("based on 4 short windows — low confidence"). Make the uncertainty visible in the trend itself, not just a footnote.
- **Expected impact:** Reduces false signals from noisy biomarkers; strengthens the wellness-not-diagnostic posture already legally flagged.
- **Evidence:** `src/lib/biomarkers/gait.ts:6-19`; `src/lib/biomarkers/typing.ts:7-15`; `src/server-routes/reports.ts:126-141`; `src/server-core/reportPdf.ts:132-153`
