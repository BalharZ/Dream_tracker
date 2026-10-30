import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import type { Habit } from "@shared/schema";
import type { ValuesByDate } from "@/lib/streaks";
import { dayKey, habitStart } from "@/lib/habit-stats";
import { habitFrequency, weekStart } from "@/lib/frequency";

/**
 * Habit strength (S53, docs/MONETIZATION.md §3): how automatic a habit has
 * become, 0..1. Calibrated on Lally et al. (2010): a habit kept consistently
 * reaches ~32 % after 21 days, ~70 % after the 66-day median and ~99 % after
 * 254 days, whatever its frequency (time, not repetitions, builds it).
 *
 * - each scheduled repetition done: S += (1 − S) · (1 − e^(−g/TAU)), g = days
 *   one repetition covers (daily 1, 3x per week 7/3, monthly 30); partial
 *   completion adds that share of the step
 * - each missed repetition: S *= 1 − p, p = min(12 %, 3 % · k) · (1 − 0.6 · S)
 *   with k = misses in a row, so missing twice hurts more ("never miss twice")
 *   and a strong habit shrugs off a single miss
 *
 * Weekly/monthly habits are judged per period: completions count as they
 * happen, missing repetitions only once the period is over.
 */

const TAU = 55;

export type StrengthLevel = "Seed" | "Forming" | "Building" | "Strong" | "Unbreakable";

/** Milestones: the strength a perfectly kept habit has after `days` days. */
export const STRENGTH_MILESTONES = [
  { days: 21, strength: 0.3, label: "Foundation" },
  { days: 66, strength: 0.7, label: "Automatic" },
  { days: 254, strength: 0.95, label: "Unbreakable" },
];

export function strengthLevel(score: number): StrengthLevel {
  const p = score * 100;
  if (p >= 90) return "Unbreakable";
  if (p >= 70) return "Strong";
  if (p >= 50) return "Building";
  if (p >= 25) return "Forming";
  return "Seed";
}

const targetOf = (habit: Habit) => (habit.target_value > 0 ? habit.target_value : 1);

/** Share of the target reached on a day, 0..1. */
const share = (habit: Habit, value: number | undefined) => Math.min(1, (value || 0) / targetOf(habit));

export function habitStrength(habit: Habit, values: ValuesByDate, today: Date = new Date()): number {
  const freq = habitFrequency(habit);
  const end = startOfDay(today);
  const start = habitStart(habit, values);
  let s = 0;
  let missesInRow = 0;

  const done = (part: number, g: number) => {
    s += (1 - s) * (1 - Math.exp(-g / TAU)) * part;
    missesInRow = 0;
  };
  const missed = () => {
    missesInRow++;
    s *= 1 - Math.min(0.12, 0.03 * missesInRow) * (1 - 0.6 * s);
  };

  if (freq.kind === "daily") {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const part = share(habit, values[dayKey(d)]);
      const isToday = differenceInCalendarDays(d, end) === 0;
      if (part > 0) done(part, 1);
      // An unfinished today is not a miss yet.
      else if (!isToday) missed();
    }
    return s;
  }

  // Weekly (N per Mon..Sun week) or monthly (1 per calendar month).
  const times = freq.kind === "weekly" ? freq.times : 1;
  let periodStart = freq.kind === "weekly" ? weekStart(start) : new Date(start.getFullYear(), start.getMonth(), 1);
  while (periodStart <= end) {
    const periodEnd =
      freq.kind === "weekly"
        ? addDays(periodStart, 6)
        : new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
    const periodDays = differenceInCalendarDays(periodEnd, periodStart) + 1;
    const g = periodDays / times;

    // Only the part of the first period after the habit started is required.
    const from = periodStart < start ? start : periodStart;
    const activeDays = differenceInCalendarDays(periodEnd, from) + 1;
    const required = Math.max(1, Math.round((times * activeDays) / periodDays));

    let count = 0;
    for (let d = from; d <= periodEnd && d <= end; d = addDays(d, 1)) {
      const part = share(habit, values[dayKey(d)]);
      if (part > 0 && count < required) {
        done(part, g);
        count += part >= 1 ? 1 : part;
      }
    }
    if (periodEnd < end) {
      for (let i = Math.ceil(count); i < required; i++) missed();
    }
    periodStart = addDays(periodEnd, 1);
  }
  return s;
}

/** First milestone not reached yet (null when all are). */
export const nextMilestone = (strength: number) => STRENGTH_MILESTONES.find((m) => strength < m.strength) || null;
