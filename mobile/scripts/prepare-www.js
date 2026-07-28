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