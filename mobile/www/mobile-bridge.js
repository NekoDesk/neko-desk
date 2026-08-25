// ═══════════════════════════════════════════════
// mobile-bridge.js — Electron API의 모바일 대체 구현
// 데스크톱 renderer 코드를 수정 없이 모바일에서 돌리기 위한 셰임.
// 정의하지 않은 메서드는 renderer 쪽 가드(if 체크)에 의해
// 자동으로 폴백 동작하거나 비활성화됨.
// ═══════════════════════════════════════════════
(function () {
  'use strict';

  var APP_VERSION = '2.3.3-mobile';
  var SESSION_KEY = 'neko_mobile_session';
  var STORAGE_KEY = 'nekodesk_v3';        // renderer와 동일한 로컬 저장 키
  var SYNC_TS_KEY = 'neko_sync_pushed_at';
  var DIRTY_KEY = 'neko_sync_dirty';      // 아직 클라우드에 안 올라간 변경 존재 표시 (재시작에도 유지)
  var OWNER_KEY = 'neko_data_owner';      // 이 기기 데이터의 주인 계정 (계정별 데이터 분리)
  var CLAIM_KEY = 'neko_sync_claim';
  var LAST_PUSH_KEY = 'neko_sync_last_push';   // 마지막으로 올린 내용(비교용)
  var BASE_KEY = 'neko_sync_base';             // 두 기기가 마지막으로 합의한 상태      // 게스트로 쓴 기록을 계정에 합쳐야 함

  // 계정 간 동기화 대상 — renderer의 CLOUD_KEYS와 동일하게 유지할 것
  var SYNC_KEYS = [
    // 기록
    'calendarNotes', 'calendarDeleted', 'ddays', 'memoDoc', 'scheduleMemo', 'diaryEntries', 'wishlist', 'wishlistDone',
    // 고양이·진행 상태
    'cat', 'pts', 'fruits', 'harvestedFruits',
    'vitaminOn', 'vitaminTime', 'vitaminTimes', 'vitaminGoal', 'vitaminTaken', 'vitaminDate',
    'waterWorkOnly', 'alarms', 'growthLogs', 'ownedAccs', 'redeemedCoupons',
    // 설정
    'schedule', 'workItems', 'scheduleItems', 'theme', 'language'
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
      if (!owner) {
        // 게스트로 쓰던 기록을 이 계정 것으로 승계한다.
        // 클라우드에 이미 기록이 있어도 덮어쓰지 않고 합치도록 표시해 둔다.
        var hasLocal = false;
        try {
          var raw0 = localStorage.getItem(STORAGE_KEY);
          hasLocal = !!raw0 && !isEmptyPayload(JSON.parse(raw0));
        } catch (e2) {}
        if (hasLocal) {
          localStorage.setItem(CLAIM_KEY, '1');
          localStorage.setItem(DIRTY_KEY, '1');
        }
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
    el.textContent = '☁️ 동기화: '
      + (parts.length ? parts.join(' · ') : '대기 중');
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
    // localStorage가 사실상의 원본이다 (saveState가 매번 여기에 쓴다).
    // 메모리의 S를 못 잡는 상황에서도 업로드가 멈추지 않도록 이쪽을 먼저 본다.
    var src = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) src = JSON.parse(raw);
    } catch (e) {}
    if (!src) src = getS();
    var out = {};
    if (!src) return out;
    SYNC_KEYS.forEach(function (k) {
      if (src[k] !== undefined) out[k] = src[k];
    });
    return out;
  }

  /** 마지막으로 올린 내용과 달라졌으면 올린다.
   *  saveState 훅이 어떤 이유로 안 걸려도 업로드가 되도록 하는 안전망. */
  function pushIfChanged() {
    if (!loggedIn()) { pushStatus('\ub300\uae30(\ub85c\uadf8\uc778X)'); return; }
    if (!_syncReady) { pushStatus('\ub300\uae30(\ubc1b\uae30\uc804)'); return; }
    if (_pushTimer) { pushStatus('\uc608\uc57d\ub428'); return; }
    var now = '';
    try { now = JSON.stringify(collectLocal()); }
    catch (e) { pushStatus('\uc77d\uae30\uc624\ub958'); return; }
    if (!now || now === '{}') { pushStatus('\ub85c\uceec\ube44\uc5b4\uc788\uc74c'); return; }
    var last = '';
    try { last = localStorage.getItem(LAST_PUSH_KEY) || ''; } catch (e) {}
    if (now === last) { pushStatus('\ubcc0\uacbd\uc5c6\uc74c (' + nowHHMM() + ')'); return; }
    pushStatus('\uc62c\ub9ac\ub294 \uc911...');
    syncPush();
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
      if (typeof window.renderWorkItems === 'function') window.renderWorkItems();
      ['ptsDisplay', 'shopPts'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = st.pts;
      });
      if (typeof window.renderDdays === 'function') window.renderDdays();
      // 메모장은 편집 중이면 건드리지 않는다 (커서가 튀고 입력이 끊긴다)
      var doc = document.getElementById('memoDoc');
      if (doc && document.activeElement !== doc) {
        var incoming = st.memoDoc || '';
        if (doc.innerHTML !== incoming) {
          doc.innerHTML = incoming;
          if (typeof window.memoSnapAll === 'function') setTimeout(window.memoSnapAll, 0);
        }
      }
      var memo = document.getElementById('scheduleMemoTxt');
      if (memo) memo.value = st.scheduleMemo || '';
      pushWidget(false);          // PC에서 바뀐 내용도 바탕화면 위젯에 반영
    } catch (e) {}
    return true;
  }

  /**
   * 원격과 로컬을 병합 (로컬 우선).
   * diaryEntries/calendarNotes처럼 날짜별 객체는 항목 단위로 합쳐
   * 양쪽 기기의 기록을 모두 보존한다.
   */
  // ── 일정 병합: 항목별 최신 우선 (main.js와 같은 규칙) ──
  function mergeTombs(a, b) {
    var out = Object.assign({}, a || {});
    Object.keys(b || {}).forEach(function (id) {
      if (!(id in out) || b[id] > out[id]) out[id] = b[id];
    });
    return out;
  }
  function pruneTombs(tombs, keepMs) {
    var cut = Date.now() - (keepMs || 30 * 24 * 60 * 60 * 1000);
    var out = {};
    Object.keys(tombs || {}).forEach(function (id) { if (tombs[id] >= cut) out[id] = tombs[id]; });
    return out;
  }
  function mergeNotes(lNotes, lTombs, rNotes, rTombs) {
    var tombs = mergeTombs(lTombs, rTombs);
    var best = {};
    var collect = function (notes) {
      Object.keys(notes || {}).forEach(function (date) {
        var arr = notes[date];
        if (!Array.isArray(arr)) return;
        arr.forEach(function (it, idx) {
          if (!it || !it.id) return;
          var ts = it.ts || 0;
          var cur = best[it.id];
          if (!cur || ts > cur.ts) {
            best[it.id] = { item: it, date: date, ts: ts, ord: it.ord != null ? it.ord : idx };
          }
        });
      });
    };
    collect(lNotes);
    collect(rNotes);
    var byDate = {};
    Object.keys(best).forEach(function (id) {
      var e = best[id];
      var dead = tombs[id];
      if (dead !== undefined && dead >= e.ts) return;   // 삭제 확정
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });
    var out = {};
    Object.keys(byDate).forEach(function (date) {
      byDate[date].sort(function (a, b) { return (a.ord - b.ord) || (a.ts - b.ts); });
      out[date] = byDate[date].map(function (e) { return e.item; });
    });
    return { notes: out, tombs: pruneTombs(tombs) };
  }
  /** 병합 결과에서 일정 부분만 항목별 규칙으로 덮어쓴다 */
  function applyNotesMerge(merged, local, remote) {
    var r = mergeNotes(
      local && local.calendarNotes, local && local.calendarDeleted,
      remote && remote.calendarNotes, remote && remote.calendarDeleted);
    merged.calendarNotes = r.notes;
    merged.calendarDeleted = r.tombs;
    return merged;
  }

  // ── 3방향 병합 (main.js의 merge3와 같은 규칙) ──
  // base와 비교해야 '내가 지웠다'와 '상대가 더했다'를 구분할 수 있다.
  function jeq(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return a === b; }
  }
  function isPlainObj(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }
  function merge3(base, local, remote) {
    if (jeq(local, base)) return remote;   // 내가 안 건드렸으면 상대 것 (상대의 삭제도 수용)
    if (jeq(remote, base)) return local;   // 상대가 안 건드렸으면 내 것 (내 삭제도 반영)
    if (isPlainObj(local) && isPlainObj(remote)) {
      var out = {}, keys = {};
      [base, local, remote].forEach(function (o) {
        if (isPlainObj(o)) Object.keys(o).forEach(function (k) { keys[k] = 1; });
      });
      Object.keys(keys).forEach(function (k) {
        var v = merge3(isPlainObj(base) ? base[k] : undefined, local[k], remote[k]);
        if (v !== undefined) out[k] = v;
      });
      return out;
    }
    if (Array.isArray(local) && Array.isArray(remote)) {
      var arr = local.slice();
      remote.forEach(function (x) {
        for (var i = 0; i < arr.length; i++) { if (jeq(arr[i], x)) return; }
        arr.push(x);
      });
      return arr;
    }
    return local;
  }
  function readBase() {
    try { return JSON.parse(localStorage.getItem(BASE_KEY)); } catch (e) { return null; }
  }
  function setBase(payload) {
    var b = {};
    SYNC_KEYS.forEach(function (k) { if (payload && payload[k] !== undefined) b[k] = payload[k]; });
    try { localStorage.setItem(BASE_KEY, JSON.stringify(b)); } catch (e) {}
  }

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

  // 게스트 기록을 계정에 합칠 때만 쓰는 병합 — 어느 쪽도 버리지 않는다.
  var CLAIM_JOIN_FIELDS = ['scheduleMemo', 'text', 'memo', 'note', 'content'];
  function claimMergeVal(rv, lv, field) {
    if (rv === undefined || rv === null) return lv;
    if (lv === undefined || lv === null) return rv;
    if (typeof rv === 'number' && typeof lv === 'number') return Math.max(rv, lv);
    if (Array.isArray(rv) && Array.isArray(lv)) {
      var out = rv.slice();
      lv.forEach(function (x) {
        var s = JSON.stringify(x);
        for (var i = 0; i < out.length; i++) { if (JSON.stringify(out[i]) === s) return; }
        out.push(x);
      });
      return out;
    }
    if (typeof rv === 'string' && typeof lv === 'string') {
      // 메모·다이어리 본문만 이어붙인다. 테마·언어 같은 설정은 기기 값 유지.
      if (CLAIM_JOIN_FIELDS.indexOf(field) < 0) return lv;
      if (rv === lv || rv.indexOf(lv) >= 0) return rv;
      if (lv.indexOf(rv) >= 0) return lv;
      return rv + '\n' + lv;
    }
    if (typeof rv === 'object' && typeof lv === 'object'
        && !Array.isArray(rv) && !Array.isArray(lv)) {
      var o = Object.assign({}, rv);
      Object.keys(lv).forEach(function (k) {
        o[k] = (k in rv) ? claimMergeVal(rv[k], lv[k], k) : lv[k];
      });
      return o;
    }
    return lv;
  }
  function claimMerge(remote, local) {
    var out = {};
    SYNC_KEYS.forEach(function (k) {
      var v = claimMergeVal(remote ? remote[k] : undefined, local ? local[k] : undefined, k);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  /** 내 클라우드 행만 삭제 (RLS가 user_id = auth.uid()로 제한).
   *  renderer의 resetAllData()가 초기화할 때 호출한다. */
  window._mobileCloudDeleteMine = function () {
    var s = readSession();
    if (!s || s.guest || !s.uid) return Promise.resolve(false);
    if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
    return authFetch('/rest/v1/nekodesk_sync?user_id=eq.' + s.uid, { method: 'DELETE' })
      .then(function (r) { return !!(r && r.ok); })
      .catch(function () { return false; });
  };

  /** 클라우드 → 기기 */
  function syncPull(notify) {
    if (!loggedIn()) return Promise.resolve(false);
    // 올릴 것도 없고 기준선도 있으면 updated_at만 먼저 본다.
    // 바뀐 게 없으면 본문(수십 KB)을 받지 않으므로 자주 돌려도 가볍다.
    var quick = Promise.resolve(false);
    if (!_pushTimer && localStorage.getItem(DIRTY_KEY) !== '1' && readBase()) {
      quick = authFetch('/rest/v1/nekodesk_sync?select=updated_at', { method: 'GET' })
        .then(function (rh) { return rh && rh.ok ? rh.json() : null; })
        .then(function (hrows) {
          if (!hrows) return false;
          _syncReady = true;
          var hts = hrows.length ? String(hrows[0].updated_at || '') : '';
          if (hts && hts === (localStorage.getItem(SYNC_TS_KEY) || '')) {
            syncStatus('최신 (' + nowHHMM() + ')');
            return true;   // 더 받을 것 없음
          }
          return false;
        })
        .catch(function () { return false; });
    }
    return quick.then(function (done) {
      if (done) return false;
      return syncPullFull(notify);
    });
  }

  function syncPullFull(notify) {
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
          localStorage.removeItem(CLAIM_KEY);     // 합칠 원격 기록이 없음
          syncPush(true);                        // 클라우드가 비어 있으면 로컬을 올림
          syncStatus('클라우드 비어있음 (' + nowHHMM() + ')');
          return false;
        }
        // 기준선이 없으면(새로 설치·초기화 직후) 비교할 근거가 없다.
        // 병합하면 상대가 지운 항목을 되살리므로, 클라우드를 그대로 받아 기준선으로 삼는다.
        if (!readBase()) {
          var ok0 = applyRemote(remote);
          setBase(remote);
          localStorage.setItem(SYNC_TS_KEY, String(rows[0].updated_at || ''));
          localStorage.removeItem(CLAIM_KEY);
          syncStatus('받음 (' + nowHHMM() + ')');
          return ok0;
        }
        // 아직 안 올라간 내 변경이 있으면(앱을 껐다 켠 경우 포함) 원격으로 덮어쓰지 않고,
        // 원격과 병합한 결과를 올린다 — 양쪽 기기의 기록이 모두 살아남는다.
        if (_pushTimer || localStorage.getItem(DIRTY_KEY) === '1') {
          var claim = localStorage.getItem(CLAIM_KEY) === '1';
          var loc = collectLocal();
          var merged = claim ? claimMerge(remote, loc)
                             : merge3(readBase(), loc, remote);
          merged = applyNotesMerge(merged, loc, remote);   // 일정은 항목별로 다시 판정
          applyRemote(merged);
          setBase(merged);
          localStorage.removeItem(CLAIM_KEY);
          if (claim) toast('info', '☁️ 동기화', '게스트로 쓴 기록을 계정에 합쳤어요');
          syncStatus('내 변경 병합 (' + nowHHMM() + ')');
          return syncPush(true);
        }
        // 기기 시계와 서버 시계를 비교하면 시간차로 최신글을 놓칠 수 있음.
        // 서버가 돌려준 값이 마지막으로 본 값과 다르면 갱신한다.
        var remoteTs = String(rows[0].updated_at || '');
        var seenTs = localStorage.getItem(SYNC_TS_KEY) || '';
        if (remoteTs && remoteTs !== seenTs) {
          var ok = applyRemote(remote);
          setBase(remote);
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
        var payload = remote ? merge3(readBase(), local, remote) : local;
        if (remote) payload = applyNotesMerge(payload, local, remote);   // 일정은 항목별로
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
        // 방금 올린 로컬 상태를 기억해 둔다 (다음 비교 기준)
        try { localStorage.setItem(LAST_PUSH_KEY, JSON.stringify(local)); } catch (e) {}
        setBase(local);
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
    }, 1000);   // 편집이 멎고 1초 뒤 올림
  }

  /** 예약된 업로드를 기다리지 않고 즉시 실행 (앱이 백그라운드로 갈 때) */
  function flushPush() {
    if (!loggedIn() || !_syncReady) return;
    if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
    if (localStorage.getItem(DIRTY_KEY) === '1') { syncPush(); return; }
    pushIfChanged();
  }

  /** saveState에 업로드 훅을 건다. 아직 정의 전이면 잠시 뒤 다시 시도한다. */
  function wrapSaveState(tries) {
    if (typeof window.saveState === 'function') {
      if (!window.saveState._syncWrapped) {
        var orig = window.saveState;
        window.saveState = function () {
          orig.apply(this, arguments);
          schedulePush();
          try { pushWidget(false); } catch (e) {}
        };
        window.saveState._syncWrapped = true;
      }
      return;
    }
    if (tries < 10) setTimeout(function () { wrapSaveState(tries + 1); }, 500);
  }

  // ══════════════════════════════════════════════
  // 바탕화면 위젯 — D-day 전부와 어제·오늘·내일 할 일을 내보낸다
  // 네이티브(NekoWidget.java)가 이 내용을 받아 홈 화면에 그린다.
  // ══════════════════════════════════════════════
  var WIDGET_MAX_TODOS = 4;    // 오늘 칸에 보여줄 줄 수
  var WIDGET_MAX_SIDE = 3;     // 어제·내일 칸에 보여줄 줄 수
  var _widgetLast = '';

  // 위젯에 쓰는 낱말 — 앱 언어를 따라간다
  var WIDGET_WORDS = {
    ko: { empty: '오늘 할 일이 없어요', head: '📝 오늘 할 일', done: '완료',
          am: '오전', pm: '오후', yday: '어제', tmr: '내일', none: '없음' },
    en: { empty: 'Nothing scheduled today', head: '📝 Today', done: 'done',
          am: 'AM', pm: 'PM', yday: 'Yesterday', tmr: 'Tomorrow', none: 'None' },
    ja: { empty: '今日の予定はありません', head: '📝 今日の予定', done: '完了',
          am: '午前', pm: '午後', yday: '昨日', tmr: '明日', none: 'なし' }
  };

  var _widgetPlugin;   // undefined = 아직 안 찾아봄
  /** 안드로이드 네이티브 위젯 플러그인 (없으면 null) */
  function widgetBridge() {
    if (_widgetPlugin !== undefined) return _widgetPlugin;
    _widgetPlugin = null;
    try {
      var C = window.Capacitor;
      var android = C && (typeof C.getPlatform === 'function') && C.getPlatform() === 'android';
      if (android) {
        if (typeof C.registerPlugin === 'function') _widgetPlugin = C.registerPlugin('NekoWidget');
        else if (C.Plugins && C.Plugins.NekoWidget) _widgetPlugin = C.Plugins.NekoWidget;
      }
    } catch (e) {}
    return _widgetPlugin;
  }

  /** 오늘에서 며칠 떨어진 날의 "yyyy-mm-dd" */
  function dayKey(offset) {
    var d = new Date();
    d.setDate(d.getDate() + (offset || 0));
    return d.getFullYear() + '-' +
           ('0' + (d.getMonth() + 1)).slice(-2) + '-' +
           ('0' + d.getDate()).slice(-2);
  }
  function todayKey() { return dayKey(0); }

  /** 그 날짜의 살아 있는 일정을 순서대로 */
  function liveNotes(src, dateKey) {
    var tombs = src.calendarDeleted || {};
    var items = (src.calendarNotes || {})[dateKey];
    if (typeof items === 'string') items = [{ text: items, done: false }];
    if (!Array.isArray(items)) return [];
    return items
      .filter(function (it) { return it && it.text && !(it.id && tombs[it.id]); })
      .slice()
      .sort(function (a, b) { return (a.ord || 0) - (b.ord || 0); });
  }

  /** 어제·내일 칸 하나 분량 */
  function sideData(src, offset, label) {
    var list = liveNotes(src, dayKey(offset));
    return {
      label: label,
      total: list.length,
      todos: list.slice(0, WIDGET_MAX_SIDE).map(function (it) {
        return { text: String(it.text), done: !!it.done };
      })
    };
  }

  /** 위젯에 보낼 내용을 만든다 */
  function buildWidgetData() {
    var src = null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) src = JSON.parse(raw);
    } catch (e) {}
    if (!src) src = getS() || {};

    var w = WIDGET_WORDS[src.language] || WIDGET_WORDS.ko;
    var out = {
      ddays: [],
      emptyText: w.empty,
      headTitle: w.head,
      doneWord: w.done,
      noneWord: w.none,
      todoTotal: 0,               // 오늘 전체 개수 (화면에는 몇 줄만 보여도)
      todoDone: 0,
      todosDate: todayKey(),      // 위젯이 '어제 것'을 계속 보여주지 않도록
      todos: []
    };

    // D-day — 등록된 것 전부, 대시보드와 같은 날짜순
    out.ddays = (src.ddays || [])
      .filter(function (d) { return d && d.date && d.title; })
      .slice()
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
      .map(function (d) { return { title: String(d.title), date: String(d.date) }; });

    // 오늘 할 일
    var today = liveNotes(src, todayKey());
    out.todoTotal = today.length;
    out.todoDone = today.filter(function (it) { return !!it.done; }).length;
    out.todos = today.slice(0, WIDGET_MAX_TODOS).map(function (it) {
      var pm = it.ampm === 'pm';
      return {
        text: String(it.text),
        done: !!it.done,
        ampm: pm ? 'pm' : 'am',
        ampmLabel: pm ? w.pm : w.am
      };
    });

    // 어제 · 내일
    out.yesterday = sideData(src, -1, w.yday);
    out.tomorrow = sideData(src, 1, w.tmr);
    return out;
  }

  /** 내용이 달라졌을 때만 네이티브로 넘긴다 */
  function pushWidget(force) {
    var nb = widgetBridge();
    if (!nb) return;                     // 안드로이드가 아니거나 플러그인 없음
    var json;
    try { json = JSON.stringify(buildWidgetData()); } catch (e) { return; }
    if (!force && json === _widgetLast) return;
    _widgetLast = json;
    try {
      var p = nb.push({ json: json });
      // 실패하면 다음 번에 다시 보내도록 기억해 둔 값을 지운다
      if (p && typeof p.catch === 'function') p.catch(function () { _widgetLast = ''; });
    } catch (e) { _widgetLast = ''; }
  }

  function startWidgetFeed() {
    if (!widgetBridge()) return;
    pushWidget(true);
    // 날짜가 바뀌면 D-day 숫자도 어제·내일 칸도 달라지므로 주기적으로 다시 계산한다
    setInterval(function () { pushWidget(false); }, 30000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) pushWidget(true);
    });
  }

  // ══════════════════════════════════════════════
  // 포토부스: 찍은 사진을 폰 갤러리에 저장
  // 웹뷰에서는 <a download> 가 아무 일도 하지 않아서, 캔버스 그림을
  // 네이티브(PhotoPlugin)로 넘겨 MediaStore에 넣는다.
  // ══════════════════════════════════════════════
  var _photoPlugin;
  function photoPlugin() {
    if (_photoPlugin !== undefined) return _photoPlugin;
    _photoPlugin = null;
    try {
      var C = window.Capacitor;
      if (C && typeof C.getPlatform === 'function' && C.getPlatform() === 'android'
          && typeof C.registerPlugin === 'function') {
        _photoPlugin = C.registerPlugin('NekoPhoto');
      }
    } catch (e) {}
    return _photoPlugin;
  }

  function stamp() {
    var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
           p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /** renderer의 capturePhoto를 모바일용으로 감싼다 */
  function wrapCapturePhoto(tries) {
    var nb = photoPlugin();
    if (!nb) return;
    if (typeof window.capturePhoto === 'function' && !window.capturePhoto._mobile) {
      var orig = window.capturePhoto;
      window.capturePhoto = function () {
        var canvas = document.getElementById('photoCanvas');
        // 다이어리 사진 고르기처럼 콜백이 걸린 경우엔 원래 동작 그대로
        var hasCb = false;
        try { hasCb = (typeof _photoBoothCallback !== 'undefined') && !!_photoBoothCallback; }
        catch (e) {}
        if (hasCb || !canvas || !canvas.width) { return orig.apply(this, arguments); }

        var name = 'neko-' + stamp() + '.png';
        var data;
        try { data = canvas.toDataURL('image/png'); }
        catch (e) { toast('alert', '저장 실패', '사진을 만들지 못했어요'); return; }

        nb.save({ data: data, name: name }).then(function () {
          toast('reward', '찰칵!', '갤러리에 저장했어요 · ' + name);
        }).catch(function (err) {
          var m = (err && (err.message || err.errorMessage)) || '';
          toast('alert', '저장 실패', m || '갤러리에 저장하지 못했어요');
        });
      };
      window.capturePhoto._mobile = true;
      return;
    }
    if (tries < 20) setTimeout(function () { wrapCapturePhoto(tries + 1); }, 300);
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
    wrapSaveState(0);
    syncPull(false).then(function () { try { pushIfChanged(); } catch (e) {} });
    setInterval(function () {
      renderSyncStatus();       // 아무 일이 없어도 t가 올라가는 게 보이도록
      syncPull(false);
      try { pushIfChanged(); }   // 훅이 안 걸렸어도 바뀐 게 있으면 올린다
      catch (e) { pushStatus('\uc624\ub958: ' + (e && e.message ? e.message : e)); }
    }, 3000);   // 확인이 가벼워서 자주 돌아도 부담이 적다
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
  // 일정 수정: PC는 더블클릭, 모바일은 길게 누르기
  // ═══════════════════════════════════════════════
  function installLongPressEdit() {
    var timer = null;
    var cancel = function () { if (timer) { clearTimeout(timer); timer = null; } };
    document.addEventListener('touchstart', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('.todo-text') : null;
      if (!el) return;
      var row = el.closest('.todo-item[data-idx]');
      if (!row) return;
      var idx = Number(row.dataset.idx);
      cancel();
      timer = setTimeout(function () {
        timer = null;
        if (typeof window.editDayItem === 'function') window.editDayItem(idx);
      }, 500);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel', 'scroll'].forEach(function (ev) {
      document.addEventListener(ev, cancel, { passive: true });
    });
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
      '.hdr-btn { height:30px !important; font-size:12px !important; padding:0 10px !important; }',
      '.hdr-btn.icon { width:34px !important; padding:0 !important; }',
      '.hdr-actions { gap:6px !important; }',
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
      // 모바일에는 홈 화면이 없다 — 할 일 목록이 첫 화면
      '#dashPanel .dtab[data-page="home"] { display:none !important; }',
      '#dp-home { display:none !important; }',

      // ── 할 일 목록: 좁은 화면에서 잘리지 않게 ──
      '#dp-schedule .grid2 { gap:12px !important; }',
      '#dp-schedule .todo-item { gap:6px !important; flex-wrap:nowrap !important; }',
      '#dp-schedule .todo-item .todo-text { min-width:0 !important; flex:1 1 auto !important;',
      '  white-space:normal !important; word-break:break-word; }',
      '#dp-schedule .todo-item input[type="checkbox"] { width:20px !important; height:20px !important; flex-shrink:0 !important; }',
      '#dp-schedule .todo-handle { flex-shrink:0 !important; padding:2px 3px; font-size:15px !important; }',
      '#dp-schedule .ampm-btn { flex-shrink:0 !important; padding:2px 4px !important; font-size:10px !important; }',
      '#dp-schedule .sch-del-btn { flex-shrink:0 !important; }',
      // 입력 줄: 오전/오후 + 입력칸 + 추가 버튼이 넘치면 두 줄로
      '#dp-schedule .todo-add-row { flex-wrap:wrap !important; gap:6px !important; }',
      '#dp-schedule .todo-add-row input { min-width:0 !important; flex:1 1 140px !important; }',
      '#dp-schedule .todo-add-row .todo-add-btn { flex-shrink:0 !important; }',
      // 패널 안의 어떤 줄도 가로로 삐져나가지 않게
      '#dp-schedule .card { min-width:0 !important; overflow-x:hidden !important; }',
      '#calRightPanel > div { min-width:0 !important; }',
      // 메모장 표: 폰 화면에서는 글씨를 줄여야 세로로 덜 길어진다 (약 60%)
      '#dp-memo .memo-doc th, #dp-memo .memo-doc td { font-size:8px !important; height:20px !important;',
      '  line-height:20px !important; padding:0 4px !important; }',
      // 표는 좁은 화면에서 가로로 넘칠 수 있으니 그 안에서만 스크롤
      '#dp-memo .memo-table-wrap { overflow-x:auto; }',
      // 행·열 추가 버튼은 터치로 누르기 좋게
      '#dp-memo .mt-addcol { width:20px !important; }',
      '#dp-memo .mt-addrow { height:20px !important; }',
      // 가로 스크롤 방지: 어떤 페이지도 기기 폭을 넘지 않게
      'html, body, .dash-body, .dpage { max-width:100vw; overflow-x:hidden !important; }',
      '.dpage * { max-width:100%; box-sizing:border-box; }',

      // 할 일 캘린더는 터치에 맞게 조금 크게 (다이어리는 팝업으로 이동)
      '#dp-schedule .cal-nav { font-size:20px !important; padding:4px 16px !important; }',
      '#calLeftGrid .cal-day { min-height:36px !important; font-size:11px !important; }',
      '#dp-schedule .cal-grid > div { font-size:10px !important; }',
      '#diaryModal .diary-nb { padding:12px !important; }',
      '#diaryModal .diary-lines-area { padding-left:14px !important; }',

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
      '  .dash-body { padding: 12px !important; }',
      '}',
      // ── 포토부스: 화면에 다 들어오게 ──
      // 세로 화면에서는 내용이 화면보다 길어 위아래가 잘렸다.
      // 위에서부터 쌓고, 넘치면 스크롤되게 하고, 시스템 바 자리를 비워둔다.
      '#photoModal {',
      '  align-items:flex-start !important;',
      '  overflow-y:auto !important;',
      '  -webkit-overflow-scrolling:touch;',
      '  padding-top:calc(env(safe-area-inset-top, 0px) + 8px) !important;',
      '  padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 12px) !important;',
      '}',
      '#photoFrame { width:96% !important; margin:auto !important; }',
      // 카메라 그림은 화면 절반을 넘지 않게 — 아래 버튼이 밀려나지 않도록
      '#photoCanvas { max-height:52vh !important; object-fit:contain !important;',
      '  aspect-ratio:auto !important; }',
      '#photoModal button { min-height:34px !important; }'
    ].join('\n');
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    // env(safe-area-inset-*)가 0이 아니려면 viewport-fit=cover 가 있어야 한다
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp && vp.content.indexOf('viewport-fit') < 0) {
      vp.setAttribute('content', vp.content + ', viewport-fit=cover');
    }

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

      // 3-1) 포토부스: 고양이 축소 + 하단 4종 선택줄
      hookPhotoBooth();

      // 3-2) 모바일 첫 화면은 할 일 목록. 메모장은 목록 아래로 내린다.
      try {
        var page = document.getElementById('dp-schedule');
        var memo = document.getElementById('scheduleMemoTxt');
        var memoCard = memo && memo.closest ? memo.closest('.card') : null;
        if (page && memoCard && memoCard.parentElement !== page) {
          memoCard.style.marginTop = '12px';
          page.appendChild(memoCard);          // .grid2 밖 → 항상 맨 아래
        }
        // 홈이 없으므로 홈으로 가는 동작(헤더 로고 등)은 할 일 목록으로 보낸다
        if (typeof window.dTab === 'function' && !window.dTab._mNoHome) {
          var origTab = window.dTab;
          window.dTab = function (name) {
            return origTab.call(this, name === 'home' ? 'schedule' : name);
          };
          window.dTab._mNoHome = true;
        }
        if (typeof window.dTab === 'function') window.dTab('schedule');
      } catch (e) {}

      // 3-3) 모바일엔 더블클릭이 없다 — 일정을 길게 눌러 수정
      installLongPressEdit();

      // 4) 클라우드 동기화 시작 (구글 로그인 상태일 때만)
      initSync();

      // 5) 바탕화면 위젯에 내용 전달
      startWidgetFeed();

      // 6) 사진을 갤러리에 저장하도록 교체
      wrapCapturePhoto(0);
    }, 400);
  });
})();