import Foundation

// ══════════════════════════════════════════════
// 위젯 고르는 화면에 뜨는 미리보기.
//
// 안드로이드 res/layout/w_preview_*.xml 과 같은 내용이다 — 두 폰에서
// 위젯 목록이 같아 보여야 하므로 글귀·개수·색을 그대로 옮겼다.
// D-day 날짜만은 박아 두지 않고 오늘에서 세어 만든다. 박아 두면
// 배지(D-3)와 날짜(08.30)가 시간이 지나면서 서로 어긋난다.
// ══════════════════════════════════════════════
extension WidgetData {

    private static func sampleTodos(_ withFourth: Bool) -> [TodoItem] {
        var out = [
            TodoItem(id: "s1", text: "A사 시안 전달", done: true, ampm: "am", ampmLabel: "오전"),
            TodoItem(id: "s2", text: "B사 견적서 검토", done: false, ampm: "am", ampmLabel: "오전"),
            TodoItem(id: "s3", text: "C사 미팅 준비", done: false, ampm: "pm", ampmLabel: "오후"),
        ]
        if withFourth {
            out.append(TodoItem(id: "s4", text: "D사 인보이스 발행",
                                done: false, ampm: "pm", ampmLabel: "오후"))
        }
        return out
    }

    private static func dayAfter(_ n: Int) -> String {
        let d = Calendar.current.date(byAdding: .day, value: n, to: Date()) ?? Date()
        return dayFormatter.string(from: d)
    }

    private static var sampleDdays: [DDayItem] {
        [
            DDayItem(title: "A사 납품일", date: dayAfter(3)),
            DDayItem(title: "B사 계약 만료", date: dayAfter(12)),
            DDayItem(title: "여름 휴가", date: dayAfter(24)),
        ]
    }

    private static var sampleHealth: HealthData {
        HealthData(waterLabel: "물 3 / 8", waterGoal: 8, waterDone: 3,
                   vitaLabel: "비타민 1 / 2", vitaGoal: 2, vitaDone: 1)
    }

    /// 월~금에 같은 일정이 반복되는 한 주
    private static func sampleTable(to: Int, withAfternoon: Bool) -> TableData {
        var blocks: [BlockItem] = []
        for d in 1...5 {
            blocks.append(BlockItem(day: d, start: 540, end: 720, label: "A사 작업", rest: false, color: 0))
            blocks.append(BlockItem(day: d, start: 720, end: 780, label: "점심", rest: true, color: -1))
            blocks.append(BlockItem(day: d, start: 780, end: 900, label: "B사 회의", rest: false, color: 3))
            if withAfternoon {
                blocks.append(BlockItem(day: d, start: 900, end: 1080, label: "C사 시안", rest: false, color: 1))
            }
        }
        return TableData(label: "이번 주 시간표",
                         dows: ["일", "월", "화", "수", "목", "금", "토"],
                         from: 9, to: to, empty: "시간표가 비어 있어요", blocks: blocks)
    }

    private static func base() -> WidgetData {
        var d = WidgetData()
        d.theme = "white"
        d.headTitle = "오늘 할 일"
        d.doneWord = "완료"
        d.noneWord = "없음"
        d.emptyText = "오늘 할 일이 없어요"
        d.todosDate = todayKey()
        d.todoTotal = 3
        d.todoDone = 1
        return d
    }

    /// 물·비타민 + D-day + 할 일 + 어제·내일 (w_preview_basic)
    static var sampleBasic: WidgetData {
        var d = base()
        d.health = sampleHealth
        d.ddays = Array(sampleDdays.prefix(2))
        d.todos = sampleTodos(false)
        d.yesterday = SideData(label: "어제", total: 2, todos: [
            TodoItem(id: "y1", text: "A사 1차 시안", done: true, ampm: nil, ampmLabel: nil),
            TodoItem(id: "y2", text: "주간 보고서", done: true, ampm: nil, ampmLabel: nil),
        ])
        d.tomorrow = SideData(label: "내일", total: 2, todos: [
            TodoItem(id: "m1", text: "B사 킥오프 미팅", done: false, ampm: nil, ampmLabel: nil),
            TodoItem(id: "m2", text: "C사 자료 정리", done: false, ampm: nil, ampmLabel: nil),
        ])
        return d
    }

    /// 물·비타민 + D-day + 할 일 + 시간표 (w_preview_full)
    static var sampleFull: WidgetData {
        var d = base()
        d.health = sampleHealth
        d.ddays = Array(sampleDdays.prefix(1))
        d.todos = sampleTodos(false)
        d.table = sampleTable(to: 15, withAfternoon: false)
        return d
    }

    /// D-day 만 (w_preview_dday)
    static var sampleDday: WidgetData {
        var d = base()
        d.ddays = sampleDdays
        return d
    }

    /// 오늘 할 일만 (w_preview_todo)
    static var sampleTodo: WidgetData {
        var d = base()
        d.todos = sampleTodos(true)
        return d
    }

    /// 시간표만 (w_preview_tt)
    static var sampleTt: WidgetData {
        var d = base()
        d.table = sampleTable(to: 17, withAfternoon: true)
        return d
    }
}
