// ═══════════════════════════════════════════════
// NEKO DESK — 관리자 전용 설정 (로컬 전용, 절대 커밋 금지)
//
// 사용법:
//   1. 이 파일을 config.admin.js 로 복사
//   2. ADMIN_API_SECRET에 실제 키 입력
//   3. node scripts/add-product.js ... 등 실행
//
// 이 파일(config.admin.example.js)은 커밋 가능한 템플릿.
// config.admin.js 는 .gitignore에 포함 → 절대 커밋 안 됨.
// ═══════════════════════════════════════════════
module.exports = {
  SUPABASE_URL: 'https://hzfjdutqsjvrwmmggrxd.supabase.co',
  ADMIN_API_SECRET: 'YOUR_ADMIN_API_SECRET_HERE',
};
