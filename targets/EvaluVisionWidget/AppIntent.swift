import WidgetKit
import AppIntents

// The App Group container shared with the main app (written to in Task 2's
// WidgetBridge). MUST match the identifier used there and in app.json.
let appGroupIdentifier = "group.com.velavision.caregiver.widget"

// One selectable patient in the widget's configuration picker. The main app
// (Task 4) writes the list of patients this device can show into
// `widget-patients.json` inside the App Group. On a single-patient device
// (the common case — each user has one `patient_id`), that list has one entry,
// or is absent, in which case the widget falls back to the active-patient
// pointer (see resolvePatientId below).
struct PatientEntity: AppEntity, Identifiable {
    let id: String
    let name: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Patient"
    static var defaultQuery = PatientQuery()

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

// Codable mirror of an entry in `widget-patients.json`.
private struct PatientOption: Codable {
    let id: String
    let name: String
}

// Reads the caregiver's available patients from the App Group so the picker
// (shown when the user long-presses the widget and taps "Edit") can list them.
struct PatientQuery: EntityQuery {
    private func loadPatients() -> [PatientEntity] {
        guard
            let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroupIdentifier),
            let data = try? Data(
                contentsOf: containerURL.appendingPathComponent("widget-patients.json")),
            let options = try? JSONDecoder().decode([PatientOption].self, from: data)
        else {
            return []
        }
        return options.map { PatientEntity(id: $0.id, name: $0.name) }
    }

    func entities(for identifiers: [String]) async throws -> [PatientEntity] {
        loadPatients().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [PatientEntity] {
        loadPatients()
    }

    func defaultResult() async -> PatientEntity? {
        loadPatients().first
    }
}

// The widget's configuration. `patient` is optional: when the user hasn't picked
// one (fresh install, or a patient's own device where there is no picker choice
// to make), the provider falls back to the active-patient pointer file.
struct SelectPatientIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource { "Select Patient" }
    static var description: IntentDescription {
        IntentDescription("Choose which patient's day this widget shows.")
    }

    @Parameter(title: "Patient")
    var patient: PatientEntity?
}
