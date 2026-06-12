package com.dreamtracker.app.widget;

import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import com.dreamtracker.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Feeds the widget ListView with today's habits from widget_get_today. */
public class HabitsWidgetService extends RemoteViewsService {

  @Override
  public RemoteViewsFactory onGetViewFactory(Intent intent) {
    return new HabitsFactory(getApplicationContext());
  }

  static final class HabitItem {
    long id;
    String name;
    double target;
    double value;
    String unit;
    boolean done;
  }

  static final class HabitsFactory implements RemoteViewsFactory {
    private final Context context;
    private final List<HabitItem> items = new ArrayList<>();

    HabitsFactory(Context context) {
      this.context = context;
    }

    @Override
    public void onCreate() {}

    @Override
    public void onDataSetChanged() {
      // Runs on a binder thread — synchronous network is allowed here.
      items.clear();
      WidgetApi.Config cfg = WidgetApi.readConfig(context);
      if (cfg == null) return; // not signed in yet → empty view
      try {
        JSONObject body = new JSONObject();
        body.put("p_token", cfg.token);
        String res = WidgetApi.rpc(cfg, "widget_get_today", body);
        JSONArray arr = new JSONArray(res);
        for (int i = 0; i < arr.length(); i++) {
          JSONObject o = arr.getJSONObject(i);
          HabitItem h = new HabitItem();
          h.id = o.getLong("id");
          h.name = o.optString("name", "");
          h.target = o.optDouble("target", 0);
          h.value = o.optDouble("value", 0);
          h.unit = o.optString("unit", "");
          h.done = o.optBoolean("done", false);
          items.add(h);
        }
      } catch (Exception ignored) {
        // Offline / server error — keep the list empty rather than crash.
      }
    }

    @Override
    public void onDestroy() {
      items.clear();
    }

    @Override
    public int getCount() {
      return items.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
      if (position < 0 || position >= items.size()) return null;
      HabitItem h = items.get(position);

      RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_habit_item);
      row.setTextViewText(R.id.item_name, h.name);

      String progress = formatNum(h.value) + " / " + formatNum(h.target);
      if (h.unit != null && !h.unit.isEmpty()) progress += " " + h.unit;
      row.setTextViewText(R.id.item_progress, progress);

      row.setTextViewText(R.id.item_check, h.done ? "✓" : "");
      row.setInt(R.id.item_check, "setBackgroundResource",
          h.done ? R.drawable.widget_check_done : R.drawable.widget_check_todo);

      Intent fillIn = new Intent();
      fillIn.putExtra(HabitsWidgetProvider.EXTRA_HABIT_ID, h.id);
      row.setOnClickFillInIntent(R.id.item_root, fillIn);

      return row;
    }

    private static String formatNum(double v) {
      if (v == Math.rint(v)) return String.valueOf((long) v);
      return String.valueOf(v);
    }

    @Override
    public RemoteViews getLoadingView() {
      return null;
    }

    @Override
    public int getViewTypeCount() {
      return 1;
    }

    @Override
    public long getItemId(int position) {
      return position < items.size() ? items.get(position).id : position;
    }

    @Override
    public boolean hasStableIds() {
      return true;
    }
  }
}
