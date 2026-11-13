package com.dreamtracker.app.reminders;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Shared scheduling helpers for the custom, picture-capable habit reminders.
 *
 * Why a custom scheduler at all: @capacitor/local-notifications can only render
 * text (BigText) notifications and schedules repeating alarms inexactly on
 * Android. Here we schedule ONE exact self-repeating alarm per habit: when it
 * fires, {@link HabitReminderReceiver} downloads the dream image, posts a
 * BigPictureStyle notification and re-arms tomorrow's alarm.
 */
public class HabitReminderScheduler {
    public static final String CHANNEL_ID = "habit_reminders";
    public static final String EXTRA_ID = "id";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_IMAGE = "imageUrl";
    public static final String EXTRA_IMAGE_PATH = "imagePath";
    public static final String EXTRA_HOUR = "hour";
    public static final String EXTRA_MINUTE = "minute";
    // S72: alternate (positive/negative) content the receiver switches to per
    // day once the habit counts as neglected (negFrom, local midnight millis).
    public static final String EXTRA_ALT_BODY = "altBody";
    public static final String EXTRA_ALT_IMAGE = "altImageUrl";
    public static final String EXTRA_ALT_IMAGE_PATH = "altImagePath";
    public static final String EXTRA_NEG_FROM = "negFromMillis";
    public static final String EXTRA_BASE_NEG = "baseIsNegative";

    /** S72 alternate content for one reminder. */
    public static class Alt {
        public final String body;
        public final String imageUrl;
        public final String imagePath;
        public final long negFromMillis;
        public final boolean baseIsNegative;

        public Alt(String body, String imageUrl, String imagePath, long negFromMillis, boolean baseIsNegative) {
            this.body = body;
            this.imageUrl = imageUrl;
            this.imagePath = imagePath;
            this.negFromMillis = negFromMillis;
            this.baseIsNegative = baseIsNegative;
        }
    }

    private static int piFlags(int base) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return base | PendingIntent.FLAG_IMMUTABLE;
        }
        return base;
    }

    /** Create the notification channel once (Android 8+). */
    public static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm =
                (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Habit reminders", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Daily habit reminders");
                nm.createNotificationChannel(ch);
            }
        }
    }

    private static PendingIntent buildPendingIntent(Context ctx, int id, int flags,
            String title, String body, String imageUrl, String imagePath, int hour, int minute, Alt alt) {
        Intent i = new Intent(ctx, HabitReminderReceiver.class);
        i.putExtra(EXTRA_ID, id);
        i.putExtra(EXTRA_TITLE, title);
        i.putExtra(EXTRA_BODY, body);
        i.putExtra(EXTRA_IMAGE, imageUrl);
        i.putExtra(EXTRA_IMAGE_PATH, imagePath);
        i.putExtra(EXTRA_HOUR, hour);
        i.putExtra(EXTRA_MINUTE, minute);
        if (alt != null) {
            i.putExtra(EXTRA_ALT_BODY, alt.body);
            i.putExtra(EXTRA_ALT_IMAGE, alt.imageUrl);
            i.putExtra(EXTRA_ALT_IMAGE_PATH, alt.imagePath);
            i.putExtra(EXTRA_NEG_FROM, alt.negFromMillis);
            i.putExtra(EXTRA_BASE_NEG, alt.baseIsNegative);
        }
        return PendingIntent.getBroadcast(ctx, id, i, piFlags(flags));
    }

    /** Schedule an exact wake-up alarm for one habit. */
    public static void scheduleExact(Context ctx, int id, long atMillis,
            String title, String body, String imageUrl, String imagePath, int hour, int minute) {
        scheduleExact(ctx, id, atMillis, title, body, imageUrl, imagePath, hour, minute, null);
    }

    /** Same, with S72 alternate content (alt may be null). */
    public static void scheduleExact(Context ctx, int id, long atMillis,
            String title, String body, String imageUrl, String imagePath, int hour, int minute, Alt alt) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = buildPendingIntent(
            ctx, id, PendingIntent.FLAG_UPDATE_CURRENT, title, body, imageUrl, imagePath, hour, minute, alt);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi);
            } catch (SecurityException e) {
                // Exact-alarm permission revoked → best-effort inexact.
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pi);
            }
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, atMillis, pi);
        }
    }

    /**
     * S72: negative content on the first neglected day, then every other day
     * (mirrors negativeOn() in src/lib/local-notifications.ts).
     */
    public static boolean negativeOn(long nowMillis, long negFromMillis) {
        if (negFromMillis <= 0 || nowMillis < negFromMillis) return false;
        java.util.Calendar day = java.util.Calendar.getInstance();
        day.setTimeInMillis(nowMillis);
        day.set(java.util.Calendar.HOUR_OF_DAY, 0);
        day.set(java.util.Calendar.MINUTE, 0);
        day.set(java.util.Calendar.SECOND, 0);
        day.set(java.util.Calendar.MILLISECOND, 0);
        // Round: a DST change makes one day 23 or 25 hours long.
        long days = Math.round((day.getTimeInMillis() - negFromMillis) / 86400000.0);
        return days % 2 == 0;
    }

    /** Cancel a habit's pending alarm (does not clear an already-shown notification). */
    public static void cancel(Context ctx, int id) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(
            ctx, id, new Intent(ctx, HabitReminderReceiver.class),
            piFlags(PendingIntent.FLAG_NO_CREATE));
        if (pi != null && am != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }
}
