import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogContentNoClose } from "@/components/ui/dialog-no-close";
import { Habit, Goal, Reward } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
// Table imports removed - using custom div-based grid for sticky columns
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { HabitForm } from "@/components/habits/habit-form";

type ProgressMap = Record<number, Record<string, number>>;

function HabitsPage() {
  const { user } = useAuth();
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editProgressDialogOpen, setEditProgressDialogOpen] = useState(false);
  const [progressMap, setProgressMap] = useState<ProgressMap>({});

  const { data: habits, isLoading } = useQuery({
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("habits").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Habit[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!habits || habits.length === 0) return;
    const loadProgress = async () => {
      try {
        const { data, error } = await supabase
          .from("habit_progress")
          .select("habit_id, date, value")
          .in("habit_id", habits.map(h => h.id));
        if (error) throw error;
        const newProgressMap: ProgressMap = {};
        data?.forEach(p => {
          if (!newProgressMap[p.habit_id]) newProgressMap[p.habit_id] = {};
          newProgressMap[p.habit_id][p.date] = p.value;
        });
        setProgressMap(newProgressMap);
      } catch (error) {
        console.error("Error loading habit progress:", error);
      }
    };
    loadProgress();
  }, [habits]);

  const [showRewardRoulette, setShowRewardRoulette] = useState(false);
  const [selectedHabitForReward, setSelectedHabitForReward] = useState<Habit | null>(null);
  const [noRewardAlertHabit, setNoRewardAlertHabit] = useState<number | null>(null);
  const [hiddenAlerts, setHiddenAlerts] = useState<number[]>([]);
  const [numberOfDays, setNumberOfDays] = useState(30);
  const { toast } = useToast();

  const daysToShow = Array.from({ length: numberOfDays }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date;
  }).sort((a, b) => b.getTime() - a.getTime());

  const { data: goals } = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!user,
  });

  const { data: rewards } = useQuery({
    queryKey: ["rewards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("rewards").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Reward[];
    },
    enabled: !!user,
  });

  const deleteHabit = useMutation({
    mutationFn: async (habitId: number) => {
      const { error } = await supabase.from("habits").delete().eq("id", habitId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      setHabitToEdit(null);
    },
  });

  const updateProgress = useMutation({
    mutationFn: async ({ habitId, value, date }: { habitId: number; value: number; date: string }) => {
      setProgressMap(prev => ({
        ...prev,
        [habitId]: { ...(prev[habitId] || {}), [date]: value }
      }));

      const { error } = await supabase
        .from("habit_progress")
        .upsert(
          { habit_id: habitId, user_id: user!.id, date, value },
          { onConflict: "habit_id,user_id,date" }
        );
      if (error) throw error;

      await supabase.from("habits").update({ current_value: value }).eq("id", habitId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dreams"] });
    },
  });

  const [lastUpdate, setLastUpdate] = useState<{
    habitId: number;
    value: number;
    date: string;
    timeout: NodeJS.Timeout | null;
  } | null>(null);

  const handleHabitProgress = async (habitId: number, value: number, date: string) => {
    const habit = habits?.find(h => h.id === habitId);
    if (!habit) return;

    if (lastUpdate && lastUpdate.habitId === habitId && lastUpdate.date === date && lastUpdate.timeout) {
      clearTimeout(lastUpdate.timeout);
    }

    updateProgress.mutate({ habitId, value, date });

    const timeout = setTimeout(() => {
      if (value >= habit.target_value) {
        const habitRewards = rewards?.filter(r => {
          try {
            const chances = JSON.parse(r.habit_chances || "{}");
            return chances[habitId] !== undefined;
          } catch {
            return false;
          }
        }) || [];

        if (habitRewards.length > 0) {
          setSelectedHabitForReward(habit);
          setShowRewardRoulette(true);
        }
      }
    }, 800);

    setLastUpdate({ habitId, value, date, timeout });
  };

  useEffect(() => {
    const saved = localStorage.getItem('hiddenRewardAlerts');
    if (saved) {
      try {
        setHiddenAlerts(JSON.parse(saved));
      } catch {
        setHiddenAlerts([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hiddenRewardAlerts', JSON.stringify(hiddenAlerts));
  }, [hiddenAlerts]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Habits</h1>
          <p className="text-muted-foreground">
            Build daily habits that lead to your goals
          </p>
        </div>

        <HabitForm
          goals={goals || []}
          rewards={rewards || []}
          habit={habitToEdit}
          onSuccess={() => {
            setHabitToEdit(null);
          }}
          onDelete={habitToEdit ? () => deleteHabit.mutate(habitToEdit.id) : undefined}
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">History</h2>
          </div>

          <div className="relative">
            {/* Grid with sticky left columns */}
            <div className="flex">
              {/* Sticky left: Habit + Target columns */}
              <div className="flex-shrink-0 z-10 bg-card">
                {/* Header row */}
                <div className="flex border-b">
                  <div className="w-36 sm:w-48 px-3 py-3 text-sm font-medium text-muted-foreground">Habit</div>
                  <div className="w-16 sm:w-20 px-2 py-3 text-sm font-medium text-muted-foreground">Target</div>
                </div>
                {/* Data rows */}
                {habits?.filter(habit => {
                  if (!habit.goal_id) return true;
                  const goalExists = goals?.some(goal => goal.id === habit.goal_id);
                  return goalExists;
                }).map((habit) => (
                  <div
                    key={habit.id}
                    className="flex border-b"
                    style={{
                      backgroundColor: `${habit.color}10`,
                      borderLeft: `4px solid ${habit.color}`
                    }}
                  >
                    <div className="w-36 sm:w-48 px-3 py-3">
                      <Button
                        variant="link"
                        className="h-auto p-0 text-left"
                        style={{ color: habit.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHabitToEdit(habit);
                        }}
                      >
                        <div className="font-bold text-sm leading-tight">{habit.name}</div>
                        <div className="text-xs text-muted-foreground leading-tight">
                          {habit.goal_id
                            ? goals?.find((g) => g.id === habit.goal_id)?.name
                            : "No goal"}
                        </div>
                      </Button>
                    </div>
                    <div className="w-16 sm:w-20 px-2 py-3 flex items-center" style={{ color: habit.color }}>
                      <span className="text-base font-bold">{habit.target_value}</span>
                      <span className="text-xs ml-0.5">{habit.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scrollable right: Date columns */}
              <div className="flex-1 overflow-x-auto">
                {/* Header row */}
                <div className="flex border-b">
                  {daysToShow.map((date, i) => (
                    <div key={i} className="w-14 sm:w-16 flex-shrink-0 px-1 py-3 text-center text-sm font-medium text-muted-foreground">
                      {format(date, "d.M")}
                    </div>
                  ))}
                </div>
                {/* Data rows */}
                {habits?.filter(habit => {
                  if (!habit.goal_id) return true;
                  const goalExists = goals?.some(goal => goal.id === habit.goal_id);
                  return goalExists;
                }).map((habit) => (
                  <div
                    key={habit.id}
                    className="flex border-b"
                    style={{ backgroundColor: `${habit.color}10` }}
                  >
                    {daysToShow.map((date, i) => {
                      const dateStr = format(date, "yyyy-MM-dd");
                      const value = progressMap[habit.id]?.[dateStr] || 0;
                      const isTargetMet = value >= habit.target_value;

                      return (
                        <div
                          key={i}
                          className="w-14 sm:w-16 flex-shrink-0 px-1 py-2 cursor-pointer transition-all hover:scale-110"
                          onClick={() => {
                            setSelectedHabit(habit);
                            setSelectedDate(date);
                            setEditProgressDialogOpen(true);
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <div
                              className="text-base font-medium"
                              style={{
                                color: value === 0
                                  ? "#9CA3AF"
                                  : isTargetMet
                                    ? habit.color
                                    : "#4B5563"
                              }}
                            >
                              {value}
                            </div>
                            <div className="text-xs text-gray-500">
                              {habit.unit}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setNumberOfDays(prev => prev + 30)}
            >
              <ChevronRight className="h-4 w-4 mr-2" />
              Load more history
            </Button>
          </div>
        </CardContent>
      </Card>

      <NoRewardAlert
        isOpen={noRewardAlertHabit !== null}
        onClose={(dontShowAgain) => {
          if (dontShowAgain && noRewardAlertHabit) {
            setHiddenAlerts(prev => [...prev, noRewardAlertHabit]);
          }
          setNoRewardAlertHabit(null);
        }}
        habitId={noRewardAlertHabit || 0}
      />

      {selectedHabitForReward && (
        <RewardRoulette
          show={showRewardRoulette}
          onClose={() => {
            setShowRewardRoulette(false);
            setSelectedHabitForReward(null);
          }}
          habit={selectedHabitForReward}
          rewards={rewards || []}
        />
      )}

      {selectedHabit && (
        <EditProgressDialog
          isOpen={editProgressDialogOpen}
          onClose={() => setEditProgressDialogOpen(false)}
          habit={selectedHabit}
          date={selectedDate}
          initialValue={progressMap[selectedHabit.id]?.[format(selectedDate, "yyyy-MM-dd")] || 0}
          onSave={(value) => {
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            handleHabitProgress(selectedHabit.id, value, dateStr);
            setEditProgressDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EditProgressDialog({
  isOpen,
  onClose,
  habit,
  date,
  initialValue,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  habit: Habit;
  date: Date;
  initialValue: number;
  onSave: (value: number) => void;
}) {
  const [value, setValue] = useState<number | string>(initialValue > 0 ? initialValue : '');

  useEffect(() => {
    if (initialValue > 0) {
      setValue(initialValue);
    } else {
      setValue('');
    }
  }, [initialValue, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {habit.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {format(date, "EEEE, MMMM d, yyyy")}
            </span>
            <span className="text-sm text-muted-foreground">
              Target: {habit.target_value} {habit.unit}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Input
              type="number"
              autoFocus
              min={0}
              placeholder="0"
              value={value}
              className="text-xl"
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                setValue(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSave(typeof value === 'string' ? 0 : value);
                }
              }}
            />
            <span className="text-lg">{habit.unit}</span>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => onSave(typeof value === 'string' ? 0 : value)}
              style={{ backgroundColor: habit.color }}
              className="text-white"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default HabitsPage;

function NoRewardAlert({
  isOpen,
  onClose,
  habitId,
}: {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
  habitId: number;
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose(dontShowAgain)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>No Rewards Assigned</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p>You can create and assign a reward for this habit to make it more motivating!</p>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>I don't want any reward for this habit</span>
          </div>
          <Button className="w-full" onClick={() => onClose(dontShowAgain)}>
            Ok
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getColorByChance(chance: number): string {
  if (chance < 10) return '#B45309';
  if (chance < 20) return '#991B1B';
  if (chance < 30) return '#5B21B6';
  if (chance < 50) return '#1E3A8A';
  return '#065F46';
}

function RewardRoulette({
  show,
  onClose,
  habit,
  rewards,
}: {
  show: boolean;
  onClose: () => void;
  habit: Habit;
  rewards: Reward[];
}) {
  const { toast } = useToast();
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [animationPhase, setAnimationPhase] = useState<'initial' | 'spinning' | 'finished'>('initial');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [rewardCards, setRewardCards] = useState<Reward[]>([]);

  const fixedWinningIndex = 50;

  useEffect(() => {
    if (show) {
      setIsAnimating(true);
      setIsFinished(false);
      setAnimationPhase('initial');

      const emptySlot = {
        id: 0,
        name: "Progress is also a reward!",
        available: 0,
        image: "",
        user_id: "",
        habit_chances: "{}"
      } as Reward;

      const habitRewards = rewards.filter(r => {
        try {
          const chances = JSON.parse(r.habit_chances || "{}");
          return chances[habit.id] !== undefined;
        } catch {
          return false;
        }
      });

      let totalChance = 0;
      const rewardChances: Record<number, number> = {};

      habitRewards.forEach(reward => {
        try {
          const chances = JSON.parse(reward.habit_chances || "{}");
          const chance = chances[habit.id] || 0;
          rewardChances[reward.id] = chance;
          totalChance += chance;
        } catch (error) {
          console.error("Error parsing reward chances:", error);
        }
      });

      let chosenReward = emptySlot;
      const roll = Math.random() * 100;
      let cumulativeChance = 0;

      for (const reward of habitRewards) {
        cumulativeChance += rewardChances[reward.id] || 0;
        if (roll <= cumulativeChance) {
          chosenReward = reward;
          break;
        }
      }

      setSelectedReward(chosenReward);

      const cards: Reward[] = [];
      const emptyProportion = Math.max(0.2, 1 - (totalChance / 100) * 0.8);

      for (let i = 0; i < 100; i++) {
        if (i === fixedWinningIndex) {
          cards.push(chosenReward);
        } else {
          if (Math.random() < emptyProportion || habitRewards.length === 0) {
            cards.push(emptySlot);
          } else {
            let rewardRoll = Math.random() * totalChance;
            let cumulative = 0;
            let randomReward = habitRewards[0];

            for (const reward of habitRewards) {
              cumulative += rewardChances[reward.id] || 0;
              if (rewardRoll <= cumulative) {
                randomReward = reward;
                break;
              }
            }
            cards.push(randomReward);
          }
        }
      }

      setRewardCards(cards);

      setTimeout(() => {
        setAnimationPhase('spinning');
        setTimeout(() => {
          setAnimationPhase('finished');
          setIsFinished(true);
          setIsAnimating(false);
        }, 4400);
      }, 300);
    } else {
      setIsAnimating(false);
      setIsFinished(false);
      setAnimationPhase('initial');
    }
  }, [show, habit.id, rewards]);

  const handleClaimReward = async () => {
    if (selectedReward && selectedReward.id > 0) {
      try {
        onClose();
        const { error } = await supabase
          .from("rewards")
          .update({ available: selectedReward.available + 1 })
          .eq("id", selectedReward.id);
        if (error) throw error;
        toast({
          title: "Reward Added!",
          description: "The reward has been added to your stash.",
        });
        queryClient.invalidateQueries({ queryKey: ["rewards"] });
      } catch (error) {
        console.error('Error claiming reward:', error);
        toast({
          title: "Error",
          description: "Failed to add reward to your stash.",
          variant: "destructive"
        });
      }
    } else {
      onClose();
    }
  };

  const getRewardStyles = () => {
    if (animationPhase === 'initial') {
      return { transform: 'translateX(0px)', transition: 'none' };
    }
    if (animationPhase === 'spinning') {
      return {
        transform: 'translateX(-5730px)',
        transition: 'transform 4.2s cubic-bezier(0.18, 0.89, 0.32, 1)'
      };
    }
    return { transform: 'translateX(-5730px)', transition: 'none' };
  };

  if (!show || !selectedReward) {
    return null;
  }

  return (
    <Dialog
      open={show}
      onOpenChange={(open) => {
        if (!open && !isAnimating) {
          onClose();
        }
      }}
    >
      <DialogContentNoClose className="max-w-3xl bg-gray-900 text-white border-2 border-blue-500">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              {isAnimating
                ? "Opening Reward Case..."
                : (selectedReward.id > 0 ? "Congratulations!" : "Progress is also a reward!")}
            </DialogTitle>
          </DialogHeader>

          <div className="relative mx-auto overflow-hidden h-44 bg-gray-800 rounded-lg border-2 border-gray-700 my-4">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="h-full w-[4px] bg-orange-500 animate-pulse relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[20px] h-[5px] bg-orange-500"></div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[20px] h-[5px] bg-orange-500"></div>
              </div>
            </div>

            <div className="absolute inset-0 flex items-center">
              <div
                className="flex absolute left-0 items-center"
                style={isAnimating ? getRewardStyles() : { transform: 'translateX(-5730px)' }}
              >
                {rewardCards.map((card, index) => {
                  const isWinningCard = index === 50;

                  return (
                    <div
                      key={`card-${index}`}
                      className={`flex-shrink-0 w-28 h-32 mx-1 p-2 rounded-lg flex flex-col items-center justify-center
                        ${card.id === 0
                          ? 'bg-gray-800/80 border-2 border-gray-600'
                          : (() => {
                              try {
                                const chances = JSON.parse(card.habit_chances || "{}");
                                const chance = chances[habit.id] || 0;
                                if (chance < 10) return 'bg-amber-900/80 border-2 border-amber-600';
                                if (chance < 20) return 'bg-red-900/80 border-2 border-red-600';
                                if (chance < 30) return 'bg-purple-900/80 border-2 border-purple-600';
                                if (chance < 50) return 'bg-blue-900/80 border-2 border-blue-600';
                                return 'bg-green-900/80 border-2 border-green-600';
                              } catch {
                                return 'bg-blue-900/80 border-2 border-blue-600';
                              }
                            })()
                        }`
                      }
                      style={!isAnimating && isWinningCard ? {
                        opacity: 0.9,
                        transform: "scale(1.1)",
                        boxShadow: '0 0 15px rgba(255, 165, 0, 0.8)',
                        zIndex: 10
                      } : !isAnimating ? {
                        opacity: 0.4,
                        zIndex: 1
                      } : {}}
                    >
                      <div className="w-22 h-22 rounded-md overflow-hidden bg-gray-700 flex items-center justify-center mb-1">
                        {card.id > 0 ? (
                          <img
                            src={card.image || ''}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiMzMzMiIHJ4PSI4IiByeT0iOCIgLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjNDQ0IiByeD0iNCIgcnk9IjQiIHN0cm9rZT0iIzU1NSIgc3Ryb2tlLXdpZHRoPSIxIiAvPjxnIGZpbGw9IiM2NjYiPjxyZWN0IHg9IjIwIiB5PSIyMCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjEwIiByeD0iMiIgcnk9IjIiIC8+PHJlY3QgeD0iMjAiIHk9IjQwIiB3aWR0aD0iODAiIGhlaWdodD0iOCIgcng9IjIiIHJ5PSIyIiAvPjxyZWN0IHg9IjIwIiB5PSI2MCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjgiIHJ4PSIyIiByeT0iMiIgLz48cmVjdCB4PSIyMCIgeT0iODAiIHdpZHRoPSI2MCIgaGVpZ2h0PSI4IiByeD0iMiIgcnk9IjIiIC8+PC9nPjwvc3ZnPg=="
                            }}
                          />
                        ) : (
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="24" height="24" rx="12" fill="#047857" opacity="0.1"/>
                            <path d="M4 4V18H20" stroke="#047857" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <rect x="6" y="14" width="2" height="2" rx="0.5" fill="#10B981"/>
                            <rect x="10" y="12" width="2" height="4" rx="0.5" fill="#10B981"/>
                            <rect x="14" y="9" width="2" height="7" rx="0.5" fill="#10B981"/>
                            <rect x="18" y="5" width="2" height="11" rx="0.5" fill="#10B981"/>
                            <path d="M5 15C6.5 13.5 8 12.5 10 11C12 9.5 14 7 18 4.5"
                                  stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M18 4.5L16 8" stroke="#047857" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M18 4.5L14.5 5.5" stroke="#047857" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className={`text-xs font-bold text-center text-white w-full ${card.id === 0 ? 'whitespace-normal h-10 flex items-center justify-center' : 'truncate'}`}>
                        {card.id === 0
                          ? "Progress is also a reward!"
                          : (card.name.length > 15 ? `${card.name.substring(0, 15)}...` : card.name)
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {!isAnimating && (
            <>
              <div className="my-4 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  {selectedReward.id > 0 ? (
                    <p className="text-green-400 font-medium text-lg">
                      You won a <span className="font-bold">{selectedReward.name}</span>!
                    </p>
                  ) : (
                    <p className="text-amber-400 font-medium text-lg">
                      Keep building habits - progress itself is a valuable reward!
                    </p>
                  )}
                </motion.div>
              </div>

              <div className="flex justify-center gap-2 pt-4">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="mx-auto"
                >
                  <Button
                    onClick={handleClaimReward}
                    className={`rounded-md font-bold ${
                      selectedReward.id > 0
                        ? "bg-green-600 hover:bg-green-700 text-white px-8 py-2"
                        : "bg-amber-600 hover:bg-amber-700 text-white"
                    }`}
                  >
                    {selectedReward.id > 0 ? "Claim Reward" : "Continue"}
                  </Button>
                </motion.div>
              </div>
            </>
          )}
        </motion.div>
      </DialogContentNoClose>
    </Dialog>
  );
}
