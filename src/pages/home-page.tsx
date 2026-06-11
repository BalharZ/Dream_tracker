import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Star, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TodayHabits } from "@/components/habits/today-habits";
import { QuickRewards } from "@/components/rewards/quick-rewards";
import { DeleteDemoBanner } from "@/components/demo/delete-demo-banner";

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
        <p className="text-muted-foreground">
          Track your progress and achieve your dreams
        </p>
      </div>

      <DeleteDemoBanner />

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
