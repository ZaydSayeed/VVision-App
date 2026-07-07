import ExpoModulesCore

private let appGroupIdentifier = "group.com.velavision.caregiver.widget"

internal final class AppGroupContainerNotFoundException: Exception {
  override var reason: String {
    "Could not resolve the App Group container for \(appGroupIdentifier). Check that the " +
      "com.apple.security.application-groups entitlement is configured on both the app and " +
      "widget extension targets."
  }
}

public class WidgetBridgeModule: Module {
  // Each module class must implement the definition function. The definition consists of components
  // that describes the module's functionality and behavior.
  // See https://docs.expo.dev/modules/module-api for more details about available components.
  public func definition() -> ModuleDefinition {
    // Sets the name of the module that JavaScript code will use to refer to the module. Takes a string as an argument.
    // The module will be accessible from `requireNativeModule('WidgetBridge')` in JavaScript.
    Name("WidgetBridge")

    // Writes `jsonString` to `<App Group container>/<filename>` so the (Task 3) widget extension
    // can read the same file. Rejects if the App Group container can't be resolved.
    AsyncFunction("writeSnapshot") { (filename: String, jsonString: String) in
      guard let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroupIdentifier
      ) else {
        throw AppGroupContainerNotFoundException()
      }

      let fileURL = containerURL.appendingPathComponent(filename)
      try jsonString.write(to: fileURL, atomically: true, encoding: .utf8)
    }
  }
}
