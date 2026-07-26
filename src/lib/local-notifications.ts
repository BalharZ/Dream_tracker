import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/lib/supabase";
import type { Habit } from "@shared/schema";

// Custom native plugin (android/app/.../reminders/HabitReminderPlugin.java).
// It schedules exact self-repeating alarms and, at fire time, posts a
// notification with a BigPictureStyle image downloaded from the dream's URL —
// something @capacitor/local-notifications can't do (it only supports text /
// BigText). Only present in APKs built with the native code; older APKs fall
// back to the text-only LocalNotifications path below.
type NativeReminder = {
  id: number;
  atMillis: number;
  title: string;
  body: string;
  imageUrl: string;
  hour: number;
  minute: number;
};
interface HabitReminderPlugin {
  schedule(options: { notifications: NativeReminder[] }): Promise<void>;
  cancel(options: { ids: number[] }): Promise<void>;
}
const HabitReminder = registerPlugin<HabitReminderPlugin>("HabitReminder");

// True when running in an APK that bundles the custom picture-capable plugin.
function useNativeReminder(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("HabitReminder");
}

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

// The motivation shown in the reminder. Mirrors the web-push Edge Function:
// prefer the linked dream's motivation, fall back to the habit's, then to the
// dream name, then a generic line.
type HabitContent = {
  positive: string | null;
  negative: string | null;
  dreamName: string | null;
  image: string | null;
};

function notificationBody(content: HabitContent | undefined): string {
  const lines = [
    content?.positive ? `✨ ${content.positive}` : null,
    content?.negative ? `⚠️ ${content.negative}` : null,
  ].filter(Boolean) as string[];
  if (lines.length === 0 && content?.dreamName) {
    lines.push(`Keep working towards: ${content.dreamName}`);
  }
  return lines.join("\n") || "Time to work on your habit.";
}

/**
 * Resolve the reminder content (motivation + dream name) for a set of habits by
 * following habit → goal → dream, in as few queries as possible. The dream's
 * motivation wins over the habit's, matching the browser push.
 */
async function resolveContent(habits: Habit[]): Promise<Map<number, HabitContent>> {
  const map = new Map<number, HabitContent>();

  const goalIds = Array.from(
    new Set(habits.map((h) => h.goal_id).filter((id): id is number => id != null)),
  );
  const goalById = new Map<number, { id: number; dream_id: number }>();
  if (goalIds.length) {
    const { data } = await supabase.from("goals").select("id, dream_id").in("id", goalIds);
    for (const g of data || []) goalById.set(g.id, g);
  }

  const dreamIds = Array.from(
    new Set(Array.from(goalById.values()).map((g) => g.dream_id)),
  );
  const dreamById = new Map<
    number,
    {
      name: string;
      image: string | null;
      positive_motivation: string | null;
      negative_motivation: string | null;
    }
  >();
  if (dreamIds.length) {
    const { data } = await supabase
      .from("dreams")
      .select("id, name, image, positive_motivation, negative_motivation")
      .in("id", dreamIds);
    for (const d of data || []) dreamById.set(d.id, d);
  }

  for (const h of habits) {
    const goal = h.goal_id != null ? goalById.get(h.goal_id) : undefined;
    const dream = goal ? dreamById.get(goal.dream_id) : undefined;
    map.set(h.id, {
      positive: dream?.positive_motivation || h.positive_motivation,
      negative: dream?.negative_motivation || h.negative_motivation,
      dreamName: dream?.name ?? null,
      image: dream?.image || h.image || null,
    });
  }
  return map;
}

// Build the next REMINDER_DAYS one-shot exact notifications for a habit, skipping
// any slot whose time has already passed today.
function buildHabitNotifications(habit: Habit, content: HabitContent | undefined) {
  const { hour, minute } = parseTime(habit.notify_time);
  const base = habit.id * 100;
  const now = Date.now();
  const title = `⏰ ${habit.name}`;
  const body = notificationBody(content);
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
      // BigText style: the notification expands to show the full motivation.
      largeBody: body,
      summaryText: content?.dreamName ?? undefined,
      iconColor: habit.color,
      schedule: { at, allowWhileIdle: true },
    });
  }
  return notifications;
}

// Cancel + reschedule one habit's reminder. Assumes permission is granted.
// Uses the picture-capable native plugin when the APK bundles it; otherwise
// falls back to the text-only LocalNotifications rolling buffer.
async function scheduleOne(habit: Habit, content: HabitContent | undefined): Promise<void> {
  await cancelHabitReminder(habit.id);

  if (useNativeReminder()) {
    const { hour, minute } = parseTime(habit.notify_time);
    const at = new Date();
    at.setHours(hour, minute, 0, 0);
    if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
    try {
      await HabitReminder.schedule({
        notifications: [
          {
            id: habit.id,
            atMillis: at.getTime(),
            title: `⏰ ${habit.name}`,
            body: notificationBody(content),
            imageUrl: content?.image || "",
            hour,
            minute,
          },
        ],
      });
    } catch (err) {
      console.error("Scheduling native reminder failed:", err);
    }
    return;
  }

  const notifications = buildHabitNotifications(habit, content);
  if (notifications.length === 0) return;
  try {
    await LocalNotifications.schedule({ notifications });
  } catch (err) {
    console.error("Scheduling local notification failed:", err);
  }
}

/**
 * Schedule (or reschedule) the daily reminders for one habit on the device.
 * No-op in the browser. Safe to call on every save — it cancels this habit's
 * existing reminders first, then lays down a fresh rolling buffer of exact
 * one-shot notifications carrying the dream's motivation.
 */
export async function scheduleHabitReminder(habit: Habit): Promise<void> {
  if (!isNativeApp()) return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const content = await resolveContent([habit]);
  await scheduleOne(habit, content.get(habit.id));
}

/** Cancel all device reminders for one habit. No-op in the browser. */
export async function cancelHabitReminder(habitId: number): Promise<void> {
  if (!isNativeApp()) return;
  // Always clear the LocalNotifications rolling buffer + legacy single id — this
  // also cleans up reminders left by an older build after upgrading to the
  // native-plugin path.
  try {
    const ids = [habitId, ...reminderIds(habitId)];
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch (err) {
    console.error("Cancelling local notification failed:", err);
  }
  if (useNativeReminder()) {
    try {
      await HabitReminder.cancel({ ids: [habitId] });
    } catch (err) {
      console.error("Cancelling native reminder failed:", err);
    }
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

    // Re-lay the rolling buffer for every habit that wants reminders. Resolve
    // the dream motivation for all of them in one batch first.
    if (await ensureNotificationPermission()) {
      const wantedHabits = habits.filter((h) => h.notify && h.notify_time);
      const contentMap = await resolveContent(wantedHabits);
      for (const habit of wantedHabits) {
        await scheduleOne(habit, contentMap.get(habit.id));
      }
    }
  } catch (err) {
    console.error("Syncing local notifications failed:", err);
  }
}
