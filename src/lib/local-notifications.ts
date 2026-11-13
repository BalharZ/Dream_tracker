import { Capacitor, registerPlugin } from "@capacitor/core";
import { addDays, addMonths, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/lib/supabase";
import type { Habit } from "@shared/schema";
import { frequencyLabel, habitFrequency } from "@/lib/frequency";
import { computeStreak } from "@/lib/streaks";

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
  // S72 (APK with the alternating receiver; older APKs ignore these and keep
  // showing title/body/imageUrl): from negFromMillis on, the receiver picks per
  // day between the base content and the alt one, see negativeOn().
  altBody?: string;
  altImageUrl?: string;
  negFromMillis?: number;
  baseIsNegative?: boolean;
};
interface HabitReminderPlugin {
  schedule(options: { notifications: NativeReminder[] }): Promise<void>;
  cancel(options: { ids: number[] }): Promise<void>;
  openExternal(options: { url: string }): Promise<void>;
}
const HabitReminder = registerPlugin<HabitReminderPlugin>("HabitReminder");

// True when running in an APK that bundles the custom picture-capable plugin.
function useNativeReminder(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("HabitReminder");
}

/**
 * Open a URL in the system browser. In the native app the WebView can't trigger
 * a file download itself, so we hand APK downloads to the OS browser via the
 * plugin; everywhere else a normal new tab does the job.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (useNativeReminder()) {
    try {
      await HabitReminder.openExternal({ url });
      return;
    } catch (err) {
      console.error("openExternal failed:", err);
    }
  }
  window.open(url, "_blank");
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
  // S72: the dream's "opposite" picture and the moment the habit counts as
  // neglected (null = never, e.g. nothing negative to show).
  negativeImage: string | null;
  negativeFrom: Date | null;
};

/* ------------------------------------------- S72: negative motivation */

// A habit with no progress at all for a whole week (a month for monthly
// habits) gets the negative motivation — taking turns day by day with the
// positive one, so a long break doesn't mean the same grim picture every day.
const NEGLECT_LOOKBACK_DAYS = 62;

/** First moment the habit counts as neglected if nothing is logged after `lastActive`. */
export function neglectStart(habit: Pick<Habit, "frequency">, lastActive: Date): Date {
  const day = startOfDay(lastActive);
  const grace = habitFrequency(habit).kind === "monthly" ? addMonths(day, 1) : addDays(day, 7);
  return addDays(grace, 1);
}

/** Negative on the first neglected day, then every other day. */
export function negativeOn(day: Date, negativeFrom: Date | null): boolean {
  if (!negativeFrom || day < negativeFrom) return false;
  return differenceInCalendarDays(day, negativeFrom) % 2 === 0;
}

function negativeBody(content: HabitContent, habit: Habit): string {
  const period = habitFrequency(habit).kind === "monthly" ? "a month" : "a week";
  return [
    `⚠️ ${content.negative || "Your dream is slipping away."}`,
    `Nothing done for ${period}. One small step today turns it around.`,
  ].join("\n");
}

/** Day of the last logged progress per habit (value > 0), from the last ~2 months. */
async function lastActiveDays(habits: Habit[]): Promise<Map<number, Date>> {
  const map = new Map<number, Date>();
  if (habits.length === 0) return map;
  const since = format(addDays(new Date(), -NEGLECT_LOOKBACK_DAYS), "yyyy-MM-dd");
  const { data } = await supabase
    .from("habit_progress")
    .select("habit_id, date, value")
    .in("habit_id", habits.map((h) => h.id))
    .gt("value", 0)
    .gte("date", since);
  for (const p of data || []) {
    const d = new Date(`${p.date}T00:00:00`);
    const prev = map.get(p.habit_id);
    if (!prev || d > prev) map.set(p.habit_id, d);
  }
  return map;
}

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
      negative_image?: string | null;
    }
  >();
  if (dreamIds.length) {
    // "*" rather than a column list: negative_image only exists after the S72
    // SQL, and naming a missing column would break every reminder.
    const { data } = await supabase.from("dreams").select("*").in("id", dreamIds);
    for (const d of data || []) dreamById.set(d.id, d);
  }

  const lastActive = await lastActiveDays(habits);
  for (const h of habits) {
    const goal = h.goal_id != null ? goalById.get(h.goal_id) : undefined;
    const dream = goal ? dreamById.get(goal.dream_id) : undefined;
    const negative = dream?.negative_motivation || h.negative_motivation;
    const negativeImage = dream?.negative_image || null;
    // A brand-new habit isn't neglected: count from its creation at the latest.
    const created = new Date(h.created_at);
    const active = lastActive.get(h.id);
    const since = active && active > created ? active : created;
    map.set(h.id, {
      positive: dream?.positive_motivation || h.positive_motivation,
      negative,
      dreamName: dream?.name ?? null,
      image: dream?.image || h.image || null,
      negativeImage,
      negativeFrom: negative || negativeImage ? neglectStart(h, since) : null,
    });
  }
  return map;
}

/**
 * S54: the title says what to do and how much — "⏰ Exercise — 1 h", plus
 * the quota for N× per week / month habits. Snowball targets are re-read on
 * every sync (each app start), so the amount follows the current target.
 */
export function reminderTitle(habit: Habit): string {
  const amount = habit.target_value > 0 ? `${habit.target_value} ${habit.unit || ""}`.trim() : "";
  const freq = habitFrequency(habit);
  const quota = freq.kind !== "daily" ? ` · ${frequencyLabel(freq)}` : "";
  return `⏰ ${habit.name}${amount ? ` — ${amount}` : ""}${quota}`;
}

// Build the next REMINDER_DAYS one-shot exact notifications for a habit, skipping
// any slot whose time has already passed today.
function buildHabitNotifications(habit: Habit, content: HabitContent | undefined) {
  const { hour, minute } = parseTime(habit.notify_time);
  const base = habit.id * 100;
  const now = Date.now();
  const title = reminderTitle(habit);
  const notifications = [];
  for (let i = 0; i < REMINDER_DAYS; i++) {
    const at = new Date();
    at.setHours(hour, minute, 0, 0);
    at.setDate(at.getDate() + i);
    if (at.getTime() <= now) continue; // today's slot already passed
    const body =
      content && negativeOn(at, content.negativeFrom) ? negativeBody(content, habit) : notificationBody(content);
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
    // S72: base = what the next reminder should show (all an older APK ever
    // shows until the next sync); alt = the other side, for the newer
    // receiver to alternate with on its own while the app stays closed.
    const positive = { body: notificationBody(content), imageUrl: content?.image || "" };
    const negativeFrom = content?.negativeFrom ?? null;
    const negative =
      content && negativeFrom
        ? { body: negativeBody(content, habit), imageUrl: content.negativeImage || content.image || "" }
        : null;
    const baseIsNegative = !!negative && negativeOn(at, negativeFrom);
    const [base, alt] = baseIsNegative ? [negative!, positive] : [positive, negative];
    try {
      await HabitReminder.schedule({
        notifications: [
          {
            id: habit.id,
            atMillis: at.getTime(),
            title: reminderTitle(habit),
            body: base.body,
            imageUrl: base.imageUrl,
            hour,
            minute,
            ...(alt &&
              negativeFrom && {
                altBody: alt.body,
                altImageUrl: alt.imageUrl,
                negFromMillis: negativeFrom.getTime(),
                baseIsNegative,
              }),
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
      if (h.notify && h.notify_time && !h.archived_at) {
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
      const wantedHabits = habits.filter((h) => h.notify && h.notify_time && !h.archived_at);
      const contentMap = await resolveContent(wantedHabits);
      for (const habit of wantedHabits) {
        await scheduleOne(habit, contentMap.get(habit.id));
      }
      await syncStreakSavers(habits);
    }
  } catch (err) {
    console.error("Syncing local notifications failed:", err);
  }
}

/* ---------------------------------------------------- S61: streak saver */

// One-shot "don't lose your streak" reminder for tonight, per daily habit.
// The native alarms repeat blindly (they can't check progress at fire time),
// so the saver is laid down for *today only* each time habits sync — the
// sync re-runs after every progress save, which cancels it once done.
const STREAK_SAVER_HOUR = 21;
const STREAK_SAVER_MIN_STREAK = 3;
const streakSaverId = (habitId: number) => 9_000_000 + habitId;

async function syncStreakSavers(habits: Habit[]): Promise<void> {
  const daily = habits.filter((h) => !h.archived_at && habitFrequency(h).kind === "daily");
  const all = habits.map((h) => ({ id: streakSaverId(h.id) }));
  if (all.length) await LocalNotifications.cancel({ notifications: all });

  const at = new Date();
  at.setHours(STREAK_SAVER_HOUR, 0, 0, 0);
  if (daily.length === 0 || at.getTime() <= Date.now()) return;

  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data } = await supabase
    .from("habit_progress")
    .select("habit_id, date, value")
    .in("habit_id", daily.map((h) => h.id))
    .gte("date", since.toISOString().slice(0, 10));
  const byHabit: Record<number, Record<string, number>> = {};
  (data || []).forEach((p) => ((byHabit[p.habit_id] ||= {})[p.date] = p.value));

  const notifications = [];
  for (const h of daily) {
    const values = byHabit[h.id] || {};
    const target = h.target_value > 0 ? h.target_value : 1;
    if ((values[localDayKey(new Date())] || 0) >= target) continue; // done today
    const streak = computeStreak(h, values);
    if (streak < STREAK_SAVER_MIN_STREAK) continue;
    notifications.push({
      id: streakSaverId(h.id),
      title: `🔥 Don't lose your ${streak}-day streak`,
      body: `${reminderTitle(h).replace(/^⏰ /, "")} — there's still time today.`,
      iconColor: h.color,
      schedule: { at, allowWhileIdle: true },
    });
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

function localDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
