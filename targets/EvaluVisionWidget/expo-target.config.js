/**
 * @bacons/apple-targets config for the Vela Vision home-screen widget.
 *
 * Using the ConfigFunction form so the widget's App Group entitlement is pulled
 * straight from the main app's `ios.entitlements` in app.json — this keeps the
 * two targets pinned to the SAME identifier (group.com.velavision.caregiver.widget,
 * set in Task 2). If they ever drift, the widget's `containerURL(...)` returns nil
 * and it silently shows the empty state, so we deliberately do not hardcode it here.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: "widget",
  name: "EvaluVisionWidget",
  // iOS 17 minimum: this widget uses AppIntentConfiguration + AppIntentTimelineProvider
  // (the modern configurable-widget API), which is iOS 17+ only.
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "AppIntents"],
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"] ?? [
        "group.com.velavision.caregiver.widget",
      ],
  },
});
