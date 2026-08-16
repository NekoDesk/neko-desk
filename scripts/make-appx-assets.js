// MSIX(AppX) 타일 이미지 생성 — assets/icon.png(360x480) → assets/appx/*.png
//
// electron-builder는 buildResources/appx/ 안에서 아래 4개를 찾고, 없으면
// 벤더 기본 이미지(회색 사각형)를 씁니다. 스토어 등록 화면과 시작 메뉴에
// 그대로 노출되므로 직접 만들어 둡니다.
//
//   node scripts/make-appx-assets.js
//
// 배율(.scale-200 등) 변형은 만들지 않습니다. 그걸 넣으면 electron-builder가
// makepri.exe 단계를 추가로 돌리는데, 지금 규모에서는 얻는 게 없습니다.
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');

const SRC = path.join(__dirname, '..', 'assets', 'icon.png');
const OUT = path.join(__dirname, '..', 'assets', 'appx');

// [파일명, 가로, 세로] — 이름은 electron-builder가 정확히 이 철자로 찾습니다
const TARGETS = [
  ['Square44x44Logo.png', 44, 44],
  ['Square150x150Logo.png', 150, 150],
  ['StoreLogo.png', 50, 50],
  ['Wide310x150Logo.png', 310, 150],
];

// 타일 가장자리에 딱 붙지 않도록 여백을 둔다 (원본 높이 기준 비율)
const FILL = 0.86;

async function main() {
  if (!fs.existsSync(SRC)) throw new Error('원본 아이콘 없음: ' + SRC);
  fs.mkdirSync(OUT, { recursive: true });

  for (const [name, w, h] of TARGETS) {
    const src = await Jimp.read(SRC);
    // 투명 배경 — 타일 배경색(appx.backgroundColor)이 뒤에서 비치도록
    const canvas = new Jimp(w, h, 0x00000000);
    const box = Math.round(Math.min(w, h) * FILL);
    src.scaleToFit(box, box);
    canvas.composite(src, Math.round((w - src.bitmap.width) / 2),
                          Math.round((h - src.bitmap.height) / 2));
    await canvas.writeAsync(path.join(OUT, name));
    console.log('생성:', name, w + 'x' + h);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
