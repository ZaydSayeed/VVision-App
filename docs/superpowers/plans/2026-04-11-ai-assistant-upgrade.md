# AI Assistant Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Vision AI assistant with task/med creation tools, caregiver access, and suggestion chips

**Architecture:** Backend gets two new Groq tools (create_task, create_medication). Frontend adds suggestion chips to VisionSheet, Vision FAB to caregiver side, and cross-component reload events for new data types.

**Tech Stack:** Groq SDK (tool calling), React Native ScrollView (chips), existing event callback pattern

---

## File Map

### Files to Modify
- `src/utils/reminderEvents.ts` — expand to generic data reload event system
- `src/server-routes/assistant.ts` — add create_task + create_medication tools, return new flags
- `src/api/client.ts` — update sendVisionMessage return type
- `src/components/VisionSheet.tsx` — handle new response flags, add suggestion chips
- `src/navigation/RootNavigator.tsx` — add VisionSheet + FAB to CaregiverView
- `src/screens/patient/TodayScreen.tsx` — register task + med reload listeners

---

## Task 1: Expand reminderEvents.ts with task and med reload events

**Files:**
- Modify: `src/utils/reminderEvents.ts`

- [ ] **Step 1: Replace reminderEvents.ts with a multi-event reload system**

The current file only supports reminder reloads. We need the same pattern for tasks and meds. Keep the existing function names so nothing breaks, and add new ones alongside them.

Replace the entire contents of `src/utils/reminderEvents.ts` with:

```typescript
// ── Reminder reload ──────────────────────────────────────
let _reminderReloadCb: (() => void) | null = null;

export function registerReminderReload(fn: () => void) {
  _reminderReloadCb = fn;
}

export function triggerReminderReload() {
  _reminderReloadCb?.();
}

// ── Task reload ──────────────────────────────────────────
let _taskReloadCb: (() => void) | null = null;

export function registerTaskReload(fn: () => void) {
  _taskReloadCb = fn;
}

export function triggerTaskReload() {
  _taskReloadCb?.();
}

// ── Medication reload ────────────────────────────────────
let _medReloadCb: (() => void) | null = null;

export function registerMedReload(fn: () => void) {
  _medReloadCb = fn;
}

export function triggerMedReload() {
  _medReloadCb?.();
}
```

- [ ] **Step 2: Commit**

```
git add src/utils/reminderEvents.ts
git commit -m "expand reminderEvents with task and med reload callbacks"
```

---

## Task 2: Add create_task and create_medication tools to the backend

**Files:**
- Modify: `src/server-routes/assistant.ts`

- [ ] **Step 1: Add the two new tool definitions to the tools array**

In `src/server-routes/assistant.ts`, find the `tools` array (line ~90). Replace the entire `const tools: Groq.Chat.ChatCompletionTool[] = [...]` block with:

```typescript
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
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Create a daily routine task for the patient. Call this when the patient asks to add something to their routine or schedule.",
          parameters: {
            type: "object",
            properties: {
              label: { type: "string", description: "Short description of the task, e.g. 'Morning walk'" },
              time: { type: "string", description: "Time for the task, e.g. '8:00 AM'. Default to '9:00 AM' if not specified." },
            },
            required: ["label"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_medication",
          description: "Add a medication to the patient's schedule. Call this when the patient mentions a new medication they need to take.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Name of the medication, e.g. 'Donepezil'" },
              dosage: { type: "string", description: "Dosage amount, e.g. '10mg'. Default to 'as prescribed' if not specified." },
              time: { type: "string", description: "Time to take it, e.g. '8:00 AM'. Default to '9:00 AM' if not specified." },
            },
            required: ["name"],
          },
        },
      },
    ];
```

- [ ] **Step 2: Update the tool execution block to handle all three tools**

Find the `let reply: string;` and `let reminderCreated = false;` declarations (line ~122-123). Replace from `let reply: string;` through the end of the `res.json(...)` line (line ~175) with:

```typescript
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
                time: args.time ?? "9:00 AM",
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
              await db.collection("medications").insertOne({
                name: args.name,
                dosage: args.dosage ?? "as prescribed",
                time: args.time ?? "9:00 AM",
                taken_date: null,
                patient_id: patientId,
              });
              result = "Medication added.";
              medicationCreated = true;
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
```

- [ ] **Step 3: Commit**

```
git add src/server-routes/assistant.ts
git commit -m "add create_task and create_medication tools to Vision assistant"
```

---

## Task 3: Update API client and VisionSheet with new response fields + suggestion chips

**Files:**
- Modify: `src/api/client.ts`
- Modify: `src/components/VisionSheet.tsx`

- [ ] **Step 1: Update the sendVisionMessage return type in client.ts**

In `src/api/client.ts`, find the `sendVisionMessage` function (line ~368). Replace:

```typescript
export async function sendVisionMessage(message: string): Promise<{ reply: string; reminderCreated?: boolean }> {
  return request<{ reply: string; reminderCreated?: boolean }>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
```

With:

```typescript
export async function sendVisionMessage(message: string): Promise<{
  reply: string;
  reminderCreated?: boolean;
  taskCreated?: boolean;
  medicationCreated?: boolean;
}> {
  return request<{
    reply: string;
    reminderCreated?: boolean;
    taskCreated?: boolean;
    medicationCreated?: boolean;
  }>("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
```

- [ ] **Step 2: Update VisionSheet imports to include new reload triggers**

In `src/components/VisionSheet.tsx`, find the import line for `triggerReminderReload` (line ~24). Replace:

```typescript
import { triggerReminderReload } from "../utils/reminderEvents";
```

With:

```typescript
import { triggerReminderReload, triggerTaskReload, triggerMedReload } from "../utils/reminderEvents";
```

- [ ] **Step 3: Update handleSend to trigger task and med reloads**

In `src/components/VisionSheet.tsx`, find the `handleSend` function. Replace the try block inside it (the section from `const { reply, reminderCreated }` through the `await Promise.all` call, lines ~95-107):

```typescript
      const { reply, reminderCreated, taskCreated, medicationCreated } = await sendVisionMessage(text);
      if (reminderCreated) triggerReminderReload();
      if (taskCreated) triggerTaskReload();
      if (medicationCreated) triggerMedReload();
      const assistantMsg: ConversationTurn = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await Promise.all([
        saveConversationTurn("user", text),
        saveConversationTurn("assistant", reply),
      ]);
```

- [ ] **Step 4: Add suggestion chips when chat is empty**

In `src/components/VisionSheet.tsx`, add a `SUGGESTION_CHIPS` constant right after the `DISMISS_Y` constant (line ~29):

```typescript
const SUGGESTION_CHIPS = [
  "What's left today?",
  "Add a reminder",
  "How's the routine going?",
];
```

- [ ] **Step 5: Add chip styles to the StyleSheet**

In `src/components/VisionSheet.tsx`, inside the `useMemo` StyleSheet (after the `micBtn` style, around line ~195), add these styles before the closing `}), [colors]);`:

```typescript
    chipsRow: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    chipsScroll: {
      gap: spacing.sm,
    },
    chip: {
      backgroundColor: colors.violet50,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.violet300,
    },
    chipText: {
      fontSize: 12,
      color: colors.violet,
      ...fonts.medium,
    },
```

- [ ] **Step 6: Add chip row JSX between the ScrollView and the input bar**

In `src/components/VisionSheet.tsx`, find the `</ScrollView>` closing tag (around line ~295). Between `</ScrollView>` and `<View style={styles.inputBar}>`, insert:

```typescript
          {messages.length === 0 && !sending && (
            <View style={styles.chipsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                {SUGGESTION_CHIPS.map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={styles.chip}
                    activeOpacity={0.7}
                    onPress={() => {
                      setInputText(chip);
                      setTimeout(() => handleSend(), 0);
                    }}
                  >
                    <Text style={styles.chipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
```

Note: The chip `onPress` sets `inputText` then calls `handleSend` on the next tick. However, because `handleSend` reads `inputText` via the state variable which won't have updated yet, we need a small refactor. Replace the chip `onPress` approach: instead of setting inputText and calling handleSend, directly send the chip text. Update the chip `onPress` to:

```typescript
                    onPress={() => {
                      setInputText(chip);
                      // handleSend reads inputText from state which is stale in the same tick.
                      // Instead, inline the send logic for the chip text.
                    }}
```

Actually, the cleanest approach is to refactor `handleSend` to accept an optional override parameter. Find the `handleSend` function declaration:

```typescript
  const handleSend = async () => {
    const text = inputText.trim();
```

Replace with:

```typescript
  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? inputText).trim();
```

Then the chip `onPress` becomes simply:

```typescript
                    onPress={() => handleSend(chip)}
```

No need for `setInputText` at all — the chip just fires the message directly.

- [ ] **Step 7: Commit**

```
git add src/api/client.ts src/components/VisionSheet.tsx
git commit -m "add suggestion chips and task/med reload triggers to VisionSheet"
```

---

## Task 4: Add VisionSheet + FAB to CaregiverView

**Files:**
- Modify: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Add VisionSheet state to CaregiverView**

In `src/navigation/RootNavigator.tsx`, inside the `CaregiverView` function, find the line:

```typescript
  const [notifOpen, setNotifOpen] = useState(false);
```

Add directly above it:

```typescript
  const [visionOpen, setVisionOpen] = useState(false);
```

- [ ] **Step 2: Add VisionSheet + FAB JSX to CaregiverView return**

In the `CaregiverView` return, find the `<SideDrawer visible={drawerOpen} onClose={onCloseDrawer} />` line (line ~345). Directly after it, add:

```typescript
      <VisionSheet visible={visionOpen} onClose={() => setVisionOpen(false)} />
      <TouchableOpacity
        onPress={() => setVisionOpen(true)}
        style={{
          position: "absolute", bottom: 108, right: 24,
          width: 56, height: 56, borderRadius: 28,
          shadowColor: colors.violet, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45, shadowRadius: 14, elevation: 12, overflow: "hidden",
        }}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[...gradients.primary]} style={{
          width: 56, height: 56, borderRadius: 28,
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="sparkles" size={22} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
```

Note: This uses inline styles matching the patient-side FAB styles defined in `RootNavigator`'s top-level `styles` object. The reason we use inline styles here instead of referencing the top-level `styles` is that the `styles` object is scoped to the `RootNavigator` function, not `CaregiverView`. If you prefer, you can move the FAB styles into `CaregiverView`'s own `useMemo` StyleSheet — but inline is simpler and matches the same values.

- [ ] **Step 3: Commit**

```
git add src/navigation/RootNavigator.tsx
git commit -m "add Vision FAB and sheet to caregiver side"
```

---

## Task 5: Wire TodayScreen to listen for task and med reload events

**Files:**
- Modify: `src/screens/patient/TodayScreen.tsx`

- [ ] **Step 1: Update the import from reminderEvents**

In `src/screens/patient/TodayScreen.tsx`, find:

```typescript
import { registerReminderReload } from "../../utils/reminderEvents";
```

Replace with:

```typescript
import { registerReminderReload, registerTaskReload, registerMedReload } from "../../utils/reminderEvents";
```

- [ ] **Step 2: Register the task and med reload callbacks**

Find the existing registration line:

```typescript
  useEffect(() => { registerReminderReload(reloadReminders); }, [reloadReminders]);
```

Replace with:

```typescript
  useEffect(() => { registerReminderReload(reloadReminders); }, [reloadReminders]);
  useEffect(() => { registerTaskReload(reloadRoutine); }, [reloadRoutine]);
  useEffect(() => { registerMedReload(reloadMeds); }, [reloadMeds]);
```

This means when the AI creates a task via VisionSheet, `triggerTaskReload()` fires, which calls `reloadRoutine()` in TodayScreen, and the new task appears immediately in the routine list. Same for medications.

- [ ] **Step 3: Commit**

```
git add src/screens/patient/TodayScreen.tsx
git commit -m "register task and med reload listeners on TodayScreen"
```

---

## Task 6: Manual test verification

- [ ] **Step 1: Test suggestion chips**
  - Open the app as a patient
  - Tap the sparkles FAB to open VisionSheet
  - Verify three suggestion chips appear below the chat area: "What's left today?", "Add a reminder", "How's the routine going?"
  - Tap a chip — it should send that text as a message
  - After messages appear, chips should disappear

- [ ] **Step 2: Test create_task tool**
  - In VisionSheet, type "Add a morning walk to my routine at 7:00 AM"
  - Vision should respond confirming the task was added
  - Dismiss VisionSheet — the new task should already be visible on TodayScreen without pulling to refresh

- [ ] **Step 3: Test create_medication tool**
  - In VisionSheet, type "I need to start taking Donepezil 10mg at 8:00 PM"
  - Vision should respond confirming the medication was added
  - Dismiss VisionSheet — the new med should already be visible on TodayScreen without pulling to refresh

- [ ] **Step 4: Test create_reminder still works**
  - In VisionSheet, type "Remind me to call my daughter at 3:00 PM"
  - Vision should confirm the reminder
  - The reminder should appear on TodayScreen

- [ ] **Step 5: Test caregiver access**
  - Log in as a caregiver
  - Verify the sparkles FAB appears in the bottom-right corner
  - Tap it — VisionSheet should open
  - Send a message — the assistant should respond with context about the linked patient
  - Verify suggestion chips work the same as on patient side

- [ ] **Step 6: Test that existing tool (create_reminder) is unaffected**
  - Verify that reminders created via the AI still trigger the reminder reload on TodayScreen
  - Verify that manually added reminders (not via AI) still work normally
