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

            // 물/비타민은 누적이라 한 번 읽으면 바로 지운다
            // 토글은 멱등(target state)이라 푸시 성공까지 보존한다
            sp.edit()
                .remove(NekoWidget.KEY_WATER_ADD)
                .remove(NekoWidget.KEY_VITA_ADD)
                .apply();

            JSObject ret = new JSObject();
            ret.put("toggles", new JSONArray(togglesRaw));
            ret.put("waterAdd", waterAdd);
            ret.put("vitaAdd", vitaAdd);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("토글 읽기 실패", e);
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
