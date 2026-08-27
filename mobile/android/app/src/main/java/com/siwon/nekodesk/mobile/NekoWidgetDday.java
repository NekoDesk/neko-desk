package com.siwon.nekodesk.mobile;

/** D-day 만 */
public class NekoWidgetDday extends NekoWidget {
    @Override protected int layoutId()       { return R.layout.neko_widget_dday; }
    @Override protected boolean showHealth() { return false; }
    @Override protected boolean showDday()   { return true; }
    @Override protected boolean showTodo()   { return false; }
    @Override protected boolean showTable()  { return false; }
}
