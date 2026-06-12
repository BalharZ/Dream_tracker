package com.dreamtracker.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import com.dreamtracker.app.R;

import org.json.JSONObject;

/**
 * Home-screen widget (S17): lists today's habits, a tap on the circle marks
 * the habit done for today (sets the value to its target) directly via the
 * Supabase RPC — without opening the app.
 */
public class HabitsWidgetProvider extends AppWidgetProvider {

  static final String ACTION_COMPLETE = "com.dreamtracker.app.widget.ACTION_COMPLETE";
  static final String ACTION_REFRESH = "com.dreamtracker.app.widget.ACTION_REFRESH";
  static final String EXTRA_HABIT_ID = "habit_id";

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    for (int id : appWidgetIds) {
      manager.updateAppWidget(id, buildViews(context, id));
    }
    manager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.widget_list);
  }

  private RemoteViews buildViews(Context context, int appWidgetId) {
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_habits);

    // List adapter (RemoteViewsService fetches data in onDataSetChanged).
    Intent svc = new Intent(context, HabitsWidgetService.class);
    svc.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
    svc.setData(Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME)));
    views.setRemoteAdapter(R.id.widget_list, svc);
    views.setEmptyView(R.id.widget_list, R.id.widget_empty);

    // Item tap template — items fill in EXTRA_HABIT_ID (needs FLAG_MUTABLE).
    Intent complete = new Intent(context, HabitsWidgetProvider.class).setAction(ACTION_COMPLETE);
    PendingIntent completePI = PendingIntent.getBroadcast(
        context, 0, complete,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
    views.setPendingIntentTemplate(R.id.widget_list, completePI);

    // Refresh button.
    Intent refresh = new Intent(context, HabitsWidgetProvider.class).setAction(ACTION_REFRESH);
    PendingIntent refreshPI = PendingIntent.getBroadcast(
        context, 1, refresh,
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    views.setOnClickPendingIntent(R.id.widget_refresh, refreshPI);

    // Title / empty state tap opens the app.
    Intent open = context.getPackageManager()
        .getLaunchIntentForPackage(context.getPackageName());
    if (open != null) {
      PendingIntent openPI = PendingIntent.getActivity(
          context, 2, open,
          PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      views.setOnClickPendingIntent(R.id.widget_title, openPI);
      views.setOnClickPendingIntent(R.id.widget_empty, openPI);
    }

    return views;
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    super.onReceive(context, intent);
    String action = intent.getAction();

    if (ACTION_REFRESH.equals(action)) {
      notifyDataChanged(context);
      return;
    }

    if (ACTION_COMPLETE.equals(action)) {
      long habitId = intent.getLongExtra(EXTRA_HABIT_ID, -1);
      if (habitId < 0) return;
      final PendingResult result = goAsync();
      new Thread(() -> {
        try {
          WidgetApi.Config cfg = WidgetApi.readConfig(context);
          if (cfg != null) {
            JSONObject body = new JSONObject();
            body.put("p_token", cfg.token);
            body.put("p_habit_id", habitId);
            WidgetApi.rpc(cfg, "widget_complete_habit", body);
          }
        } catch (Exception ignored) {
          // Offline / token revoked — the list refresh below shows the truth.
        } finally {
          notifyDataChanged(context);
          result.finish();
        }
      }).start();
    }
  }

  private void notifyDataChanged(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    int[] ids = manager.getAppWidgetIds(
        new ComponentName(context, HabitsWidgetProvider.class));
    manager.notifyAppWidgetViewDataChanged(ids, R.id.widget_list);
  }
}
