// ═══════════════════════════════════════════════
// NEKO DESK — 상품 삭제 스크립트 (관리자 로컬 전용)
//
// 사용법:
//   node scripts/delete-product.js --id 42
//
// ID를 모를 경우 Supabase 대시보드 → products 테이블에서 확인.
// config.admin.example.js를 복사해서 config.admin.js 만들고 값 채우기.
// ═══════════════════════════════════════════════
const cfg = require('../config.admin.js');

const SUPABASE_URL = cfg.SUPABASE_URL;
const ADMIN_KEY    = cfg.ADMIN_API_SECRET;
if (!SUPABASE_URL) { console.error('❌ config.admin.js에 SUPABASE_URL이 없습니다.'); process.exit(1); }
if (!ADMIN_KEY || ADMIN_KEY.includes('YOUR_ADMIN')) { console.error('❌ config.admin.js에 ADMIN_API_SECRET을 입력하세요.'); process.exit(1); }

const argv = process.argv.slice(2);
const get  = (flag) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : null; };

const idStr = get('--id');
const id    = parseInt(idStr || '', 10);
if (!idStr || isNaN(id)) {
  console.error('❌ --id 가 필요합니다.  예) node scripts/delete-product.js --id 42');
  process.exit(1);
}

async function main() {
  console.log(`\n🗑  상품 ID ${id} 삭제 중...`);

  const res  = await fetch(`${SUPABASE_URL}/functions/v1/manage-products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: JSON.stringify({ action: 'delete', id }),
  });
  const data = await res.json();

  if (data.ok) {
    console.log(`✅ 삭제 완료! (상품 ID: ${id})`);
  } else {
    console.error(`❌ 삭제 실패: ${data.error}`);
    process.exit(1);
  }
}

main().catch(err => { console.error('❌ 오류:', err.message); process.exit(1); });