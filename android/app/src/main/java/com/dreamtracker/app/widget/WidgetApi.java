package com.dreamtracker.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Reads the widget config written by the web app (src/lib/widget-sync.ts via
 * Capacitor Preferences → SharedPreferences "CapacitorStorage", key
 * "widget_cfg") and calls the Supabase RPC endpoints created in
 * supabase/sql/S17_widget.sql. Auth = long-lived widget token (validated
 * inside the SECURITY DEFINER functions), not a Supabase session.
 */
final class WidgetApi {

  static final class Config {
    final String url;
    final String anonKey;
    final String token;

    Config(String url, String anonKey, String token) {
      this.url = url;
      this.anonKey = anonKey;
      this.token = token;
    }
  }

  private WidgetApi() {}

  static Config readConfig(Context ctx) {
    SharedPreferences prefs =
        ctx.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
    String raw = prefs.getString("widget_cfg", null);
    if (raw == null) return null;
    try {
      JSONObject o = new JSONObject(raw);
      return new Config(o.getString("url"), o.getString("anonKey"), o.getString("token"));
    } catch (Exception e) {
      return null;
    }
  }

  /** Synchronous PostgREST RPC call — only call off the main thread. */
  static String rpc(Config cfg, String fn, JSONObject body) throws Exception {
    URL url = new URL(cfg.url + "/rest/v1/rpc/" + fn);
    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
    try {
      conn.setConnectTimeout(8000);
      conn.setReadTimeout(8000);
      conn.setRequestMethod("POST");
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setRequestProperty("apikey", cfg.anonKey);
      conn.setRequestProperty("Authorization", "Bearer " + cfg.anonKey);
      conn.setDoOutput(true);

      byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
      OutputStream os = conn.getOutputStream();
      os.write(payload);
      os.close();

      int code = conn.getResponseCode();
      InputStream is = (code >= 200 && code < 300) ? conn.getInputStream() : conn.getErrorStream();
      StringBuilder sb = new StringBuilder();
      if (is != null) {
        BufferedReader reader =
            new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        reader.close();
      }
      if (code < 200 || code >= 300) {
        throw new Exception("HTTP " + code + ": " + sb);
      }
      return sb.toString();
    } finally {
      conn.disconnect();
    }
  }
}
