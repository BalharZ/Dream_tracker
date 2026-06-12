import { format } from "date-fns";
import type { Habit } from "@shared/schema";

/**
 * Habit consolidation ("upevnění zvyku"): a habit counts as consolidated
 * after meeting its target CONSOLIDATION_DAYS days in a row. Computed purely
 * from habit_progress rows — no DB changes needed.
 */
export const CONSOLIDATION_DAYS = 21;

/** Day's values for one habit keyed by "yyyy-MM-dd". */
export type ValuesByDate = Record<string, number>;

function dayMet(habit: Habit, value: number): boolean {
  const target = habit.target_value > 0 ? habit.target_value : 1;
  return value >= target;
}

/**
 * Number of consecutive days (ending today, or yesterday when today is not
 * met yet — an unfinished today doesn't break the streak) on which the habit
 * met its current target.
 */
export function computeStreak(
  habit: Habit,
  valuesByDate: ValuesByDate,
  today: Date = new Date(),
): number {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  if (!dayMet(habit, valuesByDate[format(d, "yyyy-MM-dd")] || 0)) {
    d.setDate(d.getDate() - 1);
  }
  let streak = 0;
  // Hard cap (10 years of days) so a malformed map can never loop forever.
  for (let i = 0; i < 3650; i++) {
    if (!dayMet(habit, valuesByDate[format(d, "yyyy-MM-dd")] || 0)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function isConsolidated(streak: number): boolean {
  return streak >= CONSOLIDATION_DAYS;
}
