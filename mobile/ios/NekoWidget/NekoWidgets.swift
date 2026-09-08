import WidgetKit
import SwiftUI

// ══════════════════════════════════════════════
// 위젯 다섯 가지 — 안드로이드와 종류·차례가 같다.
//
//   NekoWidget.java        기본   물·비타민 + D-day + 할 일 + 어제·내일
//   NekoWidgetFull.java    가득   물·비타민 + D-day + 할 일 + 시간표
//   NekoWidgetDday.java    D-day  만
//   NekoWidgetTodo.java    할 일  만
//   NekoWidgetTt.java      시간표 만
//
// kind 문자열은 바꾸지 말 것 — 바꾸면 이미 바탕화면에 올려 둔 위젯이 사라진다.
//
// 크기는 다섯 가지 모두 중간·큰 칸을 받는다. 안드로이드도 resizeMode 로
// 180x110dp 까지 줄일 수 있어서, 한쪽만 큰 칸으로 묶으면 오히려 달라진다.
// ══════════════════════════════════════════════

struct NekoEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct NekoProvider: TimelineProvider {
    /// 위젯 고르는 화면에 보여 줄 본보기 (안드로이드 previewLayout 자리)
    let sample: WidgetData

    func placeholder(in context: Context) -> NekoEntry {
        NekoEntry(date: Date(), data: sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (NekoEntry) -> Void) {
        completion(NekoEntry(date: Date(), data: context.isPreview ? sample : WidgetData.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NekoEntry>) -> Void) {
        let now = Date()
        let entry = NekoEntry(date: now, data: WidgetData.load())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// ── 어느 칸을 보여 줄지 (안드로이드 showHealth/showDday/... 와 같다) ──
struct NekoWidgetView: View {
    let data: WidgetData
    var showHealth = false
    var showDday = false
    var showTodo = false
    var showTable = false
    var showCat = false
    var showSides = false

    private var t: WTheme { wtheme(data.theme) }
    private var stale: Bool { data.isStale }
    private var todos: [TodoItem] {
        stale ? [] : (data.todos ?? []).filter { !$0.text.isEmpty }
    }

    var body: some View {
        if #available(iOSApplicationExtension 17.0, *) {
            // iOS 17은 스스로 16pt 여백을 둔다. 6pt만 되돌려 안드로이드의 10dp에 맞춘다.
            // (여백 값이 기기마다 조금 달라도 안쪽으로만 벗어나 잘리지 않는다)
            content
                .padding(-6)
                .containerBackground(for: .widget) { t.bg }
        } else {
            ZStack {
                t.bg
                content.padding(10)
            }
        }
    }

    private var content: some View {
        VStack(spacing: 0) {
            WHeader(t: t)

            if showHealth, let h = data.health {
                WHealth(t: t, h: h)
            }

            if showDday { ddayList }
            if showTodo { todoSection }

            if showCat {
                WCatView(t: t, cat: data.cat, isLoaded: data.isLoaded)
            }

            if showTable {
                WTimetable(t: t, table: data.table, isLoaded: data.isLoaded)
            }

            if showSides {
                HStack(spacing: 6) {
                    WSideBox(t: t, side: data.yesterday, stale: stale, noneWord: data.noneWord ?? "")
                    WSideBox(t: t, side: data.tomorrow, stale: stale, noneWord: data.noneWord ?? "")
                }
                .padding(.top, 5)
            }

        }
        // 안드로이드 LinearLayout 처럼 위로 붙인다.
        // 시간표(GeometryReader)가 있으면 그쪽이 남은 자리를 가져간다.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    @ViewBuilder
    private var ddayList: some View {
        let items = (data.ddays ?? []).filter { !$0.title.isEmpty && !$0.date.isEmpty }
        if !items.isEmpty {
            let rows = (items.count + 1) / 2
            VStack(spacing: 0) {
                ForEach(0..<rows, id: \.self) { row in
                    let i = row * 2
                    HStack(spacing: 5) {
                        WDdayRow(t: t, item: items[i])
                            .frame(maxWidth: .infinity)
                        if i + 1 < items.count {
                            WDdayRow(t: t, item: items[i + 1])
                                .frame(maxWidth: .infinity)
                        } else {
                            Spacer().frame(maxWidth: .infinity)
                        }
                    }
                }
            }
            .padding(.bottom, 3)
        }
    }

    @ViewBuilder
    private var todoSection: some View {
        let items = todos
        if items.isEmpty {
            // 안드로이드는 가운데 정렬한 안내글 한 줄만 둔다 (위아래 12dp)
            Text(data.isLoaded ? (data.emptyText ?? "") : "앱을 한 번 열어 주세요")
                .font(.system(size: 11))
                .foregroundColor(t.dim)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
        } else {
            WTodoHead(t: t, title: data.headTitle ?? "",
                      done: headDone(items), total: headTotal(items),
                      doneWord: data.doneWord ?? "")
            let todoRows = (items.count + 1) / 2
            VStack(spacing: 0) {
                ForEach(0..<todoRows, id: \.self) { row in
                    let i = row * 2
                    HStack(spacing: 5) {
                        WTodoRow(t: t, todo: items[i], dateKey: data.todosDate ?? "")
                            .frame(maxWidth: .infinity)
                        if i + 1 < items.count {
                            WTodoRow(t: t, todo: items[i + 1], dateKey: data.todosDate ?? "")
                                .frame(maxWidth: .infinity)
                        } else {
                            Spacer().frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
    }

    /// 화면에 몇 줄 못 보여 줘도 셈은 앱이 보내 준 전체 개수를 쓴다 (안드로이드와 같다)
    private func headTotal(_ items: [TodoItem]) -> Int {
        let total = data.todoTotal ?? -1
        return (!stale && total >= items.count) ? total : items.count
    }

    private func headDone(_ items: [TodoItem]) -> Int {
        let total = data.todoTotal ?? -1
        let done = data.todoDone ?? -1
        if !stale && total >= items.count && done >= 0 { return done }
        return items.filter { $0.isDone }.count
    }
}

// ══════════════════════════════════════════════
// 위젯 정의 — 설명글은 안드로이드 strings.xml 과 같다
// ══════════════════════════════════════════════

/// 기본 (안드로이드 4x5)
struct NekoMainWidget: Widget {
    let kind = "NekoMainWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NekoProvider(sample: .sampleBasic)) { entry in
            NekoWidgetView(data: entry.data,
                           showHealth: true, showDday: true, showTodo: true, showSides: true)
        }
        .configurationDisplayName("NEKO DESK")
        .description("오늘의 D-day와 할 일을 바탕화면에서 바로 보여줍니다.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

/// D-day 만 (안드로이드 3x2)
struct NekoDdayWidget: Widget {
    let kind = "NekoDdayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NekoProvider(sample: .sampleDday)) { entry in
            NekoWidgetView(data: entry.data, showDday: true)
        }
        .configurationDisplayName("NEKO DESK")
        .description("등록한 D-day만 보여줍니다.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

/// 오늘 할 일만 (안드로이드 4x3)
struct NekoTodoWidget: Widget {
    let kind = "NekoTodoWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NekoProvider(sample: .sampleTodo)) { entry in
            NekoWidgetView(data: entry.data, showTodo: true)
        }
        .configurationDisplayName("NEKO DESK")
        .description("오늘 할 일만 보여줍니다.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

/// 고양이만
struct NekoCatWidget: Widget {
    let kind = "NekoCatWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NekoProvider(sample: .sampleCat)) { entry in
            NekoWidgetView(data: entry.data, showCat: true)
        }
        .configurationDisplayName("NEKO DESK")
        .description("고양이의 기분을 확인하고 먹이를 주거나 함께 놀 수 있습니다.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

/// 시간표만 (안드로이드 4x4)
struct NekoTimetableWidget: Widget {
    let kind = "NekoTimetableWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NekoProvider(sample: .sampleTt)) { entry in
            NekoWidgetView(data: entry.data, showTable: true)
        }
        .configurationDisplayName("NEKO DESK")
        .description("이번 주 시간표를 보여줍니다.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
