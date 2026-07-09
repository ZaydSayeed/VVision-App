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
    // "YYYY-MM-DD" (local-date) strings for the current month's days that have
    // at least one calendar event — feeds the large widget's mini-calendar dot
    // indicators. Optional so a stale cached snapshot written before this
    // field existed still decodes successfully (falls back to "no dots").
    let monthEventDays: [String]?
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
    // True only when the user explicitly picked a patient via the widget's
    // configuration (the caregiver-with-multiple-patients case). False when
    // the widget fell back to the active-patient pointer (the patient's own
    // device, where there's only ever one patient — themselves — so showing
    // their own name in the title is redundant).
    let hasExplicitlyConfiguredPatient: Bool
}

// AppIntentTimelineProvider ties the timeline to SelectPatientIntent, so each
// widget instance carries its own patient selection — this is what replaces the
// brief's hardcoded "REPLACE_WITH_CONFIGURED_PATIENT_ID" placeholder.
struct EvaluVisionProvider: AppIntentTimelineProvider {
    typealias Entry = EvaluVisionEntry
    typealias Intent = SelectPatientIntent

    func placeholder(in context: Context) -> EvaluVisionEntry {
        EvaluVisionEntry(date: Date(), snapshot: nil, hasExplicitlyConfiguredPatient: false)
    }

    func snapshot(for configuration: SelectPatientIntent, in context: Context) async
        -> EvaluVisionEntry
    {
        let configuredId = configuration.patient?.id
        let patientId = resolvePatientId(configuredPatientId: configuredId)
        let snapshot = patientId.flatMap(loadSnapshot)
        return EvaluVisionEntry(
            date: Date(), snapshot: snapshot,
            hasExplicitlyConfiguredPatient: !(configuredId ?? "").isEmpty)
    }

    func timeline(for configuration: SelectPatientIntent, in context: Context) async
        -> Timeline<EvaluVisionEntry>
    {
        let configuredId = configuration.patient?.id
        let patientId = resolvePatientId(configuredPatientId: configuredId)
        let snapshot = patientId.flatMap(loadSnapshot)
        let entry = EvaluVisionEntry(
            date: Date(), snapshot: snapshot,
            hasExplicitlyConfiguredPatient: !(configuredId ?? "").isEmpty)

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
                content(for: snapshot, showPatientName: entry.hasExplicitlyConfiguredPatient)
            } else {
                emptyState
            }
        }
        .containerBackground(velaBackground, for: .widget)
        // Deep link back into the app's calendar screen for this widget's patient
        // (src/hooks/useWidgetDeepLink.ts parses this same "vela://calendar/<id>"
        // format). No snapshot yet (fresh install) -> no URL, tapping just opens
        // the app.
        .widgetURL(entry.snapshot.flatMap { URL(string: "vela://calendar/\($0.patientId)") })
    }

    private func content(for snapshot: WidgetSnapshot, showPatientName: Bool) -> some View {
        // On a caregiver's widget (patient explicitly configured), the patient's
        // name distinguishes which of their patients this is. On a patient's own
        // device (no explicit configuration — there's only ever themselves),
        // showing their own name back to them is redundant, so show a plain
        // "Today's Tasks" heading instead.
        let title = (showPatientName && !snapshot.patientName.isEmpty)
            ? snapshot.patientName
            : "Today's Tasks"
        return VStack(alignment: .leading, spacing: 6) {
            Text(title)
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

            // The large size has real vertical room left after the checklist —
            // fill it with a mini month calendar instead of empty space.
            if family == .systemLarge {
                Spacer(minLength: 8)
                MiniMonthCalendarView(eventDays: Set(snapshot.monthEventDays ?? []))
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

// MARK: - Mini month calendar (large widget only)

// Compact current-month grid: today highlighted, a small dot under any day
// that has a calendar event (per `eventDays`, "YYYY-MM-DD" local-date keys
// matching WidgetSnapshot.monthEventDays).
private struct MiniMonthCalendarView: View {
    let eventDays: Set<String>

    private static let weekdaySymbols = ["S", "M", "T", "W", "T", "F", "S"]
    private static let dateKeyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.calendar = Calendar.current
        f.timeZone = TimeZone.current
        return f
    }()

    private var calendar: Calendar { Calendar.current }
    private var today: Date { Date() }

    // Leading blanks + real day-of-month numbers, laid out Sun-first to match
    // `weekdaySymbols` — nil entries render as empty cells before day 1.
    private var days: [Int?] {
        guard
            let monthInterval = calendar.dateInterval(of: .month, for: today),
            let range = calendar.range(of: .day, in: .month, for: today)
        else { return [] }

        let firstWeekday = calendar.component(.weekday, from: monthInterval.start)  // 1 = Sunday
        let leadingBlanks = Array<Int?>(repeating: nil, count: firstWeekday - 1)
        let dayNumbers = range.map { Optional($0) }
        return leadingBlanks + dayNumbers
    }

    private func dateKey(forDay day: Int) -> String? {
        var components = calendar.dateComponents([.year, .month], from: today)
        components.day = day
        guard let date = calendar.date(from: components) else { return nil }
        return Self.dateKeyFormatter.string(from: date)
    }

    private var todayDayNumber: Int {
        calendar.component(.day, from: today)
    }

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 7)

    var body: some View {
        VStack(spacing: 3) {
            HStack(spacing: 2) {
                ForEach(Array(Self.weekdaySymbols.enumerated()), id: \.offset) { _, symbol in
                    Text(symbol)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.white.opacity(0.5))
                        .frame(maxWidth: .infinity)
                }
            }

            LazyVGrid(columns: columns, spacing: 4) {
                ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                    if let day {
                        let isToday = day == todayDayNumber
                        let hasEvent = dateKey(forDay: day).map { eventDays.contains($0) } ?? false
                        VStack(spacing: 1) {
                            Text("\(day)")
                                .font(.system(size: 10))
                                .foregroundStyle(isToday ? .black : .white.opacity(0.85))
                                .frame(width: 16, height: 16)
                                .background(
                                    Circle().fill(isToday ? Color.white : Color.clear)
                                )
                            Circle()
                                .fill(hasEvent ? Color.blue : Color.clear)
                                .frame(width: 3, height: 3)
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        Color.clear.frame(width: 16, height: 16)
                    }
                }
            }
        }
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
