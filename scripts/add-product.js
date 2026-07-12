// ═══════════════════════════════════════════════
// NEKO DESK — 상품 등록 스크립트 (관리자 로컬 전용)
//
// 사용법:
//   node scripts/add-product.js \
//     --name "상품명" \
//     --price 15000 \
//     --link "https://..." \
//     [--desc "한줄설명"] \
//     [--cat office|health|living|beauty|fitness] \
//     [--img ./product.jpg]
//
// 실행 전 config.admin.js에 SUPABASE_URL, ADMIN_API_SECRET이 있어야 함.
// config.admin.example.js를 복사해서 config.admin.js 만들고 값 채우기.
// ═══════════════════════════════════════════════
const fs   = require('fs');
const path = require('path');
const cfg  = require('../config.admin.js');

// ── 설정 검증
const SUPABASE_URL = cfg.SUPABASE_URL;
const ADMIN_KEY    = cfg.ADMIN_API_SECRET;
if (!SUPABASE_URL) { console.error('❌ config.admin.js에 SUPABASE_URL이 없습니다.'); process.exit(1); }
if (!ADMIN_KEY || ADMIN_KEY.includes('YOUR_ADMIN')) { console.error('❌ config.admin.js에 ADMIN_API_SECRET을 입력하세요.'); process.exit(1); }

// ── 인수 파싱
const argv = process.argv.slice(2);
const get  = (flag) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : null; };

const name    = get('--name');
const price   = parseInt(get('--price') || '0', 10);
const link    = get('--link');
const desc    = get('--desc');
const cat     = get('--cat') || 'office';
const imgPath = get('--img');

if (!name)           { console.error('❌ --name 이 필요합니다.  예) --name "젤리 쿠션"'); process.exit(1); }
if (!price || price < 1) { console.error('❌ --price 가 필요합니다. 예) --price 15000'); process.exit(1); }
if (!link)           { console.error('❌ --link 가 필요합니다.  예) --link "https://shop.example.com/product/1"'); process.exit(1); }
if (!/^https?:\/\//.test(link)) { console.error('❌ --link 는 http:// 또는 https:// 로 시작해야 합니다.'); process.exit(1); }

const CATS = ['office', 'health', 'living', 'beauty', 'fitness'];
if (!CATS.includes(cat)) { console.error(`❌ --cat 은 다음 중 하나여야 합니다: ${CATS.join(', ')}`); process.exit(1); }

// ── 이미지 → base64
let imgBase64 = null;
if (imgPath) {
  const absPath = path.resolve(imgPath);
  if (!fs.existsSync(absPath)) { console.error(`❌ 이미지 파일을 찾을 수 없습니다: ${absPath}`); process.exit(1); }
  const ext  = path.extname(absPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  imgBase64  = `data:${mime};base64,${fs.readFileSync(absPath).toString('base64')}`;
}

// ── 등록 요청
async function main() {
  console.log(`\n📦 상품 등록 중...`);
  console.log(`   이름: ${name}`);
  console.log(`   가격: ${price.toLocaleString()}원`);
  console.log(`   링크: ${link}`);
  if (desc)    console.log(`   설명: ${desc}`);
  console.log(`   카테고리: ${cat}`);
  if (imgPath) console.log(`   이미지: ${imgPath}`);
  console.log('');

  const res  = await fetch(`${SUPABASE_URL}/functions/v1/manage-products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: JSON.stringify({ action: 'add', name, price, link, desc: desc || null, cat, imgBase64 }),
  });
  const data = await res.json();

  if (data.ok) {
    console.log(`✅ 등록 완료! ID: ${data.product?.id}`);
    if (data.product?.img_url) console.log(`   이미지: ${data.product.img_url}`);
  } else {
    console.error(`❌ 등록 실패: ${data.error}`);
    process.exit(1);
  }
}

main().catch(err => { console.error('❌ 오류:', err.message); process.exit(1); });