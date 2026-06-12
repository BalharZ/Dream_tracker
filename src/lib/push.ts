import { supabase } from "@/lib/supabase";

// Web push (S16): registers the service worker, asks for notification
// permission and stores the browser's PushSubscription in Supabase so the
// `send-habit-notifications` Edge Function can reach this device.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// PushManager.subscribe wants the raw key bytes, not the base64url string.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// Register the SW early (app start) so the device can receive pushes even
// before the user touches a habit form in this session. Safe to call always.
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch((err) => {
    console.error("Service worker registration failed:", err);
  });
}

export type PushSubscribeResult =
  | "subscribed"
  | "denied"
  | "unsupported"
  | "error";

// Ensure this browser has an active push subscription stored in Supabase.
// Must be called from a user gesture (click) so the permission prompt shows.
export async function ensurePushSubscription(
  userId: string
): Promise<PushSubscribeResult> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return "unsupported";

  try {
    await navigator.serviceWorker.register("/sw.js");
    const registration = await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;

    return "subscribed";
  } catch (err) {
    console.error("Push subscription failed:", err);
    return "error";
  }
}
