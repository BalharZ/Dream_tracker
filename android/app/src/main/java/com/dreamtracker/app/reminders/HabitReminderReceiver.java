package com.dreamtracker.app.reminders;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.io.File;
import java.util.Calendar;

/**
 * Fires at a habit's reminder time. Re-arms tomorrow's alarm (self-repeating),
 * then downloads the dream image off the main thread and posts a
 * BigPictureStyle notification (falling back to BigText when there's no image).
 */
public class HabitReminderReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(final Context context, Intent intent) {
        final int id = intent.getIntExtra(HabitReminderScheduler.EXTRA_ID, 0);
        final String title = intent.getStringExtra(HabitReminderScheduler.EXTRA_TITLE);
        final String body = intent.getStringExtra(HabitReminderScheduler.EXTRA_BODY);
        final String imageUrl = intent.getStringExtra(HabitReminderScheduler.EXTRA_IMAGE);
        final String imagePath = intent.getStringExtra(HabitReminderScheduler.EXTRA_IMAGE_PATH);
        final int hour = intent.getIntExtra(HabitReminderScheduler.EXTRA_HOUR, 8);
        final int minute = intent.getIntExtra(HabitReminderScheduler.EXTRA_MINUTE, 0);

        // Re-arm the next day's reminder so it repeats daily without the app.
        Calendar next = Calendar.getInstance();
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) {
            next.add(Calendar.DAY_OF_YEAR, 1);
        }
        HabitReminderScheduler.scheduleExact(
            context, id, next.getTimeInMillis(), title, body, imageUrl, imagePath, hour, minute);

        // Decoding (and the rare fallback download) may block; do it off the main thread.
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    postNotification(context, id, title, body, imageUrl, imagePath);
                } catch (Throwable t) {
                    // Never let a reminder crash the receiver.
                } finally {
                    pending.finish();
                }
            }
        }).start();
    }

    private void postNotification(Context ctx, int id, String title, String body,
            String imageUrl, String imagePath) {
        HabitReminderScheduler.ensureChannel(ctx);

        // Prefer the pre-downloaded local file; only hit the network if it's
        // missing (e.g. the pre-download hadn't finished / failed).
        File file = imagePath != null ? new File(imagePath) : null;
        Bitmap image = ReminderImages.decode(file);
        if (image == null && file != null && ReminderImages.isHttp(imageUrl)) {
            if (ReminderImages.download(imageUrl, file)) {
                image = ReminderImages.decode(file);
            }
        }

        PendingIntent contentPi = null;
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            contentPi = PendingIntent.getActivity(ctx, id, launch, flags);
        }

        NotificationCompat.Builder b =
            new NotificationCompat.Builder(ctx, HabitReminderScheduler.CHANNEL_ID)
                .setSmallIcon(ctx.getApplicationInfo().icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH);
        if (contentPi != null) {
            b.setContentIntent(contentPi);
        }

        if (image != null) {
            b.setLargeIcon(image);
            b.setStyle(
                new NotificationCompat.BigPictureStyle()
                    .bigPicture(image)
                    .bigLargeIcon((Bitmap) null) // hide the thumbnail when expanded
                    .setBigContentTitle(title)
                    .setSummaryText(body));
        } else {
            b.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
        }

        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
        } catch (SecurityException e) {
            // POST_NOTIFICATIONS not granted — nothing we can do here.
        }
    }
}
