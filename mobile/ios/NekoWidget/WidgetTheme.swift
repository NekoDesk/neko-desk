// 위젯 색표 — scripts/make-widget-themes.js 가 만든다. 손으로 고치지 말 것.
//
// 안드로이드 WidgetTheme.java 와 같은 THEMES·같은 셈법에서 나온다.
// 두 위젯이 같은 색으로 보이려면 이 파일을 직접 고치지 말고 생성기를 고칠 것.
import SwiftUI

struct WTheme {
    let bg: Color
    let bgLine: Color
    let row: Color
    let rowLine: Color
    let rowDone: Color
    let rowDoneLine: Color
    let side: Color
    let sideLine: Color
    let dday: Color
    let ddayLine: Color
    let ttFrame: Color
    let ttFrameLine: Color
    let ttHead: Color
    let ttHeadLine: Color
    let ttEmpty: Color
    let ttEmptyLine: Color
    let ttTodayHead: Color
    let ttTodayHeadLine: Color
    let text: Color
    let dim: Color
    let accent: Color
}

let wThemes: [String: WTheme] = [
    "white": WTheme(
        bg: Color(hex: "#F8F9FB"), bgLine: Color(hex: "#D8DEE8"),
        row: Color(hex: "#FFFFFF"), rowLine: Color(hex: "#B5BCCB"),
        rowDone: Color(hex: "#EEF1F5"), rowDoneLine: Color(hex: "#D8DEE8"),
        side: Color(hex: "#FFFFFF"), sideLine: Color(hex: "#D8DEE8"),
        dday: Color(hex: "#FFFFFF"), ddayLine: Color(hex: "#F4C2BF"),
        ttFrame: Color(hex: "#FFFFFF"), ttFrameLine: Color(hex: "#AEB8C8"),
        ttHead: Color(hex: "#EEF1F5"), ttHeadLine: Color(hex: "#D8DEE8"),
        ttEmpty: Color(hex: "#FFFFFF"), ttEmptyLine: Color(hex: "#D8DEE8"),
        ttTodayHead: Color(hex: "#E5D1A3"), ttTodayHeadLine: Color(hex: "#D9BE82"),
        text: Color(hex: "#33405A"), dim: Color(hex: "#8C98AD"), accent: Color(hex: "#5A6B8C")
    ),
    "ivory": WTheme(
        bg: Color(hex: "#FDFBF5"), bgLine: Color(hex: "#EBE4D4"),
        row: Color(hex: "#FFFEFA"), rowLine: Color(hex: "#E7D4C5"),
        rowDone: Color(hex: "#F7F3E8"), rowDoneLine: Color(hex: "#EBE4D4"),
        side: Color(hex: "#FFFEFA"), sideLine: Color(hex: "#EBE4D4"),
        dday: Color(hex: "#FFFEFA"), ddayLine: Color(hex: "#F4C1BC"),
        ttFrame: Color(hex: "#FFFEFA"), ttFrameLine: Color(hex: "#C6BEAC"),
        ttHead: Color(hex: "#F7F3E8"), ttHeadLine: Color(hex: "#EBE4D4"),
        ttEmpty: Color(hex: "#FFFEFA"), ttEmptyLine: Color(hex: "#EBE4D4"),
        ttTodayHead: Color(hex: "#E7D7B3"), ttTodayHeadLine: Color(hex: "#DDC89A"),
        text: Color(hex: "#5A5346"), dim: Color(hex: "#A89E8C"), accent: Color(hex: "#C9A184")
    ),
    "bpink": WTheme(
        bg: Color(hex: "#FFF6F8"), bgLine: Color(hex: "#F5DDE5"),
        row: Color(hex: "#FFFBFC"), rowLine: Color(hex: "#EDCAD6"),
        rowDone: Color(hex: "#FBEDF1"), rowDoneLine: Color(hex: "#F5DDE5"),
        side: Color(hex: "#FFFBFC"), sideLine: Color(hex: "#F5DDE5"),
        dday: Color(hex: "#FFFBFC"), ddayLine: Color(hex: "#F4BFBD"),
        ttFrame: Color(hex: "#FFFBFC"), ttFrameLine: Color(hex: "#DBC1CA"),
        ttHead: Color(hex: "#FBEDF1"), ttHeadLine: Color(hex: "#F5DDE5"),
        ttEmpty: Color(hex: "#FFFBFC"), ttEmptyLine: Color(hex: "#F5DDE5"),
        ttTodayHead: Color(hex: "#EED5BD"), ttTodayHeadLine: Color(hex: "#E8C7A7"),
        text: Color(hex: "#6B525A"), dim: Color(hex: "#C5AAB3"), accent: Color(hex: "#D68FA8")
    ),
    "pblue": WTheme(
        bg: Color(hex: "#F7FAFE"), bgLine: Color(hex: "#DDE9F5"),
        row: Color(hex: "#FBFDFF"), rowLine: Color(hex: "#C5D8EB"),
        rowDone: Color(hex: "#EEF5FC"), rowDoneLine: Color(hex: "#DDE9F5"),
        side: Color(hex: "#FBFDFF"), sideLine: Color(hex: "#DDE9F5"),
        dday: Color(hex: "#FBFDFF"), ddayLine: Color(hex: "#F2C1BF"),
        ttFrame: Color(hex: "#FBFDFF"), ttFrameLine: Color(hex: "#BBCCDC"),
        ttHead: Color(hex: "#EEF5FC"), ttHeadLine: Color(hex: "#DDE9F5"),
        ttEmpty: Color(hex: "#FBFDFF"), ttEmptyLine: Color(hex: "#DDE9F5"),
        ttTodayHead: Color(hex: "#E2D8BE"), ttTodayHeadLine: Color(hex: "#D8CAA7"),
        text: Color(hex: "#4A5A6E"), dim: Color(hex: "#9FB4C8"), accent: Color(hex: "#84AAD2")
    ),
    "pmint": WTheme(
        bg: Color(hex: "#F7FCF9"), bgLine: Color(hex: "#DCEFE5"),
        row: Color(hex: "#FBFEFC"), rowLine: Color(hex: "#C2E0D4"),
        rowDone: Color(hex: "#EEF8F2"), rowDoneLine: Color(hex: "#DCEFE5"),
        side: Color(hex: "#FBFEFC"), sideLine: Color(hex: "#DCEFE5"),
        dday: Color(hex: "#FBFEFC"), ddayLine: Color(hex: "#F2C1BD"),
        ttFrame: Color(hex: "#FBFEFC"), ttFrameLine: Color(hex: "#B9D2C6"),
        ttHead: Color(hex: "#EEF8F2"), ttHeadLine: Color(hex: "#DCEFE5"),
        ttEmpty: Color(hex: "#FBFEFC"), ttEmptyLine: Color(hex: "#DCEFE5"),
        ttTodayHead: Color(hex: "#E2DAB9"), ttTodayHeadLine: Color(hex: "#D7CCA1"),
        text: Color(hex: "#486054"), dim: Color(hex: "#9CBAAD"), accent: Color(hex: "#7CBBA2")
    ),
    "ppurple": WTheme(
        bg: Color(hex: "#FAF7FE"), bgLine: Color(hex: "#E8DDF4"),
        row: Color(hex: "#FDFBFF"), rowLine: Color(hex: "#D7CAE6"),
        rowDone: Color(hex: "#F4EEFB"), rowDoneLine: Color(hex: "#E8DDF4"),
        side: Color(hex: "#FDFBFF"), sideLine: Color(hex: "#E8DDF4"),
        dday: Color(hex: "#FDFBFF"), ddayLine: Color(hex: "#F3BFBF"),
        ttFrame: Color(hex: "#FDFBFF"), ttFrameLine: Color(hex: "#CBBDDB"),
        ttHead: Color(hex: "#F4EEFB"), ttHeadLine: Color(hex: "#E8DDF4"),
        ttEmpty: Color(hex: "#FDFBFF"), ttEmptyLine: Color(hex: "#E8DDF4"),
        ttTodayHead: Color(hex: "#E6D4BE"), ttTodayHeadLine: Color(hex: "#DCC5A7"),
        text: Color(hex: "#584A6A"), dim: Color(hex: "#B3A3C6"), accent: Color(hex: "#A98EC8")
    ),
];

/// 모르는 이름이면 기본(화이트) — 안드로이드 WidgetTheme.index와 같다
func wtheme(_ id: String?) -> WTheme {
    wThemes[id ?? "white"] ?? wThemes["white"]!
}

extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: .init(charactersIn: "#"))
        var n: UInt64 = 0
        Scanner(string: s).scanHexInt64(&n)
        if s.count == 3 {
            self.init(red: Double((n >> 8) & 0xF) / 15,
                      green: Double((n >> 4) & 0xF) / 15,
                      blue: Double(n & 0xF) / 15)
        } else {
            self.init(red: Double((n >> 16) & 0xFF) / 255,
                      green: Double((n >> 8) & 0xFF) / 255,
                      blue: Double(n & 0xFF) / 255)
        }
    }
}
