import { addDays, format, startOfDay } from "date-fns";
import type { Habit } from "@shared/schema";

/**
 * Habit frequency, parsed from `habits.frequency`. Stored as plain text so
 * "times per week/month" needs no DB change: "daily", "weekly" (= 1x per
 * week, legacy), "3x per week" (the format the demo data already uses),
 * "monthly" (= 1x per month) and "2x per month".
 */
export type Frequency =
  | { kind: "daily" }
  | { kind: "weekly"; times: number }
  | { kind: "monthly"; times: number };

/** N× per week or month — the habits that fill a quota per period. */
export type PeriodFrequency = Extract<Frequency, { times: number }>;

export const MAX_TIMES_PER_WEEK = 6;
export const MAX_TIMES_PER_MONTH = 20;

export function parseFrequency(value: string | null | undefined): Frequency {
  const v = (value || "daily").trim().toLowerCase();
  if (v === "monthly") return { kind: "monthly", times: 1 };
  if (v === "weekly") return { kind: "weekly", times: 1 };
  const m = v.match(/^(\d+)\s*x\s*per\s*(week|month)$/);
  if (m) {
    const n = Math.max(parseInt(m[1], 10) || 1, 1);
    if (m[2] === "month") return { kind: "monthly", times: Math.min(n, MAX_TIMES_PER_MONTH) };
    const times = Math.min(n, 7);
    // 7x per week is just daily.
    return times >= 7 ? { kind: "daily" } : { kind: "weekly", times };
  }
  return { kind: "daily" };
}

export const habitFrequency = (habit: Pick<Habit, "frequency">) => parseFrequency(habit.frequency);

export function formatFrequency(f: Frequency): string {
  if (f.kind === "daily") return "daily";
  return `${f.times}x per ${f.kind === "weekly" ? "week" : "month"}`;
}

/** Short label for UI chips: "Daily", "3× / week", "2× / month". */
export function frequencyLabel(f: Frequency): string {
  if (f.kind === "daily") return "Daily";
  return `${f.times}× / ${f.kind === "weekly" ? "week" : "month"}`;
}

/** Monday of the week containing `d` (weeks run Mon..Sun). */
export function weekStart(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

/** First day of the period (Mon..Sun week or calendar month) containing `d`. */
export function periodStart(f: PeriodFrequency, d: Date): Date {
  return f.kind === "weekly" ? weekStart(d) : new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Last day of the period containing `d`. */
export function periodEnd(f: PeriodFrequency, d: Date): Date {
  return f.kind === "weekly" ? addDays(weekStart(d), 6) : new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/**
 * S55: how many days of the period (week or month) containing `date` met the
 * target. `override` lets a caller count a value that is being saved right now.
 */
export function periodDoneCount(
  habit: Pick<Habit, "target_value">,
  f: PeriodFrequency,
  values: Record<string, number>,
  date: Date,
  override?: { date: string; value: number },
): number {
  const target = habit.target_value > 0 ? habit.target_value : 1;
  const end = periodEnd(f, date);
  let n = 0;
  for (let d = periodStart(f, date); d <= end; d = addDays(d, 1)) {
    const key = format(d, "yyyy-MM-dd");
    const v = override && override.date === key ? override.value : values[key] || 0;
    if (v >= target) n++;
  }
  return n;
}
