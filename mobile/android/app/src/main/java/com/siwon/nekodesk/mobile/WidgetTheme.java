package com.siwon.nekodesk.mobile;

/**
 * 위젯 배경 테마 — scripts/make-widget-themes.js 가 만든다. 손으로 고치지 말 것.
 *
 * 위젯은 RemoteViews라 색을 그때그때 칠할 수 없어서, 테마마다 배경 그림을
 * 미리 만들어 두고 여기서 골라 쓴다. 색은 앱의 THEMES에서 그대로 가져왔다.
 */
final class WidgetTheme {

    // 배경 그림 자리 번호
    static final int BG = 0;
    static final int ROW_BG = 1;
    static final int ROW_DONE_BG = 2;
    static final int SIDE_BG = 3;
    static final int DDAY_BG = 4;
    static final int TT_FRAME = 5;
    static final int TT_HEADBG = 6;
    static final int TT_EMPTY = 7;
    static final int TT_TODAY = 8;
    static final int TT_EMPTY_BR = 9;
    static final int TT_TODAY_BR = 10;

    private static final String[] IDS = { "white", "ivory", "bpink", "pblue", "pmint", "ppurple" };

    private static final int[][] BG = {
        { R.drawable.w_bg, R.drawable.w_row_bg, R.drawable.w_row_done_bg, R.drawable.w_side_bg, R.drawable.w_dday_bg, R.drawable.w_tt_frame, R.drawable.w_tt_headbg, R.drawable.w_tt_empty, R.drawable.w_tt_today, R.drawable.w_tt_empty_br, R.drawable.w_tt_today_br },
        { R.drawable.w_bg_ivory, R.drawable.w_row_bg_ivory, R.drawable.w_row_done_bg_ivory, R.drawable.w_side_bg_ivory, R.drawable.w_dday_bg_ivory, R.drawable.w_tt_frame_ivory, R.drawable.w_tt_headbg_ivory, R.drawable.w_tt_empty_ivory, R.drawable.w_tt_today_ivory, R.drawable.w_tt_empty_br_ivory, R.drawable.w_tt_today_br_ivory },
        { R.drawable.w_bg_bpink, R.drawable.w_row_bg_bpink, R.drawable.w_row_done_bg_bpink, R.drawable.w_side_bg_bpink, R.drawable.w_dday_bg_bpink, R.drawable.w_tt_frame_bpink, R.drawable.w_tt_headbg_bpink, R.drawable.w_tt_empty_bpink, R.drawable.w_tt_today_bpink, R.drawable.w_tt_empty_br_bpink, R.drawable.w_tt_today_br_bpink },
        { R.drawable.w_bg_pblue, R.drawable.w_row_bg_pblue, R.drawable.w_row_done_bg_pblue, R.drawable.w_side_bg_pblue, R.drawable.w_dday_bg_pblue, R.drawable.w_tt_frame_pblue, R.drawable.w_tt_headbg_pblue, R.drawable.w_tt_empty_pblue, R.drawable.w_tt_today_pblue, R.drawable.w_tt_empty_br_pblue, R.drawable.w_tt_today_br_pblue },
        { R.drawable.w_bg_pmint, R.drawable.w_row_bg_pmint, R.drawable.w_row_done_bg_pmint, R.drawable.w_side_bg_pmint, R.drawable.w_dday_bg_pmint, R.drawable.w_tt_frame_pmint, R.drawable.w_tt_headbg_pmint, R.drawable.w_tt_empty_pmint, R.drawable.w_tt_today_pmint, R.drawable.w_tt_empty_br_pmint, R.drawable.w_tt_today_br_pmint },
        { R.drawable.w_bg_ppurple, R.drawable.w_row_bg_ppurple, R.drawable.w_row_done_bg_ppurple, R.drawable.w_side_bg_ppurple, R.drawable.w_dday_bg_ppurple, R.drawable.w_tt_frame_ppurple, R.drawable.w_tt_headbg_ppurple, R.drawable.w_tt_empty_ppurple, R.drawable.w_tt_today_ppurple, R.drawable.w_tt_empty_br_ppurple, R.drawable.w_tt_today_br_ppurple },
    };

    /** 글자 색 — { 본문, 흐린 글씨, 강조 } */
    private static final int[][] TEXT = {
        { 0xFF33405A, 0xFF8C98AD, 0xFF5A6B8C },
        { 0xFF5A5346, 0xFFA89E8C, 0xFFC9A184 },
        { 0xFF6B525A, 0xFFC5AAB3, 0xFFD68FA8 },
        { 0xFF4A5A6E, 0xFF9FB4C8, 0xFF84AAD2 },
        { 0xFF486054, 0xFF9CBAAD, 0xFF7CBBA2 },
        { 0xFF584A6A, 0xFFB3A3C6, 0xFFA98EC8 },
    };

    static int index(String id) {
        for (int i = 0; i < IDS.length; i++) {
            if (IDS[i].equals(id)) return i;
        }
        return 0;                       // 모르는 이름이면 기본(화이트)
    }

    static int bg(int theme, int part) { return BG[theme][part]; }
    static int text(int theme) { return TEXT[theme][0]; }
    static int dim(int theme) { return TEXT[theme][1]; }
    static int accent(int theme) { return TEXT[theme][2]; }
}
