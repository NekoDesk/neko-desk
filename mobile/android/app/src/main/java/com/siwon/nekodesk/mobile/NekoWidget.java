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

/**
 * 홈 화면 위젯 — D-day 전부와 어제·오늘·내일 할 일을 보여준다.
 *
 * 앱(웹뷰)에서 계산한 내용을 SharedPreferences에 넣어두면 여기서 읽어 그린다.
 * 위젯은 RemoteViews라 웹뷰를 띄울 수 없어서, 표시에 필요한 값만 미리 담아 둔다.
 * 줄 수가 정해지지 않은 부분은 빈 칸에 addView로 개수만큼 붙인다.
 */
public class NekoWidget extends AppWidgetProvider {

    /** 이 위젯이 보여줄 것들 — 자식 클래스가 정한다 */
    protected int layoutId()   { return R.layout.neko_widget; }
    protected boolean showHealth() { return true; }   // 물·비타민
    protected boolean showDday()   { return true; }
    protected boolean showTodo()   { return true; }
    protected boolean showTable()  { return false; }  // 오늘 시간표


    public static final String PREFS = "neko_widget";
    public static final String KEY_DATA = "data";
    /** 앱에서 내용을 바꾼 뒤 보내는 신호 */
    public static final String ACTION_REFRESH = "com.siwon.nekodesk.mobile.WIDGET_REFRESH";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(ctx, mgr, id);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            // getClass() — 이 신호를 받은 위젯 종류의 것만 다시 그린다
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, getClass()));
            for (int id : ids) render(ctx, mgr, id);
        }
    }

    /** 크기를 바꾸면 다시 그린다 — 시간표 칸 높이가 따라 변한다 */
    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opts) {
        super.onAppWidgetOptionsChanged(ctx, mgr, id, opts);
        render(ctx, mgr, id);
    }

    /** 홈 화면에 놓을 수 있는 위젯 종류 — 새로고침 신호를 다 같이 받는다 */
    private static final Class<?>[] PROVIDERS = {
        NekoWidget.class, NekoWidgetFull.class, NekoWidgetDday.class,
        NekoWidgetTodo.class, NekoWidgetTt.class,
    };

    /** 앱에서 호출 — 저장하고 곧바로 다시 그리게 한다 */
    public static void push(Context ctx, String json) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putString(KEY_DATA, json).apply();
        // 종류마다 리시버가 따로라 하나씩 불러 줘야 한다
        for (Class<?> c : PROVIDERS) {
            ctx.sendBroadcast(new Intent(ctx, c).setAction(ACTION_REFRESH));
        }
    }

    /** "yyyy-MM-dd"를 오늘 기준 남은 날수로. 형식이 틀리면 null */
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

    /** 오늘 날짜를 "yyyy-MM-dd"로 */
    private static String todayKey() {
        Calendar c = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d",
                c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** "2026-07-05" -> "07.05" */
    private static String shortDate(String dateKey) {
        String[] p = dateKey.split("-");
        return (p.length == 3) ? (p[1] + "." + p[2]) : dateKey;
    }

    /** RemoteViews에는 배경을 바꾸는 전용 메서드가 없어 setInt로 부른다 */
    private static void setBg(RemoteViews v, int viewId, int resId) {
        v.setInt(viewId, "setBackgroundResource", resId);
    }

    /** 끝낸 일 글씨에 가로줄 */
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

        // 앱에서 고른 배경 테마 — 바탕과 글씨 색을 여기에 맞춘다
        final int th = WidgetTheme.index(o.optString("theme", "white"));
        final int cText = WidgetTheme.text(th), cDim = WidgetTheme.dim(th);
        setBg(v, R.id.w_root, WidgetTheme.bg(th, WidgetTheme.BG));
        v.setTextColor(R.id.w_brand, cText);

        String emptyText = o.optString("emptyText", "");
        String headTitle = o.optString("headTitle", "");
        String doneWord  = o.optString("doneWord", "");
        String noneWord  = o.optString("noneWord", "");

        // 앱을 며칠 안 열었으면 담아둔 할 일은 이미 지난 날 것이다
        String todosDate = o.optString("todosDate", "");
        boolean stale = todosDate.length() > 0 && !todosDate.equals(todayKey());

        // ── 물 · 비타민 ──
        if (showHealth()) {
            setBg(v, R.id.w_health_box, WidgetTheme.bg(th, WidgetTheme.SIDE_BG));
            v.setTextColor(R.id.w_water_lbl, cDim);
            v.setTextColor(R.id.w_vita_lbl, cDim);
            fillHealth(v, pkg, o);
        }

        // ── D-day: 등록된 만큼 전부 ──
        JSONArray ddays = showDday() ? o.optJSONArray("ddays") : null;
        int ddayCount = 0;
        if (showDday()) v.removeAllViews(R.id.w_dday_list);
        for (int i = 0; ddays != null && i < ddays.length(); i++) {
            JSONObject d = ddays.optJSONObject(i);
            if (d == null) continue;
            String title = d.optString("title", "");
            String date = d.optString("date", "");
            if (title.length() == 0 || date.length() == 0) continue;
            // 앱을 안 열어도 숫자가 맞도록 남은 날수는 여기서 다시 센다
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

            RemoteViews row = new RemoteViews(pkg, R.layout.w_todo_item);
            setBg(row, R.id.i_row, WidgetTheme.bg(th,
                    done ? WidgetTheme.ROW_DONE_BG : WidgetTheme.ROW_BG));
            setBg(row, R.id.i_chk, done ? R.drawable.w_check_on : R.drawable.w_check_off);
            row.setTextViewText(R.id.i_chk, done ? "✓" : "");
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

        // 머리글 개수는 오늘 전체 기준 — 위젯에는 몇 줄만 보여도
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

        // ── 오늘 시간표 ──
        // 위젯을 길게 늘일수록 한 시간 칸도 길어지도록, 남은 자리를 대충 재서 나눈다.
        if (showTable()) fillTable(v, pkg, o, th, ttRowH(mgr, id, ddayCount, shown));

        // ── 어제 · 내일 (기본 위젯에만 있다) ──
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

        // 위젯을 누르면 앱이 열린다
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);

        mgr.updateAppWidget(id, v);
    }

    /** 오늘 마신 물과 챙겨 먹은 비타민 */
    private void fillHealth(RemoteViews v, String pkg, JSONObject o) {
        JSONObject h = o.optJSONObject("health");
        if (h == null) {
            v.setViewVisibility(R.id.w_water_row, View.GONE);
            v.setViewVisibility(R.id.w_vita_box, View.GONE);
            return;
        }
        v.setTextViewText(R.id.w_water_lbl, h.optString("waterLabel", ""));
        int wDone = h.optInt("waterDone", 0), wGoal = h.optInt("waterGoal", 8);
        v.removeAllViews(R.id.w_water_row);
        // 앱 화면과 같은 방향 — 채워져 있다가 마시면 비워진다
        for (int i = 0; i < wGoal && i < 12; i++) {
            RemoteViews c = new RemoteViews(pkg, R.layout.w_cup);
            setBg(c, R.id.i_dot, i < wDone ? R.drawable.w_cup_off : R.drawable.w_cup_on);
            v.addView(R.id.w_water_row, c);
        }
        v.setViewVisibility(R.id.w_water_row, View.VISIBLE);

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
    }

    /**
     * 시간표를 요일 x 시간 격자로 그린다.
     * 앱 화면과 같은 모양이라 한눈에 알아볼 수 있다.
     * 한 시간이 한 줄이고, 칸이 걸쳐 있으면 색을 칠한다.
     * 이름은 그 칸이 시작하는 줄에만 적는다.
     */
    /**
     * 위젯 높이에서 다른 칸이 쓰는 만큼을 빼고, 남은 자리를 시간 수로 나눈다.
     * RemoteViews는 재 볼 수가 없어서 각 줄의 대략적인 높이로 어림한다.
     */
    private int ttRowH(AppWidgetManager mgr, int id, int ddayCount, int todoCount) {
        int hDp = 0;
        try {
            Bundle opts = mgr.getAppWidgetOptions(id);
            if (opts != null) {
                hDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
                if (hDp <= 0) hDp = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            }
        } catch (Exception ignored) {}
        if (hDp <= 0) return 0;                       // 크기를 모르면 기본 높이로

        int used = 20 + 34 + 22 + 22 + 8;             // 안쪽 여백 + 머리글 + 제목 + 요일줄
        if (showHealth()) used += 62;
        used += ddayCount * 40;
        if (showTodo()) used += (todoCount > 0 ? 26 + todoCount * 42 : 30);
        return hDp - used;                            // 시간표가 쓸 수 있는 높이
    }

    /** 남은 높이에 맞는 칸 모양 (0번이 제일 낮다) */
    private static int ttSize(int avail, int rows) {
        if (avail <= 0 || rows <= 0) return 1;
        int h = avail / rows;
        for (int i = TT_ROW_DP.length - 1; i > 0; i--) {
            if (h >= TT_ROW_DP[i]) return i;
        }
        return 0;
    }

    private static final int[] TT_ROW_DP   = { 14, 18, 22, 26, 31, 36 };
    private static final int[] TT_CELL_LAY = {
        R.layout.w_tt_cell_a, R.layout.w_tt_cell_b, R.layout.w_tt_cell_c,
        R.layout.w_tt_cell_d, R.layout.w_tt_cell_e, R.layout.w_tt_cell_f,
    };
    private static final int[] TT_HOUR_LAY = {
        R.layout.w_tt_hour_a, R.layout.w_tt_hour_b, R.layout.w_tt_hour_c,
        R.layout.w_tt_hour_d, R.layout.w_tt_hour_e, R.layout.w_tt_hour_f,
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
            // 빈 격자만 덩그러니 두지 않는다
            RemoteViews note = new RemoteViews(pkg, R.layout.w_tt_dow);
            note.setTextViewText(R.id.i_text, tt.optString("empty", ""));
            v.addView(R.id.w_tt_body, note);
            return;
        }
        int from = tt.optInt("from", 8);          // 보여줄 시작 시
        int to = tt.optInt("to", 20);             // 보여줄 끝 시
        if (to <= from) to = from + 1;
        if (to - from > 14) to = from + 14;       // 위젯이 너무 길어지지 않게
        int size = ttSize(avail, to - from);      // 위젯 크기에 맞는 칸 높이

        // 머리줄: 빈칸 + 일~토
        RemoteViews corner = new RemoteViews(pkg, R.layout.w_tt_hour);
        corner.setTextViewText(R.id.i_text, "");
        v.addView(R.id.w_tt_head, corner);
        int todayDow = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1;

        for (int d = 0; d < 7; d++) {
            RemoteViews c = new RemoteViews(pkg, R.layout.w_tt_dow);
            c.setTextViewText(R.id.i_text, dows == null ? "" : dows.optString(d, ""));
            // 오늘이 한눈에 보이게 노랑, 일요일은 붉게
            if (d == todayDow) {
                // 오늘은 머리글 칸만 노랗게. 글씨는 바탕에 묻히지 않게 진하게.
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
                    int s = b.optInt("start", -1), e = b.optInt("end", -1);   // 분 단위
                    if (s < 0 || e <= s) continue;
                    if (h * 60 < e && (h + 1) * 60 > s) {
                        hit = b;
                        starts = (s >= h * 60 && s < (h + 1) * 60);
                        ends = (e > h * 60 && e <= (h + 1) * 60);
                        // 보이는 범위 밖으로 이어지면 잘린 쪽은 모서리를 남기지 않는다
                        if (h == from && s < h * 60) starts = false;
                        if (h == to - 1 && e > (h + 1) * 60) ends = false;
                        break;
                    }
                }
                // 맨 아랫줄 오른쪽 끝은 바깥 틀의 둥근 모서리에 맞춰야 각지지 않는다
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

    /**
     * 한 일정이 여러 시간에 걸치면 한 덩어리로 보여야 한다.
     * 시작 줄은 위만, 끝 줄은 아래만 둥글고, 가운데 줄은 각지게 이어 붙인다.
     * 바깥 칸은 앱 화면과 같은 여덟 가지 색 (집중 · 쉼 · 골라 쓰는 여섯).
     */
    private static int ttPiece(boolean starts, boolean ends) {
        if (starts && ends) return 0;      // 한 시간짜리
        if (starts) return 1;              // 시작 줄
        if (ends) return 3;                // 끝 줄
        return 2;                          // 가운데
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

    /** 어제·내일 칸 하나를 채운다 */
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

        // 다 못 보여준 개수, 또는 아무것도 없을 때의 안내
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
