// ═══════════════════════════════════════════════
// NEKO DESK — Page 토큰 추출 헬퍼 (일회성 실행용)
//
// 사용법:
//   node scripts/get-page-token.js
//
// 목적:
//   config.js의 User 장기 토큰(INSTAGRAM_ACCESS_TOKEN)으로
//   연결된 Facebook 페이지의 Page 토큰(만료 없음)과 IG User ID를 출력.
//   출력된 Page 토큰을 supabase secrets에 등록하면 돼.
//
// 주의:
//   이 스크립트는 서버에 배포하지 말 것. 로컬에서만 실행.
// ═══════════════════════════════════════════════
const cfg = require('../config.js');

const USER_TOKEN = cfg.INSTAGRAM_ACCESS_TOKEN;
const API = 'https://graph.facebook.com/v25.0';

if (!USER_TOKEN) {
  console.error('❌ config.js에 INSTAGRAM_ACCESS_TOKEN이 없어요.');
  process.exit(1);
}

async function main() {
  console.log('🔍 Facebook 페이지 목록 조회 중...\n');

  const res = await fetch(
    `${API}/me/accounts?fields=name,access_token,instagram_business_account&access_token=${USER_TOKEN}`
  );
  const data = await res.json();

  if (data.error) {
    console.error('❌ API 오류:', data.error.message);
    console.error('   code:', data.error.code);
    process.exit(1);
  }

  if (!data.data || !data.data.length) {
    console.error('❌ 연결된 Facebook 페이지가 없어요.');
    console.error('   Instagram → 계정 센터에서 Facebook 페이지를 연결했는지 확인하세요.');
    process.exit(1);
  }

  console.log(`📄 발견된 페이지 수: ${data.data.length}\n`);

  for (const page of data.data) {
    const igId = page.instagram_business_account?.id || '(없음)';
    console.log(`─────────────────────────────────────`);
    console.log(`페이지 이름 : ${page.name}`);
    console.log(`페이지 ID   : ${page.id}`);
    console.log(`IG User ID  : ${igId}`);
    console.log(`Page 토큰   : ${page.access_token}`);
  }

  console.log(`\n─────────────────────────────────────`);
  console.log('✅ 위 Page 토큰을 아래 명령으로 Supabase secrets에 등록하세요:\n');
  const target = data.data.find(p => p.instagram_business_account?.id) || data.data[0];
  const igId = target.instagram_business_account?.id || '여기에_IG_USER_ID';
  console.log(`supabase secrets set IG_PAGE_TOKEN="${target.access_token}" IG_USER_ID="${igId}"`);
  console.log('');
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
