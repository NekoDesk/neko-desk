package com.siwon.nekodesk.mobile;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

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

        applySystemBarInsets();
    }

    /**
     * 시스템 바(상태바·내비게이션바)를 피해서 그리게 한다.
     *
     * 안드로이드 16(API 36)을 타겟하면 화면 끝까지 그리기가 강제되고,
     * 예전에 쓰던 windowOptOutEdgeToEdgeEnforcement 는 무시된다. 그대로 두면
     * 앱 머리글이 상태바 밑으로, 탭 바가 내비게이션 바 밑으로 들어가 버린다.
     *
     * 그래서 내용이 담기는 판에 시스템 바 두께만큼 안쪽 여백을 준다.
     * 웹 쪽은 손댈 필요가 없다 — 웹뷰가 이미 안전한 자리에만 놓이므로
     * CSS의 env(safe-area-inset-*)는 0이 되어 여백이 두 번 들어가지 않는다.
     */
    private void applySystemBarInsets() {
        final View root = findViewById(android.R.id.content);
        if (root == null) return;

        // 시스템 바 자리에 비치는 바탕. 테마가 모두 밝은 색이라 흰색으로 둔다.
        root.setBackgroundColor(Color.WHITE);

        // 바탕이 밝으므로 상태바 글씨는 어둡게
        try {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowInsetsControllerCompat c =
                    WindowCompat.getInsetsController(getWindow(), root);
            c.setAppearanceLightStatusBars(true);
            c.setAppearanceLightNavigationBars(true);
        } catch (Exception ignored) {}

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                            | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(root);
    }
}
