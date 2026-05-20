import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Reward } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Gift } from "lucide-react";

export default function StashPage() {
  const { user } = useAuth();
  const { data: rewards, isLoading } = useQuery({
    queryKey: ["stash", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("user_id", user!.id)
        .gt("available", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Reward[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Reward Stash</h1>
        <p className="text-muted-foreground">
          Your collection of earned rewards
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rewards?.map((reward) => (
          <Card key={reward.id}>
            <CardContent className="pt-6">
              <div
                className="w-full h-32 mb-4 rounded-lg bg-cover bg-center"
                style={{ backgroundImage: `url(${reward.image})` }}
              />
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">{reward.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Earned from completing your habits
              </p>
            </CardContent>
          </Card>
        ))}

        {(!rewards || rewards.length === 0) && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Gift className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No rewards yet</h3>
            <p>Complete your habits to earn rewards!</p>
          </div>
        )}
      </div>
    </div>
  );
}
