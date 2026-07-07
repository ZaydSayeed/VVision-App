import WidgetKit
import SwiftUI

// MARK: - Snapshot model
// Mirrors src/services/widgetSnapshot.ts (Task 1). Field names must match the
// JSON exactly — the app writes camelCase keys, so no CodingKeys remapping.

struct WidgetChecklistItem: Codable, Identifiable {
    let id: String
    let label: String
    let completed: Bool
}

struct WidgetAppointment: Codable, Identifiable {
    let id: String
    let title: String
    let time: String  // pre-formatted by the JS side, e.g. "3:00 PM"
}

struct WidgetSnapshot: Codable {
    let patientId: String
    let patientName: String
    let generatedAt: String
    let checklist: [WidgetChecklistItem]
    let appointments: [WidgetAppointment]
}

// Codable mirror of `widget-active-patient.json` (written by the app in Task 4).
// This is the fallback pointer used when the widget has no configured patient —
// i.e. the "logged-in patient's own id" the brief refers to. The app knows the
// active patient (CalendarScreen resolves `user.patient_id`); it writes that id
// here so the separate widget process can read it.
private struct ActivePatientPointer: Codable {
    let patientId: String
    let patientName: String?
}

// MARK: - App Group reads

// Resolves which patient this widget instance should display:
//   1. the patient the user picked in the widget's configuration, if any;
//   2. otherwise the active-patient pointer the app wrote to the App Group.
// Returns nil only when neither exists (fresh install, before the app has run).
func resolvePatientId(configuredPatientId: String?) -> String? {
    if let configuredPatientId, !configuredPatientId.isEmpty {
        return configuredPatientId
    }
    guard
        let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier),
        let data = try? Data(
            contentsOf: containerURL.appendingPathComponent("widget-active-patient.json")),
        let pointer = try? JSONDecoder().decode(ActivePatientPointer.self, from: data)
    else {
        return nil
    }
    return pointer.patientId
}

func loadSnapshot(patientId: String) -> WidgetSnapshot? {
    guard
        let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier)
    else { return nil }
    let fileURL = containerURL.appendingPathComponent("widget-snapshot-\(patientId).json")
    guard let data = try? Data(contentsOf: fileURL) else { return nil }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
}

// MARK: - Timeline

struct EvaluVisionEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

// AppIntentTimelineProvider ties the timeline to SelectPatientIntent, so each
// widget instance carries its own patient selection — this is what replaces the
// brief's hardcoded "REPLACE_WITH_CONFIGURED_PATIENT_ID" placeholder.
struct EvaluVisionProvider: AppIntentTimelineProvider {
    typealias Entry = EvaluVisionEntry
    typealias Intent = SelectPatientIntent

    func placeholder(in context: Context) -> EvaluVisionEntry {
        EvaluVisionEntry(date: Date(), snapshot: nil)
    }

    func snapshot(for configuration: SelectPatientIntent, in context: Context) async
        -> EvaluVisionEntry
    {
        let patientId = resolvePatientId(configuredPatientId: configuration.patient?.id)
        let snapshot = patientId.flatMap(loadSnapshot)
        return EvaluVisionEntry(date: Date(), snapshot: snapshot)
    }

    func timeline(for configuration: SelectPatientIntent, in context: Context) async
        -> Timeline<EvaluVisionEntry>
    {
        let patientId = resolvePatientId(configuredPatientId: configuration.patient?.id)
        let snapshot = patientId.flatMap(loadSnapshot)
        let entry = EvaluVisionEntry(date: Date(), snapshot: snapshot)

        // Refresh ~every 20 min as a floor; the app also calls
        // WidgetCenter.reloadTimelines after writing a fresh snapshot (Task 4),
        // which supersedes this schedule.
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 20, to: Date())!
        return Timeline(entries: [entry], policy: .after(nextRefresh))
    }
}

// MARK: - View

private let velaBackground = Color(red: 0.04, green: 0.055, blue: 0.10)  // #0a0e1a

struct EvaluVisionWidgetView: View {
    @Environment(\.widgetFamily) private var family
    var entry: EvaluVisionEntry

    // Cap rows so medium widgets don't overflow; large gets more room.
    private var maxAppointments: Int { family == .systemLarge ? 5 : 2 }
    private var maxChecklist: Int { family == .systemLarge ? 6 : 3 }

    var body: some View {
        Group {
            if let snapshot = entry.snapshot {
                content(for: snapshot)
            } else {
                emptyState
            }
        }
        .containerBackground(velaBackground, for: .widget)
    }

    private func content(for snapshot: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(snapshot.patientName.isEmpty ? "Today" : snapshot.patientName)
                .font(.headline)
                .foregroundStyle(.white)
                .lineLimit(1)

            if !snapshot.appointments.isEmpty {
                ForEach(snapshot.appointments.prefix(maxAppointments)) { appt in
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                            .font(.caption2)
                            .foregroundStyle(.blue)
                        Text("\(appt.time)  \(appt.title)")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.9))
                            .lineLimit(1)
                    }
                }
            }

            if !snapshot.checklist.isEmpty {
                ForEach(snapshot.checklist.prefix(maxChecklist)) { item in
                    HStack(spacing: 4) {
                        Image(
                            systemName: item.completed ? "checkmark.circle.fill" : "circle"
                        )
                        .font(.caption2)
                        .foregroundStyle(item.completed ? .green : .gray)
                        Text(item.label)
                            .font(.caption)
                            .strikethrough(item.completed)
                            .foregroundStyle(
                                item.completed ? .white.opacity(0.5) : .white.opacity(0.9)
                            )
                            .lineLimit(1)
                    }
                }
            }

            if snapshot.appointments.isEmpty && snapshot.checklist.isEmpty {
                Text("Nothing scheduled today")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.6))
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Vela Vision")
                .font(.headline)
                .foregroundStyle(.white)
            Text("Open the app to set up this widget")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Widget

struct EvaluVisionWidget: Widget {
    let kind: String = "EvaluVisionWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SelectPatientIntent.self,
            provider: EvaluVisionProvider()
        ) { entry in
            EvaluVisionWidgetView(entry: entry)
        }
        .configurationDisplayName("Vela Today")
        .description("Today's checklist and appointments.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
