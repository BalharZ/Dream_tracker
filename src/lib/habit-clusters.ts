import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { supabase } from "@/lib/supabase";
import type { Habit, HabitSubitem } from "@shared/schema";

/**
 * Habit clusters (S13): sub-exercises sharing the same or_group form an OR
 * cluster — completing any one member completes the whole cluster. Sub-
 * exercises without a group are required individually (AND). The day's habit
 * value is the number of completed *units*, where a unit is either a single
 * required sub-exercise or a whole OR cluster.
 */

export type ClusterUnit =
  | { kind: "single"; subitem: HabitSubitem }
  | { kind: "or"; group: number; members: HabitSubitem[] };

/** Group sub-exercises into units, preserving the list order. */
export function buildUnits(subitems: HabitSubitem[]): ClusterUnit[] {
  const units: ClusterUnit[] = [];
  const orUnits = new Map<number, Extract<ClusterUnit, { kind: "or" }>>();
  for (const s of subitems) {
    if (s.or_group == null) {
      units.push({ kind: "single", subitem: s });
    } else {
      let unit = orUnits.get(s.or_group);
      if (!unit) {
        unit = { kind: "or", group: s.or_group, members: [] };
        orUnits.set(s.or_group, unit);
        units.push(unit);
      }
      unit.members.push(s);
    }
  }
  return units;
}

const subitemDone = (s: HabitSubitem, valueOf: (subitemId: number) => number) =>
  valueOf(s.id) >= (s.target || 1);

/** AND unit: the sub-exercise is done; OR unit: any member is done. */
export function isUnitDone(
  unit: ClusterUnit,
  valueOf: (subitemId: number) => number
): boolean {
  if (unit.kind === "single") return subitemDone(unit.subitem, valueOf);
  return unit.members.some((m) => subitemDone(m, valueOf));
}

export function countDoneUnits(
  units: ClusterUnit[],
  valueOf: (subitemId: number) => number
): number {
  return units.filter((u) => isUnitDone(u, valueOf)).length;
}

/**
 * Escalation: after escalation_days days since last_escalation_at (falling
 * back to created_at) the app offers to escalate — add a sub-exercise or
 * tighten an OR cluster. Checked lazily, no cron needed.
 */
export function escalationDue(habit: Habit, today = new Date()): boolean {
  if (!habit.escalation_days || habit.escalation_days <= 0) return false;
  const anchor = startOfDay(new Date(habit.last_escalation_at || habit.created_at));
  return differenceInCalendarDays(startOfDay(today), anchor) >= habit.escalation_days;
}

/** "Later" on the escalation offer: restart the interval from today. */
export async function snoozeEscalation(habitId: number): Promise<void> {
  const { error } = await supabase
    .from("habits")
    .update({ last_escalation_at: format(new Date(), "yyyy-MM-dd") })
    .eq("id", habitId);
  if (error) throw error;
}
