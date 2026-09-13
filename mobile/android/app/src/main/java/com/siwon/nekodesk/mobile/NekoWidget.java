package com.siwon.nekodesk.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RectF;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.TextUtils;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Base64;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Calendar;
import java.util.Locale;

import org.json.JSONArray;
import org.json.JSONObject;

public class NekoWidget extends AppWidgetProvider {

    protected int layoutId()   { return R.layout.neko_widget; }
    protected boolean showHealth() { return true; }
    protected boolean showDday()   { return true; }
    protected boolean showTodo()   { return true; }
    protected boolean showTable()  { return false; }
    protected boolean showCat()    { return false; }

    public static final String PREFS = "neko_widget";
    public static final String KEY_DATA = "data";
    public static final String KEY_TOGGLES = "pending_toggles";
    public static final String KEY_WATER_ADD = "pending_water_add";
    public static final String KEY_VITA_ADD = "pending_vita_add";
    public static final String KEY_CAT_FEED = "pending_cat_feed";
    public static final String KEY_CAT_PLAY = "pending_cat_play";
    public static final String ACTION_REFRESH = "com.siwon.nekodesk.mobile.WIDGET_REFRESH";
    public static final String ACTION_TOGGLE = "com.siwon.nekodesk.mobile.WIDGET_TOGGLE";
    public static final String ACTION_WATER = "com.siwon.nekodesk.mobile.WIDGET_WATER";
    public static final String ACTION_VITA = "com.siwon.nekodesk.mobile.WIDGET_VITA";
    public static final String ACTION_CAT_FEED = "com.siwon.nekodesk.mobile.WIDGET_CAT_FEED";
    public static final String ACTION_CAT_PLAY = "com.siwon.nekodesk.mobile.WIDGET_CAT_PLAY";
    public static final String ACTION_CAT_CALL = "com.siwon.nekodesk.mobile.WIDGET_CAT_CALL";
    private static final String KEY_SND_IDX = "cat_snd_idx";
    /** 서버에서 받아 둔 소리의 파일 경로 {"touch":[...],"call1":...} — 없으면 내장 소리 */
    static final String KEY_SND_PATHS = "cat_snd_paths";
    private static final String EXTRA_TODO_ID = "todo_id";
    private static final String EXTRA_DATE_KEY = "date_key";
    private static final String EXTRA_INDEX = "index";
    private static final int MOOD_HEART = 0xFFF2506E;   // 고양이 기분 하트 (iOS와 같은 값)

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(ctx, mgr, id);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String action = intent.getAction();
        if (ACTION_REFRESH.equals(action)) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, getClass()));
            for (int id : ids) render(ctx, mgr, id);
        } else if (ACTION_TOGGLE.equals(action)) {
            String todoId = intent.getStringExtra(EXTRA_TODO_ID);
            String dateKey = intent.getStringExtra(EXTRA_DATE_KEY);
            if (todoId != null && dateKey != null) {
                toggleTodo(ctx, todoId, dateKey);
            }
        } else if (ACTION_WATER.equals(action)) {
            int idx = intent.getIntExtra(EXTRA_INDEX, -1);
            if (idx >= 0) setHealth(ctx, "waterDone", "waterGoal", 8, KEY_WATER_ADD, idx);
            else addWater(ctx);
        } else if (ACTION_VITA.equals(action)) {
            int idx = intent.getIntExtra(EXTRA_INDEX, -1);
            if (idx >= 0) setHealth(ctx, "vitaDone", "vitaGoal", 1, KEY_VITA_ADD, idx);
            else addVita(ctx);
        } else if (ACTION_CAT_FEED.equals(action)) {
            feedCat(ctx);
        } else if (ACTION_CAT_PLAY.equals(action)) {
            playCat(ctx);
        } else if (ACTION_CAT_CALL.equals(action)) {
            // 부르기는 소리만 낸다 — 앱의 '고양이 부르기'와 같다 (기분은 그대로)
            String p = soundPath(ctx, "call1", 0);
            if (p == null || !playFile(ctx, p)) playSound(ctx, R.raw.cat_calling_03);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opts) {
        super.onAppWidgetOptionsChanged(ctx, mgr, id, opts);
        render(ctx, mgr, id);
    }

    private static final Class<?>[] PROVIDERS = {
        NekoWidget.class, NekoWidgetFull.class, NekoWidgetDday.class,
        NekoWidgetTodo.class, NekoWidgetTt.class, NekoWidgetCat.class,
    };

    private static void refreshAll(Context ctx) {
        for (Class<?> c : PROVIDERS) {
            ctx.sendBroadcast(new Intent(ctx, c).setAction(ACTION_REFRESH));
        }
    }

    /**
     * 위젯이 들고 있던 것을 통째로 지운다 (계정 삭제 · 데이터 초기화).
     * 앱 기록만 지우면 바탕화면 위젯에는 할 일이 그대로 남아 있어,
     * 지웠다고 생각한 사람이 다시 보게 된다.
     */
    public static void clear(Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        refreshAll(ctx);
    }

    public static void push(Context ctx, String json) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putString(KEY_DATA, json).apply();
        refreshAll(ctx);
    }

    private static void toggleTodo(Context ctx, String todoId, String dateKey) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_DATA, null);
        if (json == null) return;

        try {
            JSONObject o = new JSONObject(json);
            JSONArray todos = o.optJSONArray("todos");
            if (todos == null) return;

            boolean newDone = false;
            for (int i = 0; i < todos.length(); i++) {
                JSONObject it = todos.optJSONObject(i);
                if (it != null && todoId.equals(it.optString("id", ""))) {
                    boolean wasDone = it.optBoolean("done", false);
                    newDone = !wasDone;
                    it.put("done", newDone);
                    int done = o.optInt("todoDone", 0);
                    o.put("todoDone", wasDone ? Math.max(0, done - 1) : done + 1);
                    break;
                }
            }

            sp.edit().putString(KEY_DATA, o.toString()).apply();

            String raw = sp.getString(KEY_TOGGLES, "[]");
            JSONArray toggles = new JSONArray(raw);
            JSONObject t = new JSONObject();
            t.put("id", todoId);
            t.put("dateKey", dateKey);
            t.put("done", newDone);
            toggles.put(t);
            sp.edit().putString(KEY_TOGGLES, toggles.toString()).apply();

        } catch (Exception ignored) {}

        refreshAll(ctx);
    }

    private static void addWater(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_DATA, null);
        if (json == null) return;

        try {
            JSONObject o = new JSONObject(json);
            JSONObject h = o.optJSONObject("health");
            if (h == null) return;
            int done = h.optInt("waterDone", 0);
            int goal = h.optInt("waterGoal", 8);
            if (done >= goal) return;
            h.put("waterDone", done + 1);
            sp.edit().putString(KEY_DATA, o.toString()).apply();
            sp.edit().putInt(KEY_WATER_ADD, sp.getInt(KEY_WATER_ADD, 0) + 1).apply();
        } catch (Exception ignored) {}

        refreshAll(ctx);
    }

    /** 컵·알약 하나를 눌렀다 — 이미 마신 컵이면 그 컵부터 되돌리고, 아니면 그 컵까지 마신 걸로 */
    private static void setHealth(Context ctx, String doneKey, String goalKey, int defGoal,
                                  String pendingKey, int idx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_DATA, null);
        if (json == null) return;

        try {
            JSONObject o = new JSONObject(json);
            JSONObject h = o.optJSONObject("health");
            if (h == null) return;
            int done = h.optInt(doneKey, 0);
            int goal = h.optInt(goalKey, defGoal);
            int next = Math.max(0, Math.min(goal, idx < done ? idx : idx + 1));
            if (next == done) return;
            h.put(doneKey, next);
            sp.edit().putString(KEY_DATA, o.toString())
              .putInt(pendingKey, sp.getInt(pendingKey, 0) + (next - done)).apply();
        } catch (Exception ignored) {}

        refreshAll(ctx);
    }

    private static void addVita(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_DATA, null);
        if (json == null) return;

        try {
            JSONObject o = new JSONObject(json);
            JSONObject h = o.optJSONObject("health");
            if (h == null) return;
            int done = h.optInt("vitaDone", 0);
            int goal = h.optInt("vitaGoal", 1);
            if (done >= goal) return;
            h.put("vitaDone", done + 1);
            sp.edit().putString(KEY_DATA, o.toString()).apply();
            sp.edit().putInt(KEY_VITA_ADD, sp.getInt(KEY_VITA_ADD, 0) + 1).apply();
        } catch (Exception ignored) {}

        refreshAll(ctx);
    }

    private static void feedCat(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_DATA, null);
        if (json == null) return;

        try {
            JSONObject o = new JSONObject(json);
            JSONObject c = o.optJSONObject("cat");
            if (c == null) return;
            int pts = c.optInt("pts", 0);
            if (pts < 20) return;
            c.put("mood", Math.min(100, c.optInt("mood", 60) + 10));
            c.put("pts", pts - 20);
            sp.edit().putString(KEY_DATA, o.toString()).apply();
            sp.edit().putInt(KEY_CAT_FEED, sp.getInt(KEY_CAT_FEED, 0) + 1).apply();
            meow(ctx);
        } catch (Exception ignored) {}

        refreshAll(ctx);
    }

    /** 고양이를 만질 때 나는 소리 — 앱과 같은 차례로 돌아간다 */
    private static final int[] CAT_TOUCH_SND = {
        R.raw.cat_touch_01, R.raw.cat_touch_02, R.raw.cat_touch_03,
        R.raw.cat_touch_04, R.raw.cat_touch_05,
    };

    /** 다음 차례의 만지는 소리. 어디까지 왔는지는 저장해 둔다 (위젯은 눌릴 때마다 새로 뜬다) */
    private static void meow(Context ctx) {
        if (!soundAllowed(ctx)) return;
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int remote = touchCount(ctx);
        int n = remote > 0 ? remote : CAT_TOUCH_SND.length;
        int i = (sp.getInt(KEY_SND_IDX, -1) + 1) % n;
        sp.edit().putInt(KEY_SND_IDX, i).apply();
        if (remote > 0) {
            String p = soundPath(ctx, "touch", i);
            if (p != null && playFile(ctx, p)) return;
        }
        playSound(ctx, CAT_TOUCH_SND[i % CAT_TOUCH_SND.length]);
    }

    // ── 서버에서 받은 소리 ──────────────────────────────
    // 앱이 서버 목록을 받으면 여기로 넘긴다. 위젯은 앱과 다른 프로세스라
    // 파일로 건네야 해서, 내려받아 앱 전용 폴더에 두고 경로만 남긴다.
    // 이미 받은 파일은 다시 받지 않는다. 못 받으면 내장 소리를 그대로 쓴다.

    /** 앱이 넘긴 목록을 내려받아 두고 경로를 남긴다 — 반드시 백그라운드 스레드에서 */
    static void cacheSounds(Context ctx, String json) throws Exception {
        JSONObject m = new JSONObject(json);
        java.io.File dir = new java.io.File(ctx.getFilesDir(), "sounds");
        if (!dir.exists()) dir.mkdirs();
        JSONObject out = new JSONObject();
        JSONArray touch = m.optJSONArray("touch");
        JSONArray tp = new JSONArray();
        if (touch != null) {
            for (int i = 0; i < touch.length(); i++) {
                String p = fetchSound(dir, touch.optString(i, ""));
                if (p != null) tp.put(p);
            }
        }
        out.put("touch", tp);
        for (String k : new String[]{"call1", "call2", "water", "fruit"}) {
            String u = m.optString(k, "");
            if (u.isEmpty()) continue;
            String p = fetchSound(dir, u);
            if (p != null) out.put(k, p);
        }
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
           .edit().putString(KEY_SND_PATHS, out.toString()).apply();
    }

    /** 주소 하나를 내려받는다. 이미 있으면 그 경로를 돌려준다 */
    private static String fetchSound(java.io.File dir, String url) {
        if (url == null || url.isEmpty()) return null;
        try {
            String name = Integer.toHexString(url.hashCode()) + ".snd";
            java.io.File f = new java.io.File(dir, name);
            if (f.exists() && f.length() > 0) return f.getAbsolutePath();
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(15000);
            if (c.getResponseCode() != 200) return null;
            java.io.File tmp = new java.io.File(dir, name + ".part");
            try (java.io.InputStream in = c.getInputStream();
                 java.io.FileOutputStream o = new java.io.FileOutputStream(tmp)) {
                byte[] b = new byte[8192];
                int r;
                while ((r = in.read(b)) > 0) o.write(b, 0, r);
            }
            if (!tmp.renameTo(f)) return null;
            return f.getAbsolutePath();
        } catch (Exception e) { return null; }
    }

    /** 서버 소리의 파일 경로. 없으면 null — 그러면 내장 소리를 쓴다 */
    private static String soundPath(Context ctx, String role, int idx) {
        try {
            String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SND_PATHS, null);
            if (raw == null) return null;
            JSONObject m = new JSONObject(raw);
            if ("touch".equals(role)) {
                JSONArray a = m.optJSONArray("touch");
                if (a == null || a.length() == 0) return null;
                String p = a.optString(idx % a.length(), "");
                return p.isEmpty() ? null : p;
            }
            String p = m.optString(role, "");
            return p.isEmpty() ? null : p;
        } catch (Exception e) { return null; }
    }

    /** 서버에서 받은 쓰다듬기 소리 개수 (0이면 내장본으로) */
    private static int touchCount(Context ctx) {
        try {
            String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SND_PATHS, null);
            if (raw == null) return 0;
            JSONArray a = new JSONObject(raw).optJSONArray("touch");
            return a == null ? 0 : a.length();
        } catch (Exception e) { return 0; }
    }

    /**
     * 진동·무음 모드면 소리를 내지 않는다. 진동 모드에서는 대신 짧게 떤다.
     * 앱과 같은 규칙 — 부르기만 예외라서 그쪽은 이걸 거치지 않는다.
     * @return true 면 소리를 내도 된다
     */
    private static boolean soundAllowed(Context ctx) {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return true;
        int m = am.getRingerMode();
        if (m == AudioManager.RINGER_MODE_NORMAL) return true;
        if (m == AudioManager.RINGER_MODE_VIBRATE) tap(ctx);
        return false;
    }

    /** 소리 대신 내는 짧은 떨림 */
    private static void tap(Context ctx) {
        try {
            Vibrator v;
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                v = vm == null ? null : vm.getDefaultVibrator();
            } else {
                v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (v == null) return;
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(40);
        } catch (Exception ignored) {}
    }

    /** 파일로 소리를 낸다. 파일이 없거나 못 열면 false — 부른 쪽이 내장 소리로 넘어간다 */
    private static boolean playFile(Context ctx, String path) {
        try {
            java.io.File f = new java.io.File(path);
            if (!f.exists() || f.length() == 0) return false;
            MediaPlayer mp = new MediaPlayer();
            mp.setDataSource(path);
            mp.prepare();
            mp.setOnCompletionListener(p -> p.release());
            mp.start();
            return true;
        } catch (Exception e) { return false; }
    }

    /** 소리 하나를 낸다. 다 울면 스스로 놓아 준다 (안 놓으면 소리 통로가 쌓인다) */
    private static void playSound(Context ctx, int resId) {
        try {
            MediaPlayer mp = MediaPlayer.create(ctx, resId);
            if (mp == null) return;
            mp.setOnCompletionListener(p -> p.release());
            mp.start();
        } catch (Exception ignored) {}
    }

    private static void playCat(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_DATA, null);
        if (json == null) return;

        try {
            JSONObject o = new JSONObject(json);
            JSONObject c = o.optJSONObject("cat");
            if (c == null) return;
            c.put("mood", Math.min(100, c.optInt("mood", 60) + 10));
            sp.edit().putString(KEY_DATA, o.toString()).apply();
            sp.edit().putInt(KEY_CAT_PLAY, sp.getInt(KEY_CAT_PLAY, 0) + 1).apply();
            meow(ctx);
        } catch (Exception ignored) {}

        refreshAll(ctx);
    }

    /** 대기 중인 변경사항을 JSON으로 꺼내고 비운다 */
    public static String consumePending(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONObject out = new JSONObject();
            out.put("toggles", sp.getString(KEY_TOGGLES, "[]"));
            out.put("waterAdd", sp.getInt(KEY_WATER_ADD, 0));
            out.put("vitaAdd", sp.getInt(KEY_VITA_ADD, 0));
            out.put("catFeed", sp.getInt(KEY_CAT_FEED, 0));
            out.put("catPlay", sp.getInt(KEY_CAT_PLAY, 0));
            sp.edit()
                .remove(KEY_TOGGLES)
                .remove(KEY_WATER_ADD)
                .remove(KEY_VITA_ADD)
                .remove(KEY_CAT_FEED)
                .remove(KEY_CAT_PLAY)
                .apply();
            return out.toString();
        } catch (Exception e) {
            return "{\"toggles\":\"[]\",\"waterAdd\":0,\"vitaAdd\":0,\"catFeed\":0,\"catPlay\":0}";
        }
    }

    private static Integer daysFromToday(String dateKey) {
        try {
            String[] p = dateKey.split("-");
            if (p.length != 3) return null;
            Calendar target = Calendar.getInstance();
            target.clear();
            target.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
            Calendar today = Calendar.getInstance();
            today.set(Calendar.HOUR_OF_DAY, 0);
            today.set(Calendar.MINUTE, 0);
            today.set(Calendar.SECOND, 0);
            today.set(Calendar.MILLISECOND, 0);
            long ms = target.getTimeInMillis() - today.getTimeInMillis();
            return (int) Math.round(ms / 86400000.0);
        } catch (Exception e) {
            return null;
        }
    }

    private static String ddayText(int diff) {
        if (diff == 0) return "D-DAY";
        return diff > 0 ? ("D-" + diff) : ("D+" + (-diff));
    }

    private static String todayKey() {
        Calendar c = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d",
                c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private static String shortDate(String dateKey) {
        String[] p = dateKey.split("-");
        return (p.length == 3) ? (p[1] + "." + p[2]) : dateKey;
    }

    private static void setBg(RemoteViews v, int viewId, int resId) {
        v.setInt(viewId, "setBackgroundResource", resId);
    }

    /**
     * 물 한 잔을 그린다. 컵 모양(아래가 좁은 사다리꼴)은 shape 로는 못 그려서 벡터 그림을 쓰는데,
     * 위젯에 벡터를 넣는 것은 안드로이드 7(N)부터 믿을 수 있다. 그 아래에서는 예전 네모로 둔다.
     * @param empty 이미 마신 자리(빈 컵)면 true
     */
    private static void setCup(RemoteViews v, boolean empty) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            setBg(v, R.id.i_dot, 0);
            v.setImageViewResource(R.id.i_dot, empty ? R.drawable.w_cup2_off : R.drawable.w_cup2_on);
        } else {
            setBg(v, R.id.i_dot, empty ? R.drawable.w_cup_off : R.drawable.w_cup_on);
        }
    }

    private static CharSequence struck(String text) {
        SpannableString s = new SpannableString(text);
        s.setSpan(new StrikethroughSpan(), 0, text.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return s;
    }

    private void render(Context ctx, AppWidgetManager mgr, int id) {
        String pkg = ctx.getPackageName();
        RemoteViews v = new RemoteViews(pkg, layoutId());

        String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                         .getString(KEY_DATA, null);
        JSONObject o = null;
        if (json != null) {
            try { o = new JSONObject(json); } catch (Exception ignored) {}
        }
        if (o == null) o = new JSONObject();

        final int th = WidgetTheme.index(o.optString("theme", "white"));
        final int cText = WidgetTheme.text(th), cDim = WidgetTheme.dim(th);
        setBg(v, R.id.w_root, WidgetTheme.bg(th, WidgetTheme.BG));
        v.setTextColor(R.id.w_brand, cText);
        v.setTextColor(R.id.w_refresh, cDim);

        // 새로고침 버튼 → 앱 열기
        Intent refreshIntent = new Intent(ctx, MainActivity.class);
        refreshIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent refreshPi = PendingIntent.getActivity(ctx, 9999, refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_refresh, refreshPi);

        String emptyText = o.optString("emptyText", "");
        String headTitle = o.optString("headTitle", "");
        String doneWord  = o.optString("doneWord", "");
        String noneWord  = o.optString("noneWord", "");

        String todosDate = o.optString("todosDate", "");
        boolean stale = todosDate.length() > 0 && !todosDate.equals(todayKey());

        if (showHealth()) {
            setBg(v, R.id.w_health_box, WidgetTheme.bg(th, WidgetTheme.SIDE_BG));
            v.setTextColor(R.id.w_water_lbl, cDim);
            v.setTextColor(R.id.w_vita_lbl, cDim);
            fillHealth(ctx, v, pkg, o);
        }

        JSONArray ddays = showDday() ? o.optJSONArray("ddays") : null;
        int ddayCount = 0;
        if (showDday()) v.removeAllViews(R.id.w_dday_list);
        for (int i = 0; ddays != null && i < ddays.length(); i++) {
            JSONObject d = ddays.optJSONObject(i);
            if (d == null) continue;
            String title = d.optString("title", "");
            String date = d.optString("date", "");
            if (title.length() == 0 || date.length() == 0) continue;
            Integer diff = daysFromToday(date);
            RemoteViews row = new RemoteViews(pkg, R.layout.w_dday_item);
            setBg(row, R.id.i_row, WidgetTheme.bg(th, WidgetTheme.DDAY_BG));
            row.setTextColor(R.id.i_title, cText);
            row.setTextViewText(R.id.i_badge, diff == null ? "" : ddayText(diff));
            row.setTextViewText(R.id.i_title, title);
            row.setTextViewText(R.id.i_date, shortDate(date));
            v.addView(R.id.w_dday_list, row);
            ddayCount++;
        }
        if (showDday()) v.setViewVisibility(R.id.w_dday_list, ddayCount > 0 ? View.VISIBLE : View.GONE);

        // ── 오늘 할 일 ──
        JSONArray todos = (stale || !showTodo()) ? null : o.optJSONArray("todos");
        int shown = 0;
        if (showTodo()) v.removeAllViews(R.id.w_today_list);
        for (int i = 0; todos != null && i < todos.length(); i++) {
            JSONObject it = todos.optJSONObject(i);
            String text = (it == null) ? "" : it.optString("text", "");
            if (text.length() == 0) continue;
            boolean done = it.optBoolean("done", false);
            boolean pm = "pm".equals(it.optString("ampm", ""));
            String badge = it.optString("ampmLabel", "");
            String itemId = it.optString("id", "idx_" + i);

            RemoteViews row = new RemoteViews(pkg, R.layout.w_todo_item);
            setBg(row, R.id.i_row, WidgetTheme.bg(th,
                    done ? WidgetTheme.ROW_DONE_BG : WidgetTheme.ROW_BG));
            setBg(row, R.id.i_chk, done ? R.drawable.w_check_on : R.drawable.w_check_off);
            row.setTextViewText(R.id.i_chk, done ? "✓" : "");

            Intent toggleIntent = new Intent(ctx, getClass());
            toggleIntent.setAction(ACTION_TOGGLE);
            toggleIntent.putExtra(EXTRA_TODO_ID, itemId);
            toggleIntent.putExtra(EXTRA_DATE_KEY, todosDate);
            PendingIntent togglePi = PendingIntent.getBroadcast(ctx, 100 + i, toggleIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
            row.setOnClickPendingIntent(R.id.i_chk_area, togglePi);

            if (done) {
                row.setTextViewText(R.id.i_text, struck(text));
                row.setTextColor(R.id.i_text, cDim);
            } else {
                row.setTextViewText(R.id.i_text, text);
                row.setTextColor(R.id.i_text, cText);
            }
            if (badge.length() > 0) {
                row.setViewVisibility(R.id.i_badge, View.VISIBLE);
                row.setTextViewText(R.id.i_badge, badge);
                setBg(row, R.id.i_badge, pm ? R.drawable.w_pill_pm : R.drawable.w_pill_am);
                row.setTextColor(R.id.i_badge, pm ? 0xFFE09A4B : 0xFF5B8DD9);
            } else {
                row.setViewVisibility(R.id.i_badge, View.GONE);
            }
            v.addView(R.id.w_today_list, row);
            shown++;
        }

        int total = shown, doneCount = 0;
        for (int i = 0; todos != null && i < todos.length(); i++) {
            JSONObject it = todos.optJSONObject(i);
            if (it != null && it.optBoolean("done", false)) doneCount++;
        }
        if (!stale) {
            int t = o.optInt("todoTotal", -1);
            int d = o.optInt("todoDone", -1);
            if (t >= shown) {
                total = t;
                if (d >= 0) doneCount = d;
            }
        }
        if (showTodo()) v.setViewVisibility(R.id.w_head_box, shown > 0 ? View.VISIBLE : View.GONE);
        if (showTodo() && shown > 0) {
            v.setTextColor(R.id.w_head_title, cText);
            v.setTextColor(R.id.w_head_count, cDim);
            v.setTextViewText(R.id.w_head_title, headTitle);
            v.setTextViewText(R.id.w_head_count,
                    doneCount + " / " + total + (doneWord.length() > 0 ? " " + doneWord : ""));
        }

        if (showTodo()) {
            if (shown == 0) {
                v.setViewVisibility(R.id.w_empty, View.VISIBLE);
                v.setTextColor(R.id.w_empty, cDim);
                if (emptyText.length() > 0) v.setTextViewText(R.id.w_empty, emptyText);
            } else {
                v.setViewVisibility(R.id.w_empty, View.GONE);
            }
        }

        if (showTable()) fillTable(ctx, v, pkg, o, th,
                                   ttWidthDp(mgr, id), ttRowH(mgr, id, o, ddayCount, shown));

        // ── 고양이 ──
        if (showCat()) {
            JSONObject cat = stale ? null : o.optJSONObject("cat");
            String breed = cat != null ? cat.optString("breed", "white") : "white";
            int mood = cat != null ? cat.optInt("mood", 60) : 60;
            String catName = cat != null ? cat.optString("name", "냐옹이") : "냐옹이";

            // 앱이 넘겨 준 진짜 그림을 먼저 쓴다. 고양이는 서버에서 받아 오므로
            // 앱에 넣어 둔 네 장으로는 새로 등록한 고양이를 그릴 수 없다.
            Bitmap sent = decodeCat(cat == null ? null : cat.optString("image", null));
            if (sent != null) {
                v.setImageViewBitmap(R.id.w_cat_img, sent);
            } else {
                int imgRes;
                switch (breed) {
                    case "tabby": imgRes = R.drawable.w_cat_tabby; break;
                    case "black": imgRes = R.drawable.w_cat_black; break;
                    case "pink":  imgRes = R.drawable.w_cat_pink;  break;
                    default:      imgRes = R.drawable.w_cat_white; break;
                }
                v.setImageViewResource(R.id.w_cat_img, imgRes);
            }

            v.setTextViewText(R.id.w_cat_mood_text, "♥ " + mood + "%");
            v.setTextColor(R.id.w_cat_mood_text, MOOD_HEART);

            v.setProgressBar(R.id.w_cat_mood_bar, 100, mood, false);

            v.setTextViewText(R.id.w_cat_name, catName);
            v.setTextColor(R.id.w_cat_name, cDim);

            // 먹이 자리에 '부르기'를 둔다. 먹이는 포인트가 들어 앱에서 주는 편이 낫고,
            // 위젯에서는 소리만 나는 부르기가 손이 덜 간다.
            Intent callIntent = new Intent(ctx, getClass());
            callIntent.setAction(ACTION_CAT_CALL);
            PendingIntent callPi = PendingIntent.getBroadcast(ctx, 302, callIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_cat_feed, callPi);

            Intent playIntent = new Intent(ctx, getClass());
            playIntent.setAction(ACTION_CAT_PLAY);
            PendingIntent playPi = PendingIntent.getBroadcast(ctx, 301, playIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_cat_play, playPi);
        }

        if (layoutId() == R.layout.neko_widget) {
            setBg(v, R.id.w_yday_box, WidgetTheme.bg(th, WidgetTheme.SIDE_BG));
            setBg(v, R.id.w_tmr_box, WidgetTheme.bg(th, WidgetTheme.SIDE_BG));
            v.setTextColor(R.id.w_yday_title, cDim);
            v.setTextColor(R.id.w_tmr_title, cDim);
            fillSide(v, pkg, o.optJSONObject("yesterday"), stale, th,
                     R.id.w_yday_title, R.id.w_yday_list, R.id.w_yday_empty, noneWord);
            fillSide(v, pkg, o.optJSONObject("tomorrow"), stale, th,
                     R.id.w_tmr_title, R.id.w_tmr_list, R.id.w_tmr_empty, noneWord);
        }

        // 위젯 전체 (체크박스·물·비타민·새로고침 이외) → 앱 열기
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);

        mgr.updateAppWidget(id, v);
    }

    private void fillHealth(Context ctx, RemoteViews v, String pkg, JSONObject o) {
        JSONObject h = o.optJSONObject("health");
        if (h == null) {
            v.setViewVisibility(R.id.w_water_row, View.GONE);
            v.setViewVisibility(R.id.w_vita_box, View.GONE);
            return;
        }
        v.setTextViewText(R.id.w_water_lbl, h.optString("waterLabel", ""));
        int wDone = h.optInt("waterDone", 0), wGoal = h.optInt("waterGoal", 8);
        v.removeAllViews(R.id.w_water_row);
        for (int i = 0; i < wGoal && i < 12; i++) {
            RemoteViews c = new RemoteViews(pkg, R.layout.w_cup);
            setCup(c, i < wDone);
            Intent cupIntent = new Intent(ctx, getClass());
            cupIntent.setAction(ACTION_WATER);
            cupIntent.putExtra(EXTRA_INDEX, i);
            PendingIntent cupPi = PendingIntent.getBroadcast(ctx, 210 + i, cupIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            c.setOnClickPendingIntent(R.id.i_tap, cupPi);
            v.addView(R.id.w_water_row, c);
        }
        v.setViewVisibility(R.id.w_water_row, View.VISIBLE);

        // 물 줄 터치 → 물 한 잔 추가
        Intent waterIntent = new Intent(ctx, getClass());
        waterIntent.setAction(ACTION_WATER);
        PendingIntent waterPi = PendingIntent.getBroadcast(ctx, 200, waterIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_water_row, waterPi);

        int vDone = h.optInt("vitaDone", 0), vGoal = h.optInt("vitaGoal", 0);
        if (vGoal <= 0) {
            v.setViewVisibility(R.id.w_vita_box, View.GONE);
            return;
        }
        v.setViewVisibility(R.id.w_vita_box, View.VISIBLE);
        v.setTextViewText(R.id.w_vita_lbl, h.optString("vitaLabel", ""));
        v.removeAllViews(R.id.w_vita_row);
        for (int i = 0; i < vGoal && i < 12; i++) {
            RemoteViews c = new RemoteViews(pkg, R.layout.w_pill);
            setBg(c, R.id.i_dot, i < vDone ? R.drawable.w_pill_off : R.drawable.w_pill_on);
            Intent pillIntent = new Intent(ctx, getClass());
            pillIntent.setAction(ACTION_VITA);
            pillIntent.putExtra(EXTRA_INDEX, i);
            PendingIntent pillPi = PendingIntent.getBroadcast(ctx, 230 + i, pillIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            c.setOnClickPendingIntent(R.id.i_tap, pillPi);
            v.addView(R.id.w_vita_row, c);
        }

        // 비타민 줄 터치 → 비타민 1회 추가
        Intent vitaIntent = new Intent(ctx, getClass());
        vitaIntent.setAction(ACTION_VITA);
        PendingIntent vitaPi = PendingIntent.getBroadcast(ctx, 201, vitaIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_vita_row, vitaPi);
    }

    /** 위젯이 가로로 몇 dp 를 쓰는지 (그림을 그 크기에 맞춰 그린다) */
    private int ttWidthDp(AppWidgetManager mgr, int id) {
        try {
            Bundle opts = mgr.getAppWidgetOptions(id);
            if (opts != null) {
                int w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
                if (w <= 0) w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0);
                if (w > 0) return w - 20 - 3;          // 바깥 여백 10dp 씩 + 틀 테두리
            }
        } catch (Exception ignored) {}
        return 300;
    }

    private int ttRowH(AppWidgetManager mgr, int id, JSONObject o, int ddayCount, int todoCount) {
        int hDp = 0;
        try {
            Bundle opts = mgr.getAppWidgetOptions(id);
            if (opts != null) {
                hDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
                if (hDp <= 0) hDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            }
        } catch (Exception ignored) {}
        if (hDp <= 0) return 0;

        // 바깥 여백 + 머리글 + 시간표 제목 + 요일 줄 + 틀 테두리
        int used = 20 + 34 + 21 + 18 + 3;
        if (showHealth()) {
            JSONObject h = o.optJSONObject("health");
            used += 48;                                        // 칸 여백 + 물 줄
            if (h != null && h.optInt("vitaGoal", 0) > 0) used += 32;
        }
        used += ddayCount * 40;
        if (showTodo()) used += (todoCount > 0 ? 25 + todoCount * 40 : 39);
        return hDp - used;
    }

    /**
     * 줄이 모두 들어가는 가장 큰 칸. 하나도 안 들어가면 가장 작은 칸을 준다.
     * 예전에는 자리를 안 보고 최소 칸을 그대로 써서 마지막 줄이 중간에서 잘렸다.
     */
    private static int ttSize(int avail, int rows) {
        if (rows <= 0) return 0;
        for (int i = TT_ROW_DP.length - 1; i >= 0; i--) {
            if (rows * TT_ROW_DP[i] <= avail) return i;
        }
        return 0;
    }

    /**
     * 보여줄 시각을 고른다. 자리가 모자라면 일정이 없는 시각부터 덜어낸다.
     * 덜어낸 시각은 어느 요일에도 칸이 없으므로 일정이 잘려 보이지 않고,
     * 왼쪽 시각 숫자가 그대로 남아 07 · 08 · 20 처럼 건너뛴 것이 드러난다.
     */
    private static int[] pickHours(JSONArray blocks, int from, int to, int avail, int size) {
        int n = to - from;
        // avail 0은 위젯 크기를 못 읽은 것(다 보여준다), 음수는 남은 자리가 없다는 뜻
        int max = (avail > 0) ? Math.max(1, avail / TT_ROW_DP[size]) : (avail == 0 ? n : 1);
        if (n <= max) {
            int[] all = new int[n];
            for (int i = 0; i < n; i++) all[i] = from + i;
            return all;
        }

        boolean[] busy = new boolean[n];
        for (int i = 0; blocks != null && i < blocks.length(); i++) {
            JSONObject b = blocks.optJSONObject(i);
            if (b == null) continue;
            int s = b.optInt("start", -1), e = b.optInt("end", -1);
            if (s < 0 || e <= s) continue;
            for (int k = 0; k < n; k++) {
                int h = from + k;
                if (h * 60 < e && (h + 1) * 60 > s) busy[k] = true;
            }
        }

        boolean[] show = new boolean[n];
        int kept = 0;
        for (int k = 0; k < n && kept < max; k++) if (busy[k]) { show[k] = true; kept++; }
        for (int k = 0; k < n && kept < max; k++) if (!show[k]) { show[k] = true; kept++; }

        int[] out = new int[kept];
        int j = 0;
        for (int k = 0; k < n; k++) if (show[k]) out[j++] = from + k;
        return out;
    }

    private static final int[] TT_ROW_DP   = { 10, 14, 18, 22, 26, 31, 36 };
    private static final int[] TT_CELL_LAY = {
        R.layout.w_tt_cell_s, R.layout.w_tt_cell_a, R.layout.w_tt_cell_b,
        R.layout.w_tt_cell_c, R.layout.w_tt_cell_d, R.layout.w_tt_cell_e,
        R.layout.w_tt_cell_f,
    };
    private static final int[] TT_HOUR_LAY = {
        R.layout.w_tt_hour_s, R.layout.w_tt_hour_a, R.layout.w_tt_hour_b,
        R.layout.w_tt_hour_c, R.layout.w_tt_hour_d, R.layout.w_tt_hour_e,
        R.layout.w_tt_hour_f,
    };

    private void fillTable(Context ctx, RemoteViews v, String pkg, JSONObject o, int th,
                           int wDp, int avail) {
        JSONObject tt = o.optJSONObject("table");
        setBg(v, R.id.w_tt_frame, WidgetTheme.bg(th, WidgetTheme.TT_FRAME));
        setBg(v, R.id.w_tt_head, WidgetTheme.bg(th, WidgetTheme.TT_HEADBG));
        v.setTextColor(R.id.w_tt_title, WidgetTheme.text(th));
        v.setTextViewText(R.id.w_tt_title, tt == null ? "" : tt.optString("label", ""));
        v.removeAllViews(R.id.w_tt_head);
        v.removeAllViews(R.id.w_tt_body);
        v.setViewVisibility(R.id.w_tt_img, View.GONE);
        if (tt == null) return;

        JSONArray dows = tt.optJSONArray("dows");
        JSONArray blocks = tt.optJSONArray("blocks");
        if (blocks == null || blocks.length() == 0) {
            RemoteViews note = new RemoteViews(pkg, R.layout.w_tt_dow);
            note.setTextViewText(R.id.i_text, tt.optString("empty", ""));
            v.addView(R.id.w_tt_body, note);
            return;
        }
        int from = tt.optInt("from", 8);
        int to = tt.optInt("to", 20);
        if (to <= from) to = from + 1;
        if (to > 24) to = 24;

        // 그림으로 그린다 — 10분짜리 일정은 10분만큼만 높다.
        // 실패하면(메모리 등) 아래의 한 시간 격자로 내려간다.
        Bitmap img = drawTable(ctx, tt, blocks, dows, th, from, to, wDp, avail);
        if (img != null) {
            v.setImageViewBitmap(R.id.w_tt_img, img);
            v.setViewVisibility(R.id.w_tt_img, View.VISIBLE);
            return;
        }

        int size = ttSize(avail, to - from);
        int[] hours = pickHours(blocks, from, to, avail, size);
        size = ttSize(avail, hours.length);   // 줄을 덜어냈으면 칸을 다시 키운다
        int last = hours.length - 1;

        RemoteViews corner = new RemoteViews(pkg, R.layout.w_tt_hour);
        corner.setTextViewText(R.id.i_text, "");
        v.addView(R.id.w_tt_head, corner);
        int todayDow = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1;

        for (int d = 0; d < 7; d++) {
            RemoteViews c = new RemoteViews(pkg, R.layout.w_tt_dow);
            c.setTextViewText(R.id.i_text, dows == null ? "" : dows.optString(d, ""));
            if (d == todayDow) {
                setBg(c, R.id.i_text, WidgetTheme.bg(th, WidgetTheme.TT_TODAYHEAD));
                c.setTextColor(R.id.i_text, 0xFF6B5214);
            } else if (d == 0) c.setTextColor(R.id.i_text, 0xFFE08A86);
            else c.setTextColor(R.id.i_text, WidgetTheme.dim(th));
            v.addView(R.id.w_tt_head, c);
        }

        for (int hi = 0; hi <= last; hi++) {
            int h = hours[hi];
            RemoteViews row = new RemoteViews(pkg, R.layout.w_tt_row);
            RemoteViews hour = new RemoteViews(pkg, TT_HOUR_LAY[size]);
            hour.setTextColor(R.id.i_text, WidgetTheme.dim(th));
            hour.setTextViewText(R.id.i_text, _tPad2(h));
            row.addView(R.id.i_row, hour);

            for (int d = 0; d < 7; d++) {
                RemoteViews cell = new RemoteViews(pkg, TT_CELL_LAY[size]);
                JSONObject hit = null;
                boolean starts = false, ends = false;
                for (int i = 0; blocks != null && i < blocks.length(); i++) {
                    JSONObject b = blocks.optJSONObject(i);
                    if (b == null || b.optInt("day", -1) != d) continue;
                    int s = b.optInt("start", -1), e = b.optInt("end", -1);
                    if (s < 0 || e <= s) continue;
                    if (h * 60 < e && (h + 1) * 60 > s) {
                        hit = b;
                        starts = (s >= h * 60 && s < (h + 1) * 60);
                        ends = (e > h * 60 && e <= (h + 1) * 60);
                        if (hi == 0 && s < h * 60) starts = false;
                        if (hi == last && e > (h + 1) * 60) ends = false;
                        break;
                    }
                }
                boolean endCell = (hi == last) && (d == 6);
                if (hit != null) {
                    int ci = hit.optInt("color", -1);
                    int style = (ci >= 0 && ci < 6) ? (2 + ci)
                              : (hit.optBoolean("rest", false) ? 1 : 0);
                    setBg(cell, R.id.i_text, WidgetTheme.blocks(th)[style][ttPiece(starts, ends)]);
                    cell.setTextColor(R.id.i_text, WidgetTheme.text(th));
                    if (starts) cell.setTextViewText(R.id.i_text, hit.optString("label", ""));
                } else {
                    setBg(cell, R.id.i_text, WidgetTheme.bg(th,
                            endCell ? WidgetTheme.TT_EMPTY_BR : WidgetTheme.TT_EMPTY));
                }
                row.addView(R.id.i_row, cell);
            }
            v.addView(R.id.w_tt_body, row);
        }
    }

    /**
     * 시간표 한 판을 그림으로 그린다.
     *
     * RemoteViews 로는 칸 하나하나의 높이를 정할 수가 없어서, 지금까지는 한 시간을
     * 통째로 칠하는 수밖에 없었다 (10분짜리 일정도 한 시간처럼 보였다). 직접 그리면
     * 분 단위로 자리와 길이가 그대로 나온다.
     *
     * @param wDp  그릴 너비(dp)   @param hDp 그릴 높이(dp)
     * @return 못 그리면 null — 부른 쪽이 예전 방식으로 내려간다
     */
    private static Bitmap drawTable(Context ctx, JSONObject tt, JSONArray blocks, JSONArray dows,
                                    int th, int from, int to, int wDp, int hDp) {
        try {
            if (wDp < 80 || hDp < 40) return null;
            float d = ctx.getResources().getDisplayMetrics().density;
            if (d <= 0) d = 2f;
            int W = Math.round(wDp * d), H = Math.round(hDp * d);
            // 너무 큰 그림은 위젯이 받아 주지 않는다 — 넘으면 줄여서 그린다
            long maxPx = 3L * 1024 * 1024 / 4;
            if ((long) W * H > maxPx) {
                double k = Math.sqrt((double) maxPx / ((double) W * (double) H));
                W = (int) (W * k); H = (int) (H * k); d = (float) (d * k);
            }
            if (W < 40 || H < 24) return null;

            Bitmap bm = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
            Canvas cv = new Canvas(bm);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
            line.setStyle(Paint.Style.STROKE);

            final int cHead = WidgetTheme.color(th, WidgetTheme.C_HEAD);
            final int cHeadLine = WidgetTheme.color(th, WidgetTheme.C_HEAD_LINE);
            final int cEmpty = WidgetTheme.color(th, WidgetTheme.C_EMPTY);
            final int cEmptyLine = WidgetTheme.color(th, WidgetTheme.C_EMPTY_LINE);
            final int cToday = WidgetTheme.color(th, WidgetTheme.C_TODAY);
            final int cTodayLine = WidgetTheme.color(th, WidgetTheme.C_TODAY_LINE);
            final int cText = WidgetTheme.color(th, WidgetTheme.C_TEXT);
            final int cDim = WidgetTheme.color(th, WidgetTheme.C_DIM);
            final int[][] blkC = WidgetTheme.blockColors(th);

            float hourW = 22 * d;
            float headH = Math.min(18 * d, H * 0.22f);
            float colW = (W - hourW) / 7f;
            int hours = Math.max(1, to - from);
            float rowH = (H - headH) / hours;
            int today = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1;

            // ── 머리줄 ──
            p.setColor(cHead);
            RectF r = new RectF(0, 0, W, headH);
            cv.drawRoundRect(r, 6 * d, 6 * d, p);
            cv.drawRect(0, headH - 6 * d, W, headH, p);      // 아래쪽은 각지게
            if (today >= 0 && today < 7) {
                p.setColor(cToday);
                float x0 = hourW + colW * today;
                RectF tr = new RectF(x0, 0, x0 + colW, headH);
                cv.drawRoundRect(tr, 5 * d, 5 * d, p);
                cv.drawRect(x0, headH - 5 * d, x0 + colW, headH, p);
                line.setColor(cTodayLine);
                line.setStrokeWidth(0.8f * d);
                cv.drawRoundRect(tr, 5 * d, 5 * d, line);
            }
            line.setColor(cHeadLine);
            line.setStrokeWidth(0.8f * d);
            cv.drawLine(0, headH, W, headH, line);

            TextPaint tp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
            float dowSize = Math.min(9 * d, headH * 0.62f);
            tp.setTextSize(dowSize);
            tp.setTextAlign(Paint.Align.CENTER);
            for (int i = 0; i < 7; i++) {
                String nm = (dows == null) ? "" : dows.optString(i, "");
                tp.setColor(i == today ? 0xFF6B5214 : (i == 0 ? 0xFFE08A86 : cDim));
                float cx = hourW + colW * i + colW / 2f;
                float cy = headH / 2f - (tp.descent() + tp.ascent()) / 2f;
                cv.drawText(nm, cx, cy, tp);
            }

            // ── 빈 격자 ──
            p.setColor(cEmpty);
            cv.drawRect(hourW, headH, W, H, p);
            line.setColor(cEmptyLine);
            line.setStrokeWidth(0.6f * d);
            for (int i = 0; i <= hours; i++) {
                float y = headH + rowH * i;
                cv.drawLine(hourW, y, W, y, line);
            }
            for (int i = 0; i <= 7; i++) {
                float x = hourW + colW * i;
                cv.drawLine(x, headH, x, H, line);
            }

            // ── 시각 ──
            float hourSize = Math.min(8 * d, rowH * 0.7f);
            tp.setTextSize(hourSize);
            tp.setTextAlign(Paint.Align.RIGHT);
            tp.setColor(cDim);
            for (int i = 0; i < hours; i++) {
                float y = headH + rowH * i - tp.ascent() + 1 * d;
                if (y > H) break;
                cv.drawText(_tPad2(from + i), hourW - 3 * d, y, tp);
            }

            // ── 일정 칸 (여기가 분 단위) ──
            float blkSize = rowH >= 31 * d ? 10 * d : (rowH >= 22 * d ? 9 * d : (rowH >= 14 * d ? 8 * d : 7 * d));
            for (int i = 0; blocks != null && i < blocks.length(); i++) {
                JSONObject b = blocks.optJSONObject(i);
                if (b == null) continue;
                int day = b.optInt("day", -1);
                if (day < 0 || day > 6) continue;
                int s0 = Math.max(b.optInt("start", -1), from * 60);
                int e0 = Math.min(b.optInt("end", -1), to * 60);
                if (b.optInt("start", -1) < 0 || e0 <= s0) continue;

                float top = headH + (s0 - from * 60) / 60f * rowH;
                float hgt = Math.max(2 * d, (e0 - s0) / 60f * rowH);
                float x0 = hourW + colW * day;
                RectF br = new RectF(x0 + 1 * d, top, x0 + colW - 1 * d, top + hgt);

                int ci = b.optInt("color", -1);
                int style = (ci >= 0 && ci < 6) ? (2 + ci) : (b.optBoolean("rest", false) ? 1 : 0);
                p.setColor(blkC[style][0]);
                cv.drawRoundRect(br, 3 * d, 3 * d, p);
                RectF in = new RectF(br.left + 1 * d, br.top + 1 * d, br.right - 1 * d, br.bottom - 1 * d);
                if (in.width() > 0 && in.height() > 0) {
                    p.setColor(blkC[style][1]);
                    cv.drawRoundRect(in, 2 * d, 2 * d, p);
                }

                String label = b.optString("label", "");
                if (label.length() == 0) continue;
                // 짧은 칸에는 글씨를 조금 줄여서라도 넣는다 (그래도 안 들어가면 색만 남긴다)
                float fs = Math.min(blkSize, (hgt - 1 * d) / 1.25f);
                if (fs < 6 * d) continue;
                float lineH = fs * 1.25f;
                TextPaint lp = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                lp.setTextSize(fs);
                lp.setColor(cText);
                int tw = (int) Math.max(1, br.width() - 3 * d);
                int maxLines = Math.max(1, (int) ((hgt - 2 * d) / lineH));
                StaticLayout sl = StaticLayout.Builder.obtain(label, 0, label.length(), lp, tw)
                        .setAlignment(Layout.Alignment.ALIGN_CENTER)
                        .setMaxLines(maxLines)
                        .setEllipsize(TextUtils.TruncateAt.END)
                        .setIncludePad(false)
                        .build();
                cv.save();
                float ty = br.top + Math.max(0, (hgt - sl.getHeight()) / 2f);
                cv.clipRect(br);
                cv.translate(br.left + 1.5f * d, ty);
                sl.draw(cv);
                cv.restore();
            }
            // 네 모서리를 틀 안쪽 곡률만큼 깎는다.
            // 그림은 네모라서 그냥 두면 둥근 틀 밖으로 모서리가 삐져나온다
            // (틀 반지름 9dp 에서 안쪽 여백 1.2dp 를 뺀 만큼).
            Paint cut = new Paint(Paint.ANTI_ALIAS_FLAG);
            cut.setColor(0xFF000000);
            cut.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.DST_IN));
            cv.drawRoundRect(new RectF(0, 0, W, H), 7.8f * d, 7.8f * d, cut);
            return bm;
        } catch (Throwable t) {
            return null;                                      // 못 그리면 예전 격자로
        }
    }

    private static int ttPiece(boolean starts, boolean ends) {
        if (starts && ends) return 0;
        if (starts) return 1;
        if (ends) return 3;
        return 2;
    }

    /**
     * 앱이 넘겨 준 "data:image/png;base64,..." 를 그림으로 되돌린다.
     * 위젯 한 판이 통째로 오가는 데는 크기 제한이 있어, 큰 그림은 줄여서 담는다.
     */
    private static Bitmap decodeCat(String dataUrl) {
        if (dataUrl == null || dataUrl.length() == 0) return null;
        int comma = dataUrl.indexOf(',');
        if (comma < 0) return null;
        try {
            byte[] raw = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);

            BitmapFactory.Options probe = new BitmapFactory.Options();
            probe.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(raw, 0, raw.length, probe);

            BitmapFactory.Options opt = new BitmapFactory.Options();
            int big = Math.max(probe.outWidth, probe.outHeight);
            int sample = 1;
            while (big / sample > 256) sample *= 2;
            opt.inSampleSize = sample;

            return BitmapFactory.decodeByteArray(raw, 0, raw.length, opt);
        } catch (Exception e) {
            return null;
        } catch (OutOfMemoryError e) {
            return null;
        }
    }

    private static String _tPad2(int n) { return (n < 10 ? "0" : "") + n; }

    private void fillSide(RemoteViews v, String pkg, JSONObject side, boolean stale, int th,
                          int titleId, int listId, int emptyId, String noneWord) {
        v.removeAllViews(listId);
        v.setTextViewText(titleId, (side == null) ? "" : side.optString("label", ""));

        JSONArray items = (side == null || stale) ? null : side.optJSONArray("todos");
        int shown = 0;
        for (int i = 0; items != null && i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            String text = (it == null) ? "" : it.optString("text", "");
            if (text.length() == 0) continue;
            boolean done = it.optBoolean("done", false);

            RemoteViews row = new RemoteViews(pkg, R.layout.w_side_item);
            setBg(row, R.id.i_chk, done ? R.drawable.w_check_on : R.drawable.w_check_off);
            row.setTextViewText(R.id.i_chk, done ? "✓" : "");
            if (done) {
                row.setTextViewText(R.id.i_text, struck(text));
                row.setTextColor(R.id.i_text, WidgetTheme.dim(th));
            } else {
                row.setTextViewText(R.id.i_text, text);
                row.setTextColor(R.id.i_text, WidgetTheme.text(th));
            }
            v.addView(listId, row);
            shown++;
        }

        int more = (side == null || stale) ? 0 : Math.max(0, side.optInt("total", shown) - shown);
        if (shown == 0) {
            v.setViewVisibility(emptyId, View.VISIBLE);
            v.setTextViewText(emptyId, noneWord);
        } else if (more > 0) {
            v.setViewVisibility(emptyId, View.VISIBLE);
            v.setTextViewText(emptyId, "+" + more);
        } else {
            v.setViewVisibility(emptyId, View.GONE);
        }
    }
}
