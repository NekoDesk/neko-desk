package com.siwon.nekodesk.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Calendar;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 홈 화면 위젯 — 가장 가까운 D-day와 오늘 할 일을 보여준다.
 *
 * 앱(웹뷰)에서 계산한 내용을 SharedPreferences에 넣어두면 여기서 읽어 그린다.
 * 위젯은 RemoteViews라 웹뷰를 띄울 수 없어서, 표시에 필요한 값만 미리 담아 둔다.
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
        return String.format("%04d-%02d-%02d",
                c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    private void render(Context ctx, AppWidgetManager mgr, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.neko_widget);

        String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                         .getString(KEY_DATA, null);

        // 기본값 — 아직 앱을 한 번도 안 열었을 때
        String ddayTitle = "";
        String ddayBadge = "";
        String ddayDate = "";
        String emptyText = "";   // 앱 언어에 맞춘 안내 문구
        String todosDate = "";   // 저장된 할 일이 어느 날 것인지
        JSONArray todos = null;

        if (json != null) {
            try {
                JSONObject o = new JSONObject(json);
                ddayTitle = o.optString("ddayTitle", "");
                ddayBadge = o.optString("ddayBadge", "");
                ddayDate  = o.optString("ddayDate", "");
                emptyText = o.optString("emptyText", "");
                todosDate = o.optString("todosDate", "");
                todos     = o.optJSONArray("todos");
            } catch (Exception ignored) {}
        }

        // 앱을 안 열어도 숫자가 맞도록 남은 날수는 위젯에서 다시 센다
        Integer diff = ddayDate.length() > 0 ? daysFromToday(ddayDate) : null;
        if (diff != null) ddayBadge = ddayText(diff);

        // 어제 것이 남아 있지 않도록, 오늘 할 일만 보여준다
        if (todosDate.length() > 0 && !todosDate.equals(todayKey())) todos = null;

        boolean hasDday = ddayTitle.length() > 0;
        v.setViewVisibility(R.id.w_dday_box, hasDday ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.w_div,     hasDday ? View.VISIBLE : View.GONE);
        if (hasDday) {
            v.setTextViewText(R.id.w_dday_title, ddayTitle);
            v.setTextViewText(R.id.w_dday_badge, ddayBadge);
            v.setTextViewText(R.id.w_dday_date, ddayDate);
        }

        int[] rowIds  = { R.id.w_row1,  R.id.w_row2,  R.id.w_row3,  R.id.w_row4 };
        int[] txtIds  = { R.id.w_todo1, R.id.w_todo2, R.id.w_todo3, R.id.w_todo4 };
        int[] dotIds  = { R.id.w_dot1,  R.id.w_dot2,  R.id.w_dot3,  R.id.w_dot4 };
        int shown = 0;
        for (int i = 0; i < rowIds.length; i++) {
            String text = null;
            boolean done = false;
            if (todos != null && i < todos.length()) {
                JSONObject it = todos.optJSONObject(i);
                if (it != null) {
                    text = it.optString("text", "");
                    done = it.optBoolean("done", false);
                }
            }
            if (text != null && text.length() > 0) {
                v.setViewVisibility(rowIds[i], View.VISIBLE);
                v.setTextViewText(txtIds[i], text);
                // 끝낸 일은 흐리게 — RemoteViews는 취소선을 못 줘서 색으로 구분한다
                v.setTextColor(txtIds[i], done ? 0xFF9A9A9A : 0xFF4A4A4A);
                v.setImageViewResource(dotIds[i],
                        done ? R.drawable.w_check_on : R.drawable.w_check_off);
                shown++;
            } else {
                v.setViewVisibility(rowIds[i], View.GONE);
            }
        }
        if (shown == 0) {
            v.setViewVisibility(R.id.w_empty, View.VISIBLE);
            if (emptyText.length() > 0) v.setTextViewText(R.id.w_empty, emptyText);
        } else {
            v.setViewVisibility(R.id.w_empty, View.GONE);
        }

        // 위젯을 누르면 앱이 열린다
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);

        mgr.updateAppWidget(id, v);
    }
}
