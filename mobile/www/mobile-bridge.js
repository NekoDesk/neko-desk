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

  // 계정 간 동기화 대상 (할 일 목록 + 다이어리)
  var SYNC_KEYS = ['calendarNotes', 'scheduleMemo', 'diaryEntries', 'wishlist', 'wishlistDone'];

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
  function capPlugin(name) {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null;
  }
  function toast(kind, title, msg) {
    if (typeof window.toast === 'function') window.toast(kind, title, msg);
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
    opts.headers = Object.assign({
      apikey: PUBLIC_CFG.SUPABASE_KEY,
      Authorization: 'Bearer ' + s.token,
      'Content-Type': 'application/json'
    }, opts.headers || {});
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
    var out = {};
    if (typeof window.S === 'undefined') return out;
    SYNC_KEYS.forEach(function (k) {
      if (window.S[k] !== undefined) out[k] = window.S[k];
    });
    return out;
  }

  /** 원격 데이터를 S에 반영하고 화면 갱신 */
  function applyRemote(data) {
    if (!data || typeof window.S === 'undefined') return false;
    var changed = false;
    SYNC_KEYS.forEach(function (k) {
      if (data[k] !== undefined) { window.S[k] = data[k]; changed = true; }
    });
    if (!changed) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(window.S));
      // 화면 다시 그리기
      if (typeof window.renderAll === 'function') window.renderAll();
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
      if (typeof window.renderDiary === 'function') window.renderDiary();
      var memo = document.getElementById('scheduleMemoTxt');
      if (memo) memo.value = window.S.scheduleMemo || '';
    } catch (e) {}
    return true;
  }

  /** 클라우드 → 기기 */
  function syncPull(notify) {
    if (!loggedIn()) return Promise.resolve(false);
    return authFetch('/rest/v1/nekodesk_sync?select=data,updated_at', { method: 'GET' })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (rows) {
        _syncReady = true;                       // 조회 성공 → 이제 push 허용
        if (!rows || !rows.length || !rows[0].data) {
          syncPush(true);                        // 클라우드가 비어 있으면 로컬을 올림
          return false;
        }
        var remoteTs = new Date(rows[0].updated_at || 0).getTime();
        var pushedTs = Number(localStorage.getItem(SYNC_TS_KEY) || 0);
        // 이 기기가 마지막으로 올린 것보다 원격이 최신일 때만 덮어씀
        if (remoteTs > pushedTs) {
          var ok = applyRemote(rows[0].data);
          localStorage.setItem(SYNC_TS_KEY, String(remoteTs));
          if (ok && notify) toast('info', '☁️ 동기화', 'PC의 최신 내용을 가져왔어요');
          return ok;
        }
        return false;
      })
      .catch(function () { return false; });
  }

  /** 기기 → 클라우드 */
  function syncPush(force) {
    if (!loggedIn() || (!_syncReady && !force)) return Promise.resolve(false);
    var s = readSession();
    var body = { user_id: s.uid, data: collectLocal(), updated_at: new Date().toISOString() };
    return authFetch('/rest/v1/nekodesk_sync?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body)
    }).then(function (r) {
      var ok = !!(r && r.ok);
      if (ok) localStorage.setItem(SYNC_TS_KEY, String(Date.now()));
      return ok;
    }).catch(function () { return false; });
  }

  function schedulePush() {
    if (!loggedIn() || !_syncReady) return;
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(syncPush, 2500);   // 편집이 멎으면 올림
  }

  function initSync() {
    if (!loggedIn()) return;
    // 로컬 저장이 일어날 때마다 클라우드로 밀어 올림
    if (typeof window.saveState === 'function' && !window.saveState._syncWrapped) {
      var orig = window.saveState;
      window.saveState = function () { orig.apply(this, arguments); schedulePush(); };
      window.saveState._syncWrapped = true;
    }
    syncPull(false);
    // 앱을 다시 열 때마다 최신 내용 확인
    var App = capPlugin('App');
    if (App) {
      App.addListener('appStateChange', function (st) {
        if (st && st.isActive) syncPull(false);
      });
    }
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
      localStorage.removeItem(SYNC_TS_KEY);
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
    var dateStr = window._diaryDate || '';
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
  // 부팅
  // ═══════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function () {
    var css = [
      // 대시보드 풀스크린 (창 프레임 개념 제거)
      '#dashPanel { width:100vw !important; height:100vh !important; max-height:100vh !important; border-radius:0 !important; }',
      '#dashboard { padding:0 !important; }',
      // 창 최소화/닫기 버튼 숨김 (모바일에선 의미 없음)
      '.dtb-btns { display:none !important; }',
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
      // 업무 사이클(스케줄) 탭 제거 — 위 규칙보다 우선순위 높게
      '#dashPanel .dtab[onclick*="cycle"] { display:none !important; }',
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

    // renderer의 init()이 끝난 뒤 실행되어야 하는 것들
    setTimeout(function () {
      // 1) 다이어리 로컬 복원 — renderer의 loadState가 diaryEntries를 빠뜨림
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw && typeof window.S !== 'undefined') {
          var saved = JSON.parse(raw);
          if (saved.diaryEntries && !Object.keys(window.S.diaryEntries || {}).length) {
            window.S.diaryEntries = saved.diaryEntries;
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

      // 4) 클라우드 동기화 시작 (구글 로그인 상태일 때만)
      initSync();
    }, 400);
  });
})();