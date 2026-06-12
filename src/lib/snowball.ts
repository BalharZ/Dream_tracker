import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { Habit } from "@shared/schema";

/**
 * Snowball habits: target_value holds the current target and grows by
 * step_value every interval_days. last_increase_at (falling back to
 * created_at) anchors the schedule, so growth is applied lazily whenever
 * habits are loaded — no cron needed.
 */

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

/**
 * Apply all due snowball increases and persist them. The anchor moves by
 * whole intervals (not to "today"), so the cadence stays stable even when
 * the app is opened late. Returns true when anything was written, so the
 * caller can invalidate the habits query.
 */
export async function applySnowballGrowth(habits: Habit[]): Promise<boolean> {
  const today = startOfDay(new Date());
  const updates = habits
    .filter(isSnowball)
    .map((h) => ({ habit: h, increments: dueIncrements(h, today) }))
    .filter(({ increments }) => increments > 0)
    .map(({ habit, increments }) =>
      supabase
        .from("habits")
        .update({
          target_value: (habit.target_value || 0) + increments * habit.step_value!,
          last_increase_at: format(
            addDays(anchorDate(habit), increments * habit.interval_days!),
            "yyyy-MM-dd",
          ),
        })
        .eq("id", habit.id),
    );
  if (updates.length === 0) return false;
  await Promise.all(updates);
  return true;
}

/** "Increase earlier" button: bump the target now and restart the interval. */
export async function increaseSnowballNow(habit: Habit): Promise<number> {
  const newTarget = (habit.target_value || 0) + (habit.step_value || 0);
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
