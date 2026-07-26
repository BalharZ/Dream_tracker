package com.dreamtracker.app.reminders;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;

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
                final String imageUrl = n.optString("imageUrl", "");
                int hour = n.optInt("hour", 8);
                int minute = n.optInt("minute", 0);

                // Pre-cache the image to a stable local file now, so the receiver
                // just reads it from disk at fire time (no network wait).
                final File imageFile = ReminderImages.cacheFile(getContext(), id);
                HabitReminderScheduler.scheduleExact(
                    getContext(), id, atMillis, title, body, imageUrl,
                    imageFile.getAbsolutePath(), hour, minute);

                if (ReminderImages.isHttp(imageUrl)) {
                    new Thread(new Runnable() {
                        @Override
                        public void run() {
                            ReminderImages.download(imageUrl, imageFile);
                        }
                    }).start();
                } else if (imageFile.exists()) {
                    // Image was removed → drop the stale cache.
                    imageFile.delete();
                }
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("schedule failed: " + e.getMessage());
        }
    }

    /**
     * Open a URL in the system browser (ACTION_VIEW). Used to download the
     * latest APK — the WebView can't trigger the download itself, but the
     * external browser can (and then Android offers to install it).
     */
    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url required");
            return;
        }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("openExternal failed: " + e.getMessage());
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
