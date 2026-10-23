import { addDays, differenceInCalendarDays, format, startOfDay, subDays } from "date-fns";
import type { Habit } from "@shared/schema";
import type { ValuesByDate } from "@/lib/streaks";

/**
 * Pure statistics over a habit's habit_progress values (keyed "yyyy-MM-dd").
 * A day is "done" when the value meets the habit's current target, "partial"
 * when something was logged but below target, otherwise "missed". Today only
 * counts once it is done, so an unfinished today never drags rates down.
 */

export type DayState = "done" | "partial" | "missed" | "none";

export const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

const targetOf = (habit: Habit) => (habit.target_value > 0 ? habit.target_value : 1);

export function dayState(habit: Habit, value: number | undefined): DayState {
  const v = value || 0;
  if (v >= targetOf(habit)) return "done";
  if (v > 0) return "partial";
  return "missed";
}

/** First day the habit can be judged on: its creation or first logged day, whichever is earlier. */
export function habitStart(habit: Habit, values: ValuesByDate): Date {
  const created = startOfDay(new Date(habit.created_at));
  const logged = Object.keys(values).sort()[0];
  if (!logged) return created;
  const first = startOfDay(new Date(logged + "T00:00:00"));
  return first < created ? first : created;
}

/** Days that count for a rate in [from, today]: clipped to the habit start; today only if done. */
function countedDays(habit: Habit, values: ValuesByDate, from: Date, to: Date): Date[] {
  const today = startOfDay(new Date());
  const start = habitStart(habit, values);
  const days: Date[] = [];
  for (let d = from < start ? start : from; d <= to; d = addDays(d, 1)) {
    if (differenceInCalendarDays(d, today) === 0 && dayState(habit, values[dayKey(d)]) !== "done") continue;
    if (d > today) break;
    days.push(d);
  }
  return days;
}

export type RangeBreakdown = { done: number; partial: number; missed: number; total: number; rate: number };

/** done/partial/missed counts and the success rate over the last `days` days. */
export function breakdown(habit: Habit, values: ValuesByDate, days: number, endOffset = 0): RangeBreakdown {
  const to = subDays(startOfDay(new Date()), endOffset);
  const from = subDays(to, days - 1);
  const list = countedDays(habit, values, from, to);
  const r = { done: 0, partial: 0, missed: 0, total: list.length, rate: 0 };
  list.forEach((d) => {
    const s = dayState(habit, values[dayKey(d)]);
    if (s === "done") r.done++;
    else if (s === "partial") r.partial++;
    else r.missed++;
  });
  r.rate = r.total ? r.done / r.total : 0;
  return r;
}

/** Rate over the last `days` days vs the `days` days before that (null when there's no earlier data). */
export function trend(habit: Habit, values: ValuesByDate, days: number) {
  const now = breakdown(habit, values, days);
  const before = breakdown(habit, values, days, days);
  return { now: now.rate, before: before.total ? before.rate : null, hasData: now.total > 0 };
}

export type Run = { start: Date; end: Date; length: number };

/** Every unbroken run of done days, longest first. */
export function streakRuns(habit: Habit, values: ValuesByDate): Run[] {
  const runs: Run[] = [];
  const today = startOfDay(new Date());
  let cur: Run | null = null;
  for (let d = habitStart(habit, values); d <= today; d = addDays(d, 1)) {
    if (dayState(habit, values[dayKey(d)]) === "done") {
      if (cur) {
        cur.end = d;
        cur.length++;
      } else cur = { start: d, end: d, length: 1 };
    } else if (cur) {
      runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs.sort((a, b) => b.length - a.length || b.end.getTime() - a.end.getTime());
}

export type ChartPoint = { label: string; value: number; done: number };

/**
 * Daily values over the last `days` days; ranges longer than 90 days are
 * averaged per week so the chart stays readable on a phone.
 */
export function series(habit: Habit, values: ValuesByDate, days: number): ChartPoint[] {
  const today = startOfDay(new Date());
  const from = subDays(today, days - 1);
  const daily: { d: Date; v: number }[] = [];
  for (let d = from; d <= today; d = addDays(d, 1)) daily.push({ d, v: values[dayKey(d)] || 0 });
  if (days <= 90) {
    return daily.map(({ d, v }) => ({
      label: format(d, "d MMM"),
      value: v,
      done: dayState(habit, v) === "done" ? 1 : 0,
    }));
  }
  const out: ChartPoint[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const week = daily.slice(i, i + 7);
    const sum = week.reduce((a, b) => a + b.v, 0);
    out.push({
      label: format(week[0].d, "d MMM"),
      value: Math.round((sum / week.length) * 10) / 10,
      done: week.filter((w) => dayState(habit, w.v) === "done").length,
    });
  }
  return out;
}

/** Success rate per weekday (Mon..Sun) over the last `days` days. */
export function weekdayRates(habit: Habit, values: ValuesByDate, days: number) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const acc = names.map((name) => ({ name, done: 0, total: 0, rate: 0 }));
  const to = startOfDay(new Date());
  countedDays(habit, values, subDays(to, days - 1), to).forEach((d) => {
    const i = (d.getDay() + 6) % 7;
    acc[i].total++;
    if (dayState(habit, values[dayKey(d)]) === "done") acc[i].done++;
  });
  acc.forEach((a) => (a.rate = a.total ? Math.round((a.done / a.total) * 100) : 0));
  return acc;
}

/** Year grid: 53 week-columns of Mon..Sun cells ending with the current week. */
export function yearGrid(habit: Habit, values: ValuesByDate) {
  const today = startOfDay(new Date());
  const start = habitStart(habit, values);
  const lastMonday = subDays(today, (today.getDay() + 6) % 7);
  const firstMonday = subDays(lastMonday, 52 * 7);
  const weeks: { date: Date; state: DayState; value: number }[][] = [];
  for (let w = 0; w < 53; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(firstMonday, w * 7 + i);
      const value = values[dayKey(date)] || 0;
      const state: DayState = date > today || date < start ? "none" : dayState(habit, value);
      col.push({ date, state, value });
    }
    weeks.push(col);
  }
  return weeks;
}
