import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Gauge, Medal, Star, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TodayHabits } from "@/components/habits/today-habits";
import { QuickRewards } from "@/components/rewards/quick-rewards";
import { DeleteDemoBanner } from "@/components/demo/delete-demo-banner";
import { computeStreak, isConsolidated, CONSOLIDATION_DAYS } from "@/lib/streaks";
import type { Habit, HabitProgress } from "@shared/schema";

export default function HomePage() {
  const { user } = useAuth();

  const { data: dreams, isLoading: dreamsLoading } = useQuery({
    queryKey: ["dreams", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dreams").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: habits } = useQuery({
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Habit[];
    },
    enabled: !!user,
  });

  const { data: habitProgress } = useQuery({
    queryKey: ["habit_progress_all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_progress")
        .select("habit_id, date, value")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data as Pick<HabitProgress, "habit_id" | "date" | "value">[];
    },
    enabled: !!user,
  });

  // Overall progress = average progress of all dreams.
  const overallProgress = dreams && dreams.length > 0
    ? dreams.reduce((acc, d) => acc + (d.progress || 0), 0) / dreams.length
    : 0;

  // Consolidated habits (21+ day streak), same habit filter as habits-page.
  const visibleHabits = (habits || []).filter((habit) => {
    if (!habit.goal_id) return true;
    return goals?.some((goal) => goal.id === habit.goal_id);
  });
  const valuesByHabit = new Map<number, Record<string, number>>();
  for (const p of habitProgress || []) {
    const map = valuesByHabit.get(p.habit_id) || {};
    map[p.date] = p.value;
    valuesByHabit.set(p.habit_id, map);
  }
  const consolidatedHabits = visibleHabits.filter((h) =>
    isConsolidated(computeStreak(h, valuesByHabit.get(h.id) || {})),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
        <p className="text-muted-foreground">
          Track your progress and achieve your dreams
        </p>
      </div>

      <DeleteDemoBanner />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dreamsLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Progress value={overallProgress} className="flex-1" />
                <span className="text-2xl font-bold tabular-nums">
                  {Math.round(overallProgress)}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Average across {dreams?.length || 0} dream{(dreams?.length || 0) === 1 ? "" : "s"}
              </p>
              {visibleHabits.length > 0 && (
                <p className="text-sm flex items-center gap-1.5">
                  <Medal className="h-4 w-4 text-amber-500" />
                  <span>
                    <span className="font-semibold">{consolidatedHabits.length}</span> of{" "}
                    <span className="font-semibold">{visibleHabits.length}</span> habit
                    {visibleHabits.length === 1 ? "" : "s"} consolidated ({CONSOLIDATION_DAYS}+ days in a row)
                  </span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TodayHabits />

      <QuickRewards />

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Dreams Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dreamsLoading ? (
              <LoadingCard />
            ) : dreams?.length ? (
              <div className="space-y-4">
                {dreams.map((dream) => (
                  <div key={dream.id}>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{dream.name}</span>
                      <span>{Math.round(dream.progress)}%</span>
                    </div>
                    <Progress value={dream.progress} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No dreams yet"
                description="Start by adding your dreams"
                link="/dreams"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Goals Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {goalsLoading ? (
              <LoadingCard />
            ) : goals?.length ? (
              <div className="space-y-4">
                {goals
                  .filter(goal => !goal.parent_goal_id)
                  .map((goal) => (
                    <div key={goal.id}>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">{goal.name}</span>
                        <span>{Math.round(goal.progress)}%</span>
                      </div>
                      <Progress value={goal.progress} />
                    </div>
                  ))}
              </div>
            ) : (
              <EmptyState
                title="No goals yet"
                description="Start by adding your goals"
                link="/goals"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="flex justify-between mb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  description,
  link,
}: {
  title: string;
  description: string;
  link: string;
}) {
  return (
    <div className="text-center py-6">
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <Link href={link}>
        <Button>Get Started</Button>
      </Link>
    </div>
  );
}
