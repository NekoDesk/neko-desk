import SwiftUI

struct ThemeColors {
    let bg: Color
    let panel: Color
    let card: Color
    let border: Color
    let text: Color
    let dim: Color
    let accent: Color
    let yellow: Color
}

let themes: [String: ThemeColors] = [
    "white": ThemeColors(
        bg: Color(hex: "#FAF9F6"), panel: Color(hex: "#FFFFFF"), card: Color(hex: "#F5F3EF"),
        border: Color(hex: "#E0DCD4"), text: Color(hex: "#3C3C3C"), dim: Color(hex: "#9AA0A6"),
        accent: Color(hex: "#D4A853"), yellow: Color(hex: "#F5C842")
    ),
    "cream": ThemeColors(
        bg: Color(hex: "#FFF8EC"), panel: Color(hex: "#FFFDF7"), card: Color(hex: "#FFF3DE"),
        border: Color(hex: "#E8DABE"), text: Color(hex: "#4A3F2F"), dim: Color(hex: "#A89880"),
        accent: Color(hex: "#D4A853"), yellow: Color(hex: "#F5C842")
    ),
    "green": ThemeColors(
        bg: Color(hex: "#F0F7F4"), panel: Color(hex: "#FAFFFE"), card: Color(hex: "#E5F0EB"),
        border: Color(hex: "#C4D8CE"), text: Color(hex: "#2D3E35"), dim: Color(hex: "#7E9A8C"),
        accent: Color(hex: "#6AAF8B"), yellow: Color(hex: "#F5C842")
    ),
    "blue": ThemeColors(
        bg: Color(hex: "#EFF4FA"), panel: Color(hex: "#FAFCFF"), card: Color(hex: "#E3EDF7"),
        border: Color(hex: "#BFD2E6"), text: Color(hex: "#2B384A"), dim: Color(hex: "#7D93AB"),
        accent: Color(hex: "#5B8DD9"), yellow: Color(hex: "#F5C842")
    ),
    "dark": ThemeColors(
        bg: Color(hex: "#1E1E22"), panel: Color(hex: "#28282E"), card: Color(hex: "#2E2E34"),
        border: Color(hex: "#3E3E46"), text: Color(hex: "#E0E0E0"), dim: Color(hex: "#8A8A94"),
        accent: Color(hex: "#D4A853"), yellow: Color(hex: "#F5C842")
    ),
    "pink": ThemeColors(
        bg: Color(hex: "#FFF5F7"), panel: Color(hex: "#FFFAFC"), card: Color(hex: "#FFEDF1"),
        border: Color(hex: "#F0CDD5"), text: Color(hex: "#4A2D35"), dim: Color(hex: "#B88E98"),
        accent: Color(hex: "#E08A9E"), yellow: Color(hex: "#F5C842")
    ),
]

func themeFor(_ id: String?) -> ThemeColors {
    themes[id ?? "white"] ?? themes["white"]!
}

extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: .init(charactersIn: "#"))
        var n: UInt64 = 0
        Scanner(string: s).scanHexInt64(&n)
        if s.count == 3 {
            let r = Double((n >> 8) & 0xF) / 15
            let g = Double((n >> 4) & 0xF) / 15
            let b = Double(n & 0xF) / 15
            self.init(red: r, green: g, blue: b)
        } else {
            let r = Double((n >> 16) & 0xFF) / 255
            let g = Double((n >> 8) & 0xFF) / 255
            let b = Double(n & 0xFF) / 255
            self.init(red: r, green: g, blue: b)
        }
    }
}
