// ═══════════════════════════════════════════════
// mobile-bridge.js — Electron API의 모바일 대체 구현
// 데스크톱 renderer 코드를 수정 없이 모바일에서 돌리기 위한 셰임.
// 정의하지 않은 메서드는 renderer 쪽 가드(if 체크)에 의해
// 자동으로 폴백 동작하거나 비활성화됨.
// ═══════════════════════════════════════════════
(function () {
  'use strict';

  var APP_VERSION = '1.3.8-mobile';
  var SESSION_KEY = 'neko_mobile_session';

  // 공개 설정만 포함 (비밀키 없음 — Supabase anon key는 공개용으로 설계됨)
  var PUBLIC_CFG = {
    SUPABASE_URL: 'https://hzfjdutqsjvrwmmggrxd.supabase.co',
    SUPABASE_KEY: 'sb_publishable_oHOLpDli-vhkgKDWCyFoyg_muSbJVs8',
    TOSS_CLIENT_KEY: null,
    NICEPAY_MID: null,   // 모바일에서는 인앱 결제창 미지원 → 외부 링크 폴백
    NICEPAY_KEY: null
  };

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch (e) { return null; }
  }

  function capPlugin(name) {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
  }

  // ── 구글 로그인 (Supabase OAuth + 딥링크) ──
  var LOGIN_CALLBACK = 'nekodesk://auth-callback';
  var _pendingLogin = null;

  function openExternalUrl(url) {
    var Browser = capPlugin('Browser');
    if (Browser) Browser.open({ url: url });
    else window.open(url, '_blank');
  }

  function initDeepLinkListener() {
    var App = capPlugin('App');
    if (!App) return;
    App.addListener('appUrlOpen', function (data) {
      var url = (data && data.url) || '';
      if (url.indexOf(LOGIN_CALLBACK) !== 0) return;
      var Browser = capPlugin('Browser');
      if (Browser) Browser.close().catch(function () {});
      // Supabase는 토큰을 URL 프래그먼트(#access_token=...)로 전달
      var frag = url.split('#')[1] || url.split('?')[1] || '';
      var params = new URLSearchParams(frag);
      var token = params.get('access_token');
      var finish = function (result) {
        if (_pendingLogin) { _pendingLogin(result); _pendingLogin = null; }
      };
      if (!token) { finish(null); return; }
      fetch(PUBLIC_CFG.SUPABASE_URL + '/auth/v1/user', {
        headers: { Authorization: 'Bearer ' + token, apikey: PUBLIC_CFG.SUPABASE_KEY }
      })
        .then(function (r) { return r.json(); })
        .then(function (u) {
          if (!u || !u.email) { finish(null); return; }
          var s = { email: u.email, guest: false, isAdmin: false };
          localStorage.setItem(SESSION_KEY, JSON.stringify(s));
          finish(s);
        })
        .catch(function () { finish(null); });
    });
  }

  window.electronAPI = {
    // ── 창 제어: 모바일은 단일 화면이므로 전부 no-op ──
    openDashboard: function () {
      var d = document.getElementById('dashboard');
      if (d) d.classList.add('open');
    },
    closeDashboard: function () {},   // 모바일에서 대시보드는 항상 열려있음
    minimizeApp: function () {},
    quitApp: function () {},
    dragWindow: function () {},
    resetWidgetPos: function () {},
    moveToDisplay: function () {},
    enterLoginMode: function () {},
    enterWidgetMode: function () {},

    // ── 로그인 (모바일 v1: 게스트만 지원) ──
    getSession: function () { return Promise.resolve(readSession()); },
    guestLogin: function () {
      var s = { email: 'guest', guest: true, isAdmin: false };
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      return Promise.resolve(s);
    },
    googleLogin: function () {
      return new Promise(function (resolve) {
        if (!capPlugin('App')) { resolve({ error: 'not_configured' }); return; }
        _pendingLogin = resolve;
        openExternalUrl(
          PUBLIC_CFG.SUPABASE_URL + '/auth/v1/authorize?provider=google&redirect_to=' +
          encodeURIComponent(LOGIN_CALLBACK)
        );
        // 3분 내에 콜백이 없으면 실패 처리
        setTimeout(function () {
          if (_pendingLogin === resolve) { _pendingLogin = null; resolve(null); }
        }, 180000);
      });
    },
    logout: function () {
      localStorage.removeItem(SESSION_KEY);
      return Promise.resolve(true);
    },

    // ── 설정/버전 ──
    getPublicConfig: function () { return Promise.resolve(PUBLIC_CFG); },
    getAppVersion: function () { return Promise.resolve(APP_VERSION); },

    // ── 외부 링크 (시스템 브라우저로) ──
    openExternal: function (url) { openExternalUrl(url); },

    // ── 분석/업데이트: no-op ──
    gaEvent: function () {},
    installUpdateNow: function () {},

    // ── 이벤트 구독: 모바일에서는 발생하지 않음 ──
    onUpdateStatus: function () {},
    onOpenDashboard: function () {},
    onToggleFollow: function () {},
    onPaymentResult: function () {}

    // 미정의(의도적) → renderer 가드가 폴백 처리:
    //   captureRegionUrl/captureFullPage (다이어리 이미지 저장 — 추후 모바일 구현)
    //   capturePhoto/choosePhotoDir (포토부스 파일 저장)
    //   openPaymentWindow (인앱 결제 → 외부 링크 폴백)
    //   setIgnoreMouseEvents/setFollow/getDisplays (데스크톱 전용)
  };

  // ── 모바일 전용 스타일 ──
  document.addEventListener('DOMContentLoaded', function () {
    var css = [
      // 대시보드 풀스크린 (창 프레임 개념 제거)
      '#dashPanel { width:100vw !important; height:100vh !important; max-height:100vh !important; border-radius:0 !important; }',
      '#dashboard { padding:0 !important; }',
      // 창 최소화/닫기 버튼 숨김 (모바일에선 의미 없음)
      '.dtb-btns { display:none !important; }',
      // body transparent(인라인) 무효화
      'body { background: var(--bg) !important; }',
      // 모바일: 탭이 텍스트 선택으로 인식되는 것 방지 (이모지 파란 선택 현상)
      '* { -webkit-user-select:none !important; user-select:none !important; -webkit-tap-highlight-color:transparent; }',
      'input, textarea, [contenteditable] { -webkit-user-select:text !important; user-select:text !important; }',
      // 모바일에서는 업무 사이클(스케줄) 탭 제거
      '.dtab[onclick*="cycle"] { display:none !important; }',
      // 가로 스크롤 방지: 어떤 페이지도 기기 폭을 넘지 않게
      'html, body, .dash-body, .dpage { max-width:100vw; overflow-x:hidden !important; }',
      '.dpage * { max-width:100%; box-sizing:border-box; }',
      // 좁은 화면 대응
      '@media (max-width:700px) {',
      '  .grid2 { grid-template-columns: 1fr !important; }',
      '  .mag-grid { grid-template-columns: repeat(2,1fr) !important; }',
      '  .diary-top-row { flex-wrap: wrap !important; }',
      '  .dash-body { padding: 12px !important; }',
      '}'
    ].join('\n');
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    // 구글 로그인 딥링크 콜백 수신 시작
    initDeepLinkListener();

    // 홈의 '현재 사이클' 카드 숨김 (모바일은 업무 사이클 기능 제외)
    var tClock = document.getElementById('hTimerClock');
    if (tClock) {
      var cycleCard = tClock.closest('.card');
      if (cycleCard) cycleCard.style.display = 'none';
    }

    // 포토부스에 전/후면 카메라 전환 버튼 주입
    var facing = 'user';
    var bgBtn = document.getElementById('photoBgBlur');
    if (bgBtn && bgBtn.parentElement && navigator.mediaDevices) {
      var flipBtn = document.createElement('button');
      flipBtn.textContent = '🔄 카메라 전환';
      flipBtn.style.cssText = 'font-size:12px;padding:5px 12px;border:2px solid var(--frame);border-radius:4px;background:transparent;color:var(--frame-text);cursor:pointer';
      flipBtn.onclick = function () {
        facing = (facing === 'user') ? 'environment' : 'user';
        var v = document.getElementById('photoVideo');
        if (!v) return;
        if (v.srcObject) v.srcObject.getTracks().forEach(function (t) { t.stop(); });
        navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: facing }, audio: false
        }).then(function (stream) {
          v.srcObject = stream;
          if (v.play) v.play().catch(function () {});
        }).catch(function () {});
      };
      bgBtn.parentElement.appendChild(flipBtn);
    }
  });
})();