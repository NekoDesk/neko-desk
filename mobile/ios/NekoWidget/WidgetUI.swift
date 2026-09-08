import SwiftUI
import WidgetKit

// ══════════════════════════════════════════════
// 위젯 부품 — 안드로이드 res/layout 의 짝이다.
//
// 두 플랫폼 위젯이 같아 보여야 하므로, 여기 숫자는 안드로이드 레이아웃의
// dp 값을 그대로 옮긴 것이다 (1dp = 1pt). 색은 WidgetTheme.swift(생성물)와
// 아래 WC — 안드로이드 drawable 과 같은 값 — 에서 가져온다.
// 고칠 일이 있으면 안드로이드 쪽도 같이 고칠 것.
// ══════════════════════════════════════════════

/// 테마를 타지 않는 색 — 안드로이드 drawable 에 박혀 있는 값과 같다
enum WC {
    static let ddayBadge = Color(hex: "#E4665F")     // w_dday_item i_badge
    static let ddayDate  = Color(hex: "#E88C86")     // w_dday_item i_date
    static let doneText  = Color(hex: "#9AA0A6")     // 끝낸 할 일 글씨
    static let checkOn   = Color(hex: "#4CC08E")     // w_check_on
    static let checkOffLine = Color(hex: "#7FA8E8")  // w_check_off
    static let amBg   = Color(hex: "#E9F1FD")        // w_pill_am
    static let amLine = Color(hex: "#D3E2F8")
    static let amText = Color(hex: "#5B8DD9")
    static let pmBg   = Color(hex: "#FDF0E1")        // w_pill_pm
    static let pmLine = Color(hex: "#F6DFC1")
    static let pmText = Color(hex: "#E09A4B")
    static let cupOn      = Color(hex: "#4FB8EF")    // w_cup_on / w_cup_off
    static let cupOnLine  = Color(hex: "#3AA0D8")
    static let cupOffLine = Color(hex: "#BCD7F2")
    static let pillOn      = Color(hex: "#F0913F")   // w_pill_on / w_pill_off
    static let pillOnLine  = Color(hex: "#D97F2E")
    static let pillOffLine = Color(hex: "#E0C9A8")
    static let white     = Color(hex: "#FFFFFF")
    static let sideText  = Color(hex: "#5F6368")     // 어제·내일 글씨
    static let sideDone  = Color(hex: "#BDC1C6")
    static let sideDim   = Color(hex: "#BDC1C6")
    static let ttHour    = Color(hex: "#BDC1C6")     // 시간표 왼쪽 시각
    static let ttToday   = Color(hex: "#6B5214")     // 머리글 오늘 요일 글씨
    static let sunday    = Color(hex: "#E08A86")     // 일요일 글씨
}

/// 시간표 칸 색 — (테두리, 바탕). 안드로이드 w_b_*.xml 과 같다.
enum TTColor {
    static let work = (line: Color(hex: "#9AD3BF"), fill: Color(hex: "#DCF0E8"))
    static let rest = (line: Color(hex: "#EFCB9A"), fill: Color(hex: "#FCEEDC"))
    static let palette: [(line: Color, fill: Color)] = [
        (Color(hex: "#A2AEC2"), Color(hex: "#EDF0F5")),
        (Color(hex: "#CFC0A0"), Color(hex: "#F7F1DF")),
        (Color(hex: "#E2A8C0"), Color(hex: "#FBE7EF")),
        (Color(hex: "#A6C4E2"), Color(hex: "#E6F0FA")),
        (Color(hex: "#A2D0BA"), Color(hex: "#E4F5EC")),
        (Color(hex: "#C2AADE"), Color(hex: "#F0E8FA")),
    ]

    static func of(_ b: BlockItem) -> (line: Color, fill: Color) {
        let ci = b.color ?? -1
        if ci >= 0 && ci < palette.count { return palette[ci] }
        return b.isRest ? rest : work
    }
}

/// 모서리를 따로 굴리는 네모.
/// 시간표 칸이 위아래로 이어질 때 이음매가 둥글면 끊겨 보여서, 안드로이드
/// layer-list(_s/_t/_m/_b)가 하던 일을 여기서 한다. iOS 14도 써야 해서
/// UnevenRoundedRectangle(iOS 16+) 대신 직접 그린다.
struct RCorners: Shape {
    var tl: CGFloat = 0
    var tr: CGFloat = 0
    var bl: CGFloat = 0
    var br: CGFloat = 0

    func path(in r: CGRect) -> Path {
        var p = Path()
        let w = r.width, h = r.height
        let m = min(w, h) / 2
        let a = min(tl, m), b = min(tr, m), c = min(br, m), d = min(bl, m)
        p.move(to: CGPoint(x: r.minX + a, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX - b, y: r.minY))
        p.addArc(center: CGPoint(x: r.maxX - b, y: r.minY + b), radius: b,
                 startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY - c))
        p.addArc(center: CGPoint(x: r.maxX - c, y: r.maxY - c), radius: c,
                 startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
        p.addLine(to: CGPoint(x: r.minX + d, y: r.maxY))
        p.addArc(center: CGPoint(x: r.minX + d, y: r.maxY - d), radius: d,
                 startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
        p.addLine(to: CGPoint(x: r.minX, y: r.minY + a))
        p.addArc(center: CGPoint(x: r.minX + a, y: r.minY + a), radius: a,
                 startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        p.closeSubpath()
        return p
    }
}

extension View {
    /// 안드로이드 shape drawable 한 장 (안쪽으로 그리는 테두리)
    func wbox(_ fill: Color, _ line: Color, radius: CGFloat, width: CGFloat) -> some View {
        self.background(RoundedRectangle(cornerRadius: radius).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: radius).strokeBorder(line, lineWidth: width))
    }
}

// ── 맨 위 — 고양이 · 앱 이름 · 새로고침 (w_header.xml) ──
struct WHeader: View {
    let t: WTheme

    var body: some View {
        HStack(spacing: 0) {
            Image("WidgetCat")
                .resizable()
                .scaledToFit()
                .frame(width: 26, height: 26)
                .padding(.trailing, 8)
            brand
            Spacer(minLength: 4)
            Text("🔄")
                .font(.system(size: 14))
                .frame(width: 24, height: 24)
        }
        .padding(.bottom, 8)
    }

    @ViewBuilder
    private var brand: some View {
        // letterSpacing 0.08em — tracking은 iOS 16부터라 그 아래선 그냥 둔다
        if #available(iOSApplicationExtension 16.0, *) {
            Text("NEKO DESK")
                .font(.system(size: 13, weight: .bold))
                .tracking(1.04)
                .foregroundColor(t.text)
        } else {
            Text("NEKO DESK")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(t.text)
        }
    }
}

// ── 오늘 마신 물 · 챙겨 먹은 비타민 (w_health.xml) ──
struct WHealth: View {
    let t: WTheme
    let h: HealthData

    var body: some View {
        VStack(spacing: 0) {
            if let wg = h.waterGoal, wg > 0 {
                row(label: h.waterLabel ?? "", top: 4, bottom: 2) {
                    dots(count: min(wg, 12), done: h.waterDone ?? 0,
                         w: 14, h: 17, r: 2,
                         on: WC.cupOn, onLine: WC.cupOnLine, offLine: WC.cupOffLine)
                }
                .modifier(TapIntent(kind: .water))
            }
            if let vg = h.vitaGoal, vg > 0 {
                row(label: h.vitaLabel ?? "", top: 2, bottom: 4) {
                    dots(count: min(vg, 12), done: h.vitaDone ?? 0,
                         w: 17, h: 11, r: 4,
                         on: WC.pillOn, onLine: WC.pillOnLine, offLine: WC.pillOffLine)
                }
                .modifier(TapIntent(kind: .vita))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .wbox(t.side, t.sideLine, radius: 12, width: 1)
        .padding(.bottom, 8)
    }

    private func row<C: View>(label: String, top: CGFloat, bottom: CGFloat,
                              @ViewBuilder content: () -> C) -> some View {
        HStack(spacing: 0) {
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(t.dim)
            Spacer(minLength: 4)
            content()
                .padding(.top, top)
                .padding(.bottom, bottom)
                .padding(.horizontal, 6)
                .frame(minHeight: 32)
        }
    }

    /// 안드로이드와 같은 셈 — 이미 채운 만큼이 빈 칸이 되고, 남은 만큼이 색칠된다
    private func dots(count: Int, done: Int, w: CGFloat, h: CGFloat, r: CGFloat,
                      on: Color, onLine: Color, offLine: Color) -> some View {
        HStack(spacing: 3) {
            ForEach(Array(0..<max(0, count)), id: \.self) { i in
                RoundedRectangle(cornerRadius: r)
                    .fill(i < done ? WC.white : on)
                    .overlay(RoundedRectangle(cornerRadius: r)
                        .strokeBorder(i < done ? offLine : onLine, lineWidth: 1.5))
                    .frame(width: w, height: h)
            }
        }
    }
}

/// 물·비타민 줄 터치 (iOS 17+). 그 아래에선 위젯 전체가 앱을 연다.
private struct TapIntent: ViewModifier {
    enum Kind { case water, vita }
    let kind: Kind

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            switch kind {
            case .water: Button(intent: AddWaterIntent()) { content }.buttonStyle(.plain)
            case .vita:  Button(intent: AddVitaIntent()) { content }.buttonStyle(.plain)
            }
        } else {
            content
        }
    }
}

// ── D-day 한 줄 (w_dday_item.xml) ──
struct WDdayRow: View {
    let t: WTheme
    let item: DDayItem

    var body: some View {
        HStack(spacing: 0) {
            Text(item.ddayText)
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(WC.ddayBadge)
                .padding(.trailing, 9)
            Text(item.title)
                .font(.system(size: 12))
                .foregroundColor(t.text)
                .lineLimit(1)
            Spacer(minLength: 6)
            Text(item.shortDate)
                .font(.system(size: 10))
                .foregroundColor(WC.ddayDate)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .wbox(t.dday, t.ddayLine, radius: 13, width: 1)
        .padding(.bottom, 5)
    }
}

// ── 오늘 할 일 머리글 (w_head_box) ──
struct WTodoHead: View {
    let t: WTheme
    let title: String
    let done: Int
    let total: Int
    let doneWord: String

    var body: some View {
        HStack(spacing: 0) {
            Text(title)
                .font(.system(size: 12))
                .foregroundColor(t.text)
                .lineLimit(1)
            Spacer(minLength: 6)
            Text("\(done) / \(total)" + (doneWord.isEmpty ? "" : " " + doneWord))
                .font(.system(size: 10))
                .foregroundColor(t.dim)
        }
        .padding(.leading, 3)
        .padding(.trailing, 4)
        .padding(.top, 3)
        .padding(.bottom, 6)
    }
}

// ── 오늘 할 일 한 줄 (w_todo_item.xml) ──
struct WTodoRow: View {
    let t: WTheme
    let todo: TodoItem
    let dateKey: String

    var body: some View {
        HStack(spacing: 0) {
            checkArea
            Text(todo.text)
                .font(.system(size: 12))
                .foregroundColor(todo.isDone ? WC.doneText : t.text)
                .strikethrough(todo.isDone)
                .lineLimit(1)
            Spacer(minLength: 6)
            if let badge = todo.ampmLabel, !badge.isEmpty {
                Text(badge)
                    .font(.system(size: 9))
                    .foregroundColor(todo.isPM ? WC.pmText : WC.amText)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .wbox(todo.isPM ? WC.pmBg : WC.amBg,
                          todo.isPM ? WC.pmLine : WC.amLine, radius: 9, width: 1)
            }
        }
        .padding(.leading, 4)
        .padding(.trailing, 8)
        .padding(.vertical, 8)
        .wbox(todo.isDone ? t.rowDone : t.row,
              todo.isDone ? t.rowDoneLine : t.rowLine, radius: 13, width: 1.5)
        .padding(.bottom, 5)
    }

    @ViewBuilder
    private var checkArea: some View {
        let id = todo.id ?? ""
        if #available(iOSApplicationExtension 17.0, *), !id.isEmpty {
            Button(intent: ToggleTodoIntent(todoId: id, dateKey: dateKey)) { box }
                .buttonStyle(.plain)
        } else {
            box
        }
    }

    private var box: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 5)
                .fill(todo.isDone ? WC.checkOn : WC.white)
                .overlay(RoundedRectangle(cornerRadius: 5)
                    .strokeBorder(todo.isDone ? WC.checkOn : WC.checkOffLine, lineWidth: 1.5))
                .frame(width: 18, height: 18)
            if todo.isDone {
                Text("✓").font(.system(size: 11)).foregroundColor(WC.white)
            }
        }
        .frame(width: 30)
    }
}

// ── 어제 · 내일 칸 (neko_widget.xml 의 w_sides) ──
struct WSideBox: View {
    let t: WTheme
    let side: SideData?
    let stale: Bool
    let noneWord: String

    var body: some View {
        let all: [TodoItem] = stale ? [] : (side?.todos ?? [])
        let items = all.filter { !$0.text.isEmpty }
        let more = max(0, (stale ? 0 : (side?.total ?? items.count)) - items.count)

        VStack(alignment: .leading, spacing: 0) {
            Text(side?.label ?? "")
                .font(.system(size: 10))
                .foregroundColor(t.dim)
                .lineLimit(1)
                .padding(.bottom, 3)
            ForEach(Array(items.enumerated()), id: \.offset) { _, it in
                HStack(spacing: 0) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 5)
                            .fill(it.isDone ? WC.checkOn : WC.white)
                            .overlay(RoundedRectangle(cornerRadius: 5)
                                .strokeBorder(it.isDone ? WC.checkOn : WC.checkOffLine, lineWidth: 1.5))
                            .frame(width: 12, height: 12)
                        if it.isDone {
                            Text("✓").font(.system(size: 8)).foregroundColor(WC.white)
                        }
                    }
                    .padding(.trailing, 6)
                    Text(it.text)
                        .font(.system(size: 10))
                        .foregroundColor(it.isDone ? WC.sideDone : WC.sideText)
                        .strikethrough(it.isDone)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 2)
            }
            if items.isEmpty {
                Text(noneWord)
                    .font(.system(size: 10))
                    .foregroundColor(WC.sideDim)
                    .padding(.top, 2)
            } else if more > 0 {
                Text("+\(more)")
                    .font(.system(size: 10))
                    .foregroundColor(WC.sideDim)
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 9)
        .padding(.vertical, 7)
        .wbox(t.side, t.sideLine, radius: 12, width: 1)
    }
}

// ── 고양이 위젯 ──
struct WCatView: View {
    let t: WTheme
    let cat: CatData?
    let isLoaded: Bool

    private var breed: String { cat?.breed ?? "white" }
    private var mood: Int { cat?.mood ?? 60 }
    private var name: String { cat?.name ?? "냐옹이" }
    private var pts: Int { cat?.pts ?? 0 }

    private var imageName: String {
        let valid = ["white", "tabby", "black", "pink"]
        return "Cat_\(valid.contains(breed) ? breed : "white")"
    }

    private var moodEmoji: String {
        if mood >= 80 { return "😻" }
        if mood >= 50 { return "😺" }
        if mood >= 30 { return "😿" }
        return "🙀"
    }

    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 4) {
                Image(imageName)
                    .resizable()
                    .interpolation(.none)
                    .scaledToFit()
                    .frame(maxWidth: 100, maxHeight: 100)
                    .saturation(mood <= 40 ? 0.4 : 1.0)
                Text(name)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(t.text)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)

            VStack(spacing: 8) {
                HStack(spacing: 4) {
                    Text(moodEmoji).font(.system(size: 14))
                    moodBar
                }
                if #available(iOSApplicationExtension 17.0, *) {
                    Button(intent: FeedCatIntent()) {
                        Label("먹이", systemImage: "fork.knife")
                            .font(.system(size: 11))
                            .foregroundColor(pts >= 20 ? WC.amText : WC.doneText)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .wbox(pts >= 20 ? WC.amBg : t.rowDone,
                                  pts >= 20 ? WC.amLine : t.rowDoneLine, radius: 10, width: 1)
                    }
                    .buttonStyle(.plain)
                    Button(intent: PlayCatIntent()) {
                        Label("놀기", systemImage: "sparkles")
                            .font(.system(size: 11))
                            .foregroundColor(WC.pmText)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .wbox(WC.pmBg, WC.pmLine, radius: 10, width: 1)
                    }
                    .buttonStyle(.plain)
                } else {
                    Text("앱에서 돌봐주세요")
                        .font(.system(size: 10))
                        .foregroundColor(t.dim)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var moodBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(t.rowDone)
                    .frame(height: 8)
                RoundedRectangle(cornerRadius: 4)
                    .fill(mood >= 50 ? WC.checkOn : WC.ddayBadge)
                    .frame(width: max(0, geo.size.width * CGFloat(mood) / 100.0), height: 8)
            }
        }
        .frame(height: 8)
    }
}

// ── 이번 주 시간표 (w_tt_grid.xml + NekoWidget.fillTable) ──
struct WTimetable: View {
    let t: WTheme
    let table: TableData?
    let isLoaded: Bool

    var body: some View {
        VStack(spacing: 0) {
            Text(table?.label ?? "")
                .font(.system(size: 12))
                .foregroundColor(t.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 3)
                .padding(.bottom, 5)
            gridFrame
        }
    }

    private var blocks: [BlockItem] { table?.blocks ?? [] }

    /// 안드로이드와 같게 — 뒤집힌 값은 바로잡고 14줄까지만
    private var span: (from: Int, to: Int) {
        let f = min(max(table?.from ?? 8, 0), 23)
        var to = max(table?.to ?? 20, f + 1)
        if to - f > 14 { to = f + 14 }
        return (f, min(to, 24))
    }

    @ViewBuilder
    private var gridFrame: some View {
        VStack(spacing: 0) {
            if blocks.isEmpty {
                // 안드로이드는 머리줄 없이 안내글 한 줄만 놓는다
                Text(isLoaded ? (table?.empty ?? "") : "앱을 한 번 열어 주세요")
                    .font(.system(size: 9))
                    .foregroundColor(t.dim)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 3)
            } else {
                head
                GeometryReader { geo in
                    grid(rowH: rowHeight(for: geo.size.height))
                }
            }
        }
        .padding(1.2)
        .background(RoundedRectangle(cornerRadius: 9).fill(t.ttFrame))
        .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(t.ttFrameLine, lineWidth: 1.2))
    }

    /// 남은 높이를 줄 수로 나눈다. 안드로이드가 고른 14~36dp 사이에 맞춘다.
    private func rowHeight(for h: CGFloat) -> CGFloat {
        let rows = max(1, span.to - span.from)
        return min(36, max(14, floor(h / CGFloat(rows))))
    }

    private var head: some View {
        let dows = table?.dows ?? []
        let today = Calendar.current.component(.weekday, from: Date()) - 1
        return HStack(spacing: 0) {
            Color.clear.frame(width: 22, height: 1)
            ForEach(Array(0..<7), id: \.self) { d in
                Text(d < dows.count ? dows[d] : "")
                    .font(.system(size: 9))
                    .foregroundColor(d == today ? WC.ttToday : (d == 0 ? WC.sunday : t.dim))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 3)
                    .background(d == today
                        ? AnyView(RCorners(tl: 6, tr: 6).fill(t.ttTodayHead))
                        : AnyView(Color.clear))
            }
        }
        .background(RCorners(tl: 7, tr: 7).fill(t.ttHead))
        .overlay(RCorners(tl: 7, tr: 7).stroke(t.ttHeadLine, lineWidth: 0.8))
    }

    private func grid(rowH: CGFloat) -> some View {
        let s = span
        let cellFont: CGFloat = rowH >= 31 ? 10 : (rowH >= 22 ? 9 : 8)
        let hourFont: CGFloat = rowH >= 22 ? 9 : 8
        return VStack(spacing: 0) {
            ForEach(Array(s.from..<s.to), id: \.self) { h in
                HStack(spacing: 0) {
                    Text(String(format: "%02d", h))
                        .font(.system(size: hourFont))
                        .foregroundColor(WC.ttHour)
                        .frame(width: 22, height: rowH)
                    ForEach(Array(0..<7), id: \.self) { d in
                        cell(day: d, hour: h, last: h == s.to - 1 && d == 6, font: cellFont)
                            .frame(maxWidth: .infinity, minHeight: rowH, maxHeight: rowH)
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private func cell(day: Int, hour: Int, last: Bool, font: CGFloat) -> some View {
        let hit = blocks.first { $0.day == day && hour * 60 < $0.end && (hour + 1) * 60 > $0.start }
        if let b = hit {
            let starts = b.start >= hour * 60 && b.start < (hour + 1) * 60
            let ends = b.end > hour * 60 && b.end <= (hour + 1) * 60
            let c = TTColor.of(b)
            ZStack {
                RCorners(tl: starts ? 3 : 0, tr: starts ? 3 : 0,
                         bl: ends ? 3 : 0, br: ends ? 3 : 0)
                    .fill(c.line)
                    .padding(.horizontal, 1)
                RCorners(tl: starts ? 2 : 0, tr: starts ? 2 : 0,
                         bl: ends ? 2 : 0, br: ends ? 2 : 0)
                    .fill(c.fill)
                    .padding(.horizontal, 2)
                    .padding(.top, starts ? 1 : 0)
                    .padding(.bottom, ends ? 1 : 0)
                if starts {
                    Text(b.label ?? "")
                        .font(.system(size: font))
                        .foregroundColor(t.text)
                        .lineLimit(1)
                        .padding(.horizontal, 1)
                }
            }
        } else {
            RCorners(br: last ? 7 : 0)
                .fill(t.ttEmpty)
                .overlay(RCorners(br: last ? 7 : 0).stroke(t.ttEmptyLine, lineWidth: 0.6))
        }
    }
}
