import WidgetKit
import SwiftUI

// Entry point for the widget extension. @bacons/apple-targets links every Swift
// file in this folder into one WidgetKit extension; the @main WidgetBundle is what
// the OS instantiates. Only EvaluVisionWidget is exported for now.
@main
struct EvaluVisionWidgetBundle: WidgetBundle {
    var body: some Widget {
        EvaluVisionWidget()
    }
}
