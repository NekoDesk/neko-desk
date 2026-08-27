/**
 * 앱 아이콘을 하얀 배경 + 고등어 고양이로 바꾼다 (MS 스토어와 같게).
 * 원본: cat-images/tabby_s.png
 */
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');

const ROOT = 'D:/NekoDesk/neko-desk-app';
const SRC = path.join(ROOT, 'cat-images', 'tabby_s.png');
const RES = path.join(ROOT, 'mobile/android/app/src/main/res');
const WHITE = 0xffffffff;

// 안드로이드 적응형 아이콘: 108dp 중 가운데 72dp만 확실히 보인다.
// 앞판(foreground)은 투명 배경에 고양이를 그 안에 담는다.
const SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FG = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

async function loadCat() {
  const img = await Jimp.read(SRC);
  let minX = img.bitmap.width, minY = img.bitmap.height, maxX = 0, maxY = 0;
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    if (this.bitmap.data[idx + 3] > 8) {
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  });
  return img.crop(minX, minY, maxX - minX + 1, maxY - minY + 1);
}

/** 정사각 판 가운데에 고양이를 비율 그대로 놓는다 */
function place(canvas, cat, ratio) {
  const size = canvas.bitmap.width;
  const c = cat.clone();
  c.resize(Jimp.AUTO, Math.round(size * ratio));
  if (c.bitmap.width > size * ratio) c.resize(Math.round(size * ratio), Jimp.AUTO);
  canvas.composite(c, Math.round((size - c.bitmap.width) / 2),
                      Math.round((size - c.bitmap.height) / 2));
  return canvas;
}

(async () => {
  const cat = await loadCat();
  console.log('원본 고양이', cat.bitmap.width + 'x' + cat.bitmap.height);

  for (const [dpi, px] of Object.entries(SIZES)) {
    const dir = path.join(RES, 'mipmap-' + dpi);
    fs.mkdirSync(dir, { recursive: true });

    // 옛 방식 아이콘 — 하얀 판에 고양이
    const sq = place(new Jimp(px, px, WHITE), cat, 0.78);
    await sq.writeAsync(path.join(dir, 'ic_launcher.png'));

    // 둥근 아이콘 — 모서리를 원으로 깎는다
    const rd = place(new Jimp(px, px, WHITE), cat, 0.72);
    const r = px / 2;
    rd.scan(0, 0, px, px, function (x, y, idx) {
      const dx = x - r + 0.5, dy = y - r + 0.5;
      if (dx * dx + dy * dy > r * r) this.bitmap.data[idx + 3] = 0;
    });
    await rd.writeAsync(path.join(dir, 'ic_launcher_round.png'));

    // 적응형 아이콘 앞판 — 배경은 흰색 판이 따로 깔린다
    const fgPx = FG[dpi];
    const fg = place(new Jimp(fgPx, fgPx, 0x00000000), cat, 0.46);
    await fg.writeAsync(path.join(dir, 'ic_launcher_foreground.png'));
    console.log('  mipmap-' + dpi, px + 'px / 앞판 ' + fgPx + 'px');
  }

  // 적응형 아이콘 뒷판을 흰색으로
  const colorFile = path.join(RES, 'values', 'ic_launcher_background.xml');
  fs.writeFileSync(colorFile,
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
    '    <color name="ic_launcher_background">#FFFFFF</color>\n</resources>\n');
  console.log('  뒷판 색 #FFFFFF');
})();
