package com.siwon.nekodesk.mobile;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 웹뷰 → 바탕화면 위젯 통로.
 *
 * 웹뷰에서 만든 내용(JSON 문자열)을 받아 NekoWidget에 넘긴다.
 * addJavascriptInterface는 페이지가 이미 뜬 뒤에 붙이면 다음 새로고침까지
 * 안 잡히는 문제가 있어서, Capacitor 플러그인 쪽을 주된 통로로 쓴다.
 */
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
}
