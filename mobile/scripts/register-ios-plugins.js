// ═══════════════════════════════════════════════
// register-ios-plugins.js — 앱 안에 직접 넣은 Capacitor 플러그인을 등록한다
//
// Capacitor 6부터 iOS는 플러그인을 런타임에 훑어서 찾지 않는다.
// 번들에 실린 capacitor.config.json의 packageClassList에 적힌 클래스만
// 등록한다 (CapacitorBridge.registerPlugins).
//
// 그런데 `npx cap sync ios`는 node_modules의 플러그인 pod만 그 목록에 넣는다.
// 그래서 App 타겟 안에 직접 쓴 NekoWidgetPlugin은 컴파일은 되지만 등록이 안 돼,
// 웹에서 부르면 조용히 실패한다 → 위젯이 언제나 "앱을 열어 동기화" 상태.
// (안드로이드는 MainActivity에서 registerPlugin()으로 손수 등록해 두어 잘 됐다)
//
// 이 스크립트는 cap sync 뒤에 돌려서 그 목록을 되살린다.
// ═══════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const NATIVE_DIR = path.join(__dirname, '..', 'ios', 'App', 'App');
const CONFIG = path.join(NATIVE_DIR, 'capacitor.config.json');

if (!fs.existsSync(CONFIG)) {
  throw new Error('capacitor.config.json이 없습니다 — `npx cap sync ios`를 먼저 돌리세요: ' + CONFIG);
}

// App 타겟 안의 Swift 파일에서 @objc(XxxPlugin) 이름을 뽑는다.
// CAPPlugin을 물려받은 것만 — AppDelegate 같은 건 걸리지 않게.
const found = [];
for (const name of fs.readdirSync(NATIVE_DIR)) {
  if (!name.endsWith('.swift')) continue;
  const src = fs.readFileSync(path.join(NATIVE_DIR, name), 'utf8');
  if (!/:\s*CAPPlugin\b/.test(src)) continue;
  const m = /@objc\(([A-Za-z0-9_]+)\)/.exec(src);
  if (m && !found.includes(m[1])) found.push(m[1]);
}

if (!found.length) {
  console.log('앱 안에 든 플러그인 없음 — 건너뜁니다');
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const list = Array.isArray(cfg.packageClassList) ? cfg.packageClassList : [];
const added = found.filter((c) => !list.includes(c));

if (!added.length) {
  console.log('OK: packageClassList에 이미 있음 (' + found.join(', ') + ')');
  process.exit(0);
}

cfg.packageClassList = list.concat(added);
fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, '\t') + '\n');
console.log('OK: packageClassList에 추가 — ' + added.join(', '));
