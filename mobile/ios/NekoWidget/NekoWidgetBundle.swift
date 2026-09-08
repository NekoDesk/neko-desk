import WidgetKit
import SwiftUI

@main
struct NekoWidgetBundle: WidgetBundle {
    var body: some Widget {
        NekoMainWidget()
        NekoFullWidget()
        NekoDdayWidget()
        NekoTodoWidget()
        NekoTimetableWidget()
        NekoCatWidget()
    }
}
