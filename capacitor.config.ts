import type { CapacitorConfig } from "@capacitor/cli";

// Android wrapper around the web app. Instead of shipping the bundled `dist`,
// the native shell loads the LIVE web app from Vercel (server.url). This means
// every Vercel deploy updates the app automatically on next open — no APK
// rebuild needed for web/feature changes (only native/widget changes require a
// new APK). `dist` stays as the offline fallback bundle copied by `cap sync`.
//
// The home-screen widget (S17) lives in
// android/app/src/main/java/.../widget and reads its config from Capacitor
// Preferences (SharedPreferences "CapacitorStorage"), written by
// src/lib/widget-sync.ts after login. The native bridge is still injected into
// the remote page, so Preferences (and the widget handoff) keep working.
const config: CapacitorConfig = {
  appId: "com.dreamtracker.app",
  appName: "Dream Tracker",
  webDir: "dist",
  server: {
    url: "https://dream-tracker-ochre.vercel.app",
    cleartext: false,
  },
};

export default config;
