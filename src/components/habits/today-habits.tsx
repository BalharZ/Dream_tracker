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
import { useToast } from "@/hooks/use-toast";
import { recomputeProgress } from "@/lib/progress";
import { applySnowballGrowth } from "@/lib/snowball";
import { syncHabitReminders } from "@/lib/local-notifications";
import { RewardRoulette } from "@/components/habits/reward-roulette";

/**
 * Compact "fill today's habits" list for the Dashboard. Writing a value reuses
 * the exact same progress pipeline as the Habits page (upsert progress, update
 * the habit, recompute the goal/dream cascade) and, when the target is reached,
 * opens the same reward roulette.
 */
export function TodayHabits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = new Date();
  const dateStr = format(today, "yyyy-MM-dd");

  // Raw write used by both the mutation and the unmount flush. Kept as a plain
  // function (not tied to the mutation observer) so a pending save can still be
  // persisted after the component is torn down — e.g. the user edits a value on
  // the dashboard and immediately navigates away before the debounce fires.
  const saveProgress = async (habitId: number, value: number) => {
    const { error } = await supabase
      .from("habit_progress")
      .upsert(
        { habit_id: habitId, user_id: user!.id, date: dateStr, value },
        { onConflict: "habit_id,user_id,date" }
      );
    if (error) throw error;

    await supabase.from("habits").update({ current_value: value }).eq("id", habitId);
    await recomputeProgress(user!.id);
  };
  // Always points at the latest saveProgress so the unmount flush uses the
  // current user/date, not the closure from the mount render.
  const saveProgressRef = useRef(saveProgress);
  saveProgressRef.current = saveProgress;

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

  // Lazily apply due snowball increases (the dashboard is usually the first
  // page that loads habits). A write invalidates the query; the refetched
  // habits have nothing due, so this cannot loop.
  useEffect(() => {
    if (!habits || habits.length === 0) return;
    applySnowballGrowth(habits)
      .then((changed) => {
        if (changed) queryClient.invalidateQueries({ queryKey: ["habits"] });
      })
      .catch((error) => console.error("Error applying snowball growth:", error));
  }, [habits]);

  // Native app only: top up the rolling buffer of exact daily reminders. The
  // dashboard is the landing page, so this keeps reminders fresh even if the
  // user never opens the Habits page.
  useEffect(() => {
    if (habits) syncHabitReminders(habits);
  }, [habits]);

  // Local, editable copy of today's values keyed by habit id.
  const [values, setValues] = useState<Record<number, number | string>>({});
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Values typed/tapped but not yet persisted, keyed by habit id. Used to keep
  // the server reseed from clobbering an in-flight edit and to flush pending
  // writes on unmount.
  const pending = useRef<Record<number, number>>({});

  // Seed from the server, but never overwrite a habit the user is mid-editing
  // (its debounced save hasn't landed yet), otherwise the value would visibly
  // jump back and feel like it didn't save.
  useEffect(() => {
    if (!todayProgress) return;
    setValues((prev) => {
      const next: Record<number, number | string> = { ...todayProgress };
      for (const id of Object.keys(pending.current)) {
        next[Number(id)] = prev[Number(id)];
      }
      return next;
    });
  }, [todayProgress]);

  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteHabit, setRouletteHabit] = useState<Habit | null>(null);

  const updateProgress = useMutation({
    mutationFn: async ({ habitId, value }: { habitId: number; value: number }) => {
      await saveProgress(habitId, value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dreams"] });
      queryClient.invalidateQueries({ queryKey: ["habit_progress_today"] });
      queryClient.invalidateQueries({ queryKey: ["habit_progress_all"] });
    },
    onError: (error) => {
      console.error("Error saving today's habit:", error);
      toast({
        variant: "destructive",
        title: "Couldn't save",
        description: "Your change wasn't saved. Check your connection and try again.",
      });
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
    delete pending.current[habit.id];
    updateProgress.mutate({ habitId: habit.id, value });
    if (value >= habit.target_value && habitHasRewards(habit.id)) {
      setRouletteHabit(habit);
      setShowRoulette(true);
    }
  };

  const handleChange = (habit: Habit, raw: number | string) => {
    setValues((prev) => ({ ...prev, [habit.id]: raw }));
    const numeric = raw === "" || typeof raw === "string" ? Number(raw) || 0 : raw;
    pending.current[habit.id] = numeric;
    if (saveTimers.current[habit.id]) clearTimeout(saveTimers.current[habit.id]);
    saveTimers.current[habit.id] = setTimeout(() => commit(habit, numeric), 700);
  };

  const markDone = (habit: Habit) => {
    if (saveTimers.current[habit.id]) clearTimeout(saveTimers.current[habit.id]);
    setValues((prev) => ({ ...prev, [habit.id]: habit.target_value }));
    commit(habit, habit.target_value);
  };

  // Flush any debounced-but-uncommitted edits when the component unmounts (e.g.
  // the user edits a value then immediately switches tab). Writes go straight
  // through saveProgress so they don't depend on the mutation still being
  // mounted; the query cache refreshes on the next visit.
  useEffect(() => {
    const timers = saveTimers.current;
    const pendingRef = pending.current;
    return () => {
      Object.values(timers).forEach((t) => clearTimeout(t));
      Object.entries(pendingRef).forEach(([id, value]) => {
        saveProgressRef.current(Number(id), value).catch((error) =>
          console.error("Error flushing pending habit save:", error)
        );
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                  className="rounded-lg p-3 space-y-2"
                  style={{
                    backgroundColor: `${habit.color}10`,
                    borderLeft: `4px solid ${habit.color}`,
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm break-words" style={{ color: habit.color }}>
                      {habit.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Target: {habit.target_value} {habit.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <NumberStepper
                      value={value}
                      onChange={(v) => handleChange(habit, v)}
                      min={0}
                      className="flex-1"
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
