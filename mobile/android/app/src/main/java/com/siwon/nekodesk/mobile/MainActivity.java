package com.siwon.nekodesk.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 웹뷰가 뜨기 전에 등록해야 첫 화면부터 위젯 갱신이 된다
        registerPlugin(WidgetPlugin.class);
        registerPlugin(PhotoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
