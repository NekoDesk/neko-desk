package com.siwon.nekodesk.mobile;

/** 오늘 할 일만 */
public class NekoWidgetTodo extends NekoWidget {
    @Override protected int layoutId()       { return R.layout.neko_widget_todo; }
    @Override protected boolean showHealth() { return false; }
    @Override protected boolean showDday()   { return false; }
    @Override protected boolean showTodo()   { return true; }
    @Override protected boolean showTable()  { return false; }
}
