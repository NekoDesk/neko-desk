// ═══════════════════════════════════════════════
// prepare-www.js — 데스크톱 renderer를 모바일 www로 복사
//   renderer/index.html → www/app.html (mobile-bridge.js 주입)
//   renderer 코드는 절대 수정하지 않음 (단일 소스 유지)
// ═══════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RENDERER = path.join(ROOT, '..', 'renderer', 'index.html');
const WWW = path.join(ROOT, 'www');
const OUT = path.join(WWW, 'app.html');

let html = fs.readFileSync(RENDERER, 'utf8');

// mobile-bridge.js를 <head> 최상단에 주입 (본문 스크립트보다 먼저 실행)
const INJECT = '<script src="mobile-bridge.js"></script>';
if (!html.includes('</title>')) {
  throw new Error('renderer/index.html에서 </title>을 찾지 못했습니다');
}
html = html.replace('</title>', '</title>\n' + INJECT);

fs.writeFileSync(OUT, html);
console.log('OK: www/app.html (' + Math.round(html.length / 1024) + ' KB)');

// renderer가 파일 이름으로 직접 불러오는 그림들도 함께 옮긴다.
// (예: 포토부스의 냥냥이 배경 bg-cats.png — 없으면 모바일에서만 안 뜬다)
const RDIR = path.join(ROOT, '..', 'renderer');
const IMG = /\.(png|jpe?g|gif|webp|svg)$/i;
for (const name of fs.readdirSync(RDIR)) {
  if (!IMG.test(name)) continue;
  const src = path.join(RDIR, name);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, path.join(WWW, name));
  console.log('OK: www/' + name + ' (' + Math.round(fs.statSync(src).size / 1024) + ' KB)');
}

// 소리 파일 (알람). 데스크톱은 renderer/ 옆의 assets/ 를 쓰지만
// 모바일 www 는 한 겹 얕아서 www/assets/ 로 옮겨 둔다.
const SND_SRC = path.join(ROOT, '..', 'assets', 'sound');
const SND_OUT = path.join(WWW, 'assets', 'sound');
if (fs.existsSync(SND_SRC)) {
  fs.mkdirSync(SND_OUT, { recursive: true });
  for (const name of fs.readdirSync(SND_SRC)) {
    const src = path.join(SND_SRC, name);
    if (!fs.statSync(src).isFile()) continue;
    fs.copyFileSync(src, path.join(SND_OUT, name));
    console.log('OK: www/assets/sound/' + name + ' (' + Math.round(fs.statSync(src).size / 1024) + ' KB)');
  }
}