import Foundation
import WidgetKit

let appGroupID = "group.com.siwon.nekodesk.mobile"
let widgetDataKey = "neko_widget_data"
let pendingTogglesKey = "neko_pending_toggles"
let pendingWaterAddKey = "neko_pending_water_add"
let pendingVitaAddKey = "neko_pending_vita_add"
let pendingCatFeedKey = "neko_pending_cat_feed"
let pendingCatPlayKey = "neko_pending_cat_play"

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
    var cat: CatData?

    static func load() -> WidgetData {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let data = defaults.data(forKey: widgetDataKey) else {
            return WidgetData()
        }
        return (try? JSONDecoder().decode(WidgetData.self, from: data)) ?? WidgetData()
    }

    /// 앱에서 내용을 한 번이라도 받아 왔는가.
    /// (buildWidgetData는 늘 todosDate를 담아 보낸다)
    /// 이걸로 "아직 동기화 안 됨"과 "동기화됐는데 일정이 없음"을 가른다.
    var isLoaded: Bool {
        if let d = todosDate, !d.isEmpty { return true }
        return table != nil || health != nil
    }

    var isStale: Bool {
        guard let d = todosDate, !d.isEmpty else { return true }
        return d != Self.todayKey()
    }

    static func todayKey() -> String {
        return Self.dayFormatter.string(from: Date())
    }

    /// 웹에서 만든 "yyyy-MM-dd"와 반드시 같은 모양이어야 한다.
    /// 로케일을 고정하지 않으면 기기 달력 설정(예: 불기·화력)에 따라
    /// 연도가 달라져 todosDate가 늘 어긋나고, 위젯이 언제나 비어 보인다.
    static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

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

        let newDone = data.todos?.first(where: { $0.id == id })?.isDone ?? false

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
        if done >= goal {
            h.waterDone = 0
            data.health = h
            if let encoded = try? JSONEncoder().encode(data) {
                defaults.set(encoded, forKey: widgetDataKey)
            }
            defaults.set(defaults.integer(forKey: pendingWaterAddKey) - done, forKey: pendingWaterAddKey)
        } else {
            h.waterDone = done + 1
            data.health = h
            if let encoded = try? JSONEncoder().encode(data) {
                defaults.set(encoded, forKey: widgetDataKey)
            }
            defaults.set(defaults.integer(forKey: pendingWaterAddKey) + 1, forKey: pendingWaterAddKey)
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func addVita() {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let raw = defaults.data(forKey: widgetDataKey),
              var data = try? JSONDecoder().decode(WidgetData.self, from: raw),
              var h = data.health else { return }

        let done = h.vitaDone ?? 0
        let goal = h.vitaGoal ?? 1
        if done >= goal {
            h.vitaDone = 0
            data.health = h
            if let encoded = try? JSONEncoder().encode(data) {
                defaults.set(encoded, forKey: widgetDataKey)
            }
            defaults.set(defaults.integer(forKey: pendingVitaAddKey) - done, forKey: pendingVitaAddKey)
        } else {
            h.vitaDone = done + 1
            data.health = h
            if let encoded = try? JSONEncoder().encode(data) {
                defaults.set(encoded, forKey: widgetDataKey)
            }
            defaults.set(defaults.integer(forKey: pendingVitaAddKey) + 1, forKey: pendingVitaAddKey)
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func feedCat() {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let raw = defaults.data(forKey: widgetDataKey),
              var data = try? JSONDecoder().decode(WidgetData.self, from: raw),
              var c = data.cat else { return }

        let pts = c.pts ?? 0
        if pts < 20 { return }
        c.mood = min(100, (c.mood ?? 60) + 10)
        c.pts = pts - 20
        data.cat = c

        if let encoded = try? JSONEncoder().encode(data) {
            defaults.set(encoded, forKey: widgetDataKey)
        }
        defaults.set(defaults.integer(forKey: pendingCatFeedKey) + 1, forKey: pendingCatFeedKey)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func playCat() {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let raw = defaults.data(forKey: widgetDataKey),
              var data = try? JSONDecoder().decode(WidgetData.self, from: raw),
              var c = data.cat else { return }

        c.mood = min(100, (c.mood ?? 60) + 10)
        data.cat = c

        if let encoded = try? JSONEncoder().encode(data) {
            defaults.set(encoded, forKey: widgetDataKey)
        }
        defaults.set(defaults.integer(forKey: pendingCatPlayKey) + 1, forKey: pendingCatPlayKey)
        WidgetCenter.shared.reloadAllTimelines()
    }
}

struct CatData: Codable {
    var breed: String?
    var mood: Int?
    var name: String?
    var pts: Int?
}

struct DDayItem: Codable {
    var title: String
    var date: String

    var daysLeft: Int? {
        guard let target = WidgetData.dayFormatter.date(from: date) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = .current
        let today = cal.startOfDay(for: Date())
        let t = cal.startOfDay(for: target)
        return cal.dateComponents([.day], from: today, to: t).day
    }

    /// "2026-08-30" → "08.30" (안드로이드 shortDate 와 같다)
    var shortDate: String {
        let p = date.split(separator: "-")
        return p.count == 3 ? "\(p[1]).\(p[2])" : date
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
