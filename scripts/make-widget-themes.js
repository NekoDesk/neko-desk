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
  const seg = html.slice(at, at + 8000);
  const out = [];
  const re = /\{ id:'(\w+)',[\s\S]*?vars:\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(seg)) && out.length < 6) {
    const vars = {};
    let v;
    const vre = /'--([\w-]+)':'([^']+)'/g;
    while ((v = vre.exec(m[2]))) vars[v[1]] = v[2];
    out.push({ id: m[1], vars });
  }
  if (out.length !== 6) throw new Error('테마를 6개 읽지 못했습니다 (' + out.length + ')');
  return out;
}

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
  ['w_tt_empty_br',  v => shape(v.panel, v.border, 0.6, BR_R(7), '시간표 빈 칸 (오른쪽 아래 끝)')],
  ['w_tt_today_br',  v => shape(mix(v.yellow, v.panel, 0.9), mix(v.yellow, v.border, 0.7), 0.6, BR_R(7), '오늘 요일 칸 (오른쪽 아래 끝)')],
];

const themes = readThemes();
let n = 0;
for (const th of themes) {
  for (const [name, make] of PARTS) {
    // 기본 테마(white)는 원래 이름 그대로 둔다 — 예전 자료와 미리보기가 쓴다
    const file = (th.id === 'white' ? name : name + '_' + th.id) + '.xml';
    fs.writeFileSync(path.join(DRAWABLE, file), make(th.vars));
    n++;
  }
}
console.log('배경 그림 ' + n + '개 (' + themes.map(t => t.id).join(', ') + ')');

// ── 코드에서 고를 수 있게 표를 만들어 둔다 ──
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

    /** 글자 색 — { 본문, 흐린 글씨, 강조 } */
    private static final int[][] TEXT = {
`;
for (const th of themes) {
  const v = th.vars;
  const c = (x) => '0xFF' + hex(x).slice(1);
  java += '        { ' + c(v.white) + ', ' + c(v.gray) + ', ' + c(v.acc) + ' },\n';
}
java += `    };

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
}
`;
fs.writeFileSync(path.join(JAVA, 'WidgetTheme.java'), java);
console.log('WidgetTheme.java');
