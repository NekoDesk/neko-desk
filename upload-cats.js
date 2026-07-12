// ═══════════════════════════════════════════════
// NEKO DESK — 고양이 이미지 일괄 업로드 스크립트
//
// 사용법:
//   node upload-cats.js
//
// cat-images/ 폴더에 이미 처리된 투명 PNG를 넣어두면 그대로 업로드
// ═══════════════════════════════════════════════
const fs   = require('fs');
const path = require('path');
const cfg  = require('./config.js');

const EDGE_URL  = cfg.SUPABASE_URL + '/functions/v1/manage-cat-breeds';
const ADMIN_KEY = cfg.ADMIN_API_SECRET;
const CATS_DIR  = path.join(__dirname, 'cat-images');

const BREEDS = [
  { name: '흰냥이',  desc: '우아하고 도도한',     front: 'white_f.png', side: 'white_s.png'  },
  { name: '고등어',  desc: '활발하고 호기심 많은', front: 'tabby_f.png', side: 'tabby_s.png'  },
  { name: '까망이',  desc: '신비롭고 매력적인',    front: 'black_f.png', side: 'black_s.png'  },
  { name: '분홍이',  desc: '사랑스럽고 달콤한',    front: 'pink_f.png',  side: 'pink_s.png'   },
];

async function callEdge(action, body) {
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) { const txt = await res.text(); throw new Error(`HTTP ${res.status}: ${txt}`); }
  return res.json();
}

function toBase64(filePath) {
  const data = fs.readFileSync(filePath);
  return `data:image/png;base64,${data.toString('base64')}`;
}

async function main() {
  if (!fs.existsSync(CATS_DIR)) {
    console.error(`❌ 폴더 없음: ${CATS_DIR}`);
    process.exit(1);
  }

  console.log('🗑  기존 고양이 데이터 삭제 중...');
  try {
    const delRes = await callEdge('delete-all', {});
    console.log(`   삭제된 파일: ${delRes.deleted ?? 0}개`);
  } catch (e) {
    console.error('   삭제 실패:', e.message); process.exit(1);
  }

  let success = 0;
  for (const breed of BREEDS) {
    const frontPath = path.join(CATS_DIR, breed.front);
    const sidePath  = path.join(CATS_DIR, breed.side);
    if (!fs.existsSync(frontPath)) { console.warn(`⚠️  F 이미지 없음: ${breed.front}`); continue; }

    process.stdout.write(`📤 ${breed.name} 업로드 중... `);
    try {
      const imgBase64Front = toBase64(frontPath);
      const imgBase64Side  = fs.existsSync(sidePath) ? toBase64(sidePath) : null;

      const res = await callEdge('add', { name: breed.name, desc: breed.desc, imgBase64Front, imgBase64Side });
      if (res.ok) { console.log(`✅  (id: ${res.breed?.id})`); success++; }
      else          console.log(`❌  ${res.error}`);
    } catch (e) {
      console.log(`❌  ${e.message}`);
    }
  }

  console.log(`\n🎉 완료! ${success}/${BREEDS.length}개 등록`);
}

main().catch(e => { console.error(e); process.exit(1); });
