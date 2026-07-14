// ═══════════════════════════════════════════════
// NEKO DESK - Electron 메인 프로세스
// ═══════════════════════════════════════════════
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, globalShortcut, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
let autoUpdater = null;

// 중복 실행 방지: 이미 실행 중이면 기존 창을 띄우고 종료
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

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
  if (!mainWindow) return;
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
}

function openDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
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
  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
    isDashboardOpen = false;
  });
  isDashboardOpen = true;
}

function sendOpenDashboard() {
  if (!mainWindow) return;
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
    // 대시보드 윈도우에서 호출 → 대시보드만 닫기
    win.close();
  } else {
    // 위젯에서 호출 → 트레이로 숨기기
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
  const s = readJSON(SESSION_FILE(), null);
  if (!s || !s.email) return null;
  return sessionInfo(s.email, s.guest);
});

ipcMain.handle('logout', () => {
  try { fs.unlinkSync(SESSION_FILE()); } catch(e) {}
  return true;
});

ipcMain.handle('guest-login', () => {
  const s = { email: 'guest', guest: true };
  writeJSON(SESSION_FILE(), s);
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

    const authWin = new BrowserWindow({
      width: 480, height: 680, parent: mainWindow, modal: false,
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

    const s = { email: info.email, guest: false };
    writeJSON(SESSION_FILE(), s);
    return sessionInfo(info.email, false);
  } catch (err) {
    return { error: String(err.message || err) };
  }
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

// ═══ 앱 라이프사이클 ═══
app.whenReady().then(() => {
  createWindow();
  createTray();
  gaTrack('app_start');

  // ═══ 자동 업데이트 (GitHub Releases) ═══
  try {
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
