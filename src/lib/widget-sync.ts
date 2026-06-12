import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "./supabase";
import { recomputeProgress } from "./progress";

// S17: Android home-screen widget support. The native widget runs outside the
// WebView (no Supabase session), so it authenticates with a long-lived random
// token stored in `widget_tokens` and calls SECURITY DEFINER RPCs
// (widget_get_today / widget_complete_habit) with the anon key.
//
// After login the app ensures the token exists and hands the widget its
// config via Capacitor Preferences — the native side reads the same
// SharedPreferences file ("CapacitorStorage", key "widget_cfg").

const WIDGET_CFG_KEY = "widget_cfg";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Called after login / session restore. No-op in the browser. */
export async function syncWidgetConfig(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // Ensure a widget token exists for this user (RLS: own row only).
    const { data: existing } = await supabase
      .from("widget_tokens")
      .select("token")
      .eq("user_id", userId)
      .maybeSingle();
    let token = existing?.token as string | undefined;
    if (!token) {
      token = generateToken();
      const { error } = await supabase
        .from("widget_tokens")
        .insert({ user_id: userId, token });
      if (error) {
        // Row may already exist (race / retry) — re-read it.
        const { data: again } = await supabase
          .from("widget_tokens")
          .select("token")
          .eq("user_id", userId)
          .maybeSingle();
        token = again?.token;
      }
    }
    if (!token) return;

    await Preferences.set({
      key: WIDGET_CFG_KEY,
      value: JSON.stringify({
        url: import.meta.env.VITE_SUPABASE_URL,
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        token,
      }),
    });

    // The widget writes habit_progress/current_value directly; the cascading
    // goal/dream progress is recomputed here on every native app start.
    await recomputeProgress(userId);
  } catch {
    // Widget sync must never break the app (e.g. widget_tokens table missing).
  }
}

/** Called on logout — the widget loses access until the next login. */
export async function clearWidgetConfig(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.remove({ key: WIDGET_CFG_KEY });
  } catch {
    // ignore
  }
}
