package com.dreamtracker.app.reminders;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Image caching for habit reminders. The dream image is downloaded to the app
 * cache when the reminder is scheduled (well before it fires), so at fire time
 * the receiver just decodes a local file — no network wait, works offline.
 * Bitmaps are down-sampled so a large upload can't OOM the notification.
 */
public class ReminderImages {

    // Cap the long edge; BigPictureStyle is shown small, and big bitmaps can be
    // rejected / OOM. ~1024px looks sharp and is safe.
    private static final int MAX_DIM = 1024;

    public static boolean isHttp(String url) {
        return url != null && (url.startsWith("http://") || url.startsWith("https://"));
    }

    public static File cacheFile(Context ctx, int id) {
        File dir = new File(ctx.getCacheDir(), "reminders");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return new File(dir, "reminder_" + id + ".img");
    }

    /** Download url into dest (via a temp file). Blocking — call off the main thread. */
    public static boolean download(String url, File dest) {
        HttpURLConnection conn = null;
        InputStream in = null;
        OutputStream out = null;
        File tmp = new File(dest.getAbsolutePath() + ".tmp");
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setInstanceFollowRedirects(true);
            conn.connect();
            if (conn.getResponseCode() / 100 != 2) {
                return false;
            }
            in = conn.getInputStream();
            out = new FileOutputStream(tmp);
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
            }
            out.flush();
            out.close();
            out = null;
            in.close();
            in = null;
            if (dest.exists()) {
                dest.delete();
            }
            return tmp.renameTo(dest);
        } catch (Exception e) {
            return false;
        } finally {
            try { if (out != null) out.close(); } catch (Exception ignored) {}
            try { if (in != null) in.close(); } catch (Exception ignored) {}
            if (conn != null) conn.disconnect();
            if (tmp.exists()) tmp.delete();
        }
    }

    /** Decode a cached file into a bitmap capped at MAX_DIM on the long edge. */
    public static Bitmap decode(File file) {
        if (file == null || !file.exists() || file.length() == 0) {
            return null;
        }
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
            int longEdge = Math.max(bounds.outWidth, bounds.outHeight);
            if (longEdge <= 0) {
                return null;
            }
            int sample = 1;
            while (longEdge / sample > MAX_DIM) {
                sample *= 2;
            }
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = sample;
            return BitmapFactory.decodeFile(file.getAbsolutePath(), opts);
        } catch (Throwable t) {
            return null;
        }
    }
}
