import { addDays, format, startOfDay } from "date-fns";
import type { Habit } from "@shared/schema";
import { habitFrequency, weekStart } from "@/lib/frequency";

/**
 * S61b: the weekly review (Pro). On Sunday it covers the current week so far,
 * on Monday the week that just ended. Monthly habits are left out — one week
 * says little about a 2× per month quota.
 */

export type HabitWeek = { habit: Habit; done: number; expected: number };

export type WeekReview = {
  from: Date;
  to: Date;
  isPast: boolean;
  habits: HabitWeek[];
  done: number;
  expected: number;
  best: HabitWeek | null;
  weakest: HabitWeek | null;
};

/** The week to review today, or null on days without a review (Tue–Sat). */
export function reviewWeek(today: Date = new Date()): { from: Date; to: Date; isPast: boolean } | null {
  const day = today.getDay();
  if (day === 0) return { from: weekStart(today), to: startOfDay(today), isPast: false };
  if (day === 1) {
    const from = addDays(weekStart(today), -7);
    return { from, to: addDays(from, 6), isPast: true };
  }
  return null;
}

export function computeWeekReview(
  habits: Habit[],
  valuesByHabit: Record<number, Record<string, number>>,
  week: { from: Date; to: Date; isPast: boolean },
): WeekReview {
  const rows: HabitWeek[] = [];
  for (const habit of habits) {
    const freq = habitFrequency(habit);
    if (freq.kind === "monthly") continue;
    const created = startOfDay(new Date(habit.created_at));
    const target = habit.target_value > 0 ? habit.target_value : 1;
    const values = valuesByHabit[habit.id] || {};
    let done = 0;
    let days = 0;
    for (let d = week.from; d <= week.to; d = addDays(d, 1)) {
      if (d < created) continue;
      days++;
      if ((values[format(d, "yyyy-MM-dd")] || 0) >= target) done++;
    }
    if (days === 0) continue; // habit created after the week
    // Daily: every day the habit existed. N× per week: the quota, scaled down
    // when the habit only existed for part of the week.
    const expected = freq.kind === "daily" ? days : Math.min(freq.times, Math.ceil((freq.times * days) / 7));
    rows.push({ habit, done: Math.min(done, expected), expected });
  }
  const rate = (r: HabitWeek) => r.done / r.expected;
  const sorted = [...rows].sort((a, b) => rate(b) - rate(a));
  const best = sorted[0] && sorted[0].done > 0 ? sorted[0] : null;
  const last = sorted[sorted.length - 1];
  const weakest = sorted.length > 1 && last !== best && rate(last) < 1 ? last : null;
  return {
    ...week,
    habits: rows,
    done: rows.reduce((n, r) => n + r.done, 0),
    expected: rows.reduce((n, r) => n + r.expected, 0),
    best,
    weakest,
  };
}
