// ═══════════════════════════════════════════════
// NEKO DESK - Electron 메인 프로세스
// ═══════════════════════════════════════════════
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, globalShortcut, nativeImage, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
let autoUpdater = null;

// 중복 실행 방지: 이미 실행 중이면 기존 창을 띄우고 종료
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

let mainWindow = null;       // 위젯 전용 윈도우 (항상 작게 유지)
let dashboardWindow = null;  // 대시보드 별도 윈도우
let tray = null;
let isDashboardOpen = false;
let lastWidgetPosition = null;

// 위젯/대시보드 크기
const WIDGET_SIZE    = { width: 280, height: 320 };
const LOGIN_SIZE     = { width: 440, height: 600 };
const DASHBOARD_SIZE = { width: 980, height: 720 };

// ═══ 메인 윈도우 생성 ═══
function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;

  mainWindow = new BrowserWindow({
    width: WIDGET_SIZE.width,
    height: WIDGET_SIZE.height,
    x: sw - WIDGET_SIZE.width - 40,
    y: sh - WIDGET_SIZE.height - 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // 콘텐츠 렌더링 완료 후 창 표시 (로딩 중 검은 박스 방지)
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.loadFile('renderer/index.html');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIcon(nativeImage.createEmpty()); // 윈도우 아이콘 비우기

  // 초기 위치 기억
  lastWidgetPosition = mainWindow.getPosition();

  // 사용자가 위젯을 드래그해서 옮길 때마다 위치 갱신
  mainWindow.on('move', () => {
    if (!isDashboardOpen) {
      lastWidgetPosition = mainWindow.getPosition();
    }
  });


  // 시작 시 개발자 도구 켜고 싶으면 주석 해제:
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// ═══ 트레이 아이콘 (시스템 트레이) ═══
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error('icon empty');
  } catch (e) {
    // 아이콘 없으면 빈 16x16 PNG로 fallback (앱은 동작)
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  const menu = Menu.buildFromTemplate([
    { label: '🐱 NEKO DESK', enabled: false },
    { type: 'separator' },
    { label: '보이기 / 숨기기', click: toggleVisibility },
    { label: '대시보드 열기',  click: () => sendOpenDashboard() },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip('NEKO DESK - 고양이와 함께하는 집중');
  tray.setContextMenu(menu);
  tray.on('click', toggleVisibility);
}

function toggleVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
}

function openDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    if (dashboardWindow.isMinimized()) dashboardWindow.restore();
    dashboardWindow.focus();
    return;
  }
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  dashboardWindow = new BrowserWindow({
    width: DASHBOARD_SIZE.width,
    height: DASHBOARD_SIZE.height,
    x: Math.round(dx + (dw - DASHBOARD_SIZE.width) / 2),
    y: Math.round(dy + (dh - DASHBOARD_SIZE.height) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  dashboardWindow.loadFile('renderer/index.html', { query: { mode: 'dashboard' } });
  dashboardWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (typeof attachCloudFocusPull === 'function') attachCloudFocusPull(dashboardWindow);
  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
    isDashboardOpen = false;
  });
  isDashboardOpen = true;
}

function sendOpenDashboard() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  openDashboardWindow();
}

// ═══ IPC: 대시보드 윈도우 열기/닫기 (위젯 윈도우는 항상 유지) ═══
ipcMain.on('open-dashboard', () => {
  openDashboardWindow();
});

ipcMain.on('close-dashboard', () => {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.close();
  }
  isDashboardOpen = false;
});

ipcMain.on('quit-app', () => { app.isQuitting = true; app.quit(); });

// ═══ 스토어(Microsoft Store) 빌드 판별 ═══
// 스토어는 (1) 스토어 밖에서 실행 코드를 내려받아 설치하는 것을 금지하고,
// (2) 부팅 시 자동 실행은 레지스트리가 아니라 매니페스트의 StartupTask로 선언하게 한다.
// 그래서 스토어용 빌드에서는 두 기능을 끈다. GitHub 배포판은 지금 그대로 동작한다.
//   · MSIX로 패키징되면 Electron이 process.windowsStore를 true로 세팅한다
//   · 그 외에는 `npm run build:store`가 package.json에 storeBuild를 주입한다
const IS_STORE_BUILD = (() => {
  if (process.windowsStore === true) return true;
  try {
    const v = require('./package.json').storeBuild;
    return v === true || v === 'true';
  } catch (e) { return false; }
})();

// ═══ 부팅 시 자동 실행 설정 ═══
// 사용자의 의도(켬/끔)를 파일에 저장해두고, 실행할 때마다 실제 등록 상태와 맞춘다.
// 업데이트·재설치 등으로 등록이 사라져도 다음 실행에서 자동 복구된다.
const AUTOLAUNCH_FILE = () => path.join(app.getPath('userData'), 'auto-launch.json');
const AUTOLAUNCH_OPTS = () => ({ path: process.execPath, args: [] });

function getAutoLaunchPref() {
  const j = readJSON(AUTOLAUNCH_FILE(), null);
  return (j && typeof j.enabled === 'boolean') ? j.enabled : true;  // 기본값: 켜짐
}

function isAutoLaunchOn() {
  try {
    return app.getLoginItemSettings(AUTOLAUNCH_OPTS()).openAtLogin;
  } catch (e) { return false; }
}

function applyAutoLaunch(on) {
  try {
    app.setLoginItemSettings(Object.assign({ openAtLogin: !!on }, AUTOLAUNCH_OPTS()));
  } catch (e) {}
}

function syncAutoLaunch() {
  if (IS_STORE_BUILD) return;    // 스토어 빌드: StartupTask로만 가능
  if (!app.isPackaged) return;   // 개발 중에는 등록하지 않음
  try {
    const want = getAutoLaunchPref();
    if (want !== isAutoLaunchOn()) applyAutoLaunch(want);
  } catch (e) {}
}

// 스토어(MSIX) 빌드는 매니페스트의 StartupTask로 자동 실행되고, 켜고 끄는 것은
// Windows 설정이 관리한다. 렌더러가 그 상태를 구분할 수 있도록 'store'를 돌려준다.
ipcMain.handle('get-auto-launch', () => IS_STORE_BUILD ? 'store' : isAutoLaunchOn());

// 스토어 빌드용: Windows의 시작 프로그램 설정을 연다
ipcMain.on('open-startup-settings', () => {
  shell.openExternal('ms-settings:startupapps').catch(() => {});
});

ipcMain.handle('set-auto-launch', (e, on) => {
  if (IS_STORE_BUILD) return null;
  writeJSON(AUTOLAUNCH_FILE(), { enabled: !!on });
  applyAutoLaunch(on);
  return isAutoLaunchOn();
});


ipcMain.handle('get-public-config', () => ({
  SUPABASE_URL: CFG.SUPABASE_URL || null,
  SUPABASE_KEY: CFG.SUPABASE_ANON_KEY || null,
  TOSS_CLIENT_KEY: CFG.TOSS_CLIENT_KEY && !CFG.TOSS_CLIENT_KEY.includes('PASTE') ? CFG.TOSS_CLIENT_KEY : null,
  NICEPAY_MID: CFG.NICEPAY_MID || null,
  NICEPAY_KEY: CFG.NICEPAY_KEY || null,
}));

// ─── NicePay 결제창 ───
ipcMain.handle('open-payment-window', (event, params) => {
  return new Promise((resolve) => {
    const { BrowserWindow: BW, app: _app } = require('electron');
    const fs = require('fs');
    const os = require('os');
    const pth = require('path');

    function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    const formHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>결제</title>
<style>body{margin:0;background:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666}p{font-size:14px}</style>
</head><body><p>결제창을 불러오는 중...</p>
<form id="pf" method="POST" action="https://web.nicepay.co.kr/v3/paymentStd.jsp">
  <input type="hidden" name="MID" value="${esc(params.mid)}">
  <input type="hidden" name="GoodsName" value="${esc(params.goodsName)}">
  <input type="hidden" name="Amt" value="${esc(params.amt)}">
  <input type="hidden" name="Moid" value="${esc(params.moid)}">
  <input type="hidden" name="BuyerName" value="${esc(params.buyerName)}">
  <input type="hidden" name="BuyerEmail" value="${esc(params.buyerEmail)}">
  <input type="hidden" name="BuyerTel" value="${esc(params.buyerTel)}">
  <input type="hidden" name="ReturnURL" value="${esc(params.returnUrl)}">
  <input type="hidden" name="EdiDate" value="${esc(params.ediDate)}">
  <input type="hidden" name="SignData" value="${esc(params.signData)}">
  <input type="hidden" name="CharSet" value="utf-8">
  <input type="hidden" name="GoodsCnt" value="${esc(params.goodsCnt||'1')}">
  <input type="hidden" name="MallReserved" value="${esc(params.mallReserved||'')}">
</form>
<script>document.getElementById('pf').submit();</script>
</body></html>`;

    const tmpFile = pth.join(os.tmpdir(), 'nekodesk_pay.html');
    fs.writeFileSync(tmpFile, formHtml, 'utf-8');

    const payWin = new BW({
      width: 500, height: 750, title: 'NEKO DESK 결제',
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    payWin.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    payWin.loadFile(tmpFile);

    const sendResult = (result) => {
      [mainWindow, dashboardWindow].forEach(w => {
        if (w && !w.isDestroyed()) w.webContents.send('payment-result', result);
      });
    };

    payWin.webContents.on('will-navigate', (e, url) => {
      if (url.startsWith('nekoapp://payment-done')) {
        e.preventDefault();
        try {
          const u = new URL(url.replace('nekoapp://', 'http://x/'));
          const result = {
            success: u.searchParams.get('success') === '1',
            tid: u.searchParams.get('tid') || '',
            amt: u.searchParams.get('amt') || params.amt,
            goods: u.searchParams.get('goods') || params.goodsName,
            msg: u.searchParams.get('msg') || ''
          };
          sendResult(result);
          resolve(result);
        } catch(err) {
          resolve({ success: false, msg: '결과 파싱 오류' });
        }
        payWin.close();
      }
    });

    payWin.on('closed', () => {
      resolve({ success: false, cancelled: true });
    });
  });
});

ipcMain.on('open-external', (e, url) => {
  // 외부 브라우저로 열기 (아임웹 상품/결제 페이지 등) — http/https만 허용
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') shell.openExternal(url);
  } catch (err) {}
});

// 로그인 화면: 큰 창 + 중앙 (프레임/투명 유지)
ipcMain.on('enter-login-mode', () => {
  if (!mainWindow) return;
  const display = screen.getPrimaryDisplay();
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  mainWindow.setResizable(true);
  mainWindow.setBounds({
    x: Math.round(dx + (dw - LOGIN_SIZE.width) / 2),
    y: Math.round(dy + (dh - LOGIN_SIZE.height) / 2),
    width: LOGIN_SIZE.width,
    height: LOGIN_SIZE.height,
  });
  mainWindow.setResizable(false);
  mainWindow.setAlwaysOnTop(true);
  mainWindow.center();
});

// 로그인 완료 → 위젯 모드(우하단 작은 창)로
ipcMain.on('enter-widget-mode', () => {
  if (!mainWindow) return;
  const display = screen.getPrimaryDisplay();
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const x = dx + dw - WIDGET_SIZE.width - 20;
  const y = dy + dh - WIDGET_SIZE.height - 20;
  lastWidgetPosition = [x, y];
  mainWindow.setResizable(true);
  mainWindow.setBounds({ x, y, width: WIDGET_SIZE.width, height: WIDGET_SIZE.height });
  mainWindow.setResizable(false);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
});

ipcMain.on('reset-widget-pos', () => {
  // 데이터 초기화 시 위젯을 처음 설치 상태(크기+위치)로 복원
  isDashboardOpen = false;
  const display = screen.getPrimaryDisplay();
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const x = dx + dw - WIDGET_SIZE.width - 20;
  const y = dy + dh - WIDGET_SIZE.height - 20;
  lastWidgetPosition = [x, y];
  if (mainWindow) {
    mainWindow.setResizable(true);
    mainWindow.setBounds({ x, y, width: WIDGET_SIZE.width, height: WIDGET_SIZE.height });
    mainWindow.setResizable(false);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }
});

ipcMain.on('install-update-now', () => {
  if (autoUpdater) autoUpdater.quitAndInstall();
});

ipcMain.on('minimize-app', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && win !== mainWindow) {
    // 대시보드 → 최소화 (작업표시줄로)
    win.minimize();
  } else {
    // 위젯 → 트레이로 숨기기
    if (mainWindow) mainWindow.hide();
  }
});

// ═══ 포토부스: 프로그램 화면 캡처 → 지정 폴더(기본: 바탕화면)에 저장 ═══
ipcMain.handle('capture-photo', async (e, rect, dir) => {
  try {
    const win = BrowserWindow.fromWebContents(e.sender) || mainWindow;
    const img = await win.webContents.capturePage(rect);
    const dest = dir || app.getPath('desktop');
    const file = path.join(dest, 'neko-photo-' + Date.now() + '.png');
    fs.writeFileSync(file, img.toPNG());
    return { ok: true, path: file };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('capture-region-url', async (e, rect) => {
  try {
    const win = BrowserWindow.fromWebContents(e.sender) || mainWindow;
    const img = await win.webContents.capturePage(rect);
    const base64 = img.toPNG().toString('base64');
    return { ok: true, dataUrl: 'data:image/png;base64,' + base64 };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('capture-full-page', async (e, { contentH }) => {
  const win = BrowserWindow.fromWebContents(e.sender) || mainWindow;
  if (!win) return { ok: false, error: 'no window' };
  const origBounds = win.getBounds();
  try {
    const neededH = Math.min(Math.round(contentH) + 80, 8000);
    if (neededH > origBounds.height) {
      const disp = screen.getDisplayNearestPoint({ x: origBounds.x, y: origBounds.y });
      win.setBounds({
        x: origBounds.x,
        y: disp.workArea.y,
        width: origBounds.width,
        height: neededH
      });
      await new Promise(r => setTimeout(r, 450));
    }
    const img = await win.webContents.capturePage();
    win.setBounds(origBounds);
    await new Promise(r => setTimeout(r, 100));
    return { ok: true, dataUrl: 'data:image/png;base64,' + img.toPNG().toString('base64') };
  } catch (err) {
    try { win.setBounds(origBounds); } catch (_) {}
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('choose-photo-dir', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender) || mainWindow;
  const r = await dialog.showOpenDialog(win, {
    title: '사진 저장 폴더 선택',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

// ═══ 멀티모니터 ═══
ipcMain.handle('get-displays', () => {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: `모니터 ${i + 1}` + (d.id === primary.id ? ' (주)' : ''),
    bounds: d.bounds,
    workArea: d.workArea,
    primary: d.id === primary.id
  }));
});

ipcMain.on('move-to-display', (e, displayId, position) => {
  const display = screen.getAllDisplays().find(d => d.id === displayId);
  if (!display) return;
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  const m = 40;
  const w = WIDGET_SIZE.width, h = WIDGET_SIZE.height;
  const positions = {
    tl: { x: dx + m,            y: dy + m },
    tr: { x: dx + dw - w - m,   y: dy + m },
    bl: { x: dx + m,            y: dy + dh - h - m },
    br: { x: dx + dw - w - m,   y: dy + dh - h - m },
  };
  const p = positions[position] || positions.br;
  mainWindow.setPosition(p.x, p.y);
  lastWidgetPosition = [p.x, p.y]; // 위치 변경 즉시 기억
});

// ═══ 윈도우 드래그 (위젯 모드에서 자유롭게 이동) ═══
ipcMain.on('drag-window', (e, dx, dy) => {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(x + dx, y + dy);
});

ipcMain.on('set-ignore-mouse-events', (e, ignore) => {
  if (mainWindow) mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
});

// 위젯 클릭 통과 안전장치: forward 이벤트는 창 숨김/표시 등을 거치면 끊길 수 있음
// → 메인에서 커서 위치를 폴링해 renderer가 항상 히트테스트를 할 수 있게 함
setInterval(() => {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
  const p = screen.getCursorScreenPoint();
  const b = mainWindow.getBounds();
  if (p.x < b.x || p.x >= b.x + b.width || p.y < b.y || p.y >= b.y + b.height) return;
  mainWindow.webContents.send('cursor-pos', { x: p.x - b.x, y: p.y - b.y });
}, 120);

// ═══ 커서 팔로우: 화면 전체를 따라다니는 미니 고양이 윈도우 ═══
let cursorWindow = null;
let cursorTimer = null;

ipcMain.on('set-follow', (e, on, imgDataURL) => {
  if (on) {
    if (!cursorWindow) {
      cursorWindow = new BrowserWindow({
        width: 40, height: 48,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        focusable: false,           // 포커스 안 뺏음
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });
      cursorWindow.setIgnoreMouseEvents(true);  // 클릭 통과 (작업 방해 X)
      cursorWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      cursorWindow.on('closed', () => { cursorWindow = null; });
    }
    const html = `<!DOCTYPE html><html><body style="margin:0;background:transparent;overflow:hidden">
      <img src="${imgDataURL}" style="width:32px;height:38px;image-rendering:pixelated;user-select:none;-webkit-user-drag:none">
      </body></html>`;
    cursorWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    cursorWindow.showInactive();

    if (cursorTimer) clearInterval(cursorTimer);
    cursorTimer = setInterval(() => {
      if (!cursorWindow) return;
      const p = screen.getCursorScreenPoint();
      cursorWindow.setPosition(p.x + 11, p.y - 22); // 커서 바로 옆 (60% 더 아래로)
    }, 16); // ~60fps
  } else {
    if (cursorTimer) { clearInterval(cursorTimer); cursorTimer = null; }
    if (cursorWindow) { cursorWindow.close(); cursorWindow = null; }
  }
});

// ═══ 구글 로그인 (OAuth 2.0 PKCE) + 계정별 환영 보너스 ═══
const crypto = require('crypto');
const http = require('http');

const CFG = (() => { try { return require('./config'); } catch(e) { return {}; } })();

const SESSION_FILE = () => path.join(app.getPath('userData'), 'session.json');

// ── 세션 파일 암호화 ────────────────────────────────────────────
// 갱신 토큰이 평문으로 있으면 그 파일만 빼내도 계정을 쓸 수 있다.
// safeStorage는 OS 계정 키(Windows DPAPI)로 암호화하므로, 파일이 유출돼도
// 다른 PC나 다른 사용자 계정에서는 풀 수 없다.
const SESSION_ENC_PREFIX = 'enc:v1:';

function readSessionFile() {
  let raw;
  try { raw = fs.readFileSync(SESSION_FILE(), 'utf8'); } catch (e) { return null; }
  if (raw.startsWith(SESSION_ENC_PREFIX)) {
    try {
      const buf = Buffer.from(raw.slice(SESSION_ENC_PREFIX.length), 'base64');
      return JSON.parse(safeStorage.decryptString(buf));
    } catch (e) { return null; }   // 다른 계정/PC에서 복호화 실패 → 재로그인
  }
  // 예전 평문 파일 — 읽어서 바로 암호화해 다시 쓴다
  try {
    const s = JSON.parse(raw);
    writeSessionFile(s);
    return s;
  } catch (e) { return null; }
}

function writeSessionFile(s) {
  try {
    const json = JSON.stringify(s);
    let out = json;
    try {
      if (safeStorage.isEncryptionAvailable()) {
        out = SESSION_ENC_PREFIX + safeStorage.encryptString(json).toString('base64');
      }
    } catch (e) {}   // 암호화를 못 쓰는 환경이면 평문으로라도 저장
    fs.writeFileSync(SESSION_FILE(), out, 'utf8');
  } catch (e) {}
}
const CLAIMED_FILE = () => path.join(app.getPath('userData'), 'claimed_accounts.json');

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return fallback; }
}
function writeJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data)); } catch(e) {}
}

function isConfigured() {
  return CFG.GOOGLE_CLIENT_ID && !CFG.GOOGLE_CLIENT_ID.includes('PASTE');
}
function sessionInfo(email, guest) {
  return { email, guest: !!guest, isAdmin: !guest && email === CFG.ADMIN_EMAIL };
}

ipcMain.handle('get-session', () => {
  const s = readSessionFile();
  if (!s || !s.email) return null;
  return sessionInfo(s.email, s.guest);
});

ipcMain.handle('logout', () => {
  try { fs.unlinkSync(SESSION_FILE()); } catch(e) {}
  return true;
});

ipcMain.handle('guest-login', () => {
  const s = { email: 'guest', guest: true };
  writeSessionFile(s);
  return sessionInfo(s.email, true);
});

ipcMain.handle('google-login', async () => {
  if (!isConfigured()) return { error: 'not_configured' };
  try {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    // 루프백 서버 (랜덤 포트)
    let resolveCode, rejectCode;
    const codePromise = new Promise((res, rej) => { resolveCode = res; rejectCode = rej; });
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      const code = u.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2 style="font-family:sans-serif">✅ 로그인 완료! 이 창은 닫아도 됩니다.</h2>');
      if (code) resolveCode(code);
    });
    await new Promise(res => server.listen(0, '127.0.0.1', res));
    const port = server.address().port;
    const redirect = `http://127.0.0.1:${port}`;

    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: CFG.GOOGLE_CLIENT_ID,
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });

    // 로그인 창은 화면 중앙에. (부모를 위젯으로 두면 우하단 위젯 옆에 뜨는 문제)
    const AW = 480, AH = 680;
    const refWin = (dashboardWindow && !dashboardWindow.isDestroyed()) ? dashboardWindow : mainWindow;
    let ax, ay;
    try {
      const rb = refWin.getBounds();
      const wa = screen.getDisplayNearestPoint({
        x: Math.round(rb.x + rb.width / 2),
        y: Math.round(rb.y + rb.height / 2),
      }).workArea;
      ax = Math.round(wa.x + (wa.width - AW) / 2);
      ay = Math.round(wa.y + (wa.height - AH) / 2);
    } catch (e) {}

    const authWin = new BrowserWindow({
      width: AW, height: AH, x: ax, y: ay,
      parent: mainWindow, modal: false,
      alwaysOnTop: true,     // 항상 위에 뜨는 위젯/대시보드에 가려지지 않도록
      autoHideMenuBar: true, webPreferences: { nodeIntegration: false }
    });
    authWin.loadURL(authUrl);
    authWin.on('closed', () => rejectCode(new Error('closed')));

    const code = await Promise.race([
      codePromise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 180000))
    ]);
    try { authWin.close(); } catch(e) {}
    server.close();

    // 토큰 교환
    const body = new URLSearchParams({
      client_id: CFG.GOOGLE_CLIENT_ID,
      code, code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirect,
    });
    if (CFG.GOOGLE_CLIENT_SECRET && !CFG.GOOGLE_CLIENT_SECRET.includes('PASTE')) {
      body.set('client_secret', CFG.GOOGLE_CLIENT_SECRET);
    }
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }).then(r => r.json());
    if (!tok.access_token) return { error: 'token_failed' };

    const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + tok.access_token }
    }).then(r => r.json());
    if (!info.email) return { error: 'userinfo_failed' };

    // 구글 id_token → Supabase 세션 교환 (기기 간 동기화용)
    // 모바일과 같은 구글 계정이면 같은 Supabase 유저가 되어 데이터가 공유됨
    let sb = null;
    if (tok.id_token && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) {
      try {
        const r = await fetch(CFG.SUPABASE_URL + '/auth/v1/token?grant_type=id_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY },
          body: JSON.stringify({ provider: 'google', id_token: tok.id_token }),
        }).then(r => r.json());
        if (r && r.access_token) {
          sb = { token: r.access_token, refresh: r.refresh_token, uid: r.user && r.user.id };
        }
      } catch (e) {}
    }

    const s = { email: info.email, guest: false, sb };
    writeSessionFile(s);
    return sessionInfo(info.email, false);
  } catch (err) {
    return { error: String(err.message || err) };
  }
});

// ═══ 기기 간 동기화용 Supabase 세션 ═══
ipcMain.handle('get-supabase-session', () => {
  const s = readSessionFile();
  return (s && s.sb && s.sb.token) ? s.sb : null;
});

ipcMain.handle('save-supabase-session', (e, sb) => {
  const s = readSessionFile();
  if (!s) return false;
  s.sb = sb;
  writeSessionFile(s);
  return true;
});

// 앱 버전 (package.json version)
ipcMain.handle('get-app-version', () => app.getVersion());

// ═══ GA4 애널리틱스 (Measurement Protocol — 데스크탑 앱용 공식 방식) ═══
function gaTrack(eventName, params = {}) {
  try {
    if (!CFG.GA_MEASUREMENT_ID || CFG.GA_MEASUREMENT_ID.includes('XXXX')) return;
    if (!CFG.GA_API_SECRET || CFG.GA_API_SECRET.includes('PASTE')) return;
    // 익명 클라이언트 ID (기기당 1개, 영구 보존)
    const idFile = path.join(app.getPath('userData'), 'ga_client_id.txt');
    let cid;
    try { cid = fs.readFileSync(idFile, 'utf8').trim(); } catch (e) {}
    if (!cid) {
      cid = crypto.randomUUID();
      try { fs.writeFileSync(idFile, cid); } catch (e) {}
    }
    fetch(
      'https://www.google-analytics.com/mp/collect' +
      '?measurement_id=' + CFG.GA_MEASUREMENT_ID +
      '&api_secret=' + CFG.GA_API_SECRET,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: cid,
          events: [{ name: eventName, params: { engagement_time_msec: 100, ...params } }],
        }),
      }
    ).catch(() => {});
  } catch (e) {}
}

ipcMain.on('ga-event', (e, name, params) => gaTrack(name, params || {}));

// ═══════════════════════════════════════════════════════════════
// 클라우드 동기화 (메인 프로세스 소유)
//
// 예전에는 대시보드 렌더러가 타이머를 돌렸는데, 대시보드는 닫으면 파괴되는
// 창이라 위젯만 띄워둔 평소 상태에서는 동기화가 아예 멈춰 있었다.
// 이제 메인이 주기·네트워크·토큰을 소유한다. 상태값(nekodesk_v3)은 여전히
// localStorage에 있으므로, 앱이 살아있는 한 항상 존재하는 위젯 창을 통해
// 읽고 쓴다. 창이 열려 있든 닫혀 있든 동작이 같아진다.
// ═══════════════════════════════════════════════════════════════
const SYNC_STATE_FILE = () => path.join(app.getPath('userData'), 'sync-state.json');
const CLOUD_STORAGE_KEY = 'nekodesk_v3';
const CLOUD_PULL_MS = 3 * 1000;          // 확인은 수백 바이트뿐이라 자주 돌아도 부담이 적다
const CLOUD_PUSH_DEBOUNCE_MS = 1000;     // 편집이 멎고 1초 뒤 올림

const CLOUD_KEYS = [
  'calendarNotes','calendarDeleted','ddays','memoDoc','scheduleMemo','diaryEntries','wishlist','wishlistDone',
  'cat','pts','fruits','harvestedFruits','waterCups','waterDate','vitaminOn','vitaminTime','vitaminTimes','vitaminGoal','vitaminTaken','vitaminDate','waterWorkOnly','alarms','growthLogs','ownedAccs','redeemedCoupons',
  'schedule','workItems','scheduleItems','theme','language'
];
// '실질적으로 아무 기록도 없는가' 판정용 (cat처럼 항상 기본값이 있는 키는 제외)
const CLOUD_CONTENT_KEYS = ['calendarNotes','diaryEntries','wishlist','wishlistDone',
  'scheduleMemo','growthLogs','ownedAccs','fruits','harvestedFruits','pts'];

let cloudTimer = null;         // 주기적 pull
let cloudPushTimer = null;     // 편집이 멎으면 올리는 디바운스
let cloudReady = false;        // 최초 pull 성공 전에는 push 금지
let cloudBusy = false;         // pull 중복 실행 방지

function syncState() {
  return readJSON(SYNC_STATE_FILE(), { dirty: false, claim: false, seenTs: '', base: null });
}
function setSyncState(patch) {
  writeJSON(SYNC_STATE_FILE(), Object.assign(syncState(), patch));
}

/** 살아있는 모든 창에 알림 (위젯은 항상, 대시보드는 열려 있을 때만) */
function cloudBroadcast(channel, payload) {
  for (const w of [mainWindow, dashboardWindow]) {
    if (w && !w.isDestroyed()) {
      try { w.webContents.send(channel, payload); } catch (e) {}
    }
  }
}
function cloudStatus(kind, key, extra) {
  cloudBroadcast('cloud-status', { kind, key, extra: extra || '' });
}

/** 위젯 창의 localStorage에서 현재 상태를 읽는다 (창 간 공유 저장소라 항상 최신) */
async function cloudReadLocal() {
  const w = (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : dashboardWindow;
  if (!w || w.isDestroyed()) return null;
  try {
    const raw = await w.webContents.executeJavaScript(
      'localStorage.getItem(' + JSON.stringify(CLOUD_STORAGE_KEY) + ')', true);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const out = {};
    CLOUD_KEYS.forEach(k => { if (saved[k] !== undefined) out[k] = saved[k]; });
    return out;
  } catch (e) { return null; }
}

function cloudIsEmpty(d) {
  if (!d || !Object.keys(d).length) return true;
  return CLOUD_CONTENT_KEYS.every(k => {
    const v = d[k];
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (typeof v === 'number') return v === 0;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
  });
}

/** 평소 병합 — 겹치면 이 기기(로컬) 우선 */
function cloudMerge(remote, local) {
  const out = {};
  CLOUD_KEYS.forEach(k => {
    const rv = remote ? remote[k] : undefined;
    const lv = local ? local[k] : undefined;
    if (lv === undefined) { if (rv !== undefined) out[k] = rv; return; }
    if (rv && lv && typeof rv === 'object' && typeof lv === 'object'
        && !Array.isArray(rv) && !Array.isArray(lv)) {
      out[k] = Object.assign({}, rv, lv);
    } else {
      out[k] = lv;
    }
  });
  return out;
}

// ── 일정 병합: 항목별 최신 우선 ────────────────────────────────
// 항목마다 id와 수정 시각(ts)이 있고, 삭제는 무덤(calendarDeleted)에 남는다.
// 같은 id면 ts가 큰 쪽이 이기고, 무덤 시각이 항목 ts 이상이면 삭제로 확정한다.
// 이렇게 해야 "한쪽에서 지운 것"과 "상대가 새로 더한 것"을 구분할 수 있다.
function mergeTombs(a, b) {
  const out = Object.assign({}, a || {});
  Object.keys(b || {}).forEach(id => {
    if (!(id in out) || b[id] > out[id]) out[id] = b[id];
  });
  return out;
}
function pruneTombs(tombs, keepMs) {
  const cut = Date.now() - (keepMs || 30 * 24 * 60 * 60 * 1000);
  const out = {};
  Object.keys(tombs || {}).forEach(id => { if (tombs[id] >= cut) out[id] = tombs[id]; });
  return out;
}
function mergeNotes(lNotes, lTombs, rNotes, rTombs) {
  const tombs = mergeTombs(lTombs, rTombs);
  const best = {};
  const collect = (notes) => {
    Object.keys(notes || {}).forEach(date => {
      const arr = notes[date];
      if (!Array.isArray(arr)) return;
      arr.forEach((it, idx) => {
        if (!it || !it.id) return;
        const ts = it.ts || 0;
        const cur = best[it.id];
        if (!cur || ts > cur.ts) {
          best[it.id] = { item: it, date: date, ts: ts, ord: it.ord != null ? it.ord : idx };
        }
      });
    });
  };
  collect(lNotes);
  collect(rNotes);
  const byDate = {};
  Object.keys(best).forEach(id => {
    const e = best[id];
    const dead = tombs[id];
    if (dead !== undefined && dead >= e.ts) return;   // 삭제 확정
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });
  const out = {};
  Object.keys(byDate).forEach(date => {
    byDate[date].sort((a, b) => (a.ord - b.ord) || (a.ts - b.ts));
    out[date] = byDate[date].map(e => e.item);
  });
  return { notes: out, tombs: pruneTombs(tombs) };
}
/** 병합 결과에서 일정 부분만 항목별 규칙으로 덮어쓴다 */
function applyNotesMerge(merged, local, remote) {
  const r = mergeNotes(
    local && local.calendarNotes, local && local.calendarDeleted,
    remote && remote.calendarNotes, remote && remote.calendarDeleted);
  merged.calendarNotes = r.notes;
  merged.calendarDeleted = r.tombs;
  return merged;
}

// ── 3방향 병합 ────────────────────────────────────────────────
// base = 두 기기가 마지막으로 합의했던 상태.
// base와 비교하면 "내가 지웠다"와 "상대가 추가했다"를 구분할 수 있다.
// 이게 없으면 삭제가 영원히 되살아난다(로컬 우선) 또는 추가가 사라진다(원격 우선).
function jeq(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return a === b; }
}
function isPlainObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function merge3(base, local, remote) {
  if (jeq(local, base)) return remote;    // 내가 안 건드렸으면 상대 것 (상대의 삭제도 수용)
  if (jeq(remote, base)) return local;    // 상대가 안 건드렸으면 내 것 (내 삭제도 반영)
  // 양쪽 다 바뀐 경우
  if (isPlainObj(local) && isPlainObj(remote)) {
    const out = {};
    const keys = {};
    [base, local, remote].forEach(o => { if (isPlainObj(o)) Object.keys(o).forEach(k => { keys[k] = 1; }); });
    Object.keys(keys).forEach(k => {
      const v = merge3(isPlainObj(base) ? base[k] : undefined, local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remote)) {
    const out = local.slice();            // 양쪽이 동시에 고친 목록은 합집합으로 (기록 우선)
    remote.forEach(x => { if (!out.some(y => jeq(x, y))) out.push(x); });
    return out;
  }
  return local;                           // 그 외에는 이 기기 값
}
/** 동기화가 끝난 시점의 상태를 기준선으로 저장 */
function setCloudBase(payload) {
  const b = {};
  CLOUD_KEYS.forEach(k => { if (payload && payload[k] !== undefined) b[k] = payload[k]; });
  setSyncState({ base: b });
}

// 게스트 기록을 계정에 합칠 때만 쓰는 병합 — 어느 쪽도 버리지 않는다
const CLAIM_JOIN_FIELDS = ['scheduleMemo','text','memo','note','content'];
function claimMergeVal(rv, lv, field) {
  if (rv === undefined || rv === null) return lv;
  if (lv === undefined || lv === null) return rv;
  if (typeof rv === 'number' && typeof lv === 'number') return Math.max(rv, lv);
  if (Array.isArray(rv) && Array.isArray(lv)) {
    const out = rv.slice();
    lv.forEach(x => {
      const s = JSON.stringify(x);
      if (!out.some(y => JSON.stringify(y) === s)) out.push(x);
    });
    return out;
  }
  if (typeof rv === 'string' && typeof lv === 'string') {
    if (CLAIM_JOIN_FIELDS.indexOf(field) < 0) return lv;
    if (rv === lv || rv.indexOf(lv) >= 0) return rv;
    if (lv.indexOf(rv) >= 0) return lv;
    return rv + String.fromCharCode(10) + lv;
  }
  if (typeof rv === 'object' && typeof lv === 'object'
      && !Array.isArray(rv) && !Array.isArray(lv)) {
    const out = Object.assign({}, rv);
    Object.keys(lv).forEach(k => {
      out[k] = (k in rv) ? claimMergeVal(rv[k], lv[k], k) : lv[k];
    });
    return out;
  }
  return lv;
}
function cloudClaimMerge(remote, local) {
  const out = {};
  CLOUD_KEYS.forEach(k => {
    const v = claimMergeVal(remote ? remote[k] : undefined, local ? local[k] : undefined, k);
    if (v !== undefined) out[k] = v;
  });
  return out;
}

function cloudSession() {
  const s = readSessionFile();
  return (s && s.sb && s.sb.token) ? s.sb : null;
}

/** 만료된 access_token을 refresh_token으로 갱신하고 파일에 반영 */
async function cloudRefreshToken() {
  const sb = cloudSession();
  if (!sb || !sb.refresh || !CFG.SUPABASE_URL) return null;
  try {
    const r = await fetch(CFG.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY },
      body: JSON.stringify({ refresh_token: sb.refresh })
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !j.access_token) return null;
    const s = readSessionFile() || {};
    s.sb = { token: j.access_token, refresh: j.refresh_token || sb.refresh, uid: sb.uid };
    writeSessionFile(s);
    return s.sb;
  } catch (e) { return null; }
}

async function cloudFetch(pathname, opts, retry) {
  const sb = cloudSession();
  if (!sb || !CFG.SUPABASE_URL) return null;
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers || {}, {
    apikey: CFG.SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + sb.token,
    'Content-Type': 'application/json'
  });
  try {
    const r = await fetch(CFG.SUPABASE_URL + pathname, opts);
    if (r.status === 401 && !retry) {
      const t = await cloudRefreshToken();
      return t ? cloudFetch(pathname, opts, true) : null;
    }
    return r;
  } catch (e) { return null; }
}

/** 클라우드 → 기기 */
async function cloudPull(notify) {
  if (cloudBusy || !cloudSession()) return false;
  cloudBusy = true;
  try {
    // 올릴 것도 없고 기준선도 있으면, 먼저 updated_at만 확인한다.
    // 바뀐 게 없으면 본문(수십 KB)을 받지 않으므로 자주 돌려도 가볍다.
    const st0 = syncState();
    if (!cloudPushTimer && !st0.dirty && st0.base) {
      const rh = await cloudFetch('/rest/v1/nekodesk_sync?select=updated_at', { method: 'GET' });
      if (rh && rh.ok) {
        const hrows = await rh.json();
        const hts = (hrows && hrows.length) ? String(hrows[0].updated_at || '') : '';
        cloudReady = true;
        if (hts && hts === st0.seenTs) { cloudStatus('pull', 'sync_uptodate'); return false; }
      }
    }
    const r = await cloudFetch('/rest/v1/nekodesk_sync?select=data,updated_at', { method: 'GET' });
    if (!r || !r.ok) {
      cloudStatus('pull', 'sync_failed', r ? ' (HTTP ' + r.status + ')' : '');
      return false;
    }
    const rows = await r.json();
    cloudReady = true;
    const remote = (rows && rows.length) ? rows[0].data : null;
    const st = syncState();

    if (cloudIsEmpty(remote)) {
      setSyncState({ claim: false });
      cloudStatus('pull', 'sync_cloud_empty');
      cloudBusy = false;
      return cloudPush(true);
    }
    // 기준선이 없으면(새로 설치·초기화 직후) 비교할 근거가 없다.
    // 이때 병합하면 상대가 지운 항목을 되살리게 되므로, 클라우드를 그대로 받아
    // 기준선으로 삼는다. 다음 동기화부터 삭제가 정상 전파된다.
    if (!st.base) {
      cloudBroadcast('cloud-apply', { data: remote, notify: '' });
      setSyncState({ seenTs: String(rows[0].updated_at || ''), claim: false });
      setCloudBase(remote);
      cloudStatus('pull', 'sync_received');
      return true;
    }
    // 안 올라간 내 변경이 있으면 원격으로 덮어쓰지 않고 병합해서 올린다
    if (cloudPushTimer || st.dirty) {
      const local = await cloudReadLocal();
      let merged = st.claim ? cloudClaimMerge(remote, local)
                            : merge3(st.base, local, remote);
      merged = applyNotesMerge(merged, local, remote);   // 일정은 항목별로 다시 판정
      cloudBroadcast('cloud-apply', { data: merged, notify: st.claim ? 'claim' : '' });
      setSyncState({ claim: false });
      setCloudBase(merged);
      cloudStatus('pull', 'sync_merged');
      cloudBusy = false;
      return cloudPush(true);
    }
    // 서버가 돌려준 updated_at이 마지막으로 본 값과 다르면 갱신
    const remoteTs = String(rows[0].updated_at || '');
    if (remoteTs && remoteTs !== st.seenTs) {
      cloudBroadcast('cloud-apply', { data: remote, notify: notify ? 'pulled' : '' });
      setSyncState({ seenTs: remoteTs });
      setCloudBase(remote);
      cloudStatus('pull', 'sync_received');
      return true;
    }
    cloudStatus('pull', 'sync_uptodate');
    return false;
  } catch (e) {
    cloudStatus('pull', 'sync_error');
    return false;
  } finally {
    cloudBusy = false;
  }
}

/** 기기 → 클라우드 */
async function cloudPush(force) {
  const sb = cloudSession();
  if (!sb) { cloudStatus('push', 'sync_need_login'); return false; }
  if (!cloudReady && !force) { cloudStatus('push', 'sync_waiting'); return false; }
  const data = await cloudReadLocal();
  // 이 기기가 텅 비어 있으면 올리지 않는다 (다른 기기 기록 보호)
  if (cloudIsEmpty(data)) { cloudStatus('push', 'sync_nothing'); return false; }
  // 업로드는 통째로 덮어쓰기이므로 직전에 원격을 읽어 병합한다
  try {
    const rg = await cloudFetch('/rest/v1/nekodesk_sync?select=data', { method: 'GET' });
    if (rg && rg.ok) {
      const rows = await rg.json();
      const remoteNow = (rows && rows.length) ? rows[0].data : null;
      if (remoteNow) {
        // 내가 지운 것은 지운 채로, 상대가 더한 것은 살린 채로 올린다
        let merged = merge3(syncState().base, data, remoteNow);
        merged = applyNotesMerge(merged, data, remoteNow);   // 일정은 항목별로
        CLOUD_KEYS.forEach(k => { delete data[k]; });
        Object.keys(merged).forEach(k => { data[k] = merged[k]; });
      }
    }
  } catch (e) {}
  data._device = 'pc';
  const r = await cloudFetch('/rest/v1/nekodesk_sync?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: sb.uid, data, updated_at: new Date().toISOString() })
  });
  const ok = !!(r && r.ok);
  if (ok) {
    try {
      const back = await r.json();
      if (back && back[0] && back[0].updated_at) setSyncState({ seenTs: String(back[0].updated_at) });
    } catch (e) {}
    setSyncState({ dirty: false });
    setCloudBase(data);
    cloudStatus('push', 'sync_done');
  } else {
    cloudStatus('push', 'sync_fail', r ? ' HTTP ' + r.status : '');
  }
  return ok;
}

/** 렌더러의 saveState가 알려온다 — 편집이 멎으면 올린다 */
function cloudSchedulePush() {
  if (!cloudSession()) return;
  setSyncState({ dirty: true });
  if (!cloudReady) { cloudStatus('push', 'sync_waiting'); return; }
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(() => { cloudPushTimer = null; cloudPush(); }, CLOUD_PUSH_DEBOUNCE_MS);
}

/** 창을 다시 보면 즉시 받아온다 — 열자마자 최신이 보이도록 */
let cloudLastFocusPull = 0;
function attachCloudFocusPull(w) {
  if (!w || w.isDestroyed()) return;
  const onFocus = () => {
    const now = Date.now();
    if (now - cloudLastFocusPull < 2000) return;   // 연타 방지
    cloudLastFocusPull = now;
    cloudPull(false);
  };
  w.on('focus', onFocus);
  w.on('show', onFocus);
}

function startCloudSync() {
  if (cloudTimer) return;
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;
  attachCloudFocusPull(mainWindow);
  cloudPull(false);
  cloudTimer = setInterval(() => cloudPull(false), CLOUD_PULL_MS);
}

ipcMain.on('cloud-mark-dirty', () => cloudSchedulePush());
ipcMain.on('cloud-start', () => startCloudSync());
ipcMain.handle('cloud-sync-now', () => cloudPull(true));
ipcMain.handle('cloud-delete-mine', async () => {
  const sb = cloudSession();
  if (!sb || !sb.uid) return false;
  if (cloudPushTimer) { clearTimeout(cloudPushTimer); cloudPushTimer = null; }
  setSyncState({ dirty: false, claim: false, seenTs: '', base: null });
  const r = await cloudFetch('/rest/v1/nekodesk_sync?user_id=eq.' + sb.uid, { method: 'DELETE' });
  return !!(r && r.ok);
});
// 게스트로 쓰던 기록을 계정에 승계할 때 렌더러가 알려준다
ipcMain.on('cloud-mark-claim', () => setSyncState({ claim: true, dirty: true }));

// 앱이 꺼지기 전, 예약만 되고 안 올라간 변경을 즉시 올린다
app.on('before-quit', () => {
  if (cloudPushTimer) { clearTimeout(cloudPushTimer); cloudPushTimer = null; cloudPush(); }
});

// ═══ 앱 라이프사이클 ═══
app.whenReady().then(() => {
  createWindow();
  createTray();
  gaTrack('app_start');

  // ═══ 클라우드 동기화 시작 — 창 상태와 무관하게 메인이 계속 돈다 ═══
  startCloudSync();

  // ═══ 부팅 시 자동 실행: 매 실행마다 설정을 점검해 어긋나면 복구 ═══
  syncAutoLaunch();

  // ═══ 자동 업데이트 (GitHub Releases) ═══
  // 스토어 빌드는 업데이트를 스토어가 담당한다 (직접 내려받아 설치하면 정책 위반)
  try {
    if (IS_STORE_BUILD) throw new Error('store build: updater disabled');
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    setTimeout(() => autoUpdater.checkForUpdates().catch(()=>{}), 3000);
    setInterval(() => autoUpdater.checkForUpdates().catch(()=>{}), 4 * 60 * 60 * 1000);
    autoUpdater.on('update-available', (info) => {
      if (mainWindow) mainWindow.webContents.send('update-status', { state: 'available', version: info.version });
    });
    autoUpdater.on('download-progress', (p) => {
      if (mainWindow) mainWindow.webContents.send('update-status', { state: 'downloading', percent: Math.round(p.percent) });
    });
    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow) mainWindow.webContents.send('update-status', { state: 'downloaded', version: info.version });
    });
    autoUpdater.on('error', () => {});
  } catch(e) {}

  // Ctrl+0: 커서 팔로우 ON/OFF (전역 단축키)
  globalShortcut.register('Control+0', () => {
    if (mainWindow) mainWindow.webContents.send('trigger-toggle-follow');
  });

  // 카메라(포토부스) + autoplay 권한 허용 (check + request 둘 다 필요)
  const { session } = require('electron');
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return ['media', 'autoplay', 'camera'].includes(permission);
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(['media', 'autoplay', 'camera'].includes(permission));
  });
});

app.on('window-all-closed', (e) => {
  // 트레이만 남기고 백그라운드 유지
  if (!app.isQuitting) e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (cursorTimer) clearInterval(cursorTimer);
});
