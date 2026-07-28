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
      // 모바일 구글 로그인은 딥링크 설정이 필요 → v1은 게스트 안내
      return Promise.resolve({ error: 'not_configured' });
    },
    logout: function () {
      localStorage.removeItem(SESSION_KEY);
      return Promise.resolve(true);
    },

    // ── 설정/버전 ──
    getPublicConfig: function () { return Promise.resolve(PUBLIC_CFG); },
    getAppVersion: function () { return Promise.resolve(APP_VERSION); },

    // ── 외부 링크 ──
    openExternal: function (url) { window.open(url, '_blank'); },

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
  });
})();