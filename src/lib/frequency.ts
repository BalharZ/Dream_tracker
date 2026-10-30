import { addDays, format, startOfDay } from "date-fns";
import type { Habit } from "@shared/schema";

/**
 * Habit frequency, parsed from `habits.frequency`. Stored as plain text so
 * "times per week" needs no DB change: "daily", "weekly" (= 1x per week,
 * legacy), "3x per week" (the format the demo data already uses), "monthly".
 */
export type Frequency =
  | { kind: "daily" }
  | { kind: "weekly"; times: number }
  | { kind: "monthly" };

export const MAX_TIMES_PER_WEEK = 6;

export function parseFrequency(value: string | null | undefined): Frequency {
  const v = (value || "daily").trim().toLowerCase();
  if (v === "monthly") return { kind: "monthly" };
  if (v === "weekly") return { kind: "weekly", times: 1 };
  const m = v.match(/^(\d+)\s*x\s*per\s*week$/);
  if (m) {
    const times = Math.min(Math.max(parseInt(m[1], 10) || 1, 1), 7);
    // 7x per week is just daily.
    return times >= 7 ? { kind: "daily" } : { kind: "weekly", times };
  }
  return { kind: "daily" };
}

export const habitFrequency = (habit: Pick<Habit, "frequency">) => parseFrequency(habit.frequency);

export function formatFrequency(f: Frequency): string {
  if (f.kind === "daily") return "daily";
  if (f.kind === "monthly") return "monthly";
  return `${f.times}x per week`;
}

/** Short label for UI chips: "Daily", "3× / week", "Monthly". */
export function frequencyLabel(f: Frequency): string {
  if (f.kind === "daily") return "Daily";
  if (f.kind === "monthly") return "Monthly";
  return `${f.times}× / week`;
}

/** Monday of the week containing `d` (weeks run Mon..Sun). */
export function weekStart(d: Date): Date {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

/**
 * S55: how many days of the Mon..Sun week containing `date` met the target.
 * `override` lets a caller count a value that is being saved right now.
 */
export function weekDoneCount(
  habit: Pick<Habit, "target_value">,
  values: Record<string, number>,
  date: Date,
  override?: { date: string; value: number },
): number {
  const target = habit.target_value > 0 ? habit.target_value : 1;
  const monday = weekStart(date);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const key = format(addDays(monday, i), "yyyy-MM-dd");
    const v = override && override.date === key ? override.value : values[key] || 0;
    if (v >= target) n++;
  }
  return n;
}
