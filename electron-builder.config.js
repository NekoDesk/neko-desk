// electron-builder 설정 — package.json의 "build"를 그대로 쓰고 훅만 얹는다.
//
// 왜 별도 파일이 필요한가:
//   appx 매니페스트 템플릿의 <Capabilities>가 runFullTrust 하나로 고정돼 있고
//   electron-builder에 capability를 추가하는 옵션이 없다. customExtensionsPath는
//   <Extensions>에만 들어가므로 쓸 수 없다. 매니페스트가 만들어진 직후에
//   직접 끼워 넣는 appxManifestCreated 훅이 유일한 방법이다.
const fs = require('fs');
const base = require('./package.json').build;

module.exports = {
  ...base,

  /**
   * 포토부스가 카메라를 쓰므로 webcam 장치 기능을 선언한다.
   * 빠지면 패키지 앱의 카메라 접근이 차단돼 사진 기능이 배포판에서만 동작하지 않는다.
   * @param {string} manifestPath 생성된 AppxManifest.xml 경로
   */
  appxManifestCreated: async (manifestPath) => {
    let xml = fs.readFileSync(manifestPath, 'utf8');
    if (xml.includes('DeviceCapability Name="webcam"')) return;
    xml = xml.replace(
      '</Capabilities>',
      '  <DeviceCapability Name="webcam"/>\n  </Capabilities>'
    );
    fs.writeFileSync(manifestPath, xml, 'utf8');
    console.log('  • AppxManifest: webcam DeviceCapability 추가됨');
  },
};
