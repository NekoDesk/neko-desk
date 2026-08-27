package com.siwon.nekodesk.mobile;

/** 시간표만 */
public class NekoWidgetTt extends NekoWidget {
    @Override protected int layoutId()       { return R.layout.neko_widget_tt; }
    @Override protected boolean showHealth() { return false; }
    @Override protected boolean showDday()   { return false; }
    @Override protected boolean showTodo()   { return false; }
    @Override protected boolean showTable()  { return true; }
}
