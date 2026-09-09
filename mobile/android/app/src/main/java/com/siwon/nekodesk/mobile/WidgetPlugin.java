package com.siwon.nekodesk.mobile;

import android.content.SharedPreferences;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

@CapacitorPlugin(name = "NekoWidget")
public class WidgetPlugin extends Plugin {

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
