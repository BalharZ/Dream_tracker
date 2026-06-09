import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Check, Repeat2 } from "lucide-react";
import { Habit, Goal, Reward } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { recomputeProgress } from "@/lib/progress";
import { RewardRoulette } from "@/components/habits/reward-roulette";

/**
 * Compact "fill today's habits" list for the Dashboard. Writing a value reuses
 * the exact same progress pipeline as the Habits page (upsert progress, update
 * the habit, recompute the goal/dream cascade) and, when the target is reached,
 * opens the same reward roulette.
 */
export function TodayHabits() {
  const { user } = useAuth();
  const today = new Date();
  const dateStr = format(today, "yyyy-MM-dd");

  const { data: habits, isLoading } = useQuery({
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Habit[];
    },
    enabled: !!user,
  });

  const { data: goals } = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!user,
  });

  const { data: rewards } = useQuery({
    queryKey: ["rewards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Reward[];
    },
    enabled: !!user,
  });

  const { data: todayProgress } = useQuery({
    queryKey: ["habit_progress_today", user?.id, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_progress")
        .select("habit_id, value")
        .eq("user_id", user!.id)
        .eq("date", dateStr);
      if (error) throw error;
      const map: Record<number, number> = {};
      (data || []).forEach((p) => {
        map[p.habit_id] = p.value;
      });
      return map;
    },
    enabled: !!user,
  });

  // Local, editable copy of today's values keyed by habit id.
  const [values, setValues] = useState<Record<number, number | string>>({});
  useEffect(() => {
    if (todayProgress) setValues(todayProgress);
  }, [todayProgress]);

  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteHabit, setRouletteHabit] = useState<Habit | null>(null);
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const updateProgress = useMutation({
    mutationFn: async ({ habitId, value }: { habitId: number; value: number }) => {
      const { error } = await supabase
        .from("habit_progress")
        .upsert(
          { habit_id: habitId, user_id: user!.id, date: dateStr, value },
          { onConflict: "habit_id,user_id,date" }
        );
      if (error) throw error;

      await supabase.from("habits").update({ current_value: value }).eq("id", habitId);

      await recomputeProgress(user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dreams"] });
      queryClient.invalidateQueries({ queryKey: ["habit_progress_today"] });
    },
  });

  const habitHasRewards = (habitId: number) =>
    (rewards || []).some((r) => {
      try {
        const chances = JSON.parse(r.habit_chances || "{}");
        return chances[habitId] !== undefined;
      } catch {
        return false;
      }
    });

  const commit = (habit: Habit, value: number) => {
    updateProgress.mutate({ habitId: habit.id, value });
    if (value >= habit.target_value && habitHasRewards(habit.id)) {
      setRouletteHabit(habit);
      setShowRoulette(true);
    }
  };

  const handleChange = (habit: Habit, raw: number | string) => {
    setValues((prev) => ({ ...prev, [habit.id]: raw }));
    const numeric = raw === "" || typeof raw === "string" ? Number(raw) || 0 : raw;
    if (saveTimers.current[habit.id]) clearTimeout(saveTimers.current[habit.id]);
    saveTimers.current[habit.id] = setTimeout(() => commit(habit, numeric), 700);
  };

  const markDone = (habit: Habit) => {
    if (saveTimers.current[habit.id]) clearTimeout(saveTimers.current[habit.id]);
    setValues((prev) => ({ ...prev, [habit.id]: habit.target_value }));
    commit(habit, habit.target_value);
  };

  // Only show habits whose goal still exists (mirrors the Habits page filter).
  const visibleHabits = (habits || []).filter((habit) => {
    if (!habit.goal_id) return true;
    return goals?.some((goal) => goal.id === habit.goal_id);
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Repeat2 className="h-5 w-5 text-primary" />
          Today's Habits
        </CardTitle>
        <span className="text-sm text-muted-foreground">{format(today, "EEEE, MMM d")}</span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : visibleHabits.length ? (
          <div className="space-y-3">
            {visibleHabits.map((habit) => {
              const value = values[habit.id] ?? 0;
              const numeric = typeof value === "string" ? Number(value) || 0 : value;
              const done = numeric >= habit.target_value;
              return (
                <div
                  key={habit.id}
                  className="flex items-center gap-3 rounded-lg p-2"
                  style={{
                    backgroundColor: `${habit.color}10`,
                    borderLeft: `4px solid ${habit.color}`,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-sm" style={{ color: habit.color }}>
                      {habit.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Target: {habit.target_value} {habit.unit}
                    </div>
                  </div>
                  <NumberStepper
                    value={value}
                    onChange={(v) => handleChange(habit, v)}
                    min={0}
                    className="w-32 shrink-0"
                    inputClassName="h-9"
                    aria-label={`Today's ${habit.name}`}
                  />
                  <Button
                    size="icon"
                    variant={done ? "default" : "outline"}
                    className="shrink-0"
                    style={done ? { backgroundColor: habit.color } : undefined}
                    onClick={() => markDone(habit)}
                    aria-label={`Mark ${habit.name} done`}
                    title="Mark target reached"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center">
            <h3 className="font-medium mb-1">No habits yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add a habit to start tracking it here.
            </p>
            <Link href="/habits">
              <Button>Get Started</Button>
            </Link>
          </div>
        )}
      </CardContent>

      {rouletteHabit && (
        <RewardRoulette
          show={showRoulette}
          onClose={() => {
            setShowRoulette(false);
            setRouletteHabit(null);
          }}
          habit={rouletteHabit}
          rewards={rewards || []}
        />
      )}
    </Card>
  );
}
