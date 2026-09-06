import Foundation
import WidgetKit

let appGroupID = "group.com.siwon.nekodesk.mobile"
let widgetDataKey = "neko_widget_data"
let pendingTogglesKey = "neko_pending_toggles"
let pendingWaterAddKey = "neko_pending_water_add"
let pendingVitaAddKey = "neko_pending_vita_add"

struct WidgetData: Codable {
    var theme: String?
    var emptyText: String?
    var headTitle: String?
    var doneWord: String?
    var noneWord: String?
    var todoTotal: Int?
    var todoDone: Int?
    var todosDate: String?
    var ddays: [DDayItem]?
    var todos: [TodoItem]?
    var yesterday: SideData?
    var tomorrow: SideData?
    var health: HealthData?
    var table: TableData?

    static func load() -> WidgetData {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let data = defaults.data(forKey: widgetDataKey) else {
            return WidgetData()
        }
        return (try? JSONDecoder().decode(WidgetData.self, from: data)) ?? WidgetData()
    }

    var isStale: Bool {
        guard let d = todosDate, !d.isEmpty else { return true }
        return d != Self.todayKey()
    }

    static func todayKey() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    static func toggleTodo(id: String, dateKey: String) {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let raw = defaults.data(forKey: widgetDataKey),
              var data = try? JSONDecoder().decode(WidgetData.self, from: raw) else { return }

        if var todos = data.todos {
            for i in 0..<todos.count {
                if todos[i].id == id {
                    let wasDone = todos[i].isDone
                    todos[i].done = !wasDone
                    data.todos = todos
                    let done = data.todoDone ?? 0
                    data.todoDone = wasDone ? max(0, done - 1) : done + 1
                    break
                }
            }
        }

        if let encoded = try? JSONEncoder().encode(data) {
            defaults.set(encoded, forKey: widgetDataKey)
        }

        let newDone = !(data.todos?.first(where: { $0.id == id })?.isDone ?? false)

        var toggles: [[String: Any]] = []
        if let existing = defaults.data(forKey: pendingTogglesKey),
           let parsed = try? JSONSerialization.jsonObject(with: existing) as? [[String: Any]] {
            toggles = parsed
        }
        toggles.append(["id": id, "dateKey": dateKey, "done": newDone])
        if let data = try? JSONSerialization.data(withJSONObject: toggles) {
            defaults.set(data, forKey: pendingTogglesKey)
        }

        WidgetCenter.shared.reloadAllTimelines()
    }

    static func addWater() {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let raw = defaults.data(forKey: widgetDataKey),
              var data = try? JSONDecoder().decode(WidgetData.self, from: raw),
              var h = data.health else { return }

        let done = h.waterDone ?? 0
        let goal = h.waterGoal ?? 8
        if done >= goal { return }
        h.waterDone = done + 1
        data.health = h

        if let encoded = try? JSONEncoder().encode(data) {
            defaults.set(encoded, forKey: widgetDataKey)
        }
        defaults.set(defaults.integer(forKey: pendingWaterAddKey) + 1, forKey: pendingWaterAddKey)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func addVita() {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let raw = defaults.data(forKey: widgetDataKey),
              var data = try? JSONDecoder().decode(WidgetData.self, from: raw),
              var h = data.health else { return }

        let done = h.vitaDone ?? 0
        let goal = h.vitaGoal ?? 1
        if done >= goal { return }
        h.vitaDone = done + 1
        data.health = h

        if let encoded = try? JSONEncoder().encode(data) {
            defaults.set(encoded, forKey: widgetDataKey)
        }
        defaults.set(defaults.integer(forKey: pendingVitaAddKey) + 1, forKey: pendingVitaAddKey)
        WidgetCenter.shared.reloadAllTimelines()
    }
}

struct DDayItem: Codable {
    var title: String
    var date: String

    var daysLeft: Int? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        guard let target = f.date(from: date) else { return nil }
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let t = cal.startOfDay(for: target)
        return cal.dateComponents([.day], from: today, to: t).day
    }

    var ddayText: String {
        guard let d = daysLeft else { return "" }
        if d == 0 { return "D-DAY" }
        return d > 0 ? "D-\(d)" : "D+\(-d)"
    }
}

struct TodoItem: Codable {
    var id: String?
    var text: String
    var done: Bool?
    var ampm: String?
    var ampmLabel: String?

    var isDone: Bool { done ?? false }
    var isPM: Bool { ampm == "pm" }
}

struct SideData: Codable {
    var label: String?
    var total: Int?
    var todos: [TodoItem]?
}

struct HealthData: Codable {
    var waterLabel: String?
    var waterGoal: Int?
    var waterDone: Int?
    var vitaLabel: String?
    var vitaGoal: Int?
    var vitaDone: Int?
}

struct TableData: Codable {
    var label: String?
    var dows: [String]?
    var from: Int?
    var to: Int?
    var empty: String?
    var blocks: [BlockItem]?
}

struct BlockItem: Codable {
    var day: Int
    var start: Int
    var end: Int
    var label: String?
    var rest: Bool?
    var color: Int?

    var isRest: Bool { rest ?? false }
}
