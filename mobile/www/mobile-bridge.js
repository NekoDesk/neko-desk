// ═══════════════════════════════════════════════
// mobile-bridge.js — Electron API의 모바일 대체 구현
// 데스크톱 renderer 코드를 수정 없이 모바일에서 돌리기 위한 셰임.
// 정의하지 않은 메서드는 renderer 쪽 가드(if 체크)에 의해
// 자동으로 폴백 동작하거나 비활성화됨.
// ═══════════════════════════════════════════════
(function () {
  'use strict';

  var APP_VERSION = '1.4.3-mobile';
  var SESSION_KEY = 'neko_mobile_session';
  var STORAGE_KEY = 'nekodesk_v3';        // renderer와 동일한 로컬 저장 키
  var SYNC_TS_KEY = 'neko_sync_pushed_at';
  var DIRTY_KEY = 'neko_sync_dirty';      // 아직 클라우드에 안 올라간 변경 존재 표시 (재시작에도 유지)
  var OWNER_KEY = 'neko_data_owner';      // 이 기기 데이터의 주인 계정 (계정별 데이터 분리)

  // 계정 간 동기화 대상 — renderer의 CLOUD_KEYS와 동일하게 유지할 것
  var SYNC_KEYS = [
    // 기록
    'calendarNotes', 'scheduleMemo', 'diaryEntries', 'wishlist', 'wishlistDone',
    // 고양이·진행 상태
    'cat', 'pts', 'fruits', 'harvestedFruits', 'growthLogs', 'ownedAccs', 'redeemedCoupons',
    // 설정
    'schedule', 'workItems', 'scheduleItems', 'shipping', 'theme', 'language'
  ];

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
  function writeSession(s) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }
  /**
   * 계정별 데이터 분리: 이 기기의 데이터가 다른 계정 것이면 비우고 재시작.
   * 게스트로 쓰다 처음 로그인하면 기존 데이터를 그 계정 것으로 승계.
   * @returns true면 재시작 중이므로 호출측은 중단해야 함
   */
  function enforceDataOwner(email) {
    try {
      var owner = localStorage.getItem(OWNER_KEY);
      if (owner && owner !== email) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SYNC_TS_KEY);
        localStorage.removeItem(DIRTY_KEY);
        localStorage.setItem(OWNER_KEY, email);
        location.reload();
        return true;
      }
      localStorage.setItem(OWNER_KEY, email);
    } catch (e) {}
    return false;
  }
  function capPlugin(name) {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
  }
  // renderer의 S는 `const`로 선언되어 window에 붙지 않는다.
  // 같은 classic script 스코프를 공유하므로 식별자로 직접 참조해야 함.
  function getS() {
    try { return (typeof S !== 'undefined' && S) ? S : null; } catch (e) { return null; }
  }
  function toast(kind, title, msg) {
    if (typeof window.toast === 'function') window.toast(kind, title, msg);
  }
  // '실질적으로 아무 기록도 없는가' 판단용 (cat처럼 항상 기본값이 있는 키는 제외)
  var CONTENT_KEYS = ['calendarNotes', 'diaryEntries', 'wishlist', 'wishlistDone',
    'scheduleMemo', 'growthLogs', 'ownedAccs', 'fruits', 'harvestedFruits', 'pts'];

  /** 기록이 하나도 없는 페이로드인가 (빈 기기가 클라우드를 지우는 것 방지) */
  function isEmptyPayload(d) {
    if (!d || !Object.keys(d).length) return true;
    return CONTENT_KEYS.every(function (k) {
      var v = d[k];
      if (v === null || v === undefined) return true;
      if (typeof v === 'string') return v.trim() === '';
      if (typeof v === 'number') return v === 0;
      if (Array.isArray(v)) return v.length === 0;
      if (typeof v === 'object') return Object.keys(v).length === 0;
      return false;
    });
  }
  // 받기/올리기 결과를 각각 보관해 한쪽이 다른 쪽을 덮어쓰지 않게 한다
  // (예전에는 15초 주기의 '받기'가 업로드 실패 메시지를 지워버려 원인을 알 수 없었음)
  var _stPull = '', _stPush = '';
  function renderSyncStatus() {
    var el = document.getElementById('syncStatus');
    if (!el) return;
    var parts = [];
    if (_stPull) parts.push('받기 ' + _stPull);
    if (_stPush) parts.push('올리기 ' + _stPush);
    el.textContent = '☁️ 동기화: ' + (parts.length ? parts.join(' · ') : '대기 중');
  }
  function syncStatus(msg) { _stPull = msg; renderSyncStatus(); }
  function pushStatus(msg) { _stPush = msg; renderSyncStatus(); }
  function nowHHMM() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // ═══════════════════════════════════════════════
  // 구글 로그인 (Supabase OAuth + 딥링크)
  // ═══════════════════════════════════════════════
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
      var refresh = params.get('refresh_token');
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
          var s = {
            email: u.email, guest: false, isAdmin: false,
            token: token, refresh: refresh, uid: u.id
          };
          writeSession(s);
          // 다른 계정의 데이터가 남아있으면 비우고 재시작 (계정별 분리)
          if (enforceDataOwner(u.email)) return;
          finish(s);
          // 로그인 직후 클라우드 데이터 가져오기
          syncPull(true);
        })
        .catch(function () { finish(null); });
    });
  }

  // ═══════════════════════════════════════════════
  // 클라우드 동기화 (Supabase REST + RLS)
  //   테이블: nekodesk_sync (user_id uuid PK, data jsonb, updated_at)
  // ═══════════════════════════════════════════════
  var _syncReady = false;      // pull 성공 전에는 push 금지 (원격 데이터 덮어쓰기 방지)
  var _pushTimer = null;

  function loggedIn() {
    var s = readSession();
    return !!(s && !s.guest && s.token);
  }

  /** 만료된 access_token을 refresh_token으로 갱신 */
  function refreshToken() {
    var s = readSession();
    if (!s || !s.refresh) return Promise.resolve(null);
    return fetch(PUBLIC_CFG.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: PUBLIC_CFG.SUPABASE_KEY },
      body: JSON.stringify({ refresh_token: s.refresh })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.access_token) return null;
        s.token = d.access_token;
        if (d.refresh_token) s.refresh = d.refresh_token;
        writeSession(s);
        return s.token;
      })
      .catch(function () { return null; });
  }

  /** 인증 헤더를 붙여 REST 호출. 401이면 토큰 갱신 후 1회 재시도. */
  function authFetch(path, opts, retry) {
    var s = readSession();
    if (!s || !s.token) return Promise.resolve(null);
    opts = opts || {};
    // 헤더는 매 호출마다 재구성 — 재시도 시 새 토큰이 반영되도록
    opts.headers = Object.assign({}, opts.headers || {}, {
      apikey: PUBLIC_CFG.SUPABASE_KEY,
      Authorization: 'Bearer ' + s.token,
      'Content-Type': 'application/json'
    });
    return fetch(PUBLIC_CFG.SUPABASE_URL + path, opts).then(function (r) {
      if (r.status === 401 && !retry) {
        return refreshToken().then(function (t) {
          return t ? authFetch(path, opts, true) : null;
        });
      }
      return r;
    }).catch(function () { return null; });
  }

  /** 로컬 S에서 동기화 대상만 추출 */
  function collectLocal() {
    var out = {}, st = getS();
    if (!st) return out;
    SYNC_KEYS.forEach(function (k) {
      if (st[k] !== undefined) out[k] = st[k];
    });
    return out;
  }

  /** 원격 데이터를 S에 반영하고 화면 갱신 */
  function applyRemote(data) {
    var st = getS();
    if (!data || !st) return false;
    var changed = false;
    SYNC_KEYS.forEach(function (k) {
      if (data[k] !== undefined) { st[k] = data[k]; changed = true; }
    });
    if (!changed) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
      // 화면 다시 그리기
      if (typeof window.applyTheme === 'function' && st.theme) window.applyTheme(st.theme);
      if (typeof window.applyLang === 'function') window.applyLang();
      if (typeof window.renderAll === 'function') window.renderAll();
      if (typeof window.updateCatUI === 'function') window.updateCatUI();
      if (typeof window.renderFruits === 'function') window.renderFruits();
      if (typeof window.renderHarvestCount === 'function') window.renderHarvestCount();
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
      if (typeof window.renderDiary === 'function') window.renderDiary();
      if (typeof window.renderWorkItems === 'function') window.renderWorkItems();
      ['ptsDisplay', 'shopPts'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = st.pts;
      });
      var memo = document.getElementById('scheduleMemoTxt');
      if (memo) memo.value = st.scheduleMemo || '';
    } catch (e) {}
    return true;
  }

  /**
   * 원격과 로컬을 병합 (로컬 우선).
   * diaryEntries/calendarNotes처럼 날짜별 객체는 항목 단위로 합쳐
   * 양쪽 기기의 기록을 모두 보존한다.
   */
  function mergePayload(remote, local) {
    var out = {};
    SYNC_KEYS.forEach(function (k) {
      var rv = remote ? remote[k] : undefined;
      var lv = local ? local[k] : undefined;
      if (lv === undefined) { if (rv !== undefined) out[k] = rv; return; }
      if (rv && lv && typeof rv === 'object' && typeof lv === 'object'
          && !Array.isArray(rv) && !Array.isArray(lv)) {
        out[k] = Object.assign({}, rv, lv);   // 원격 + 로컬, 겹치면 로컬 우선
      } else {
        out[k] = lv;                          // 그 외는 로컬(내 변경) 우선
      }
    });
    return out;
  }

  /** 클라우드 → 기기 */
  function syncPull(notify) {
    if (!loggedIn()) return Promise.resolve(false);
    return authFetch('/rest/v1/nekodesk_sync?select=data,updated_at', { method: 'GET' })
      .then(function (r) {
        if (!r || !r.ok) {
          syncStatus('연결 실패' + (r ? ' (HTTP ' + r.status + ')' : ''));
          return null;
        }
        return r.json();
      })
      .then(function (rows) {
        if (rows === null) return false;
        _syncReady = true;                       // 조회 성공 → 이제 push 허용
        var remote = (rows && rows.length) ? rows[0].data : null;
        if (isEmptyPayload(remote)) {
          syncPush(true);                        // 클라우드가 비어 있으면 로컬을 올림
          syncStatus('클라우드 비어있음 (' + nowHHMM() + ')');
          return false;
        }
        // 아직 안 올라간 내 변경이 있으면(앱을 껐다 켠 경우 포함) 원격으로 덮어쓰지 않고,
        // 원격과 병합한 결과를 올린다 — 양쪽 기기의 기록이 모두 살아남는다.
        if (_pushTimer || localStorage.getItem(DIRTY_KEY) === '1') {
          var merged = mergePayload(remote, collectLocal());
          applyRemote(merged);
          syncStatus('내 변경 병합 (' + nowHHMM() + ')');
          return syncPush(true);
        }
        // 기기 시계와 서버 시계를 비교하면 시간차로 최신글을 놓칠 수 있음.
        // 서버가 돌려준 값이 마지막으로 본 값과 다르면 갱신한다.
        var remoteTs = String(rows[0].updated_at || '');
        var seenTs = localStorage.getItem(SYNC_TS_KEY) || '';
        if (remoteTs && remoteTs !== seenTs) {
          var ok = applyRemote(remote);
          localStorage.setItem(SYNC_TS_KEY, remoteTs);
          if (ok && notify) toast('info', '☁️ 동기화', 'PC의 최신 내용을 가져왔어요');
          syncStatus('받음 (' + nowHHMM() + ')');
          return ok;
        }
        syncStatus('최신 (' + nowHHMM() + ')');
        return false;
      })
      .catch(function () { syncStatus('연결 오류'); return false; });
  }

  /** 기기 → 클라우드 */
  function syncPush(force) {
    if (!loggedIn()) { pushStatus('로그인 필요'); return Promise.resolve(false); }
    if (!_syncReady && !force) { pushStatus('연결 대기 중'); return Promise.resolve(false); }
    var s = readSession();
    if (!s || !s.uid) { pushStatus('계정 정보 없음 (재로그인 필요)'); return Promise.resolve(false); }
    var local = collectLocal();
    // 내 기기가 텅 비어있으면 올리지 않음 — 다른 기기 기록을 지우지 않기 위해
    if (isEmptyPayload(local)) { pushStatus('올릴 내용 없음'); return Promise.resolve(false); }
    // 업로드는 '통째로 덮어쓰기'이므로, 올리기 직전에 클라우드의 현재 내용을 읽어
    // 병합한다 — 상대 기기가 방금 올린(내가 아직 안 받은) 기록을 지우지 않기 위해.
    return authFetch('/rest/v1/nekodesk_sync?select=data', { method: 'GET' })
      .then(function (rg) { return rg && rg.ok ? rg.json() : null; })
      .then(function (rows) {
        var remote = (rows && rows.length) ? rows[0].data : null;
        var payload = remote ? mergePayload(remote, local) : local;
        payload._device = 'mobile';              // 어느 기기가 올렸는지 진단용
        var body = { user_id: s.uid, data: payload, updated_at: new Date().toISOString() };
        return authFetch('/rest/v1/nekodesk_sync?on_conflict=user_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(body)
        });
      }).then(function (r) {
      var ok = !!(r && r.ok);
      if (ok) {
        localStorage.removeItem(DIRTY_KEY);   // 내 변경이 클라우드에 반영됨
        // 서버가 기록한 시각을 그대로 저장해 두어야 다음 비교가 정확함
        r.json().then(function (back) {
          if (back && back[0] && back[0].updated_at) {
            localStorage.setItem(SYNC_TS_KEY, String(back[0].updated_at));
          }
        }).catch(function () {});
        pushStatus('완료 (' + nowHHMM() + ')');
      } else {
        pushStatus('실패' + (r ? ' HTTP ' + r.status : ''));
      }
      return ok;
    }).catch(function () { pushStatus('오류'); return false; });
  }

  function schedulePush() {
    if (!loggedIn()) return;
    localStorage.setItem(DIRTY_KEY, '1');   // 앱이 죽어도 '안 올라간 변경 있음'이 남도록
    if (!_syncReady) { pushStatus('연결 대기 중'); return; }
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(function () {
      _pushTimer = null;
      syncPush();
    }, 2500);   // 편집이 멎으면 올림
  }

  /** 예약된 업로드를 기다리지 않고 즉시 실행 (앱이 백그라운드로 갈 때) */
  function flushPush() {
    if (!loggedIn() || !_syncReady) return;
    if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
    if (localStorage.getItem(DIRTY_KEY) === '1') syncPush();
  }

  function initSync() {
    if (!loggedIn()) {
      syncStatus(readSession() ? '구글 로그인 필요 (지금은 게스트)' : '로그인 필요');
      return;
    }
    // 앱 시작 시에도 데이터 주인 확인 (다른 계정 데이터면 비우고 재시작)
    var ses = readSession();
    if (ses && ses.email && enforceDataOwner(ses.email)) return;
    syncStatus('연결 중...');
    // 로컬 저장이 일어날 때마다 클라우드로 밀어 올림
    if (typeof window.saveState === 'function' && !window.saveState._syncWrapped) {
      var orig = window.saveState;
      window.saveState = function () { orig.apply(this, arguments); schedulePush(); };
      window.saveState._syncWrapped = true;
    }
    syncPull(false);
    setInterval(function () { syncPull(false); }, 15000);   // 15초마다 최신 내용 확인
    // 앱을 열면 최신 내용 확인, 백그라운드로 가면 예약된 업로드 즉시 실행
    var App = capPlugin('App');
    if (App) {
      App.addListener('appStateChange', function (st) {
        if (st && st.isActive) syncPull(false);
        else flushPush();
      });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) flushPush();
    });
  }

  // ═══════════════════════════════════════════════
  // Electron API 셰임
  // ═══════════════════════════════════════════════
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

    // ── 로그인 ──
    getSession: function () { return Promise.resolve(readSession()); },
    guestLogin: function () {
      var s = { email: 'guest', guest: true, isAdmin: false };
      writeSession(s);
      return Promise.resolve(s);
    },
    googleLogin: function () {
      return new Promise(function (resolve) {
        if (!capPlugin('App')) { resolve({ error: 'not_configured' }); return; }
        _pendingLogin = resolve;
        // prompt=select_account: 폰에 기본 로그인된 구글 계정이 자동 선택되는 것을 막고
        // 항상 계정 선택 화면을 띄운다 (PC와 다른 계정으로 로그인되는 사고 방지)
        openExternalUrl(
          PUBLIC_CFG.SUPABASE_URL + '/auth/v1/authorize?provider=google&prompt=select_account' +
          '&redirect_to=' + encodeURIComponent(LOGIN_CALLBACK)
        );
        // 3분 내에 콜백이 없으면 실패 처리
        setTimeout(function () {
          if (_pendingLogin === resolve) { _pendingLogin = null; resolve(null); }
        }, 180000);
      });
    },
    logout: function () {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SYNC_TS_KEY);
      localStorage.removeItem(DIRTY_KEY);
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
    //   capturePhoto/choosePhotoDir (포토부스 파일 저장)
    //   openPaymentWindow (인앱 결제 → 외부 링크 폴백)
    //   setIgnoreMouseEvents/setFollow/getDisplays (데스크톱 전용)
    //   getAutoLaunch/setAutoLaunch (부팅 시 자동 실행 — 데스크톱 전용)
  };

  // ═══════════════════════════════════════════════
  // 탭 바: 아이콘 위 / 라벨 아래, 균등 너비
  // ═══════════════════════════════════════════════
  function formatTabs() {
    var tabs = document.querySelectorAll('#dashPanel .dash-tabs .dtab');
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      if (t.querySelector('.mtab-lbl')) continue;      // 이미 변환됨
      var raw = (t.textContent || '').trim();
      if (!raw) continue;
      var sp = raw.indexOf(' ');
      var ico = sp > 0 ? raw.slice(0, sp) : '';
      var lbl = sp > 0 ? raw.slice(sp + 1).trim() : raw;
      t.innerHTML = '';
      if (ico) {
        var si = document.createElement('span');
        si.className = 'mtab-ico'; si.textContent = ico;
        t.appendChild(si);
      }
      var sl = document.createElement('span');
      sl.className = 'mtab-lbl'; sl.textContent = lbl;
      t.appendChild(sl);
    }
  }

  // ═══════════════════════════════════════════════
  // 다이어리 이미지 저장/공유 (모바일 전용 캔버스 렌더)
  // ═══════════════════════════════════════════════
  function exportDiaryImgMobile() {
    var ta = document.getElementById('diaryText');
    var img = document.getElementById('diaryPhotoImg');
    var text = ta ? ta.value : '';
    var dateStr = '';
    try { if (typeof _diaryDate !== 'undefined') dateStr = _diaryDate || ''; } catch (e) {}
    var hasImg = img && img.src && img.style.display !== 'none';

    var W = 1080, PAD = 64, CW = W - PAD * 2;
    var cs = getComputedStyle(document.documentElement);
    var bg = (cs.getPropertyValue('--bg') || '#fff').trim();
    var fg = (cs.getPropertyValue('--white') || '#222').trim();
    var sub = (cs.getPropertyValue('--gray') || '#888').trim();
    var line = (cs.getPropertyValue('--border') || '#ddd').trim();

    var draw = function (photo) {
      var meas = document.createElement('canvas').getContext('2d');
      meas.font = '34px sans-serif';
      // 텍스트 줄바꿈 계산
      var rows = [];
      (text || '').split('\n').forEach(function (para) {
        if (!para) { rows.push(''); return; }
        var cur = '';
        for (var i = 0; i < para.length; i++) {
          var next = cur + para[i];
          if (meas.measureText(next).width > CW && cur) { rows.push(cur); cur = para[i]; }
          else cur = next;
        }
        rows.push(cur);
      });

      var LH = 52;
      var photoH = 0;
      if (photo) photoH = Math.min(760, Math.round(CW * photo.naturalHeight / photo.naturalWidth)) + 36;
      var H = PAD + 60 + photoH + rows.length * LH + PAD;
      if (H < 700) H = 700;

      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.fillStyle = bg; x.fillRect(0, 0, W, H);

      // 날짜 헤더
      x.fillStyle = sub;
      x.font = 'bold 34px sans-serif';
      x.fillText(dateStr, PAD, PAD + 26);
      x.strokeStyle = line; x.lineWidth = 2;
      x.beginPath(); x.moveTo(PAD, PAD + 48); x.lineTo(W - PAD, PAD + 48); x.stroke();

      var y = PAD + 60;
      // 사진
      if (photo) {
        var ih = Math.min(760, Math.round(CW * photo.naturalHeight / photo.naturalWidth));
        var iw = Math.round(ih * photo.naturalWidth / photo.naturalHeight);
        x.drawImage(photo, PAD + Math.round((CW - iw) / 2), y, iw, ih);
        y += ih + 36;
      }
      // 본문
      x.fillStyle = fg; x.font = '34px sans-serif';
      rows.forEach(function (r, i) { x.fillText(r, PAD, y + 34 + i * LH); });

      shareCanvas(c, 'diary-' + (dateStr || 'neko') + '.png');
    };

    if (hasImg) {
      var p = new Image();
      p.onload = function () { draw(p); };
      p.onerror = function () { draw(null); };
      p.src = img.src;
    } else draw(null);
  }

  /** 캔버스를 파일로 저장하고 공유 시트 열기 (인스타 스토리 등) */
  function shareCanvas(canvas, filename) {
    var dataUrl = canvas.toDataURL('image/png');
    var Fs = capPlugin('Filesystem'), Sh = capPlugin('Share');
    if (!Fs || !Sh) {
      var a = document.createElement('a');
      a.download = filename; a.href = dataUrl; a.click();
      return;
    }
    var base64 = dataUrl.split(',')[1];
    Fs.writeFile({ path: filename, data: base64, directory: 'CACHE' })
      .then(function (res) {
        return Sh.share({ title: 'NEKO DESK 다이어리', files: [res.uri] });
      })
      .then(function () { toast('reward', '📸', '공유 완료!'); })
      .catch(function () { toast('alert', '저장 실패', ''); });
  }

  // ═══════════════════════════════════════════════
  // 포토부스: 고양이 크기 축소 + 하단 4종 선택줄
  // ═══════════════════════════════════════════════
  // 합성 코드가 프레임 높이의 92%로 그리므로, 원본에 투명 여백을 둘러
  // 화면상 고양이만 작게 보이도록 한다 (합성 로직은 건드리지 않음).
  var PHOTO_CAT_PAD = 2.3;

  function paddedCatUrl(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = function () {
        try {
          var w = im.naturalWidth, h = im.naturalHeight;
          var c = document.createElement('canvas');
          c.width = Math.round(w * PHOTO_CAT_PAD);
          c.height = Math.round(h * PHOTO_CAT_PAD);
          var x = c.getContext('2d');
          x.imageSmoothingEnabled = false;
          x.drawImage(im, c.width - w, c.height - h, w, h);   // 오른쪽 아래 정렬
          res(c.toDataURL('image/png'));
        } catch (e) { res(null); }
      };
      im.onerror = function () { res(null); };
      im.src = src;
    });
  }

  function applyPhotoCat(url) {
    var el = document.getElementById('photoCat');
    if (!el || !url) return;
    paddedCatUrl(url).then(function (d) { el.src = d || url; });
  }

  function buildCatPicker() {
    if (document.getElementById('mCatPicker')) return;
    var frame = document.getElementById('photoFrame');
    var breeds = window._customBreeds || {};
    var ids = Object.keys(breeds).filter(function (id) { return breeds[id].image_url; });
    if (!frame || !ids.length) return;

    var bar = document.createElement('div');
    bar.id = 'mCatPicker';
    bar.style.cssText = 'display:flex;gap:6px;justify-content:center;padding:8px 0 0;flex-wrap:wrap';
    var st = getS();
    var curBreed = st && st.cat && st.cat.breed;

    ids.forEach(function (id) {
      var b = document.createElement('button');
      b.style.cssText = 'background:var(--frame-light);border:2px solid ' +
        (id === curBreed ? 'var(--acc)' : 'var(--frame)') +
        ';border-radius:6px;padding:3px;cursor:pointer;line-height:0';
      var im = document.createElement('img');
      im.src = breeds[id].image_url;
      im.style.cssText = 'width:34px;height:41px;image-rendering:pixelated;display:block;object-fit:contain';
      b.appendChild(im);
      b.onclick = function () {
        applyPhotoCat(breeds[id].image_url);
        Array.prototype.forEach.call(bar.children, function (c) { c.style.borderColor = 'var(--frame)'; });
        b.style.borderColor = 'var(--acc)';
      };
      bar.appendChild(b);
    });

    // 촬영 버튼 줄 바로 위에 삽입
    var shoot = frame.querySelector('.btn.btn-g');
    var row = shoot && shoot.parentElement;
    if (row && row.parentElement) row.parentElement.insertBefore(bar, row);
    else frame.appendChild(bar);
  }

  function hookPhotoBooth() {
    if (typeof window.openPhotoBooth !== 'function' || window.openPhotoBooth._mWrapped) return;
    var orig = window.openPhotoBooth;
    window.openPhotoBooth = function () {
      var r = orig.apply(this, arguments);
      setTimeout(function () {
        buildCatPicker();
        var st = getS();
        var cur = st && st.cat && window._customBreeds && window._customBreeds[st.cat.breed];
        if (cur && cur.image_url) applyPhotoCat(cur.image_url);
      }, 120);
      return r;
    };
    window.openPhotoBooth._mWrapped = true;
  }

  // ═══════════════════════════════════════════════
  // 부팅
  // ═══════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function () {
    var css = [
      // 대시보드 풀스크린 (창 프레임 개념 제거)
      '#dashPanel { width:100vw !important; height:100vh !important; max-height:100vh !important; border-radius:0 !important; }',
      '#dashboard { padding:0 !important; }',
      // 창 최소화/닫기 버튼 숨김 (모바일에선 의미 없음)
      '.dtb-btns { display:none !important; }',
      // 헤더: 고양이 버튼 + 포인트가 좁은 화면에서 넘치지 않도록
      '#dashPanel .dash-header { flex-wrap:wrap !important; gap:6px 8px; }',
      '.header-cat-btn, .header-pts { font-size:12px !important; padding:4px 9px !important; }',
      // body transparent(인라인) 무효화
      'body { background: var(--bg) !important; }',
      // 탭이 텍스트 선택으로 인식되는 것 방지 (이모지 파란 선택 현상)
      '* { -webkit-user-select:none !important; user-select:none !important; -webkit-tap-highlight-color:transparent; }',
      'input, textarea, [contenteditable] { -webkit-user-select:text !important; user-select:text !important; }',
      // ── 탭 바: 균등 너비 + 아이콘/라벨 2줄 ──
      '#dashPanel .dash-tabs { padding:0 !important; }',
      '#dashPanel .dtab {',
      '  flex:1 1 0 !important; min-width:0 !important;',
      '  display:flex !important; flex-direction:column; align-items:center; justify-content:center;',
      '  gap:3px; padding:9px 2px !important; font-size:10px !important;',
      '  line-height:1.2; text-align:center; white-space:nowrap;',
      '}',
      '#dashPanel .dtab .mtab-ico { font-size:17px; line-height:1; }',
      '#dashPanel .dtab .mtab-lbl { font-size:10px; letter-spacing:-0.3px; }',
      // 모바일은 업무 사이클을 쓰지 않으므로 홈의 사이클/업무시간 영역을 숨긴다
      // (스케줄 탭은 홈으로 통합되면서 사라짐)
      '#dp-home #homeCycleCol, #dp-home #homeWorkCard { display:none !important; }',
      // 가로 스크롤 방지: 어떤 페이지도 기기 폭을 넘지 않게
      'html, body, .dash-body, .dpage { max-width:100vw; overflow-x:hidden !important; }',
      '.dpage * { max-width:100%; box-sizing:border-box; }',

      // ── 다이어리: 캘린더를 화면 폭에 꽉 차게 (오른쪽 여백 제거) ──
      '#dp-diary .diary-top-row { flex-direction:column !important; }',
      '#dp-diary .diary-mini-cal { flex:1 1 100% !important; width:100% !important; }',
      // 두 캘린더(할 일 목록 · 다이어리)는 완전히 같은 규격으로 보이게 한다
      '#dp-diary .diary-cal-nav, #dp-schedule .cal-nav { font-size:20px !important; padding:4px 16px !important; }',
      '#dp-diary .diary-cal-cell, #calLeftGrid .cal-day { min-height:36px !important; font-size:11px !important; }',
      '#dp-diary .diary-cal-dows span, #dp-schedule .cal-grid > div { font-size:10px !important; }',
      '#dp-diary .diary-date-label, #dp-diary .diary-lines-area, #dp-diary .diary-btns { padding-left:14px !important; }',
      '#dp-diary .diary-nb { padding:12px !important; }',

      // (할 일 캘린더의 '점만 표시'는 이제 renderer 기본 동작이라 별도 규칙 불필요)

      // ── 고양이 탭: 잘림/찌그러짐 방지 ──
      '#dp-cat [style*="display:flex"] { flex-wrap:wrap !important; }',
      '#dp-cat .big-cat { width:110px !important; height:132px !important; flex-shrink:0 !important; }',
      '#dp-cat .breed-row { grid-template-columns:repeat(2,1fr) !important; }',
      '#dp-cat .breed-name { white-space:normal !important; font-size:12px !important; }',
      '#dp-cat .breed-desc { white-space:normal !important; font-size:10px !important; }',
      '#dp-cat #sellFruitBtn { flex-shrink:0 !important; }',
      '#dp-cat input { min-width:0 !important; }',
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

    initDeepLinkListener();

    // (사이클 영역 숨김은 위 CSS에서 처리)

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

    // renderer의 init()이 끝난 뒤 실행되어야 하는 것들
    setTimeout(function () {
      // 1) 다이어리 로컬 복원 — renderer의 loadState가 diaryEntries를 빠뜨림
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        var st0 = getS();
        if (raw && st0) {
          var saved = JSON.parse(raw);
          if (saved.diaryEntries && !Object.keys(st0.diaryEntries || {}).length) {
            st0.diaryEntries = saved.diaryEntries;
            if (typeof window.renderDiary === 'function') window.renderDiary();
          }
        }
      } catch (e) {}

      // 2) 탭 바 2줄 변환 + 언어 전환 후에도 유지
      formatTabs();
      if (typeof window.applyLang === 'function' && !window.applyLang._mtabWrapped) {
        var origLang = window.applyLang;
        window.applyLang = function () { origLang.apply(this, arguments); formatTabs(); };
        window.applyLang._mtabWrapped = true;
      }

      // 3) 다이어리 이미지 저장 → 모바일 공유 시트
      window.exportDiaryImg = exportDiaryImgMobile;

      // 3-1) 포토부스: 고양이 축소 + 하단 4종 선택줄
      hookPhotoBooth();

      // 4) 클라우드 동기화 시작 (구글 로그인 상태일 때만)
      initSync();
    }, 400);
  });
})();