package com.gujian.guditu;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** 桌面「行迹卡片」：统计 + 最近记忆，数据由 Web 层经 AndroidCard 桥写入 SharedPreferences */
public class TraceWidget extends AppWidgetProvider {

    public static final String PREFS = "trace_card";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) render(ctx, mgr, id);
    }

    /** 数据变化后由 MainActivity 调用：刷新桌面上所有实例 */
    public static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        if (mgr == null) return;
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, TraceWidget.class));
        for (int id : ids) render(ctx, mgr, id);
    }

    private static void render(Context ctx, AppWidgetManager mgr, int id) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.widget_trace);

        Date now = new Date();
        rv.setTextViewText(R.id.w_date, new SimpleDateFormat("M月d日", Locale.CHINA).format(now));
        rv.setTextViewText(R.id.w_week, new SimpleDateFormat("EEEE", Locale.CHINA).format(now));

        rv.setTextViewText(R.id.w_cities, String.valueOf(sp.getInt("cities", 0)));
        rv.setTextViewText(R.id.w_notes, String.valueOf(sp.getInt("notes", 0)));
        rv.setTextViewText(R.id.w_wishes, String.valueOf(sp.getInt("wishes", 0)));

        String place = sp.getString("place", "");
        String quote = sp.getString("quote", "");
        if (place == null || place.isEmpty()) place = "还没有足迹";
        if (quote == null || quote.isEmpty()) quote = "打开行迹，记下第一段旅程";
        rv.setTextViewText(R.id.w_place, place);
        rv.setTextViewText(R.id.w_quote, quote);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        Intent open = new Intent(ctx, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        rv.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 0, open, flags));
        Intent note = new Intent(ctx, MainActivity.class)
                .putExtra("tn_shortcut", "anywhere")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        rv.setOnClickPendingIntent(R.id.w_note, PendingIntent.getActivity(ctx, 1, note, flags));

        mgr.updateAppWidget(id, rv);
    }
}
