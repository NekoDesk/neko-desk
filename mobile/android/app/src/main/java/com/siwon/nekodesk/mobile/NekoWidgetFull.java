package com.siwon.nekodesk.mobile;

/** 목록 + 오늘 시간표 */
public class NekoWidgetFull extends NekoWidget {
    @Override protected int layoutId()       { return R.layout.neko_widget_full; }
    @Override protected boolean showHealth() { return true; }
    @Override protected boolean showDday()   { return true; }
    @Override protected boolean showTodo()   { return true; }
    @Override protected boolean showTable()  { return true; }
}
