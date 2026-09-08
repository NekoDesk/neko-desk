import AppIntents
import WidgetKit

@available(iOS 17.0, *)
struct ToggleTodoIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Todo"

    @Parameter(title: "Todo ID")
    var todoId: String

    @Parameter(title: "Date Key")
    var dateKey: String

    init() {
        self.todoId = ""
        self.dateKey = ""
    }

    init(todoId: String, dateKey: String) {
        self.todoId = todoId
        self.dateKey = dateKey
    }

    func perform() async throws -> some IntentResult {
        WidgetData.toggleTodo(id: todoId, dateKey: dateKey)
        return .result()
    }
}

@available(iOS 17.0, *)
struct AddWaterIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Water"

    init() {}

    func perform() async throws -> some IntentResult {
        WidgetData.addWater()
        return .result()
    }
}

@available(iOS 17.0, *)
struct AddVitaIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Vitamin"

    init() {}

    func perform() async throws -> some IntentResult {
        WidgetData.addVita()
        return .result()
    }
}

@available(iOS 17.0, *)
struct FeedCatIntent: AppIntent {
    static var title: LocalizedStringResource = "Feed Cat"

    init() {}

    func perform() async throws -> some IntentResult {
        WidgetData.feedCat()
        return .result()
    }
}

@available(iOS 17.0, *)
struct PlayCatIntent: AppIntent {
    static var title: LocalizedStringResource = "Play Cat"

    init() {}

    func perform() async throws -> some IntentResult {
        WidgetData.playCat()
        return .result()
    }
}
