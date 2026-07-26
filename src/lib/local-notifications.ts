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

/**
 * Make sure the app is allowed to schedule EXACT alarms so timed reminders fire
 * on the minute (not batched to the morning). On Android 12+ this is a special
 * permission; if it isn't granted we send the user straight to the system
 * screen that toggles it — so nobody has to hunt through settings.
 *
 * Returns true if exact alarms are allowed (or the OS/plugin doesn't gate them,
 * in which case they're allowed by default).
 */
export async function ensureExactAlarmPermission(): Promise<boolean> {
  if (!isNativeApp()) return true;
  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    if (status.exact_alarm === "granted") return true;
    // Not granted yet → open the OS screen for it and read the result back.
    const changed = await LocalNotifications.changeExactNotificationSetting();
    return changed.exact_alarm === "granted";
  } catch (err) {
    // Older Android or a plugin without the API: exact alarms aren't gated.
    console.error("Exact alarm setting check failed:", err);
    return true;
  }
}

function parseTime(time: string | null): { hour: number; minute: number } {
  const [h, m] = (time || "08:00").split(":");
  return { hour: Number(h) || 8, minute: Number(m) || 0 };
}

// How many days of reminders to pre-schedule per habit.
//
// Why not a single repeating notification: @capacitor/local-notifications only
// schedules *repeating* alarms (`every` / `on`) as INEXACT on Android, so a
// daily reminder slips by hours and gets delivered whenever the device next
// wakes (the "set 1:00, arrived 8:30" bug). One-shot notifications with an
// explicit `at` date + `allowWhileIdle` use setExactAndAllowWhileIdle, which is
// exact. So we pre-schedule a rolling buffer of one-shot exact notifications
// (one per day) and top it up every time the app opens (syncHabitReminders).
const REMINDER_DAYS = 14;

// Notification ids for a habit's rolling buffer: habitId*100 + dayOffset. Serial
// habit ids keep these well inside Android's 32-bit id range.
function reminderIds(habitId: number): number[] {
  const base = habitId * 100;
  return Array.from({ length: REMINDER_DAYS }, (_, i) => base + i);
}

function notificationBody(habit: Pick<Habit, "positive_motivation" | "negative_motivation">): string {
  const lines = [
    habit.positive_motivation ? `✨ ${habit.positive_motivation}` : null,
    habit.negative_motivation ? `⚠️ ${habit.negative_motivation}` : null,
  ].filter(Boolean) as string[];
  return lines.join("\n") || "Time to work on your habit.";
}

// Build the next REMINDER_DAYS one-shot exact notifications for a habit, skipping
// any slot whose time has already passed today.
function buildHabitNotifications(habit: Habit) {
  const { hour, minute } = parseTime(habit.notify_time);
  const base = habit.id * 100;
  const now = Date.now();
  const title = `⏰ ${habit.name}`;
  const body = notificationBody(habit);
  const notifications = [];
  for (let i = 0; i < REMINDER_DAYS; i++) {
    const at = new Date();
    at.setHours(hour, minute, 0, 0);
    at.setDate(at.getDate() + i);
    if (at.getTime() <= now) continue; // today's slot already passed
    notifications.push({
      id: base + i,
      title,
      body,
      schedule: { at, allowWhileIdle: true },
    });
  }
  return notifications;
}

/**
 * Schedule (or reschedule) the daily reminders for one habit on the device.
 * No-op in the browser. Safe to call on every save — it cancels this habit's
 * existing reminders first, then lays down a fresh rolling buffer of exact
 * one-shot notifications.
 */
export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  if (!isNativeApp()) return;
  await cancelHabitReminder(habit.id);

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const notifications = buildHabitNotifications(habit);
  if (notifications.length === 0) return;
  try {
    await LocalNotifications.schedule({ notifications });
  } catch (err) {
    console.error("Scheduling local notification failed:", err);
  }
}

/** Cancel all device reminders for one habit. No-op in the browser. */
export async function cancelHabitReminder(habitId: number): Promise<void> {
  if (!isNativeApp()) return;
  try {
    // Include the legacy single id (habitId) used before the rolling buffer.
    const ids = [habitId, ...reminderIds(habitId)];
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch (err) {
    console.error("Cancelling local notification failed:", err);
  }
}

/**
 * Sync device reminders to the current set of habits. Called on native app
 * start so reminders survive reinstall/reboot, reflect edits made on other
 * devices, and — importantly — so the rolling buffer of exact one-shot
 * notifications is topped up before it runs out.
 */
export async function syncHabitReminders(habits: Habit[]): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const pending = await LocalNotifications.getPending();
    // All notification ids that the current habits legitimately own.
    const wanted = new Set<number>();
    for (const h of habits) {
      if (h.notify && h.notify_time) {
        for (const id of reminderIds(h.id)) wanted.add(id);
      }
    }

    // Drop any pending reminder that isn't wanted anymore (habit deleted, its
    // reminder turned off, or a legacy single-id notification from an older
    // build).
    const stale = pending.notifications
      .map((n) => n.id)
      .filter((id) => !wanted.has(id));
    if (stale.length > 0) {
      await LocalNotifications.cancel({ notifications: stale.map((id) => ({ id })) });
    }

    // Re-lay the rolling buffer for every habit that wants reminders.
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
