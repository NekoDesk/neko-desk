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
    static final int TT_TODAYHEAD = 9;
    static final int TT_EMPTY_BR = 10;
    static final int TT_TODAY_BR = 11;

    private static final String[] IDS = { "white", "ivory", "bpink", "pblue", "pmint", "ppurple", "black" };

    private static final int[][] SETS = {
        { R.drawable.w_bg, R.drawable.w_row_bg, R.drawable.w_row_done_bg, R.drawable.w_side_bg, R.drawable.w_dday_bg, R.drawable.w_tt_frame, R.drawable.w_tt_headbg, R.drawable.w_tt_empty, R.drawable.w_tt_today, R.drawable.w_tt_todayhead, R.drawable.w_tt_empty_br, R.drawable.w_tt_today_br },
        { R.drawable.w_bg_ivory, R.drawable.w_row_bg_ivory, R.drawable.w_row_done_bg_ivory, R.drawable.w_side_bg_ivory, R.drawable.w_dday_bg_ivory, R.drawable.w_tt_frame_ivory, R.drawable.w_tt_headbg_ivory, R.drawable.w_tt_empty_ivory, R.drawable.w_tt_today_ivory, R.drawable.w_tt_todayhead_ivory, R.drawable.w_tt_empty_br_ivory, R.drawable.w_tt_today_br_ivory },
        { R.drawable.w_bg_bpink, R.drawable.w_row_bg_bpink, R.drawable.w_row_done_bg_bpink, R.drawable.w_side_bg_bpink, R.drawable.w_dday_bg_bpink, R.drawable.w_tt_frame_bpink, R.drawable.w_tt_headbg_bpink, R.drawable.w_tt_empty_bpink, R.drawable.w_tt_today_bpink, R.drawable.w_tt_todayhead_bpink, R.drawable.w_tt_empty_br_bpink, R.drawable.w_tt_today_br_bpink },
        { R.drawable.w_bg_pblue, R.drawable.w_row_bg_pblue, R.drawable.w_row_done_bg_pblue, R.drawable.w_side_bg_pblue, R.drawable.w_dday_bg_pblue, R.drawable.w_tt_frame_pblue, R.drawable.w_tt_headbg_pblue, R.drawable.w_tt_empty_pblue, R.drawable.w_tt_today_pblue, R.drawable.w_tt_todayhead_pblue, R.drawable.w_tt_empty_br_pblue, R.drawable.w_tt_today_br_pblue },
        { R.drawable.w_bg_pmint, R.drawable.w_row_bg_pmint, R.drawable.w_row_done_bg_pmint, R.drawable.w_side_bg_pmint, R.drawable.w_dday_bg_pmint, R.drawable.w_tt_frame_pmint, R.drawable.w_tt_headbg_pmint, R.drawable.w_tt_empty_pmint, R.drawable.w_tt_today_pmint, R.drawable.w_tt_todayhead_pmint, R.drawable.w_tt_empty_br_pmint, R.drawable.w_tt_today_br_pmint },
        { R.drawable.w_bg_ppurple, R.drawable.w_row_bg_ppurple, R.drawable.w_row_done_bg_ppurple, R.drawable.w_side_bg_ppurple, R.drawable.w_dday_bg_ppurple, R.drawable.w_tt_frame_ppurple, R.drawable.w_tt_headbg_ppurple, R.drawable.w_tt_empty_ppurple, R.drawable.w_tt_today_ppurple, R.drawable.w_tt_todayhead_ppurple, R.drawable.w_tt_empty_br_ppurple, R.drawable.w_tt_today_br_ppurple },
        { R.drawable.w_bg_black, R.drawable.w_row_bg_black, R.drawable.w_row_done_bg_black, R.drawable.w_side_bg_black, R.drawable.w_dday_bg_black, R.drawable.w_tt_frame_black, R.drawable.w_tt_headbg_black, R.drawable.w_tt_empty_black, R.drawable.w_tt_today_black, R.drawable.w_tt_todayhead_black, R.drawable.w_tt_empty_br_black, R.drawable.w_tt_today_br_black },
    };

    /** 어두운 테마인가 — 시간표 칸을 어두운 그림으로 그린다 */
    private static final boolean[] DARK = { false, false, false, false, false, false, true };

    // ── 캔버스로 직접 그릴 때 쓰는 색값 ──────────────────
    // 시간표는 그림으로 그린다 (RemoteViews 로는 분 단위 높이를 만들 수 없다).
    // 그림 drawable 과 같은 셈에서 나오므로 두 방식이 같은 색으로 보인다.
    static final int C_HEAD = 0, C_HEAD_LINE = 1, C_EMPTY = 2, C_EMPTY_LINE = 3,
                     C_TODAY = 4, C_TODAY_LINE = 5, C_TEXT = 6, C_DIM = 7, C_FRAME_LINE = 8;

    private static final int[][] COLORS = {
        { 0xFFEEF1F5, 0xFFD8DEE8, 0xFFFFFFFF, 0xFFD8DEE8, 0xFFE5D1A3, 0xFFD9BE82, 0xFF33405A, 0xFF8C98AD, 0xFFAEB8C8 },
        { 0xFFF7F3E8, 0xFFEBE4D4, 0xFFFFFEFA, 0xFFEBE4D4, 0xFFE7D7B3, 0xFFDDC89A, 0xFF5A5346, 0xFFA89E8C, 0xFFC6BEAC },
        { 0xFFFBEDF1, 0xFFF5DDE5, 0xFFFFFBFC, 0xFFF5DDE5, 0xFFEED5BD, 0xFFE8C7A7, 0xFF6B525A, 0xFFC5AAB3, 0xFFDBC1CA },
        { 0xFFEEF5FC, 0xFFDDE9F5, 0xFFFBFDFF, 0xFFDDE9F5, 0xFFE2D8BE, 0xFFD8CAA7, 0xFF4A5A6E, 0xFF9FB4C8, 0xFFBBCCDC },
        { 0xFFEEF8F2, 0xFFDCEFE5, 0xFFFBFEFC, 0xFFDCEFE5, 0xFFE2DAB9, 0xFFD7CCA1, 0xFF486054, 0xFF9CBAAD, 0xFFB9D2C6 },
        { 0xFFF4EEFB, 0xFFE8DDF4, 0xFFFDFBFF, 0xFFE8DDF4, 0xFFE6D4BE, 0xFFDCC5A7, 0xFF584A6A, 0xFFB3A3C6, 0xFFCBBDDB },
        { 0xFF3A3A43, 0xFF4B4B56, 0xFF2E2E35, 0xFF4B4B56, 0xFF8C7B56, 0xFFAE9864, 0xFFF4F4F8, 0xFFB0B0BC, 0xFF83838E },
    };

    /** 시간표 칸 색 — [종류][0]=테두리 [종류][1]=바탕. 종류는 일·쉼·색0~5 */
    private static final int[][] BLK_C_LIGHT = {
        { 0xFF9AD3BF, 0xFFDCF0E8 },
        { 0xFFEFCB9A, 0xFFFCEEDC },
        { 0xFFA2AEC2, 0xFFEDF0F5 },
        { 0xFFCFC0A0, 0xFFF7F1DF },
        { 0xFFE2A8C0, 0xFFFBE7EF },
        { 0xFFA6C4E2, 0xFFE6F0FA },
        { 0xFFA2D0BA, 0xFFE4F5EC },
        { 0xFFC2AADE, 0xFFF0E8FA },
    };
    private static final int[][] BLK_C_DARK = {
        { 0xFF528372, 0xFF31463D },
        { 0xFF84775A, 0xFF453F31 },
        { 0xFF65758D, 0xFF38424F },
        { 0xFF84775A, 0xFF453F31 },
        { 0xFF8A5D71, 0xFF4B3642 },
        { 0xFF56759B, 0xFF313E53 },
        { 0xFF528372, 0xFF31463D },
        { 0xFF756492, 0xFF403752 },
    };

    /** 글자 색 — { 본문, 흐린 글씨, 강조 } */
    private static final int[][] TEXT = {
        { 0xFF33405A, 0xFF8C98AD, 0xFF5A6B8C },
        { 0xFF5A5346, 0xFFA89E8C, 0xFFC9A184 },
        { 0xFF6B525A, 0xFFC5AAB3, 0xFFD68FA8 },
        { 0xFF4A5A6E, 0xFF9FB4C8, 0xFF84AAD2 },
        { 0xFF486054, 0xFF9CBAAD, 0xFF7CBBA2 },
        { 0xFF584A6A, 0xFFB3A3C6, 0xFFA98EC8 },
        { 0xFFF4F4F8, 0xFFB0B0BC, 0xFF9AA9DA },
    };

    private static final int[][] BLK_LIGHT = {
        { R.drawable.w_b_w_s, R.drawable.w_b_w_t, R.drawable.w_b_w_m, R.drawable.w_b_w_b },
        { R.drawable.w_b_r_s, R.drawable.w_b_r_t, R.drawable.w_b_r_m, R.drawable.w_b_r_b },
        { R.drawable.w_b_c0_s, R.drawable.w_b_c0_t, R.drawable.w_b_c0_m, R.drawable.w_b_c0_b },
        { R.drawable.w_b_c1_s, R.drawable.w_b_c1_t, R.drawable.w_b_c1_m, R.drawable.w_b_c1_b },
        { R.drawable.w_b_c2_s, R.drawable.w_b_c2_t, R.drawable.w_b_c2_m, R.drawable.w_b_c2_b },
        { R.drawable.w_b_c3_s, R.drawable.w_b_c3_t, R.drawable.w_b_c3_m, R.drawable.w_b_c3_b },
        { R.drawable.w_b_c4_s, R.drawable.w_b_c4_t, R.drawable.w_b_c4_m, R.drawable.w_b_c4_b },
        { R.drawable.w_b_c5_s, R.drawable.w_b_c5_t, R.drawable.w_b_c5_m, R.drawable.w_b_c5_b },
    };

    private static final int[][] BLK_DARK = {
        { R.drawable.w_b_w_s_black, R.drawable.w_b_w_t_black, R.drawable.w_b_w_m_black, R.drawable.w_b_w_b_black },
        { R.drawable.w_b_r_s_black, R.drawable.w_b_r_t_black, R.drawable.w_b_r_m_black, R.drawable.w_b_r_b_black },
        { R.drawable.w_b_c0_s_black, R.drawable.w_b_c0_t_black, R.drawable.w_b_c0_m_black, R.drawable.w_b_c0_b_black },
        { R.drawable.w_b_c1_s_black, R.drawable.w_b_c1_t_black, R.drawable.w_b_c1_m_black, R.drawable.w_b_c1_b_black },
        { R.drawable.w_b_c2_s_black, R.drawable.w_b_c2_t_black, R.drawable.w_b_c2_m_black, R.drawable.w_b_c2_b_black },
        { R.drawable.w_b_c3_s_black, R.drawable.w_b_c3_t_black, R.drawable.w_b_c3_m_black, R.drawable.w_b_c3_b_black },
        { R.drawable.w_b_c4_s_black, R.drawable.w_b_c4_t_black, R.drawable.w_b_c4_m_black, R.drawable.w_b_c4_b_black },
        { R.drawable.w_b_c5_s_black, R.drawable.w_b_c5_t_black, R.drawable.w_b_c5_m_black, R.drawable.w_b_c5_b_black },
    };


    static int index(String id) {
        for (int i = 0; i < IDS.length; i++) {
            if (IDS[i].equals(id)) return i;
        }
        return 0;                       // 모르는 이름이면 기본(화이트)
    }

    static int bg(int theme, int part) { return SETS[theme][part]; }
    static int text(int theme) { return TEXT[theme][0]; }
    static int dim(int theme) { return TEXT[theme][1]; }
    static int accent(int theme) { return TEXT[theme][2]; }

    /** 어두운 테마인가 — 시간표 칸을 어두운 그림으로 그린다 */
    static boolean dark(int theme) { return DARK[theme]; }

    /** 시간표 칸 그림 — [종류][조각]. 종류는 일·쉼·색0~5, 조각은 혼자·위·가운데·아래 */
    static int[][] blocks(int theme) { return dark(theme) ? BLK_DARK : BLK_LIGHT; }

    /** 캔버스용 색값 (C_ 로 시작하는 자리 번호) */
    static int color(int theme, int slot) { return COLORS[theme][slot]; }

    /** 캔버스용 칸 색 — [종류][테두리/바탕] */
    static int[][] blockColors(int theme) { return dark(theme) ? BLK_C_DARK : BLK_C_LIGHT; }
}
