package com.siwon.nekodesk.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
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
    private static final String EXTRA_TODO_ID = "todo_id";
    private static final String EXTRA_DATE_KEY = "date_key";

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
            addWater(ctx);
        } else if (ACTION_VITA.equals(action)) {
            addVita(ctx);
        } else if (ACTION_CAT_FEED.equals(action)) {
            feedCat(ctx);
        } else if (ACTION_CAT_PLAY.equals(action)) {
            playCat(ctx);
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
            if (done >= goal) {
                h.put("waterDone", 0);
                sp.edit().putString(KEY_DATA, o.toString()).apply();
                sp.edit().putInt(KEY_WATER_ADD, sp.getInt(KEY_WATER_ADD, 0) - done).apply();
            } else {
                h.put("waterDone", done + 1);
                sp.edit().putString(KEY_DATA, o.toString()).apply();
                sp.edit().putInt(KEY_WATER_ADD, sp.getInt(KEY_WATER_ADD, 0) + 1).apply();
            }
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
            if (done >= goal) {
                h.put("vitaDone", 0);
                sp.edit().putString(KEY_DATA, o.toString()).apply();
                sp.edit().putInt(KEY_VITA_ADD, sp.getInt(KEY_VITA_ADD, 0) - done).apply();
            } else {
                h.put("vitaDone", done + 1);
                sp.edit().putString(KEY_DATA, o.toString()).apply();
                sp.edit().putInt(KEY_VITA_ADD, sp.getInt(KEY_VITA_ADD, 0) + 1).apply();
            }
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
        } catch (Exception ignored) {}

        refreshAll(ctx);
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
                row.setTextColor(R.id.i_text, 0xFF9AA0A6);
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

        if (showTable()) fillTable(v, pkg, o, th, ttRowH(mgr, id, ddayCount, shown));

        // ── 고양이 ──
        if (showCat()) {
            JSONObject cat = stale ? null : o.optJSONObject("cat");
            String breed = cat != null ? cat.optString("breed", "white") : "white";
            int mood = cat != null ? cat.optInt("mood", 60) : 60;
            String catName = cat != null ? cat.optString("name", "냐옹이") : "냐옹이";
            int pts = cat != null ? cat.optInt("pts", 0) : 0;

            int imgRes;
            switch (breed) {
                case "tabby": imgRes = R.drawable.w_cat_tabby; break;
                case "black": imgRes = R.drawable.w_cat_black; break;
                case "pink":  imgRes = R.drawable.w_cat_pink;  break;
                default:      imgRes = R.drawable.w_cat_white; break;
            }
            v.setImageViewResource(R.id.w_cat_img, imgRes);

            String moodEmoji = mood >= 80 ? "😆" : mood >= 50 ? "😊" : mood >= 30 ? "😐" : "😢";
            v.setTextViewText(R.id.w_cat_mood_text, moodEmoji + " " + mood + "%");
            v.setTextColor(R.id.w_cat_mood_text, cText);

            v.setProgressBar(R.id.w_cat_mood_bar, 100, mood, false);

            v.setTextViewText(R.id.w_cat_name, catName);
            v.setTextColor(R.id.w_cat_name, cDim);

            v.setTextViewText(R.id.w_cat_feed, "🐟 먹이 (-" + 20 + "pt)");

            Intent feedIntent = new Intent(ctx, getClass());
            feedIntent.setAction(ACTION_CAT_FEED);
            PendingIntent feedPi = PendingIntent.getBroadcast(ctx, 300, feedIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_cat_feed, feedPi);

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
            fillSide(v, pkg, o.optJSONObject("yesterday"), stale,
                     R.id.w_yday_title, R.id.w_yday_list, R.id.w_yday_empty, noneWord);
            fillSide(v, pkg, o.optJSONObject("tomorrow"), stale,
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
            setBg(c, R.id.i_dot, i < wDone ? R.drawable.w_cup_off : R.drawable.w_cup_on);
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
            v.addView(R.id.w_vita_row, c);
        }

        // 비타민 줄 터치 → 비타민 1회 추가
        Intent vitaIntent = new Intent(ctx, getClass());
        vitaIntent.setAction(ACTION_VITA);
        PendingIntent vitaPi = PendingIntent.getBroadcast(ctx, 201, vitaIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_vita_row, vitaPi);
    }

    private int ttRowH(AppWidgetManager mgr, int id, int ddayCount, int todoCount) {
        int hDp = 0;
        try {
            Bundle opts = mgr.getAppWidgetOptions(id);
            if (opts != null) {
                hDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
                if (hDp <= 0) hDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            }
        } catch (Exception ignored) {}
        if (hDp <= 0) return 0;
        int used = 20 + 34 + 22 + 22 + 8;
        if (showHealth()) used += 62;
        used += ddayCount * 40;
        if (showTodo()) used += (todoCount > 0 ? 26 + todoCount * 48 : 30);
        return hDp - used;
    }

    private static int ttSize(int avail, int rows) {
        if (avail <= 0 || rows <= 0) return 1;
        int h = avail / rows;
        for (int i = TT_ROW_DP.length - 1; i > 0; i--) {
            if (h >= TT_ROW_DP[i]) return i;
        }
        return 0;
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

    private void fillTable(RemoteViews v, String pkg, JSONObject o, int th, int avail) {
        JSONObject tt = o.optJSONObject("table");
        setBg(v, R.id.w_tt_frame, WidgetTheme.bg(th, WidgetTheme.TT_FRAME));
        setBg(v, R.id.w_tt_head, WidgetTheme.bg(th, WidgetTheme.TT_HEADBG));
        v.setTextColor(R.id.w_tt_title, WidgetTheme.text(th));
        v.setTextViewText(R.id.w_tt_title, tt == null ? "" : tt.optString("label", ""));
        v.removeAllViews(R.id.w_tt_head);
        v.removeAllViews(R.id.w_tt_body);
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
        int size = ttSize(avail, to - from);

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

        for (int h = from; h < to; h++) {
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
                        if (h == from && s < h * 60) starts = false;
                        if (h == to - 1 && e > (h + 1) * 60) ends = false;
                        break;
                    }
                }
                boolean endCell = (h == to - 1) && (d == 6);
                if (hit != null) {
                    int ci = hit.optInt("color", -1);
                    int style = (ci >= 0 && ci < 6) ? (2 + ci)
                              : (hit.optBoolean("rest", false) ? 1 : 0);
                    setBg(cell, R.id.i_text, TT_BG[style][ttPiece(starts, ends)]);
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

    private static int ttPiece(boolean starts, boolean ends) {
        if (starts && ends) return 0;
        if (starts) return 1;
        if (ends) return 3;
        return 2;
    }

    private static final int[][] TT_BG = {
        { R.drawable.w_b_w_s,  R.drawable.w_b_w_t,  R.drawable.w_b_w_m,  R.drawable.w_b_w_b  },
        { R.drawable.w_b_r_s,  R.drawable.w_b_r_t,  R.drawable.w_b_r_m,  R.drawable.w_b_r_b  },
        { R.drawable.w_b_c0_s, R.drawable.w_b_c0_t, R.drawable.w_b_c0_m, R.drawable.w_b_c0_b },
        { R.drawable.w_b_c1_s, R.drawable.w_b_c1_t, R.drawable.w_b_c1_m, R.drawable.w_b_c1_b },
        { R.drawable.w_b_c2_s, R.drawable.w_b_c2_t, R.drawable.w_b_c2_m, R.drawable.w_b_c2_b },
        { R.drawable.w_b_c3_s, R.drawable.w_b_c3_t, R.drawable.w_b_c3_m, R.drawable.w_b_c3_b },
        { R.drawable.w_b_c4_s, R.drawable.w_b_c4_t, R.drawable.w_b_c4_m, R.drawable.w_b_c4_b },
        { R.drawable.w_b_c5_s, R.drawable.w_b_c5_t, R.drawable.w_b_c5_m, R.drawable.w_b_c5_b },
    };

    private static String _tPad2(int n) { return (n < 10 ? "0" : "") + n; }

    private void fillSide(RemoteViews v, String pkg, JSONObject side, boolean stale,
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
                row.setTextColor(R.id.i_text, 0xFFBDC1C6);
            } else {
                row.setTextViewText(R.id.i_text, text);
                row.setTextColor(R.id.i_text, 0xFF5F6368);
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
