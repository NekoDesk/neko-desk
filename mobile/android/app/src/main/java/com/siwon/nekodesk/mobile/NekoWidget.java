package com.siwon.nekodesk.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
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
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NekoWidget.class));
            for (int id : ids) render(ctx, mgr, id);
        }
    }

    /** 앱에서 호출 — 저장하고 곧바로 다시 그리게 한다 */
    public static void push(Context ctx, String json) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putString(KEY_DATA, json).apply();
        ctx.sendBroadcast(new Intent(ctx, NekoWidget.class).setAction(ACTION_REFRESH));
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
        RemoteViews v = new RemoteViews(pkg, R.layout.neko_widget);

        String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                         .getString(KEY_DATA, null);
        JSONObject o = null;
        if (json != null) {
            try { o = new JSONObject(json); } catch (Exception ignored) {}
        }
        if (o == null) o = new JSONObject();

        String emptyText = o.optString("emptyText", "");
        String headTitle = o.optString("headTitle", "");
        String doneWord  = o.optString("doneWord", "");
        String noneWord  = o.optString("noneWord", "");

        // 앱을 며칠 안 열었으면 담아둔 할 일은 이미 지난 날 것이다
        String todosDate = o.optString("todosDate", "");
        boolean stale = todosDate.length() > 0 && !todosDate.equals(todayKey());

        // ── D-day: 등록된 만큼 전부 ──
        JSONArray ddays = o.optJSONArray("ddays");
        v.removeAllViews(R.id.w_dday_list);
        int ddayCount = 0;
        for (int i = 0; ddays != null && i < ddays.length(); i++) {
            JSONObject d = ddays.optJSONObject(i);
            if (d == null) continue;
            String title = d.optString("title", "");
            String date = d.optString("date", "");
            if (title.length() == 0 || date.length() == 0) continue;
            // 앱을 안 열어도 숫자가 맞도록 남은 날수는 여기서 다시 센다
            Integer diff = daysFromToday(date);
            RemoteViews row = new RemoteViews(pkg, R.layout.w_dday_item);
            row.setTextViewText(R.id.i_badge, diff == null ? "" : ddayText(diff));
            row.setTextViewText(R.id.i_title, title);
            row.setTextViewText(R.id.i_date, shortDate(date));
            v.addView(R.id.w_dday_list, row);
            ddayCount++;
        }
        v.setViewVisibility(R.id.w_dday_list, ddayCount > 0 ? View.VISIBLE : View.GONE);

        // ── 오늘 할 일 ──
        JSONArray todos = stale ? null : o.optJSONArray("todos");
        v.removeAllViews(R.id.w_today_list);
        int shown = 0;
        for (int i = 0; todos != null && i < todos.length(); i++) {
            JSONObject it = todos.optJSONObject(i);
            String text = (it == null) ? "" : it.optString("text", "");
            if (text.length() == 0) continue;
            boolean done = it.optBoolean("done", false);
            boolean pm = "pm".equals(it.optString("ampm", ""));
            String badge = it.optString("ampmLabel", "");

            RemoteViews row = new RemoteViews(pkg, R.layout.w_todo_item);
            setBg(row, R.id.i_row, done ? R.drawable.w_row_done_bg : R.drawable.w_row_bg);
            setBg(row, R.id.i_chk, done ? R.drawable.w_check_on : R.drawable.w_check_off);
            row.setTextViewText(R.id.i_chk, done ? "✓" : "");
            if (done) {
                row.setTextViewText(R.id.i_text, struck(text));
                row.setTextColor(R.id.i_text, 0xFF9AA0A6);
            } else {
                row.setTextViewText(R.id.i_text, text);
                row.setTextColor(R.id.i_text, 0xFF3E3A39);
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
        v.setViewVisibility(R.id.w_head_box, shown > 0 ? View.VISIBLE : View.GONE);
        if (shown > 0) {
            v.setTextViewText(R.id.w_head_title, headTitle);
            v.setTextViewText(R.id.w_head_count,
                    doneCount + " / " + total + (doneWord.length() > 0 ? " " + doneWord : ""));
        }

        if (shown == 0) {
            v.setViewVisibility(R.id.w_empty, View.VISIBLE);
            if (emptyText.length() > 0) v.setTextViewText(R.id.w_empty, emptyText);
        } else {
            v.setViewVisibility(R.id.w_empty, View.GONE);
        }

        // ── 어제 · 내일 ──
        fillSide(v, pkg, o.optJSONObject("yesterday"), stale,
                 R.id.w_yday_title, R.id.w_yday_list, R.id.w_yday_empty, noneWord);
        fillSide(v, pkg, o.optJSONObject("tomorrow"), stale,
                 R.id.w_tmr_title, R.id.w_tmr_list, R.id.w_tmr_empty, noneWord);

        // 위젯을 누르면 앱이 열린다
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);

        mgr.updateAppWidget(id, v);
    }

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
