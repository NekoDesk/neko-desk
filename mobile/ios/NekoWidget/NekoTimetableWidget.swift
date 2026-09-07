import WidgetKit
import SwiftUI

struct NekoTimetableWidget: Widget {
    let kind = "NekoTimetableWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NekoProvider()) { entry in
            TimetableView(data: entry.data)
        }
        .configurationDisplayName("NEKO DESK 시간표")
        .description("이번 주 시간표")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

private let blockColors: [Color] = [
    Color(hex: "#DCF0E8"), Color(hex: "#FCEEDC"),
    Color(hex: "#EDF0F5"), Color(hex: "#F7F1DF"),
    Color(hex: "#FBE7EF"), Color(hex: "#E6F0FA"),
    Color(hex: "#E4F5EC"), Color(hex: "#F0E8FA"),
]

struct TimetableView: View {
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
        let table = data.table
        let from = table?.from ?? 8
        let to = table?.to ?? 20
        let dows = table?.dows ?? ["일","월","화","수","목","금","토"]
        let blocks = table?.blocks ?? []
        let todayDow = Calendar.current.component(.weekday, from: Date()) - 1

        return VStack(spacing: 0) {
                Text(table?.label ?? "🕐 시간표")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(t.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.bottom, 4)

                if blocks.isEmpty {
                    Spacer()
                    Text(table?.empty ?? "시간표가 비어 있어요")
                        .font(.system(size: 12))
                        .foregroundColor(t.dim)
                    Spacer()
                } else {
                    VStack(spacing: 0) {
                        // 요일 머리글
                        HStack(spacing: 0) {
                            Text("")
                                .frame(width: 20)
                            ForEach(0..<7, id: \.self) { d in
                                Text(dows[d])
                                    .font(.system(size: 8, weight: d == todayDow ? .bold : .regular))
                                    .foregroundColor(
                                        d == todayDow ? Color(hex: "#6B5214") :
                                        d == 0 ? Color(hex: "#E08A86") : t.dim
                                    )
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 2)
                                    .background(
                                        d == todayDow ?
                                            AnyView(RoundedRectangle(cornerRadius: 3)
                                                .fill(Color(hex: "#F5C842").opacity(0.3)))
                                            : AnyView(EmptyView())
                                    )
                            }
                        }
                        .padding(.vertical, 2)
                        .background(t.card)

                        // 격자
                        ForEach(from..<min(to, from + 14), id: \.self) { h in
                            HStack(spacing: 0) {
                                Text(String(format: "%02d", h))
                                    .font(.system(size: 7, design: .monospaced))
                                    .foregroundColor(t.dim)
                                    .frame(width: 20)

                                ForEach(0..<7, id: \.self) { d in
                                    let hit = blocks.first { b in
                                        b.day == d && h * 60 < b.end && (h + 1) * 60 > b.start
                                    }
                                    let starts = hit.map { $0.start >= h * 60 && $0.start < (h+1) * 60 } ?? false

                                    ZStack {
                                        if let b = hit {
                                            let ci = (b.color ?? -1)
                                            let color = ci >= 0 && ci < blockColors.count
                                                ? blockColors[ci]
                                                : (b.isRest ? blockColors[1] : blockColors[0])
                                            color
                                            if starts {
                                                Text(b.label ?? "")
                                                    .font(.system(size: 6))
                                                    .foregroundColor(t.text)
                                                    .lineLimit(1)
                                            }
                                        } else {
                                            t.panel
                                        }
                                    }
                                    .frame(maxWidth: .infinity)
                                    .overlay(
                                        Rectangle().stroke(t.border, lineWidth: 0.3)
                                    )
                                }
                            }
                            .frame(height: max(12, CGFloat(min(200, 400) / max(to - from, 1))))
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(t.border, lineWidth: 0.5)
                    )
                }
            }
            .padding(10)
    }
}
