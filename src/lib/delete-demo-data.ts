import { supabase } from "./supabase";
import { recomputeProgress } from "./progress";

const DEMO_TABLES = ["dreams", "goals", "habits", "rewards"] as const;

/**
 * Returns true if the user still has any demo rows (is_demo = true).
 * If the is_demo column doesn't exist yet (migration not applied),
 * the queries fail and this reports false — the delete button stays hidden.
 */
export async function hasDemoData(userId: string): Promise<boolean> {
  const results = await Promise.all(
    DEMO_TABLES.map((table) =>
      supabase
        .from(table)
        .select("id")
        .eq("user_id", userId)
        .eq("is_demo", true)
        .limit(1),
    ),
  );
  return results.some((r) => !r.error && (r.data?.length ?? 0) > 0);
}

/**
 * Deletes all demo rows (is_demo = true) of the user, in FK-safe order:
 * habit_progress of demo habits → rewards → habits → goals → dreams.
 * User-created data is untouched.
 */
export async function deleteDemoData(userId: string): Promise<void> {
  const { data: demoHabits, error: habitsErr } = await supabase
    .from("habits")
    .select("id")
    .eq("user_id", userId)
    .eq("is_demo", true);
  if (habitsErr) throw habitsErr;

  const habitIds = (demoHabits ?? []).map((h) => h.id);
  if (habitIds.length > 0) {
    const { error } = await supabase
      .from("habit_progress")
      .delete()
      .eq("user_id", userId)
      .in("habit_id", habitIds);
    if (error) throw error;
  }

  for (const table of ["rewards", "habits", "goals", "dreams"] as const) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .eq("is_demo", true);
    if (error) throw error;
  }

  // Refresh cascade for the remaining (user-created) data; non-fatal.
  await recomputeProgress(userId).catch(() => {});
}
