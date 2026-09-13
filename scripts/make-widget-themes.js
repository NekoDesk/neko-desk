/**
 * 위젯도 앱의 배경 테마를 따라가게, 테마마다 배경 그림을 만들어 둔다.
 *
 *   node scripts/make-widget-themes.js
 *
 * 위젯은 RemoteViews라 색을 그때그때 칠할 수가 없다(둥근 모서리를 가진
 * shape은 API 31 미만에서 물들일 방법이 없다). 그래서 테마 수만큼 미리
 * 만들어 두고 코드에서 골라 쓴다. 색은 renderer/index.html의 THEMES에서
 * 그대로 읽어 오므로 앱과 위젯이 어긋나지 않는다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RENDERER = path.join(ROOT, 'renderer', 'index.html');
const DRAWABLE = path.join(ROOT, 'mobile/android/app/src/main/res/drawable');
const JAVA = path.join(ROOT, 'mobile/android/app/src/main/java/com/siwon/nekodesk/mobile');

/** renderer의 THEMES에서 색표를 읽는다 */
function readThemes() {
  const html = fs.readFileSync(RENDERER, 'utf8');
  const at = html.indexOf('const THEMES');
  if (at < 0) throw new Error('renderer/index.html에서 THEMES를 찾지 못했습니다');
  // THEMES 배열이 끝나는 곳까지만 (뒤에 오는 코드에서 엉뚱한 걸 줍지 않게)
  const end = html.indexOf('\n];', at);
  const seg = html.slice(at, end < 0 ? at + 12000 : end);
  const out = [];
  const re = /\{ id:'(\w+)',[\s\S]*?vars:\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(seg))) {
    const vars = {};
    let v;
    const vre = /'--([\w-]+)':'([^']+)'/g;
    while ((v = vre.exec(m[2]))) vars[v[1]] = v[2];
    out.push({ id: m[1], vars });
  }
  if (out.length < 6) throw new Error('테마를 다 읽지 못했습니다 (' + out.length + ')');
  return out;
}

/** 어두운 테마 — 시간표 칸 색을 따로 쓴다 */
const DARK = ['black'];
const isDark = (id) => DARK.indexOf(id) >= 0;

// 시간표 칸 색 (테두리, 바탕). 밝은 테마는 renderer 의 .tt-blk 와 같은 값,
// 어두운 테마는 body.theme-black 의 덧칠과 같은 값이어야 앱과 위젯이 같아 보인다.
const BLOCK_LIGHT = {
  w:  ['#9AD3BF', '#DCF0E8'], r:  ['#EFCB9A', '#FCEEDC'],
  c0: ['#A2AEC2', '#EDF0F5'], c1: ['#CFC0A0', '#F7F1DF'], c2: ['#E2A8C0', '#FBE7EF'],
  c3: ['#A6C4E2', '#E6F0FA'], c4: ['#A2D0BA', '#E4F5EC'], c5: ['#C2AADE', '#F0E8FA'],
};
const BLOCK_DARK = {
  w:  ['#3f6456', '#1f2e28'], r:  ['#635a41', '#2e2a20'],
  c0: ['#4e5a6d', '#232a34'], c1: ['#635a41', '#2e2a20'], c2: ['#6a4655', '#33232b'],
  c3: ['#415876', '#1f2836'], c4: ['#3f6456', '#1f2e28'], c5: ['#584a6e', '#2a2436'],
};

/** #rgb → #AARRGGBB (안드로이드 표기) */
function hex(c) {
  const s = String(c).replace('#', '');
  return '#' + (s.length === 3 ? s.split('').map(x => x + x).join('') : s).toUpperCase();
}

/** 두 색을 섞는다 (0=a, 1=b) */
function mix(a, b, t) {
  const p = (c) => {
    const s = hex(c).slice(1);
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  const [ar, ag, ab] = p(a), [br, bg, bb] = p(b);
  const q = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return ('#' + q(ar, br) + q(ag, bg) + q(ab, bb)).toUpperCase();
}

function shape(fill, line, width, corners, comment) {
  return '<?xml version="1.0" encoding="utf-8"?>\n'
    + '<!-- ' + comment + ' -->\n'
    + '<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n'
    + '    <solid android:color="' + hex(fill) + '" />\n'
    + '    <stroke android:width="' + width + 'dp" android:color="' + hex(line) + '" />\n'
    + '    ' + corners + '\n'
    + '</shape>\n';
}

const ALL_R = (r) => '<corners android:radius="' + r + 'dp" />';
const TOP_R = (r) => '<corners android:topLeftRadius="' + r + 'dp" android:topRightRadius="' + r + 'dp" />';
const BR_R = (r) => '<corners android:bottomRightRadius="' + r + 'dp" />';

// [파일 이름, 만드는 법] — v는 그 테마의 색표
const PARTS = [
  ['w_bg',           v => shape(v.bg, v.border, 1, ALL_R(20), '위젯 바탕')],
  ['w_row_bg',       v => shape(v.panel, mix(v.acc, v.panel, 0.55), 1.5, ALL_R(13), '할 일 칸')],
  ['w_row_done_bg',  v => shape(v.card, v.border, 1.5, ALL_R(13), '끝낸 할 일 칸')],
  ['w_side_bg',      v => shape(v.panel, v.border, 1, ALL_R(12), '어제·내일 칸')],
  ['w_dday_bg',      v => shape(v.panel, mix('#E4665F', v.panel, 0.6), 1, ALL_R(13), 'D-day 칸')],
  ['w_tt_frame',     v => shape(v.panel, mix(v.gray, v.border, 0.45), 1.2, ALL_R(9), '시간표 바깥 틀')],
  ['w_tt_headbg',    v => shape(v.card, v.border, 0.8, TOP_R(7), '시간표 머리줄')],
  ['w_tt_empty',     v => shape(v.panel, v.border, 0.6, '', '시간표 빈 칸')],
  ['w_tt_today',     v => shape(mix(v.yellow, v.panel, 0.9), mix(v.yellow, v.border, 0.7), 0.6, '', '오늘 요일 칸')],
  // 머리글의 오늘 칸 — 여기만 노랗게 한다 (몸통까지 칠하면 일정 사이로 비쳐 헷갈린다)
  ['w_tt_todayhead', v => shape(mix(v.yellow, v.card, 0.55), mix(v.yellow, v.border, 0.4), 0.8, TOP_R(6), '머리글의 오늘 요일 칸')],
  ['w_tt_empty_br',  v => shape(v.panel, v.border, 0.6, BR_R(7), '시간표 빈 칸 (오른쪽 아래 끝)')],
  ['w_tt_today_br',  v => shape(mix(v.yellow, v.panel, 0.9), mix(v.yellow, v.border, 0.7), 0.6, BR_R(7), '오늘 요일 칸 (오른쪽 아래 끝)')],
];

/**
 * 시간표 칸 한 조각. 좌우는 늘 테두리, 위아래는 그 칸이 시작·끝인지에 따라.
 * piece: s(혼자) t(위) m(가운데) b(아래)
 */
function blockPiece(line, fill, piece) {
  const top = (piece === 's' || piece === 't') ? 3 : 0;
  const bot = (piece === 's' || piece === 'b') ? 3 : 0;
  const r = (a, b) => '<corners android:topLeftRadius="' + a + 'dp" android:topRightRadius="' + a
    + 'dp" android:bottomLeftRadius="' + b + 'dp" android:bottomRightRadius="' + b + 'dp" />';
  return '<?xml version="1.0" encoding="utf-8"?>\n'
    + '<!-- 시간표 한 조각. 좌우는 늘 테두리, 위아래는 위아래. -->\n'
    + '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n'
    + '    <item android:left="1dp" android:right="1dp">\n'
    + '        <shape android:shape="rectangle">\n'
    + '            <solid android:color="' + hex(line) + '" />\n'
    + '            ' + r(top, bot) + '\n'
    + '        </shape>\n    </item>\n'
    + '    <item android:left="2dp" android:right="2dp" android:top="'
    + (piece === 's' || piece === 't' ? 1 : 0) + 'dp" android:bottom="'
    + (piece === 's' || piece === 'b' ? 1 : 0) + 'dp">\n'
    + '        <shape android:shape="rectangle">\n'
    + '            <solid android:color="' + hex(fill) + '" />\n'
    + '            ' + r(Math.max(0, top - 1), Math.max(0, bot - 1)) + '\n'
    + '        </shape>\n    </item>\n</layer-list>\n';
}

const themes = readThemes();
let n = 0;
for (const th of themes) {
  for (const [name, make] of PARTS) {
    // 기본 테마(white)는 원래 이름 그대로 둔다 — 예전 자료와 미리보기가 쓴다
    const file = (th.id === 'white' ? name : name + '_' + th.id) + '.xml';
    fs.writeFileSync(path.join(DRAWABLE, file), make(th.vars));
    n++;
  }
  // 어두운 테마만 칸 색을 따로 만든다 (밝은 테마는 손으로 만든 w_b_*.xml 을 그대로 쓴다)
  if (!isDark(th.id)) continue;
  for (const key of Object.keys(BLOCK_DARK)) {
    const [line, fill] = BLOCK_DARK[key];
    for (const piece of ['s', 't', 'm', 'b']) {
      fs.writeFileSync(path.join(DRAWABLE, 'w_b_' + key + '_' + piece + '_' + th.id + '.xml'),
                       blockPiece(line, fill, piece));
      n++;
    }
  }
}
console.log('배경 그림 ' + n + '개 (' + themes.map(t => t.id).join(', ') + ')');

// ── 코드에서 고를 수 있게 표를 만들어 둔다 ──
/** 시간표 칸 그림 표 한 벌 (일·쉼·색0~5 × 혼자·위·가운데·아래) */
function blockTable(suffix) {
  const kinds = ['w', 'r', 'c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
  return kinds.map(k =>
    '        { ' + ['s', 't', 'm', 'b'].map(p => 'R.drawable.w_b_' + k + '_' + p + suffix).join(', ') + ' },\n'
  ).join('');
}

const idx = PARTS.map(([name]) => name);
let java = `package com.siwon.nekodesk.mobile;

/**
 * 위젯 배경 테마 — scripts/make-widget-themes.js 가 만든다. 손으로 고치지 말 것.
 *
 * 위젯은 RemoteViews라 색을 그때그때 칠할 수 없어서, 테마마다 배경 그림을
 * 미리 만들어 두고 여기서 골라 쓴다. 색은 앱의 THEMES에서 그대로 가져왔다.
 */
final class WidgetTheme {

    // 배경 그림 자리 번호
`;
idx.forEach((name, i) => {
  java += '    static final int ' + name.toUpperCase().replace(/^W_/, '') + ' = ' + i + ';\n';
});
java += `
    private static final String[] IDS = { ${themes.map(t => '"' + t.id + '"').join(', ')} };

    private static final int[][] SETS = {
`;
for (const th of themes) {
  const suffix = th.id === 'white' ? '' : '_' + th.id;
  java += '        { ' + idx.map(nm => 'R.drawable.' + nm + suffix).join(', ') + ' },\n';
}
java += `    };

    /** 어두운 테마인가 — 시간표 칸을 어두운 그림으로 그린다 */
    private static final boolean[] DARK = { ${themes.map(t => isDark(t.id)).join(', ')} };

    /** 글자 색 — { 본문, 흐린 글씨, 강조 } */
    private static final int[][] TEXT = {
`;
for (const th of themes) {
  const v = th.vars;
  const c = (x) => '0xFF' + hex(x).slice(1);
  java += '        { ' + c(v.white) + ', ' + c(v.gray) + ', ' + c(v.acc) + ' },\n';
}
java += `    };

    private static final int[][] BLK_LIGHT = {
${blockTable('')}    };

    private static final int[][] BLK_DARK = {
${blockTable('_black')}    };


    static int index(String id) {
        for (int i = 0; i < IDS.length; i++) {
            if (IDS[i].equals(id)) return i;
        }
        return 0;                       // 모르는 이름이면 기본(화이트)
    }

    static int bg(int theme, int part) { return SETS[theme][part]; }
    static int text(int theme) { return TEXT[theme][0]; }
    static int dim(int theme) { return TEXT[theme][1]; }
    static int accent(int theme) { return TEXT[theme][2]; }

    /** 어두운 테마인가 — 시간표 칸을 어두운 그림으로 그린다 */
    static boolean dark(int theme) { return DARK[theme]; }

    /** 시간표 칸 그림 — [종류][조각]. 종류는 일·쉼·색0~5, 조각은 혼자·위·가운데·아래 */
    static int[][] blocks(int theme) { return dark(theme) ? BLK_DARK : BLK_LIGHT; }
}
`;
fs.writeFileSync(path.join(JAVA, 'WidgetTheme.java'), java);
console.log('WidgetTheme.java');

// ══════════════════════════════════════════════
// iOS 위젯 색표
//
// iOS는 SwiftUI라 색을 그때그때 칠할 수 있어서 배경 그림은 필요 없지만,
// 색이 안드로이드와 어긋나면 두 위젯 모양이 달라 보인다. 그래서 같은
// THEMES·같은 셈법으로 Swift 표도 여기서 함께 만든다.
// ══════════════════════════════════════════════
const IOS = path.join(ROOT, 'mobile/ios/NekoWidget');

// [이름, 바탕색, 테두리색] — 위 PARTS와 짝이 맞아야 한다
const SWIFT_PARTS = [
  ['bg',          v => [v.bg,    v.border]],
  ['row',         v => [v.panel, mix(v.acc, v.panel, 0.55)]],
  ['rowDone',     v => [v.card,  v.border]],
  ['side',        v => [v.panel, v.border]],
  ['dday',        v => [v.panel, mix('#E4665F', v.panel, 0.6)]],
  ['ttFrame',     v => [v.panel, mix(v.gray, v.border, 0.45)]],
  ['ttHead',      v => [v.card,  v.border]],
  ['ttEmpty',     v => [v.panel, v.border]],
  ['ttTodayHead', v => [mix(v.yellow, v.card, 0.55), mix(v.yellow, v.border, 0.4)]],
];

let swift = `// 위젯 색표 — scripts/make-widget-themes.js 가 만든다. 손으로 고치지 말 것.
//
// 안드로이드 WidgetTheme.java 와 같은 THEMES·같은 셈법에서 나온다.
// 두 위젯이 같은 색으로 보이려면 이 파일을 직접 고치지 말고 생성기를 고칠 것.
import SwiftUI

struct WTheme {
`;
for (const [name] of SWIFT_PARTS) {
  swift += '    let ' + name + ': Color\n';
  swift += '    let ' + name + 'Line: Color\n';
}
swift += `    let text: Color
    let dim: Color
    let accent: Color
    let isDark: Bool
}

let wThemes: [String: WTheme] = [
`;
for (const th of themes) {
  const v = th.vars;
  const c = (x) => 'Color(hex: "' + hex(x) + '")';
  const args = [];
  for (const [name, make] of SWIFT_PARTS) {
    const [fill, line] = make(v);
    args.push('        ' + name + ': ' + c(fill) + ', ' + name + 'Line: ' + c(line));
  }
  args.push('        text: ' + c(v.white) + ', dim: ' + c(v.gray) + ', accent: ' + c(v.acc)
            + ', isDark: ' + (isDark(th.id) ? 'true' : 'false'));
  swift += '    "' + th.id + '": WTheme(\n' + args.join(',\n') + '\n    ),\n';
}
swift += `];

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
`;
fs.writeFileSync(path.join(IOS, 'WidgetTheme.swift'), swift);
console.log('WidgetTheme.swift (iOS)');
