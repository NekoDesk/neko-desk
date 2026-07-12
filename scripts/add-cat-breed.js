// ═══════════════════════════════════════════════
// NEKO DESK — 고양이 종류 등록 스크립트 (관리자 로컬 전용)
//
// 사용법:
//   node scripts/add-cat-breed.js \
//     --name "러시안블루" \
//     --front ./cat_front.png \
//     [--side ./cat_side.png] \
//     [--desc "포근한 러시안 블루"]
//
// 이미지는 투명 배경 PNG 권장 (360×480 기준).
// config.admin.example.js를 복사해서 config.admin.js 만들고 값 채우기.
// ═══════════════════════════════════════════════
const fs   = require('fs');
const path = require('path');
const cfg  = require('../config.admin.js');

const SUPABASE_URL = cfg.SUPABASE_URL;
const ADMIN_KEY    = cfg.ADMIN_API_SECRET;
if (!SUPABASE_URL) { console.error('❌ config.admin.js에 SUPABASE_URL이 없습니다.'); process.exit(1); }
if (!ADMIN_KEY || ADMIN_KEY.includes('YOUR_ADMIN')) { console.error('❌ config.admin.js에 ADMIN_API_SECRET을 입력하세요.'); process.exit(1); }

const argv     = process.argv.slice(2);
const get      = (flag) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : null; };

const name      = get('--name');
const desc      = get('--desc');
const frontPath = get('--front');
const sidePath  = get('--side');

if (!name)      { console.error('❌ --name 이 필요합니다.   예) --name "러시안블루"'); process.exit(1); }
if (!frontPath) { console.error('❌ --front 가 필요합니다.  예) --front ./cat_front.png'); process.exit(1); }

const toBase64 = (filePath) => {
  const abs  = path.resolve(filePath);
  if (!fs.existsSync(abs)) { console.error(`❌ 파일을 찾을 수 없습니다: ${abs}`); process.exit(1); }
  const ext  = path.extname(abs).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
};

const imgBase64Front = toBase64(frontPath);
const imgBase64Side  = sidePath ? toBase64(sidePath) : null;

async function main() {
  console.log(`\n🐱 고양이 등록 중...`);
  console.log(`   이름: ${name}`);
  if (desc)     console.log(`   설명: ${desc}`);
  console.log(`   앞모습: ${frontPath}`);
  if (sidePath) console.log(`   옆모습: ${sidePath}`);
  console.log('');

  const res  = await fetch(`${SUPABASE_URL}/functions/v1/manage-cat-breeds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: JSON.stringify({ action: 'add', name, desc: desc || null, imgBase64Front, imgBase64Side }),
  });
  const data = await res.json();

  if (data.ok) {
    console.log(`✅ 등록 완료! ID: ${data.breed?.id}`);
    if (data.breed?.image_url) console.log(`   앞모습 URL: ${data.breed.image_url}`);
    if (data.breed?.image_url_side) console.log(`   옆모습 URL: ${data.breed.image_url_side}`);
  } else {
    console.error(`❌ 등록 실패: ${data.error}`);
    process.exit(1);
  }
}

main().catch(err => { console.error('❌ 오류:', err.message); process.exit(1); });