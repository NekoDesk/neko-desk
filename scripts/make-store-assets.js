/**
 * 스토어 제출용 그림을 만든다.
 *
 *   node scripts/make-store-assets.js
 *
 * - 안드로이드 앱 아이콘 (기본 캐패시터 아이콘을 고양이로 교체)
 * - 구글 플레이 스토어 아이콘 512x512
 * - 구글 플레이 그래픽 이미지 1024x500
 *
 * 원본은 assets/icon-mac.png (1024x1024, 배경 투명한 흰 고양이).
 * 고양이가 밝은 색이라 어두운 앱 바탕색을 깔아야 보인다.
 */
const path = require('path');
const fs = require('fs');
const Jimp = require('jimp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icon-mac.png');
const RES = path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res');
const OUT = path.join(ROOT, 'play-submit');

// 앱 테마색 (renderer/index.html 의 --bg, --panel, --yellow)
const BG = 0x1a1a2eff;
const PANEL = 0x16213eff;
const YELLOW = 0xffd369ff;

/** 투명한 여백을 잘라내 고양이만 남긴다 */
async function loadCat() {
  const img = await Jimp.read(SRC);
  let minX = img.bitmap.width, minY = img.bitmap.height, maxX = 0, maxY = 0;
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    if (this.bitmap.data[idx + 3] > 8) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  });
  return img.crop(minX, minY, maxX - minX + 1, maxY - minY + 1);
}

/** 정사각 판 위에 고양이를 비율 그대로 가운데 놓는다 */
function place(canvas, cat, ratio) {
  const size = Math.min(canvas.bitmap.width, canvas.bitmap.height);
  const c = cat.clone();
  // 고양이는 세로로 긴 그림이라 높이를 기준으로 맞춘다
  c.resize(Jimp.AUTO, Math.round(size * ratio));
  if (c.bitmap.width > canvas.bitmap.width * ratio) {
    c.resize(Math.round(canvas.bitmap.width * ratio), Jimp.AUTO);
  }
  canvas.composite(c,
    Math.round((canvas.bitmap.width - c.bitmap.width) / 2),
    Math.round((canvas.bitmap.height - c.bitmap.height) / 2));
  return canvas;
}

/** 원 밖을 지운다 (둥근 아이콘용) */
function circleMask(img) {
  const w = img.bitmap.width, h = img.bitmap.height;
  const cx = w / 2, cy = h / 2, r = Math.min(cx, cy);
  img.scan(0, 0, w, h, function (x, y, idx) {
    const dx = x - cx + 0.5, dy = y - cy + 0.5;
    if (dx * dx + dy * dy > r * r) this.bitmap.data[idx + 3] = 0;
  });
  return img;
}

async function main() {
  const cat = await loadCat();
  console.log('고양이 원본:', cat.bitmap.width + 'x' + cat.bitmap.height);

  // ── 1. 안드로이드 앱 아이콘 ──
  // 적응형 아이콘의 앞면은 108dp 판인데 가운데 72dp만 항상 보인다.
  // 런처가 어떤 모양으로 잘라도 고양이가 안 잘리게 작게 넣는다.
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, scale] of Object.entries(dens)) {
    const dir = path.join(RES, 'mipmap-' + d);
    if (!fs.existsSync(dir)) continue;

    const fg = Math.round(108 * scale);
    await place(new Jimp(fg, fg, 0x00000000), cat, 0.52)
      .writeAsync(path.join(dir, 'ic_launcher_foreground.png'));

    const legacy = Math.round(48 * scale);
    const sq = place(new Jimp(legacy, legacy, BG), cat, 0.7);
    await sq.clone().writeAsync(path.join(dir, 'ic_launcher.png'));
    await circleMask(sq.clone()).writeAsync(path.join(dir, 'ic_launcher_round.png'));
    console.log('  아이콘', d, '앞면 ' + fg + ', 기본 ' + legacy);
  }

  // 적응형 아이콘 뒷배경도 앱 바탕색으로
  const bgXml = path.join(RES, 'values', 'ic_launcher_background.xml');
  fs.writeFileSync(bgXml,
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' +
    '    <color name="ic_launcher_background">#1A1A2E</color>\n</resources>\n', 'utf8');
  console.log('  적응형 아이콘 뒷배경 -> #1A1A2E');

  fs.mkdirSync(OUT, { recursive: true });

  // ── 2. 플레이 스토어 아이콘 512x512 ──
  await place(new Jimp(512, 512, BG), cat, 0.72)
    .writeAsync(path.join(OUT, 'play-icon-512.png'));
  console.log('플레이 아이콘 512x512');

  // ── 3. 그래픽 이미지 1024x500 ──
  const g = new Jimp(1024, 500, BG);
  // 위에서 아래로 아주 옅은 그러데이션
  g.scan(0, 0, 1024, 500, function (x, y, idx) {
    const t = y / 500;
    const a = Jimp.intToRGBA(BG), b = Jimp.intToRGBA(PANEL);
    this.bitmap.data[idx] = Math.round(a.r + (b.r - a.r) * t);
    this.bitmap.data[idx + 1] = Math.round(a.g + (b.g - a.g) * t);
    this.bitmap.data[idx + 2] = Math.round(a.b + (b.b - a.b) * t);
  });

  const c = cat.clone().resize(Jimp.AUTO, 340);
  g.composite(c, 110, Math.round((500 - 340) / 2));

  const f64 = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const f32 = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const textX = 110 + c.bitmap.width + 70;
  g.print(f64, textX, 190, 'NEKO DESK');
  g.print(f32, textX + 4, 268, 'a cat on your desk, and your day');

  // 아래쪽에 포인트 색 띠 하나
  g.scan(0, 494, 1024, 6, function (x, y, idx) {
    const p = Jimp.intToRGBA(YELLOW);
    this.bitmap.data[idx] = p.r;
    this.bitmap.data[idx + 1] = p.g;
    this.bitmap.data[idx + 2] = p.b;
  });

  await g.writeAsync(path.join(OUT, 'play-feature-1024x500.png'));
  console.log('그래픽 이미지 1024x500');
}

main().catch((e) => { console.error(e); process.exit(1); });
