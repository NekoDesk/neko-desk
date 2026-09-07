import WidgetKit
import SwiftUI

struct NekoEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct NekoProvider: TimelineProvider {
    func placeholder(in context: Context) -> NekoEntry {
        NekoEntry(date: Date(), data: WidgetData.sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (NekoEntry) -> Void) {
        let data = context.isPreview ? WidgetData.sample : WidgetData.load()
        completion(NekoEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NekoEntry>) -> Void) {
        let data = WidgetData.load()
        let now = Date()
        let entry = NekoEntry(date: now, data: data)
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct NekoMainWidget: Widget {
    let kind = "NekoMainWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NekoProvider()) { entry in
            NekoMainView(data: entry.data)
        }
        .configurationDisplayName("NEKO DESK")
        .description("할 일 · D-day · 물 · 비타민")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct NekoMainView: View {
    let data: WidgetData
    var t: ThemeColors { themeFor(data.theme) }

    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            content
                .containerBackground(for: .widget) {
                    t.bg
                }
        } else {
            ZStack {
                t.bg
                content
            }
        }
    }

    var content: some View {
        VStack(alignment: .leading, spacing: 6) {
            healthRow
            ddaySection
            todoSection
        }
        .padding(12)
    }

    @ViewBuilder
    var healthRow: some View {
        let h = data.health
        if h != nil {
            HStack(spacing: 12) {
                if let wg = h?.waterGoal, wg > 0 {
                    if #available(iOSApplicationExtension 17.0, *) {
                        Button(intent: AddWaterIntent()) {
                            waterCups(h: h, wg: wg)
                        }
                        .buttonStyle(.plain)
                    } else {
                        waterCups(h: h, wg: wg)
                    }
                }
                if let vg = h?.vitaGoal, vg > 0 {
                    if #available(iOSApplicationExtension 17.0, *) {
                        Button(intent: AddVitaIntent()) {
                            vitaPills(h: h, vg: vg)
                        }
                        .buttonStyle(.plain)
                    } else {
                        vitaPills(h: h, vg: vg)
                    }
                }
                Spacer()
            }
        }
    }

    @ViewBuilder
    func waterCups(h: HealthData?, wg: Int) -> some View {
        HStack(spacing: 2) {
            Text(h?.waterLabel ?? "💧")
                .font(.system(size: 10))
                .foregroundColor(t.dim)
            ForEach(0..<min(wg, 12), id: \.self) { i in
                let done = i < (h?.waterDone ?? 0)
                Text("💧")
                    .font(.system(size: 9))
                    .opacity(done ? 0.3 : 1.0)
            }
        }
    }

    @ViewBuilder
    func vitaPills(h: HealthData?, vg: Int) -> some View {
        HStack(spacing: 2) {
            Text(h?.vitaLabel ?? "💊")
                .font(.system(size: 10))
                .foregroundColor(t.dim)
            ForEach(0..<min(vg, 12), id: \.self) { i in
                let done = i < (h?.vitaDone ?? 0)
                Text("💊")
                    .font(.system(size: 9))
                    .opacity(done ? 0.3 : 1.0)
            }
        }
    }

    @ViewBuilder
    var ddaySection: some View {
        let items = data.ddays ?? []
        if !items.isEmpty {
            VStack(spacing: 3) {
                ForEach(Array(items.prefix(3).enumerated()), id: \.offset) { _, d in
                    HStack {
                        Text(d.ddayText)
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(t.accent)
                            .frame(width: 50, alignment: .leading)
                        Text(d.title)
                            .font(.system(size: 11))
                            .foregroundColor(t.text)
                            .lineLimit(1)
                        Spacer()
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(t.panel)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(t.border, lineWidth: 0.5)
                            )
                    )
                }
            }
        }
    }

    @ViewBuilder
    var todoSection: some View {
        let items = data.isStale ? [] : (data.todos ?? [])
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(data.headTitle ?? "📝")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(t.text)
                    Spacer()
                    Text("🔄")
                        .font(.system(size: 12))
                    Text("\(data.todoDone ?? 0) / \(data.todoTotal ?? items.count) \(data.doneWord ?? "")")
                        .font(.system(size: 10))
                        .foregroundColor(t.dim)
                }
                ForEach(Array(items.prefix(6).enumerated()), id: \.offset) { _, todo in
                    todoRow(todo)
                }
            }
        } else {
            VStack(spacing: 8) {
                Text("🐱")
                    .font(.system(size: 28))
                Text(data.emptyText ?? "앱을 열어서 동기화하세요")
                    .font(.system(size: 12))
                    .foregroundColor(t.dim)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    func todoRow(_ todo: TodoItem) -> some View {
        let dateKey = data.todosDate ?? ""
        let todoId = todo.id ?? ""

        HStack(spacing: 0) {
            if #available(iOSApplicationExtension 17.0, *), !todoId.isEmpty {
                Button(intent: ToggleTodoIntent(todoId: todoId, dateKey: dateKey)) {
                    Image(systemName: todo.isDone ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 13))
                        .foregroundColor(todo.isDone ? t.dim : t.accent)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
            } else {
                Image(systemName: todo.isDone ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 13))
                    .foregroundColor(todo.isDone ? t.dim : t.accent)
                    .frame(width: 28, height: 28)
            }

            Text(todo.text)
                .font(.system(size: 11))
                .foregroundColor(todo.isDone ? t.dim : t.text)
                .strikethrough(todo.isDone)
                .lineLimit(1)
            Spacer()
            if let badge = todo.ampmLabel, !badge.isEmpty {
                Text(badge)
                    .font(.system(size: 8, weight: .medium))
                    .foregroundColor(todo.isPM ? Color(hex: "#E09A4B") : Color(hex: "#5B8DD9"))
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(
                        Capsule()
                            .stroke(todo.isPM ? Color(hex: "#E09A4B") : Color(hex: "#5B8DD9"), lineWidth: 0.5)
                    )
            }
        }
        .padding(.trailing, 8)
        .padding(.vertical, 2)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(todo.isDone ? t.card : t.panel)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(t.border, lineWidth: 0.5)
                )
        )
    }
}
