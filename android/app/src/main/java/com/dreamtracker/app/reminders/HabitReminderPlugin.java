package com.dreamtracker.app.reminders;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

/**
 * JS-callable bridge for the picture-capable habit reminders. Registered in
 * {@link com.dreamtracker.app.MainActivity}. The web layer detects it via
 * Capacitor.isPluginAvailable("HabitReminder") and falls back to
 * @capacitor/local-notifications when it's missing (older APKs).
 */
@CapacitorPlugin(name = "HabitReminder")
public class HabitReminderPlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray notifications = call.getArray("notifications");
        if (notifications == null) {
            call.resolve();
            return;
        }
        try {
            HabitReminderScheduler.ensureChannel(getContext());
            for (int i = 0; i < notifications.length(); i++) {
                JSONObject n = notifications.getJSONObject(i);
                int id = n.getInt("id");
                long atMillis = n.getLong("atMillis");
                String title = n.optString("title", "");
                String body = n.optString("body", "");
                String imageUrl = n.optString("imageUrl", "");
                int hour = n.optInt("hour", 8);
                int minute = n.optInt("minute", 0);
                HabitReminderScheduler.scheduleExact(
                    getContext(), id, atMillis, title, body, imageUrl, hour, minute);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("schedule failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids == null) {
            call.resolve();
            return;
        }
        try {
            for (int i = 0; i < ids.length(); i++) {
                HabitReminderScheduler.cancel(getContext(), ids.getInt(i));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("cancel failed: " + e.getMessage());
        }
    }
}
