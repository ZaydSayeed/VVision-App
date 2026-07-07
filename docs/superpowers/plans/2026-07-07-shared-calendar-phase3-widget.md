# Shared Calendar — Phase 3: iPhone Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A home-screen iPhone widget showing today's checklist (reminders + medications, with checkmarks when done) plus today's calendar appointments — one instance per patient the user has access to. Depends on Phase 1 (calendar data model, `calendarApi.ts`) and the existing reminders/medications features already in the app.

**Architecture:** A native WidgetKit extension (Swift/SwiftUI) added to the iOS project via an Expo config plugin, since Expo's managed workflow has no `ios/` directory checked in — the plugin injects the extension target during `expo prebuild`/EAS build. The extension reads a small JSON snapshot from a shared "App Group" container (an Apple mechanism letting the main app and the widget extension share a sandboxed folder on-device) rather than making its own network call. The main React Native app is responsible for writing that snapshot file (via a native module bridge, since JS in the RN app cannot itself write into the App Group container — this requires a small native bridge module, not just JS).

**Tech Stack:** Swift, SwiftUI, WidgetKit (native, new), an Expo config plugin (new, TypeScript), a small native module bridge (new) exposed to the RN app for writing the shared snapshot.

## Global Constraints

- This phase requires real Xcode work — writing and iterating on Swift/SwiftUI code, adding an App Group entitlement, and building through Xcode or EAS. There is no way to fully avoid native tooling here; this plan is honest about that rather than pretending it's pure-JS.
- No automated test harness exists in this repo for Swift/WidgetKit code. This plan uses manual on-device verification for the native pieces, and real unit tests (Vitest) only for the JS-side snapshot-building logic, which is pure data transformation with no native dependency.
- Widget content is fixed per the approved spec: today only (never other days), reminders/medications checklist with completion state, plus today's calendar appointments, in one combined view.
- Caregiver's widget picks one patient per widget instance (add multiple instances for multiple patients); patient's widget always shows their own day with no picker.
- Data flow is one-directional: app writes snapshot → widget reads snapshot. The widget never writes back or calls the network directly.

---

### Task 1: JS-side snapshot builder (pure logic, fully testable)

**Files:**
- Create: `src/services/widgetSnapshot.ts`
- Test: `src/services/widgetSnapshot.test.ts`

**Interfaces:**
- Consumes: `CalendarEventOccurrence` type (Phase 1, `src/services/calendarApi.ts`), and whatever the existing reminders/medications fetch functions already return (locate via `grep -rn "function.*[Rr]eminder\|function.*[Mm]edication" src/services` — read the matched file(s) to get their exact return types before writing this task's code).
- Produces: `buildWidgetSnapshot(patientId: string, patientName: string, todayEvents: CalendarEventOccurrence[], todayReminders: ReminderItem[]): WidgetSnapshot` — a pure function with no I/O, where `WidgetSnapshot` is:

```typescript
export interface WidgetChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface WidgetAppointment {
  id: string;
  title: string;
  time: string; // e.g. "3:00 PM", pre-formatted for direct display
}

export interface WidgetSnapshot {
  patientId: string;
  patientName: string;
  generatedAt: string;
  checklist: WidgetChecklistItem[];
  appointments: WidgetAppointment[];
}
```

`ReminderItem` should match whatever shape Step 1 discovers is already returned by the app's existing reminders/medications fetch — do not invent a new shape, adapt to what's there.

- [ ] **Step 1: Read the existing reminders/medications data shape**

Run: `grep -rn "function.*[Rr]eminder\|function.*[Mm]edication" src/services` and read the matched file(s) in full. Note the exact field names for: item text/label, completion state, and whether "medication" items come from the same collection as general reminders or a separate one (the backend's `reminders.ts` schema — already read during Phase 1 research — has `text`, `completed_date`, `source: "glasses" | "app"`; confirm whether medications are a `recurrence`-tagged reminder or a wholly separate feature before writing `ReminderItem`).

- [ ] **Step 2: Write the failing test**

```typescript
// src/services/widgetSnapshot.test.ts
import { describe, it, expect } from "vitest";
import { buildWidgetSnapshot } from "./widgetSnapshot";
import type { CalendarEventOccurrence } from "./calendarApi";

describe("buildWidgetSnapshot", () => {
  it("builds a checklist from reminders and an appointments list from calendar events", () => {
    const events: CalendarEventOccurrence[] = [
      {
        id: "evt-1", title: "Dr. Smith", category: "medical",
        occurrenceAt: "2026-07-10T15:00:00.000Z", endAt: "2026-07-10T15:30:00.000Z",
        notes: null, recurrenceRule: null, createdBy: "caregiver-1", completed: false,
      },
    ];
    const reminders = [
      { id: "rem-1", text: "Use restroom", completed_date: null },
      { id: "rem-2", text: "Take Adderall", completed_date: "2026-07-10" },
    ];

    const snapshot = buildWidgetSnapshot("patient-123", "Mom", events, reminders as any);

    expect(snapshot.patientId).toBe("patient-123");
    expect(snapshot.patientName).toBe("Mom");
    expect(snapshot.checklist).toEqual([
      { id: "rem-1", label: "Use restroom", completed: false },
      { id: "rem-2", label: "Take Adderall", completed: true },
    ]);
    expect(snapshot.appointments).toHaveLength(1);
    expect(snapshot.appointments[0]).toMatchObject({ id: "evt-1", title: "Dr. Smith" });
    expect(snapshot.appointments[0].time).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
  });

  it("produces an empty checklist and appointments array when there is nothing today", () => {
    const snapshot = buildWidgetSnapshot("patient-123", "Mom", [], []);
    expect(snapshot.checklist).toEqual([]);
    expect(snapshot.appointments).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/services/widgetSnapshot.test.ts`
Expected: FAIL — module doesn't exist

- [ ] **Step 4: Implement**

Adjust the `ReminderItem` field names in this implementation to match exactly what Step 1's investigation found — the following assumes the `reminders.ts` shape (`text`, `completed_date`) confirmed during Phase 1 research; update if medications turned out to live in a differently-shaped collection:

```typescript
// src/services/widgetSnapshot.ts
import type { CalendarEventOccurrence } from "./calendarApi";

export interface ReminderItem {
  id: string;
  text: string;
  completed_date: string | null;
}

export interface WidgetChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface WidgetAppointment {
  id: string;
  title: string;
  time: string;
}

export interface WidgetSnapshot {
  patientId: string;
  patientName: string;
  generatedAt: string;
  checklist: WidgetChecklistItem[];
  appointments: WidgetAppointment[];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function buildWidgetSnapshot(
  patientId: string,
  patientName: string,
  todayEvents: CalendarEventOccurrence[],
  todayReminders: ReminderItem[]
): WidgetSnapshot {
  return {
    patientId,
    patientName,
    generatedAt: new Date().toISOString(),
    checklist: todayReminders.map((r) => ({
      id: r.id,
      label: r.text,
      completed: r.completed_date !== null,
    })),
    appointments: todayEvents.map((e) => ({
      id: e.id,
      title: e.title,
      time: formatTime(e.occurrenceAt),
    })),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/services/widgetSnapshot.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/services/widgetSnapshot.ts src/services/widgetSnapshot.test.ts
git commit -m "feat: add pure widget snapshot builder for reminders + today's appointments"
```

---

### Task 2: Native bridge module to write the App Group shared file

**Files:**
- Create: `modules/widget-bridge/expo-module.config.json`
- Create: `modules/widget-bridge/index.ts`
- Create: `modules/widget-bridge/ios/WidgetBridgeModule.swift`

This is a local Expo Module (Expo's supported way to add a small native module without ejecting from managed workflow) — not a config plugin. Follow Expo's "Create a local module" structure exactly; if unfamiliar, fetch current docs (via context7 or WebFetch) for `expo-modules-core` local module scaffolding before writing the Swift file, since API specifics (the base class name, the required manifest fields) can shift between Expo SDK versions and this repo is on SDK 54.

**Interfaces:**
- Produces (JS side, `modules/widget-bridge/index.ts`): `writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void>` — calls into the native module, JSON-stringifies the snapshot, and writes it to a file named `widget-snapshot-<patientId>.json` inside the shared App Group container.
- Produces (native side): a Swift method the JS binding calls, taking a filename and JSON string, writing it into `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)`.

- [ ] **Step 1: Scaffold the local Expo module**

Run: `cd ~/Documents/VVision-App && npx create-expo-module@latest --local modules/widget-bridge`
Follow the interactive prompts (module name: `WidgetBridge`). This generates the standard local-module folder structure — inspect what it creates before hand-writing anything, since the exact generated file layout should drive the next two steps rather than being guessed.

- [ ] **Step 2: Add the App Group entitlement**

In `app.json`, add the entitlement via the `"ios"` config (check current `expo-build-properties` or native entitlements plugin docs for SDK 54's supported way to set `com.apple.security.application-groups` — this changed across Expo SDK versions, confirm the current mechanism rather than assuming). The App Group identifier should follow Apple's required format, e.g. `group.com.evaluvision.app.widget` — must match exactly between the main app target and the widget extension target (Task 3 uses the same identifier).

- [ ] **Step 3: Implement the Swift write method**

In the generated `WidgetBridgeModule.swift`, add a method (exposed via Expo Modules' `AsyncFunction` API — confirm exact macro/API name against the scaffolded template from Step 1) that:
1. Takes `(filename: String, jsonString: String)`.
2. Resolves the App Group container URL via `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.evaluvision.app.widget")`.
3. Writes `jsonString` to `<container>/<filename>` using `String.write(to:atomically:encoding:)`.
4. Throws/rejects if the container URL is nil (App Group misconfigured) so JS-side callers can log it rather than silently losing data.

- [ ] **Step 4: Implement the JS-side wrapper**

```typescript
// modules/widget-bridge/index.ts
import { requireNativeModule } from "expo-modules-core";
import type { WidgetSnapshot } from "../../src/services/widgetSnapshot";

const NativeWidgetBridge = requireNativeModule("WidgetBridge");

export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  const filename = `widget-snapshot-${snapshot.patientId}.json`;
  await NativeWidgetBridge.writeSnapshot(filename, JSON.stringify(snapshot));
}
```

(Adjust the exact native call signature — `writeSnapshot(filename, jsonString)` — to match whatever method name and casing the Expo Modules scaffolding/AsyncFunction declaration from Step 3 actually produced; keep them in sync.)

- [ ] **Step 5: Manual verification (no automated test — native bridge requires a real build)**

Build a dev client (see manual checklist), call `writeWidgetSnapshot` from a temporary debug button in the app, and confirm via Xcode's device file browser (or a quick native log statement) that the JSON file actually lands in the App Group container.

- [ ] **Step 6: Commit**

```bash
git add modules/widget-bridge app.json
git commit -m "feat: add native widget-bridge module to write shared App Group snapshot"
```

---

### Task 3: WidgetKit extension (Swift/SwiftUI)

**Files:**
- Create: `widget-extension-plugin/withWidgetExtension.ts` (an Expo config plugin that adds the native widget extension target during prebuild)
- Create: `widget-extension-plugin/ios/Vela VisionWidget/Vela VisionWidget.swift`
- Create: `widget-extension-plugin/ios/Vela VisionWidget/Info.plist`

Adding a full native widget extension target via a config plugin is one of the more involved things Expo's config-plugin system supports — fetch current Expo docs on "config plugins" and "adding a native target" (or a widely-used community example like `@bacons/apple-targets`, which exists specifically to simplify this) before hand-rolling the Xcode project mutation logic. Using an established community plugin for the mechanical "add a target to the Xcode project" part is reasonable here (YAGNI — don't reinvent Xcode project-file surgery), while the actual widget UI code (`Vela VisionWidget.swift`) is bespoke to this app's design.

**Interfaces:**
- Consumes: the JSON file written by Task 2, read via the same App Group container URL (`group.com.evaluvision.app.widget`) from the widget extension's own process.
- Produces: a `Widget` conforming to WidgetKit's `Widget` protocol, with a `TimelineProvider` that reads the snapshot file and refreshes every ~15–30 minutes, plus whenever the OS triggers a reload (the main app should call WidgetKit's reload-timelines API after writing a new snapshot — this belongs in Task 4).

- [ ] **Step 1: Research the config-plugin approach**

Fetch current documentation (via context7 for Expo config plugins, or WebFetch for `@bacons/apple-targets` if that's still the maintained community solution) for adding a WidgetKit extension target to an Expo-managed app on SDK 54. Confirm: the plugin package name/version to use, how it expects the widget's Swift source to be organized, and how it wires the App Group entitlement onto the new target (must match Task 2's identifier exactly).

- [ ] **Step 2: Scaffold the widget target per the chosen plugin's conventions**

Follow whatever folder/manifest structure the plugin from Step 1 requires. This step's exact files depend on that research — do not guess a structure before Step 1 completes.

- [ ] **Step 3: Implement the timeline provider and view**

```swift
// Vela VisionWidget.swift — illustrative; adjust types/imports to match the
// scaffolding from Step 1/2 and the App Group identifier from Task 2.
import WidgetKit
import SwiftUI

struct ChecklistItem: Codable, Identifiable {
    let id: String
    let label: String
    let completed: Bool
}

struct Appointment: Codable, Identifiable {
    let id: String
    let title: String
    let time: String
}

struct WidgetSnapshot: Codable {
    let patientId: String
    let patientName: String
    let generatedAt: String
    let checklist: [ChecklistItem]
    let appointments: [Appointment]
}

func loadSnapshot(patientId: String) -> WidgetSnapshot? {
    guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.com.evaluvision.app.widget"
    ) else { return nil }
    let fileURL = containerURL.appendingPathComponent("widget-snapshot-\(patientId).json")
    guard let data = try? Data(contentsOf: fileURL) else { return nil }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
}

struct Vela VisionEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct Vela VisionProvider: TimelineProvider {
    // Patient selection (which patientId this widget instance shows) comes
    // from WidgetKit's configuration/intent system for a per-instance
    // picker — confirm the exact mechanism (static configuration vs
    // IntentConfiguration) against Step 1's research before finalizing;
    // a static single-patient placeholder is acceptable for the very first
    // on-device smoke test, but the caregiver-picks-a-patient requirement
    // from the spec needs the configurable-intent variant to actually ship.

    func placeholder(in context: Context) -> Vela VisionEntry {
        Vela VisionEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (Vela VisionEntry) -> Void) {
        completion(Vela VisionEntry(date: Date(), snapshot: nil))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Vela VisionEntry>) -> Void) {
        // TODO(Task 3 Step 4): resolve the actual patientId for this widget
        // instance from its configuration, not a hardcoded placeholder.
        let snapshot = loadSnapshot(patientId: "REPLACE_WITH_CONFIGURED_PATIENT_ID")
        let entry = Vela VisionEntry(date: Date(), snapshot: snapshot)
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 20, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

struct Vela VisionWidgetView: View {
    var entry: Vela VisionEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let snapshot = entry.snapshot {
                Text(snapshot.patientName).font(.headline)
                ForEach(snapshot.appointments) { appt in
                    Text("\(appt.time) — \(appt.title)").font(.caption)
                }
                ForEach(snapshot.checklist) { item in
                    HStack {
                        Image(systemName: item.completed ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(item.completed ? .green : .gray)
                        Text(item.label)
                            .strikethrough(item.completed)
                    }.font(.caption)
                }
            } else {
                Text("Open Vela Vision to set up this widget")
            }
        }
        .padding()
    }
}

struct Vela VisionWidget: Widget {
    let kind: String = "Vela VisionWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Vela VisionProvider()) { entry in
            Vela VisionWidgetView(entry: entry)
        }
        .configurationDisplayName("Vela Vision Today")
        .description("Today's checklist and appointments.")
        .supportedFamilies([.systemMedium])
    }
}
```

The `TODO` in `getTimeline` is a genuine open item, not a plan placeholder — it's explicitly called out as needing Step 1's intent-configuration research to resolve properly, and Step 4 below covers replacing it before this task is considered done.

- [ ] **Step 4: Replace the static placeholder with real per-instance patient configuration**

Using whichever mechanism Step 1's research confirmed (likely `IntentConfiguration` with an `AppIntent`/`INIntent` letting the user pick a patient when adding the widget), replace the hardcoded `"REPLACE_WITH_CONFIGURED_PATIENT_ID"` in `getTimeline` with the actual per-instance configured patient ID. For the patient's own device, skip the picker entirely and hardcode to "the logged-in patient's own id" (resolved from whatever the app already persists locally for the logged-in patient — check the same source `CalendarScreen.tsx` used in Phase 1 Task 9 for identifying "the active patient").

- [ ] **Step 5: Manual verification (no automated test — WidgetKit requires a real build)**

Build via EAS/Xcode, add the widget to a home screen, confirm it renders the checklist + appointments from the snapshot file written in Task 2, confirm it refreshes after ~20 minutes or after the app writes a new snapshot (see Task 4 for the explicit reload trigger), confirm tapping deep-links into the app (Task 4).

- [ ] **Step 6: Commit**

```bash
git add widget-extension-plugin
git commit -m "feat: add WidgetKit extension reading shared snapshot, per-patient configurable"
```

---

### Task 4: Trigger snapshot writes + widget reload from the app, add deep link

**Files:**
- Modify: `src/services/calendarApi.ts` (Phase 1/2 file)
- Modify: whatever reminders/medications completion-marking function was found in Task 1 Step 1
- Modify: `src/navigation/RootNavigator.tsx` (deep link handling)

**Interfaces:**
- Consumes: `buildWidgetSnapshot` (Task 1), `writeWidgetSnapshot` (Task 2), and WidgetKit's reload API exposed through the local Expo module (add a second native method, `reloadWidgetTimelines()`, calling `WidgetCenter.shared.reloadAllTimelines()` — add this alongside Task 2's `writeSnapshot` method in the same Swift file rather than a separate module, since it's the same bridge).

- [ ] **Step 1: Add `reloadWidgetTimelines` to the widget-bridge native module**

In `modules/widget-bridge/ios/WidgetBridgeModule.swift`, add a second exposed method calling `WidgetCenter.shared.reloadAllTimelines()` (import `WidgetKit` in this file). Export it from `modules/widget-bridge/index.ts` as `reloadWidgetTimelines(): Promise<void>`.

- [ ] **Step 2: Call snapshot-write + reload after any relevant data change**

After `createCalendarEvent`/`updateCalendarEvent`/`deleteCalendarEvent` (Phase 1) succeed, and after any reminder/medication completion toggle (wherever Task 1 Step 1 located that function), rebuild today's snapshot for the affected patient (`buildWidgetSnapshot`, fetching today's events + reminders fresh) and call `writeWidgetSnapshot` then `reloadWidgetTimelines`. Wrap in a try/catch that only logs — this must never block or fail the user's actual save action, matching Phase 2's own non-fatal sync pattern.

- [ ] **Step 3: Add the widget's deep link target**

In `RootNavigator.tsx`, confirm the app's existing deep-link scheme (referenced in project memory as `vela://`) and add a route the widget can open into — e.g. `vela://calendar/<patientId>` — that lands on the `CalendarScreen` from Phase 1 Task 9 for that patient. In the widget's SwiftUI view (Task 3), wrap the view in `.widgetURL(URL(string: "vela://calendar/\(snapshot.patientId)"))`.

- [ ] **Step 4: Manual verification**

Complete a reminder in the app, confirm the widget updates within a few seconds (via the explicit reload call, not waiting for the ~20-minute timeline refresh). Tap the widget, confirm it opens the app directly to that patient's calendar screen.

- [ ] **Step 5: Commit**

```bash
git add modules/widget-bridge src/services/calendarApi.ts src/navigation/RootNavigator.tsx
git commit -m "feat: trigger widget snapshot refresh and reload on data changes, add widget deep link"
```

---

## Self-Review Notes

- **Spec coverage:** today-only content (Task 1's snapshot builder only ever receives "today" data — enforced by the caller fetching today's range, not by the builder itself, which is a deliberate boundary: fetching-range logic stays in the caller, formatting stays in the builder), checklist + appointments combined (Task 1/3), per-patient picker for caregivers vs. fixed-self for patients (Task 3 Step 4), completion checkmarks (Task 1's `completed` field, Task 3's SwiftUI checkmark rendering), shared local file over network call (Task 2/3), deep link (Task 4).
- **Type consistency:** `WidgetSnapshot`/`WidgetChecklistItem`/`WidgetAppointment` are defined once in `src/services/widgetSnapshot.ts` (Task 1) and mirrored — necessarily, since Swift and TypeScript can't share a type definition — in the Swift file (Task 3); field names are kept identical (`patientId`, `patientName`, `checklist`, `appointments`, `id`, `label`, `completed`, `title`, `time`) so a future reader can visually diff them.
- **Honest placeholders flagged, not silent ones:** the `TODO` in Task 3 Step 3 and the "REPLACE_WITH_CONFIGURED_PATIENT_ID" literal are called out explicitly as intermediate states resolved by Task 3 Step 4 within the same task — not left dangling across the plan's end. This differs from a forbidden placeholder in that the plan itself states exactly which later step removes it.

## Manual checklist (things Haadi must do, not automatable)

- [ ] Approve kicking off an EAS build once Tasks 1–4 are code-complete (consumes EAS build quota — confirm before it runs). This build must include both the widget-bridge local module and the widget extension target, so it likely needs to happen after Task 3, not incrementally per task.
- [ ] Have an active Apple Developer Program membership with the App Groups capability enabled for the app's bundle ID (this is a paid-tier requirement, not available on a free Apple ID — confirm current enrollment before starting Task 2).
- [ ] Walk through every manual verification step in Tasks 2, 3, and 4 on a physical device (widgets don't reliably preview correctly in the simulator for App Group file access in all Xcode versions — confirm on a real iPhone).
- [ ] Decide the exact App Group identifier (`group.com.evaluvision.app.widget` is this plan's placeholder — confirm the real bundle identifier prefix matches what's registered in the Apple Developer portal for this app).
