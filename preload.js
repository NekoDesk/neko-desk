// ═══════════════════════════════════════════════
// preload.js — 렌더러 ↔ 메인 프로세스 안전한 브릿지
// ═══════════════════════════════════════════════
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 대시보드 모드 전환
  openDashboard:  () => ipcRenderer.send('open-dashboard'),
  closeDashboard: () => ipcRenderer.send('close-dashboard'),

  // 멀티모니터
  getDisplays:    () => ipcRenderer.invoke('get-displays'),
  moveToDisplay:  (displayId, position) => ipcRenderer.send('move-to-display', displayId, position),

  // 위젯 드래그
  dragWindow:     (dx, dy) => ipcRenderer.send('drag-window', dx, dy),

  // 위젯 투명 영역 클릭 통과
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', ignore),

  // 커서 팔로우 (화면 전체)
  setFollow:      (on, imgDataURL) => ipcRenderer.send('set-follow', on, imgDataURL),

  // 숨기기 (트레이로)
  minimizeApp:    () => ipcRenderer.send('minimize-app'),

  // 구글 로그인
  googleLogin:    () => ipcRenderer.invoke('google-login'),
  guestLogin:     () => ipcRenderer.invoke('guest-login'),
  getSession:     () => ipcRenderer.invoke('get-session'),
  logout:         () => ipcRenderer.invoke('logout'),
  getAppVersion:  () => ipcRenderer.invoke('get-app-version'),

  // 부팅 시 자동 실행
  getAutoLaunch:  () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch:  (on) => ipcRenderer.invoke('set-auto-launch', on),

  // 기기 간 동기화 (Supabase 세션)
  getSupabaseSession:  () => ipcRenderer.invoke('get-supabase-session'),
  saveSupabaseSession: (sb) => ipcRenderer.invoke('save-supabase-session', sb),

  // 포토부스: 프로그램 화면 캡처 + 저장
  capturePhoto:   (rect, dir) => ipcRenderer.invoke('capture-photo', rect, dir),
  captureRegionUrl: (rect) => ipcRenderer.invoke('capture-region-url', rect),
  captureFullPage:  (params) => ipcRenderer.invoke('capture-full-page', params),
  choosePhotoDir: () => ipcRenderer.invoke('choose-photo-dir'),

  // 종료
  quitApp:        () => ipcRenderer.send('quit-app'),

  // 공개 설정 (Supabase 등)
  getPublicConfig: () => ipcRenderer.invoke('get-public-config'),

  // 외부 링크 열기 (상품 구매 페이지)
  openExternal:   (url) => ipcRenderer.send('open-external', url),

  // GA4 이벤트 추적
  gaEvent:        (name, params) => ipcRenderer.send('ga-event', name, params),

  // 자동 업데이트
  onUpdateStatus:  (cb) => ipcRenderer.on('update-status', (e, data) => cb(data)),
  installUpdateNow: () => ipcRenderer.send('install-update-now'),

  // 로그인/위젯 모드 전환
  enterLoginMode:  () => ipcRenderer.send('enter-login-mode'),
  enterWidgetMode: () => ipcRenderer.send('enter-widget-mode'),

  // 위젯 위치 리셋 (데이터 초기화 시)
  resetWidgetPos: () => ipcRenderer.send('reset-widget-pos'),

  // 메인 → 렌더러 이벤트 수신
  onOpenDashboard: (cb) => ipcRenderer.on('trigger-open-dashboard', cb),
  onToggleFollow:  (cb) => ipcRenderer.on('trigger-toggle-follow', cb),
  onCursorPos:     (cb) => ipcRenderer.on('cursor-pos', (e, p) => cb(p)),

  // NicePay 결제창 (V1 표준결제)
  openPaymentWindow: (params) => ipcRenderer.invoke('open-payment-window', params),
  onPaymentResult:   (cb) => ipcRenderer.on('payment-result', (e, data) => cb(data)),
});
