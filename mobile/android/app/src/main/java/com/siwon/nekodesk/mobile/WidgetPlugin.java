package com.siwon.nekodesk.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.media.AudioManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

@CapacitorPlugin(name = "NekoWidget")
public class WidgetPlugin extends Plugin {

    // ── 소리 모드(소리·진동·무음) ──────────────────────────
    // 웹뷰의 소리는 미디어 볼륨으로 나서 진동 모드여도 그냥 나 버린다. 앱이 이 값을 보고
    // 소리 대신 떨 수 있게 지금 모드를 답하고, 바뀔 때마다 "ringerMode" 로 알린다.
    private BroadcastReceiver ringerReceiver;

    @Override
    public void load() {
        ringerReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent i) { notifyRinger(); }
        };
        try {
            ContextCompat.registerReceiver(getContext(), ringerReceiver,
                    new IntentFilter(AudioManager.RINGER_MODE_CHANGED_ACTION),
                    ContextCompat.RECEIVER_NOT_EXPORTED);
        } catch (Exception e) {
            ringerReceiver = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (ringerReceiver != null) {
            try { getContext().unregisterReceiver(ringerReceiver); } catch (Exception e) {}
            ringerReceiver = null;
        }
    }

    private static String ringerName(Context ctx) {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return "normal";
        switch (am.getRingerMode()) {
            case AudioManager.RINGER_MODE_VIBRATE: return "vibrate";
            case AudioManager.RINGER_MODE_SILENT:  return "silent";
            default: return "normal";
        }
    }

    private void notifyRinger() {
        JSObject o = new JSObject();
        o.put("mode", ringerName(getContext()));
        notifyListeners("ringerMode", o);
    }

    @PluginMethod
    public void getRingerMode(PluginCall call) {
        JSObject o = new JSObject();
        o.put("mode", ringerName(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void push(PluginCall call) {
        String json = call.getString("json", "");
        try {
            NekoWidget.push(getContext().getApplicationContext(), json);
            call.resolve();
        } catch (Exception e) {
            call.reject("위젯 갱신 실패", e);
        }
    }

    @PluginMethod
    public void getToggles(PluginCall call) {
        try {
            Context ctx = getContext().getApplicationContext();
            SharedPreferences sp = ctx.getSharedPreferences(NekoWidget.PREFS, Context.MODE_PRIVATE);

            String togglesRaw = sp.getString(NekoWidget.KEY_TOGGLES, "[]");
            int waterAdd = sp.getInt(NekoWidget.KEY_WATER_ADD, 0);
            int vitaAdd = sp.getInt(NekoWidget.KEY_VITA_ADD, 0);
            // 고양이도 함께 넘긴다. 여기서 빠져 있어서, 위젯에서 먹이를 주거나
            // 놀아 준 것이 앱에 닿지 못하고 다음 저장 때 덮여 사라졌다.
            int catFeed = sp.getInt(NekoWidget.KEY_CAT_FEED, 0);
            int catPlay = sp.getInt(NekoWidget.KEY_CAT_PLAY, 0);

            // 물·비타민·고양이는 누적이라 한 번 읽으면 바로 지운다
            // 토글은 멱등(target state)이라 푸시 성공까지 보존한다
            sp.edit()
                .remove(NekoWidget.KEY_WATER_ADD)
                .remove(NekoWidget.KEY_VITA_ADD)
                .remove(NekoWidget.KEY_CAT_FEED)
                .remove(NekoWidget.KEY_CAT_PLAY)
                .apply();

            JSObject ret = new JSObject();
            ret.put("toggles", new JSONArray(togglesRaw));
            ret.put("waterAdd", waterAdd);
            ret.put("vitaAdd", vitaAdd);
            ret.put("catFeed", catFeed);
            ret.put("catPlay", catPlay);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("토글 읽기 실패", e);
        }
    }

    /**
     * 앱이 서버에서 받은 소리 목록을 넘긴다. 내려받기는 시간이 걸리므로
     * 뒤에서 돌리고 바로 돌아온다 — 위젯은 다음에 눌릴 때부터 새 소리를 쓴다.
     */
    @PluginMethod
    public void setSounds(PluginCall call) {
        String json = call.getString("json", "");
        Context ctx = getContext().getApplicationContext();
        new Thread(() -> {
            try { NekoWidget.cacheSounds(ctx, json); } catch (Exception ignored) {}
        }).start();
        call.resolve();
    }

    /** 위젯이 들고 있던 것을 통째로 지운다 (계정 삭제 · 데이터 초기화) */
    @PluginMethod
    public void clear(PluginCall call) {
        try {
            NekoWidget.clear(getContext().getApplicationContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("위젯 지우기 실패", e);
        }
    }

    @PluginMethod
    public void clearPendingToggles(PluginCall call) {
        try {
            Context ctx = getContext().getApplicationContext();
            SharedPreferences sp = ctx.getSharedPreferences(NekoWidget.PREFS, Context.MODE_PRIVATE);
            sp.edit().remove(NekoWidget.KEY_TOGGLES).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("토글 지우기 실패", e);
        }
    }
}
