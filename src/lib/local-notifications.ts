import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Habit } from "@shared/schema";

// S20: native reminders for the Android app. Web push (src/lib/push.ts) does
// not work inside the Capacitor WebView — there is no push service, so
// pushManager.subscribe() throws. Instead the native app schedules an on-device
// daily local notification at the habit's notify_time. This works offline and
// needs no Firebase; the browser keeps using web push.
//
// The notification id is the habit id (a serial int, safe for Android's 32-bit
// notification ids), so scheduling again replaces the previous one and
// cancelling by id is exact.

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Ask for the OS notification permission (Android 13+). Returns true if granted. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === "prompt" || perm.display === "prompt-with-rationale") {
      perm = await LocalNotifications.requestPermissions();
    }
    return perm.display === "granted";
  } catch (err) {
    console.error("Notification permission check failed:", err);
    return false;
  }
}

function parseTime(time: string | null): { hour: number; minute: number } {
  const [h, m] = (time || "08:00").split(":");
  return { hour: Number(h) || 8, minute: Number(m) || 0 };
}

function notificationBody(habit: Pick<Habit, "positive_motivation" | "negative_motivation">): string {
  const lines = [
    habit.positive_motivation ? `✨ ${habit.positive_motivation}` : null,
    habit.negative_motivation ? `⚠️ ${habit.negative_motivation}` : null,
  ].filter(Boolean) as string[];
  return lines.join("\n") || "Time to work on your habit.";
}

/**
 * Schedule (or reschedule) the daily reminder for one habit on the device.
 * No-op in the browser. Safe to call on every save — it cancels any existing
 * notification with the same id first.
 */
export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  if (!isNativeApp()) return;
  await cancelHabitReminder(habit.id);

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const { hour, minute } = parseTime(habit.notify_time);
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: habit.id,
          title: `⏰ ${habit.name}`,
          body: notificationBody(habit),
          schedule: {
            on: { hour, minute },
            allowWhileIdle: true,
          },
        },
      ],
    });
  } catch (err) {
    console.error("Scheduling local notification failed:", err);
  }
}

/** Cancel the device reminder for one habit. No-op in the browser. */
export async function cancelHabitReminder(habitId: number): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: habitId }] });
  } catch (err) {
    console.error("Cancelling local notification failed:", err);
  }
}

/**
 * Sync device reminders to the current set of habits. Called on native app
 * start so reminders survive reinstall/reboot and reflect edits made on other
 * devices. Cancels reminders for habits that no longer want one.
 */
export async function syncHabitReminders(habits: Habit[]): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const wanted = new Set(habits.filter((h) => h.notify && h.notify_time).map((h) => h.id));

    // Drop reminders whose habit no longer wants one.
    const stale = pending.notifications
      .map((n) => n.id)
      .filter((id) => !wanted.has(id));
    if (stale.length > 0) {
      await LocalNotifications.cancel({ notifications: stale.map((id) => ({ id })) });
    }

    // (Re)schedule the wanted ones.
    if (await ensureNotificationPermission()) {
      for (const habit of habits) {
        if (habit.notify && habit.notify_time) {
          await scheduleHabitReminder(habit);
        }
      }
    }
  } catch (err) {
    console.error("Syncing local notifications failed:", err);
  }
}
