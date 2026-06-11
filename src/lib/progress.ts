import { supabase } from "@/lib/supabase";
import { conversionFactor } from "@/lib/units";
import type { Goal, Habit, HabitProgress } from "@shared/schema";

/**
 * Recompute the cascade habit -> goal -> dream and persist the results.
 *
 * Model:
 *  - habit contribution = sum of all habit_progress.value rows for that habit
 *  - leaf goal (no subgoals): progress = min(100, fulfilled / final_count * 100)
 *    where fulfilled = sum of contributions of habits linked to the goal
 *  - parent goal (has subgoals): progress = weighted average of its subgoals
 *    weighted by each subgoal's final_count (falls back to a simple average)
 *  - dream: progress = average of its root goals (parent_goal_id === null)
 *
 * Only rows whose progress actually changed are written back, to keep the
 * number of Supabase round-trips minimal.
 */
export async function recomputeProgress(userId: string): Promise<void> {
  const [goalsRes, habitsRes, progressRes, dreamsRes] = await Promise.all([
    supabase.from("goals").select("*").eq("user_id", userId),
    supabase.from("habits").select("*").eq("user_id", userId),
    supabase.from("habit_progress").select("habit_id, value").eq("user_id", userId),
    supabase.from("dreams").select("id, progress").eq("user_id", userId),
  ]);

  if (goalsRes.error) throw goalsRes.error;
  if (habitsRes.error) throw habitsRes.error;
  if (progressRes.error) throw progressRes.error;
  if (dreamsRes.error) throw dreamsRes.error;

  const goals = (goalsRes.data || []) as Goal[];
  const habits = (habitsRes.data || []) as Habit[];
  const progress = (progressRes.data || []) as Pick<HabitProgress, "habit_id" | "value">[];
  const dreams = (dreamsRes.data || []) as { id: number; progress: number }[];

  // Sum of progress values per habit.
  const fulfilledByHabit = new Map<number, number>();
  for (const p of progress) {
    fulfilledByHabit.set(p.habit_id, (fulfilledByHabit.get(p.habit_id) || 0) + (p.value || 0));
  }

  // Sum of habit contributions per goal, converted into the goal's unit
  // when the habit tracks a different time unit (e.g. minutes vs hours).
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const fulfilledByGoal = new Map<number, number>();
  for (const h of habits) {
    if (h.goal_id == null) continue;
    const factor = conversionFactor(h.unit, goalById.get(h.goal_id)?.unit);
    const contribution = (fulfilledByHabit.get(h.id) || 0) * factor;
    fulfilledByGoal.set(h.goal_id, (fulfilledByGoal.get(h.goal_id) || 0) + contribution);
  }

  // Children grouped by parent goal id.
  const childrenByParent = new Map<number, Goal[]>();
  for (const g of goals) {
    if (g.parent_goal_id == null) continue;
    const list = childrenByParent.get(g.parent_goal_id) || [];
    list.push(g);
    childrenByParent.set(g.parent_goal_id, list);
  }

  const clampPct = (n: number) => Math.max(0, Math.min(100, n));

  const leafProgress = (goal: Goal): number => {
    const fulfilled = fulfilledByGoal.get(goal.id) || 0;
    if (!goal.final_count || goal.final_count <= 0) return 0;
    return clampPct((fulfilled / goal.final_count) * 100);
  };

  const goalProgress = new Map<number, number>();
  const computeGoal = (goal: Goal): number => {
    if (goalProgress.has(goal.id)) return goalProgress.get(goal.id)!;
    const children = childrenByParent.get(goal.id);
    let result: number;
    if (children && children.length > 0) {
      // Weighted average of subgoals by their final_count.
      const totalWeight = children.reduce((acc, c) => acc + (c.final_count > 0 ? c.final_count : 0), 0);
      if (totalWeight > 0) {
        result = children.reduce((acc, c) => acc + computeGoal(c) * (c.final_count > 0 ? c.final_count : 0), 0) / totalWeight;
      } else {
        result = children.reduce((acc, c) => acc + computeGoal(c), 0) / children.length;
      }
    } else {
      result = leafProgress(goal);
    }
    result = clampPct(result);
    goalProgress.set(goal.id, result);
    return result;
  };

  for (const g of goals) computeGoal(g);

  // Dream progress = average of its root goals.
  const rootGoalsByDream = new Map<number, Goal[]>();
  for (const g of goals) {
    if (g.parent_goal_id != null) continue;
    const list = rootGoalsByDream.get(g.dream_id) || [];
    list.push(g);
    rootGoalsByDream.set(g.dream_id, list);
  }

  // Persist goal progress changes.
  const sameRounded = (a: number, b: number) => Math.round(a) === Math.round(b);
  const goalWrites = goals
    .filter((g) => !sameRounded(goalProgress.get(g.id) ?? 0, g.progress ?? 0))
    .map((g) =>
      supabase.from("goals").update({ progress: Math.round(goalProgress.get(g.id) ?? 0) }).eq("id", g.id),
    );

  // Persist dream progress changes.
  const dreamWrites = dreams
    .map((d) => {
      const roots = rootGoalsByDream.get(d.id) || [];
      const value = roots.length > 0
        ? clampPct(roots.reduce((acc, g) => acc + (goalProgress.get(g.id) ?? 0), 0) / roots.length)
        : 0;
      return { id: d.id, value: Math.round(value), prev: d.progress ?? 0 };
    })
    .filter((d) => !sameRounded(d.value, d.prev))
    .map((d) => supabase.from("dreams").update({ progress: d.value }).eq("id", d.id));

  await Promise.all([...goalWrites, ...dreamWrites]);
}
