package com.siwon.nekodesk.mobile;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 웹뷰가 뜨기 전에 등록해야 첫 화면부터 위젯 갱신이 된다
        registerPlugin(WidgetPlugin.class);
        registerPlugin(PhotoPlugin.class);
        super.onCreate(savedInstanceState);

        // 알람 소리는 사용자가 화면을 누른 직후가 아니어도 나야 한다.
        // 안드로이드 웹뷰는 기본적으로 이런 재생을 막으므로 풀어준다.
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) wv.getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}
