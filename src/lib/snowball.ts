import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { Habit } from "@shared/schema";

/**
 * Snowball habits: target_value holds the current target and is re-evaluated
 * every interval_days. At each interval boundary the past interval is scored:
 *   - hit the target on >= GROW_RATE of the days  → target + step_value
 *   - hit it on <  SHRINK_RATE of the days         → target - step_value
 *   - anything in between                          → target stays
 * so the bar rises when the habit is easy and drops when it is too hard.
 * last_increase_at (falling back to created_at) anchors the schedule, so the
 * evaluation runs lazily whenever habits are loaded — no cron needed.
 * Weekly habits are scored by the summed amount instead of per-day hits.
 */

export const GROW_RATE = 0.8;
export const SHRINK_RATE = 0.5;

export function isSnowball(habit: Habit): boolean {
  return (
    habit.habit_type === "snowball" &&
    (habit.step_value ?? 0) > 0 &&
    (habit.interval_days ?? 0) > 0
  );
}

const anchorDate = (habit: Habit): Date =>
  startOfDay(new Date(habit.last_increase_at || habit.created_at));

/** Whole intervals elapsed since the last increase (0 = nothing due). */
function dueIncrements(habit: Habit, today: Date): number {
  const days = differenceInCalendarDays(today, anchorDate(habit));
  if (days <= 0) return 0;
  return Math.floor(days / habit.interval_days!);
}

/** Days remaining until the next scheduled increase (null for non-snowball). */
export function daysUntilNextIncrease(habit: Habit, today = new Date()): number | null {
  if (!isSnowball(habit)) return null;
  const days = differenceInCalendarDays(startOfDay(today), anchorDate(habit));
  return Math.max(0, habit.interval_days! - (days % habit.interval_days!));
}

export type SnowballVerdict = "up" | "hold" | "down";

/**
 * Score one finished interval [start, start + interval_days) against the
 * target that applied during it. Days without a logged value count as missed.
 */
export function scoreInterval(
  habit: Habit,
  target: number,
  start: Date,
  values: Record<string, number>,
): SnowballVerdict {
  const days = habit.interval_days!;
  let hits = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const v = values[format(addDays(start, i), "yyyy-MM-dd")] || 0;
    total += v;
    if (v >= target) hits++;
  }
  const rate =
    habit.frequency === "weekly"
      ? target > 0 ? total / (target * (days / 7)) : 1
      : hits / days;
  if (rate >= GROW_RATE) return "up";
  if (rate < SHRINK_RATE) return "down";
  return "hold";
}

/** Lowest the bar may drop to: one step (never zero or negative). */
const minTarget = (habit: Habit) => Math.max(habit.step_value || 1, 1);

/**
 * Evaluate all finished intervals and persist the new target. The anchor
 * moves by whole intervals (not to "today"), so the cadence stays stable even
 * when the app is opened late. Returns true when anything was written, so the
 * caller can invalidate the habits query.
 */
export async function applySnowballGrowth(habits: Habit[]): Promise<boolean> {
  const today = startOfDay(new Date());
  const due = habits
    .filter(isSnowball)
    .map((h) => ({ habit: h, intervals: dueIncrements(h, today) }))
    .filter(({ intervals }) => intervals > 0);
  if (due.length === 0) return false;

  const earliest = due
    .map(({ habit }) => anchorDate(habit))
    .reduce((a, b) => (a < b ? a : b));
  const { data, error } = await supabase
    .from("habit_progress")
    .select("habit_id, date, value")
    .in("habit_id", due.map(({ habit }) => habit.id))
    .gte("date", format(earliest, "yyyy-MM-dd"))
    .lt("date", format(today, "yyyy-MM-dd"));
  if (error) throw error;
  const byHabit: Record<number, Record<string, number>> = {};
  (data || []).forEach((p) => {
    (byHabit[p.habit_id] ||= {})[p.date] = p.value;
  });

  const updates = due.map(({ habit, intervals }) => {
    let target = habit.target_value || 0;
    let start = anchorDate(habit);
    for (let i = 0; i < intervals; i++) {
      const verdict = scoreInterval(habit, target, start, byHabit[habit.id] || {});
      if (verdict === "up") target += habit.step_value!;
      if (verdict === "down") target = Math.max(minTarget(habit), target - habit.step_value!);
      start = addDays(start, habit.interval_days!);
    }
    return supabase
      .from("habits")
      .update({ target_value: target, last_increase_at: format(start, "yyyy-MM-dd") })
      .eq("id", habit.id);
  });
  await Promise.all(updates);
  return true;
}

/** Manual "+step / −step now" buttons: change the target now and restart the interval. */
export async function adjustSnowballNow(habit: Habit, dir: "up" | "down"): Promise<number> {
  const step = habit.step_value || 0;
  const current = habit.target_value || 0;
  const newTarget = dir === "up" ? current + step : Math.max(minTarget(habit), current - step);
  const { error } = await supabase
    .from("habits")
    .update({
      target_value: newTarget,
      last_increase_at: format(new Date(), "yyyy-MM-dd"),
    })
    .eq("id", habit.id);
  if (error) throw error;
  return newTarget;
}
