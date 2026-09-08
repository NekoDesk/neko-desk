#!/usr/bin/env node
/**
 * 버전을 한 번에 올린다.  node scripts/bump-version.js 3.0.2
 *
 * 버전이 적힌 곳이 네 군데라 손으로 고치면 꼭 하나가 빠진다.
 * 실제로 iOS 는 1.0 에 머문 채로 여러 번 배포돼서, 어느 스토어에 무엇이
 * 올라갔는지 알 수 없었다.
 *
 *   package.json          윈도우 설치본 · MS 스토어 · Mac  (셋 다 ${version} 참조)
 *   build.gradle          안드로이드 versionName + versionCode(자동 +1)
 *   project.pbxproj       iOS MARKETING_VERSION
 *   add-ios-widget-target.rb  위젯 타겟 MARKETING_VERSION
 *
 * versionCode 는 보이는 버전과 따로 논다. 구글은 "이전보다 큰 수"만 받으므로
 * 같은 3.0.2 를 다시 올리더라도 이 수는 반드시 올라가야 한다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const version = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('쓰는 법: node scripts/bump-version.js 3.0.2');
  process.exit(1);
}

/** 파일에서 정규식 한 곳을 바꾼다. 못 찾으면 멈춘다 — 조용히 빠뜨리지 않도록. */
function edit(rel, re, make) {
  const file = path.join(ROOT, rel);
  const before = fs.readFileSync(file, 'utf8');
  if (!re.test(before)) {
    console.error(`실패: ${rel} 에서 ${re} 를 찾지 못했습니다`);
    process.exit(1);
  }
  const after = before.replace(re, make);
  if (after !== before) fs.writeFileSync(file, after);
  return { rel, changed: after !== before };
}

const done = [];

done.push(edit('package.json', /"version":\s*"[^"]+"/, `"version": "${version}"`));

// versionCode 는 현재 값을 읽어 +1 한다
const gradleRel = 'mobile/android/app/build.gradle';
const gradle = fs.readFileSync(path.join(ROOT, gradleRel), 'utf8');
const codeM = /versionCode\s+(\d+)/.exec(gradle);
if (!codeM) {
  console.error(`실패: ${gradleRel} 에서 versionCode 를 찾지 못했습니다`);
  process.exit(1);
}
const nextCode = Number(codeM[1]) + 1;
done.push(edit(gradleRel, /versionCode\s+\d+/, `versionCode ${nextCode}`));
done.push(edit(gradleRel, /versionName\s+"[^"]+"/, `versionName "${version}"`));

done.push(edit('mobile/ios/App/App.xcodeproj/project.pbxproj',
               /MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`));

done.push(edit('scripts/add-ios-widget-target.rb',
               /(s\['MARKETING_VERSION'\]\s*=\s*)'[^']*'/, `$1'${version}'`));

console.log(`버전 ${version} (안드로이드 versionCode ${nextCode})`);
done.forEach(d => console.log(`  ${d.changed ? '고침' : '그대로'}  ${d.rel}`));
console.log('\n다음: git commit 후  git tag v' + version + ' && git push origin v' + version);
