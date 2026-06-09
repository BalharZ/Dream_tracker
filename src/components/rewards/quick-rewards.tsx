import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { Gift, Loader2 } from "lucide-react";
import { Reward } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

/**
 * Dashboard widget showing earned rewards (available > 0) as mini cards with a
 * "Select" action. Selecting opens a small dialog to choose how many to redeem
 * (default 1) before confirming, which decrements the reward's availability.
 */
export function QuickRewards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Reward | null>(null);
  const [count, setCount] = useState<number | string>(1);

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["rewards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("user_id", user!.id)
        .order("available", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Reward[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (selected) setCount(1);
  }, [selected]);

  const redeem = useMutation({
    mutationFn: async ({ reward, amount }: { reward: Reward; amount: number }) => {
      const next = Math.max(0, (reward.available || 0) - amount);
      const { error } = await supabase
        .from("rewards")
        .update({ available: next })
        .eq("id", reward.id);
      if (error) throw error;
    },
    onSuccess: (_data, { amount }) => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      queryClient.invalidateQueries({ queryKey: ["stash"] });
      toast({
        title: "Reward selected!",
        description: `You redeemed ${amount} reward${amount > 1 ? "s" : ""}. Enjoy!`,
      });
      setSelected(null);
    },
  });

  const earned = (rewards || []).filter((r) => (r.available || 0) > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Your Rewards
        </CardTitle>
        <Link href="/stash">
          <Button variant="link" className="h-auto p-0 text-sm">
            View stash
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : earned.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {earned.map((reward) => (
              <div key={reward.id} className="rounded-lg border overflow-hidden">
                <div className="h-20 bg-muted flex items-center justify-center overflow-hidden">
                  {reward.image ? (
                    <img
                      src={reward.image}
                      alt={reward.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Gift className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-medium" title={reward.name}>
                      {reward.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ×{reward.available}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => setSelected(reward)}
                  >
                    Select
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <Gift className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Complete your habits to earn rewards.
            </p>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select {selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                How many would you like to redeem? You have {selected.available} available.
              </p>
              <NumberStepper
                value={count}
                onChange={setCount}
                min={1}
                max={selected.available}
                aria-label="How many to redeem"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const amount = Math.min(
                      Math.max(1, typeof count === "string" ? Number(count) || 1 : count),
                      selected.available
                    );
                    redeem.mutate({ reward: selected, amount });
                  }}
                  disabled={redeem.isPending}
                >
                  {redeem.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
