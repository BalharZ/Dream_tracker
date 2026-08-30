import { supabase } from "@/lib/supabase";

// S33: web push is retired. Reminders now come only from the native Android app
// (on-device local notifications, src/lib/local-notifications.ts). Web push
// caused duplicate/late notifications in the browser (Chrome delivered queued
// pushes in batches, e.g. only when the phone reconnected) on top of the app's
// own notification.
//
// This module used to register a service worker and subscribe the browser to
// web push. It now does the opposite: it tears the subscription down so no
// browser keeps receiving pushes from the (now unscheduled) Edge Function.

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Disable web push on this browser: unsubscribe any active PushSubscription,
 * delete its row from Supabase so the Edge Function stops targeting it, and
 * unregister the service worker. Called on app start; safe to run every time
 * (a no-op once there's nothing left to clean up). No-op outside the browser.
 */
export async function disableWebPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      try {
        const subscription = await registration.pushManager?.getSubscription();
        if (subscription) {
          // Remove the server-side target first so no more pushes are sent here.
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);
          await subscription.unsubscribe();
        }
      } catch (err) {
        console.error("Unsubscribing web push failed:", err);
      }
      // Drop the service worker itself so the old push handler can't fire again.
      await registration.unregister().catch(() => {});
    }
  } catch (err) {
    console.error("Disabling web push failed:", err);
  }
}
