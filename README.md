# 🐱 NEKO DESK - 데스크탑 앱

고양이 친구와 함께하는 번아웃 방지 데스크탑 위젯.

## 📦 빠른 시작 (3단계)

### 1. Node.js 설치 (한 번만)
- https://nodejs.org 에서 **LTS** 버전 다운로드 후 설치
- 설치 확인: 터미널/PowerShell 열고 `node --version` 입력해서 버전 나오면 OK

### 2. 의존성 설치
이 폴더를 터미널로 열고 (또는 폴더에서 Shift+우클릭 → "여기에 PowerShell 창 열기"):
```bash
npm install
```
처음에 2~3분 걸려요 (Electron 다운로드).

### 3. 실행

**개발 모드로 실행 (테스트):**
```bash
npm start
```

**배포용 exe 만들기 (Windows):**
```bash
npm run build:win
```
완료되면 `dist/` 폴더에 **NEKO DESK Setup 1.1.0.exe** 가 생겨요. 이걸 다른 사람한테 보내거나 배포하면 됩니다.

**Mac용 dmg 만들기:**
```bash
npm run build:mac
```

---

## 🎮 사용법

- **위젯**: 화면 모서리에 떠있는 작은 고양이. 마우스로 잡고 드래그 가능.
- **클릭**: 위젯 클릭 시 대시보드 열림 (창 자동 확장).
- **닫기**: 대시보드 우상단 X 버튼 → 다시 위젯 모드로.
- **트레이**: 우하단 알림 영역에 고양이 아이콘. 우클릭으로 메뉴.
- **단축키**: `Ctrl + 0` — 위젯 표시/숨김 토글.
- **종료**: 트레이 아이콘 우클릭 → 종료. (창 닫기로는 안 꺼짐, 백그라운드 유지)

## 📁 폴더 구조

```
neko-desk-app/
├── main.js              # Electron 메인 프로세스 (창 관리, 트레이)
├── preload.js           # 보안 브릿지 (렌더러 ↔ 메인)
├── package.json         # 빌드 설정
├── renderer/
│   └── index.html       # 앱 UI (모든 기능)
└── assets/
    ├── icon.png         # 앱 아이콘 (Linux)
    ├── icon.ico         # 앱 아이콘 (Windows)
    └── tray-icon.png    # 트레이 아이콘
```

## 🔐 구글 로그인 설정 (필수)

앱을 사용하려면 구글 로그인이 필요해요. 배포 전에 한 번만 설정:

1. https://console.cloud.google.com → 새 프로젝트 생성
2. "API 및 서비스" → "OAuth 동의 화면" → 외부 선택 → 앱 이름/이메일 입력 → 저장
3. "사용자 인증 정보" → "+ 만들기" → "OAuth 클라이언트 ID" → 유형: **데스크톱 앱**
4. 발급된 클라이언트 ID와 보안 비밀을 **config.js**에 붙여넣기
5. config.js의 ADMIN_EMAIL에 본인 이메일 입력 → 광고 링크 설정은 이 계정만 가능

- 환영 보너스(200pts)는 **구글 계정당 1회만** 지급 (데이터 초기화해도 중복 지급 안 됨)
- 설정 전에는 "게스트로 둘러보기"로 테스트 가능 (보너스 없음)

## ⚙️ 커스터마이즈

- **아이콘 바꾸기**: `assets/` 폴더의 파일 교체. 256×256 권장. .ico 생성은 https://www.icoconverter.com 같은 곳에서.
- **위젯 크기**: `main.js` 상단의 `WIDGET_SIZE` 값 수정.
- **단축키 변경**: `main.js`의 `globalShortcut.register('Control+0', ...)` 부분 수정.
- **GA4 측정 ID**: `renderer/index.html` 상단의 `G-XXXXXXXXXX` 두 군데 본인 ID로 교체.

## 🐛 문제 해결

- **`npm install` 에서 권한 오류**: PowerShell을 관리자 권한으로 실행.
- **빌드 시 코드 서명 경고**: 무시해도 됨. 정식 배포할 거면 코드 서명 인증서 별도 필요.
- **Windows Defender가 막을 때**: 서명 안 된 자체 빌드라서 정상. "추가 정보 → 실행" 클릭.
- **트레이 아이콘 안 보임**: Windows 알림 영역 설정에서 NEKO DESK 항상 표시로 변경.

## 📝 라이선스

MIT. 자유롭게 수정/배포하세요.
