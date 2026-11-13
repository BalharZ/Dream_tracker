import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarCheck, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { isActiveHabit, type Habit } from "@shared/schema";
import { computeWeekReview, reviewWeek } from "@/lib/week-review";
import { cn } from "@/lib/utils";

/** S61b: weekly review on the Dashboard, Sunday (this week) and Monday (last week). Pro. */
export function WeekReviewCard() {
  const { user } = useAuth();
  const { isPro, openPaywall } = usePlan();
  const week = reviewWeek();
  const from = week ? format(week.from, "yyyy-MM-dd") : "";
  const to = week ? format(week.to, "yyyy-MM-dd") : "";

  const { data: habits } = useQuery({
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
    enabled: !!user && !!week,
  });

  const { data: progress } = useQuery({
    queryKey: ["habit_progress_week_review", user?.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_progress")
        .select("habit_id, date, value")
        .eq("user_id", user!.id)
        .gte("date", from)
        .lte("date", to);
      if (error) throw error;
      const map: Record<number, Record<string, number>> = {};
      (data || []).forEach((p) => ((map[p.habit_id] ||= {})[p.date] = p.value));
      return map;
    },
    enabled: !!user && !!week,
  });

  if (!week || !habits || !progress) return null;
  const review = computeWeekReview(habits.filter(isActiveHabit), progress, week);
  if (review.habits.length === 0) return null;
  const pct = review.expected ? Math.round((review.done / review.expected) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          {week.isPast ? "Last week" : "Your week so far"}
        </CardTitle>
        <span className="text-sm text-muted-foreground">
          {format(week.from, "MMM d")} – {format(week.to, "MMM d")}
        </span>
      </CardHeader>
      <CardContent className="relative">
        <div className={cn("space-y-3", !isPro && "pointer-events-none select-none blur-sm")} aria-hidden={!isPro}>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{pct} %</span>
            <span className="text-sm text-muted-foreground">
              {review.done} of {review.expected} habit days done
            </span>
          </div>
          <div className="space-y-1.5">
            {review.habits.map((r) => (
              <div key={r.habit.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{r.habit.name}</span>
                <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(r.done / r.expected) * 100}%`, backgroundColor: r.habit.color }}
                  />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                  {r.done}/{r.expected}
                </span>
              </div>
            ))}
          </div>
          {(review.best || review.weakest) && (
            <div className="space-y-1 text-sm">
              {review.best && <p>🏆 Carried your week: <strong>{review.best.habit.name}</strong></p>}
              {review.weakest && (
                <p>
                  🎯 {week.isPast ? "Focus this week" : "Still time for"}: <strong>{review.weakest.habit.name}</strong>
                </p>
              )}
            </div>
          )}
        </div>
        {!isPro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">Weekly review is part of Pro</p>
            <Button size="sm" onClick={() => openPaywall("reminders")}>
              See Pro
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
