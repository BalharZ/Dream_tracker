import type { CapacitorConfig } from "@capacitor/cli";

// Android wrapper around the built web app (dist). The home-screen widget
// (S17) lives in android/app/src/main/java/.../widget and reads its config
// from Capacitor Preferences (SharedPreferences "CapacitorStorage"), written
// by src/lib/widget-sync.ts after login.
const config: CapacitorConfig = {
  appId: "com.dreamtracker.app",
  appName: "Dream Tracker",
  webDir: "dist",
};

export default config;
