import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { TodayHabits } from "@/components/habits/today-habits";
import { QuickRewards } from "@/components/rewards/quick-rewards";
import { DreamShowcase } from "@/components/dreams/dream-showcase";
import type { Dream } from "@shared/schema";

export default function HomePage() {
  const { user } = useAuth();

  const { data: dreams, isLoading: dreamsLoading } = useQuery({
    queryKey: ["dreams", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dreams").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Dream[];
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

      <TodayHabits />

      <QuickRewards />

      <DreamShowcase dreams={dreams} isLoading={dreamsLoading} />
    </div>
  );
}
