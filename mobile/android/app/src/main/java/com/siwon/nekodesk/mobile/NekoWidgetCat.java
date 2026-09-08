package com.siwon.nekodesk.mobile;

/** 고양이만 */
public class NekoWidgetCat extends NekoWidget {
    @Override protected int layoutId()       { return R.layout.neko_widget_cat; }
    @Override protected boolean showHealth() { return false; }
    @Override protected boolean showDday()   { return false; }
    @Override protected boolean showTodo()   { return false; }
    @Override protected boolean showTable()  { return false; }
    @Override protected boolean showCat()    { return true; }
}
