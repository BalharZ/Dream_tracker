import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Habit, HabitSubitem, Goal, Reward } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Check, ChevronRight, StickyNote, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { HabitForm } from "@/components/habits/habit-form";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RewardRoulette } from "@/components/habits/reward-roulette";
import { recomputeProgress } from "@/lib/progress";
import { applySnowballGrowth } from "@/lib/snowball";
import { buildUnits, countDoneUnits, isUnitDone, escalationDue, snoozeEscalation } from "@/lib/habit-clusters";

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

  // Lazily apply due snowball increases whenever habits load. A successful
  // write invalidates the query; the refetched habits have nothing due, so
  // this cannot loop.
  useEffect(() => {
    if (!habits || habits.length === 0) return;
    applySnowballGrowth(habits)
      .then((changed) => {
        if (changed) queryClient.invalidateQueries({ queryKey: ["habits"] });
      })
      .catch((error) => console.error("Error applying snowball growth:", error));
  }, [habits]);

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

      await recomputeProgress(user!.id);
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
    <div className="space-y-8 overflow-x-hidden">
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

      <Card className="overflow-hidden">
        <CardContent className="p-0 sm:p-6">
          <div className="flex items-center justify-between mb-4 px-4 pt-4 sm:px-0 sm:pt-0">
            <h2 className="text-lg font-semibold">History</h2>
          </div>

          <div className="relative">
            {/* Horizontally scrollable grid */}
            <div className="flex overflow-x-auto">
              {/* Habit + Target columns */}
              <div className="flex-shrink-0 border-r">
                {/* Header row */}
                <div className="flex border-b">
                  <div className="w-28 sm:w-48 px-3 py-3 text-sm font-medium text-muted-foreground">Habit</div>
                  <div className="w-14 sm:w-20 px-2 py-3 text-sm font-medium text-muted-foreground text-center">Target</div>
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
                    <div className="w-28 sm:w-48 px-3 py-3 flex items-center gap-1 min-w-0">
                      <Button
                        variant="link"
                        className="h-auto p-0 text-left min-w-0"
                        style={{ color: habit.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHabitToEdit(habit);
                        }}
                      >
                        <div className="font-bold text-sm leading-tight truncate">{habit.name}</div>
                      </Button>
                      {habit.notes && (
                        <span
                          title={habit.notes}
                          aria-label="Habit notes"
                          className="flex-shrink-0 text-muted-foreground"
                        >
                          <StickyNote className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="w-14 sm:w-20 px-2 py-3 flex flex-col items-center justify-center" style={{ color: habit.color }}>
                      <span className="text-base font-bold leading-tight flex items-center gap-0.5">
                        {habit.target_value}
                        {habit.habit_type === "snowball" && (
                          <TrendingUp
                            className="h-3 w-3"
                            aria-label="Snowball habit"
                          />
                        )}
                      </span>
                      <span className="text-[10px] leading-tight">{habit.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scrollable right: Date columns */}
              <div className="flex-shrink-0">
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

          <div className="flex justify-end mt-4 px-4 pb-4 sm:px-0 sm:pb-0">
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
          onEditHabit={() => {
            setEditProgressDialogOpen(false);
            setHabitToEdit(selectedHabit);
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
  onEditHabit,
}: {
  isOpen: boolean;
  onClose: () => void;
  habit: Habit;
  date: Date;
  initialValue: number;
  onSave: (value: number) => void;
  onEditHabit?: () => void;
}) {
  const [value, setValue] = useState<number | string>(initialValue > 0 ? initialValue : '');
  const dateStr = format(date, "yyyy-MM-dd");

  useEffect(() => {
    if (initialValue > 0) {
      setValue(initialValue);
    } else {
      setValue('');
    }
  }, [initialValue, isOpen]);

  // Sub-exercises of this habit; when present they replace the single value
  // input and the day's habit value becomes the number of completed ones.
  const { data: subitems } = useQuery({
    queryKey: ["habit_subitems", habit.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_subitems")
        .select("*")
        .eq("habit_id", habit.id)
        .order("position", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return data as HabitSubitem[];
    },
    enabled: isOpen,
  });

  const { data: subitemDayValues } = useQuery({
    queryKey: ["habit_subitem_progress", habit.id, dateStr],
    queryFn: async () => {
      const ids = (subitems || []).map((s) => s.id);
      const { data, error } = await supabase
        .from("habit_subitem_progress")
        .select("subitem_id, value")
        .eq("date", dateStr)
        .in("subitem_id", ids);
      if (error) throw error;
      const map: Record<number, number> = {};
      (data || []).forEach((p) => {
        map[p.subitem_id] = p.value;
      });
      return map;
    },
    enabled: isOpen && !!subitems && subitems.length > 0,
  });

  const [subValues, setSubValues] = useState<Record<number, number | string>>({});
  useEffect(() => {
    setSubValues(subitemDayValues || {});
  }, [subitemDayValues, isOpen, dateStr]);

  const hasSubitems = !!subitems && subitems.length > 0;
  const subNumeric = (id: number) => {
    const v = subValues[id];
    return typeof v === "string" ? Number(v) || 0 : v || 0;
  };
  // Units: standalone sub-exercises (AND) + OR clusters, each counting as 1.
  const units = buildUnits(subitems || []);
  const doneCount = countDoneUnits(units, subNumeric);

  // Escalation offer (hidden locally after snoozing — the habit prop is stale
  // until the habits query refetches).
  const [escalationSnoozed, setEscalationSnoozed] = useState(false);
  useEffect(() => {
    setEscalationSnoozed(false);
  }, [habit.id, isOpen]);
  const showEscalation = escalationDue(habit) && !escalationSnoozed;
  const handleSnoozeEscalation = async () => {
    setEscalationSnoozed(true);
    try {
      await snoozeEscalation(habit.id);
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    } catch (error) {
      console.error("Error snoozing escalation:", error);
    }
  };

  const handleSave = async () => {
    if (hasSubitems) {
      const rows = subitems!.map((s) => ({
        subitem_id: s.id,
        user_id: habit.user_id,
        date: dateStr,
        value: subNumeric(s.id),
      }));
      const { error } = await supabase
        .from("habit_subitem_progress")
        .upsert(rows, { onConflict: "subitem_id,user_id,date" });
      if (error) console.error("Error saving sub-exercise progress:", error);
      queryClient.invalidateQueries({ queryKey: ["habit_subitem_progress"] });
      onSave(doneCount);
    } else {
      onSave(typeof value === "string" ? 0 : value);
    }
  };

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
              Target: {hasSubitems
                ? `${units.length} item${units.length === 1 ? "" : "s"}`
                : `${habit.target_value} ${habit.unit}`}
            </span>
          </div>

          {habit.habit_type === "snowball" && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Snowball: +{habit.step_value ?? 0} every {habit.interval_days ?? 0} days
            </p>
          )}

          {habit.notes && (
            <p className="text-sm text-muted-foreground whitespace-pre-line border rounded-md p-2 bg-muted/50">
              {habit.notes}
            </p>
          )}

          {showEscalation && (
            <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-2">
              <p className="text-sm">
                Time to escalate <span className="font-medium">{habit.name}</span> —
                consider adding a sub-exercise or tightening an OR group.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleSnoozeEscalation}>
                  Later
                </Button>
                {onEditHabit && (
                  <Button size="sm" onClick={onEditHabit}>
                    Escalate (edit habit)
                  </Button>
                )}
              </div>
            </div>
          )}

          {hasSubitems ? (
            <div className="space-y-2">
              {units.map((unit) => {
                const renderRow = (s: HabitSubitem) => {
                  const done = subNumeric(s.id) >= (s.target || 1);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Target: {s.target} {s.unit}
                        </div>
                      </div>
                      {(s.target || 1) > 1 && (
                        <NumberStepper
                          min={0}
                          value={subValues[s.id] ?? 0}
                          onChange={(v) =>
                            setSubValues((prev) => ({ ...prev, [s.id]: v }))
                          }
                          className="w-32 shrink-0"
                          inputClassName="h-9"
                          buttonClassName="h-9 w-9"
                          aria-label={`${s.name} value`}
                        />
                      )}
                      <Button
                        size="icon"
                        variant={done ? "default" : "outline"}
                        className="shrink-0"
                        style={done ? { backgroundColor: habit.color } : undefined}
                        onClick={() =>
                          setSubValues((prev) => ({
                            ...prev,
                            [s.id]: done ? 0 : s.target || 1,
                          }))
                        }
                        aria-label={`Toggle ${s.name} done`}
                        title={done ? "Mark as not done" : "Mark as done"}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                };

                if (unit.kind === "single") return renderRow(unit.subitem);

                const orDone = isUnitDone(unit, subNumeric);
                return (
                  <div
                    key={`or-${unit.group}`}
                    className={`space-y-2 rounded-md border border-dashed p-2 ${
                      orDone ? "border-green-500" : ""
                    }`}
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      OR group — complete any one{orDone ? " ✓" : ""}
                    </p>
                    {unit.members.map(renderRow)}
                  </div>
                );
              })}
              <p className="text-sm text-muted-foreground">
                Completed: {doneCount} / {units.length} item{units.length === 1 ? "" : "s"}
              </p>
            </div>
          ) : (
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
                    handleSave();
                  }
                }}
              />
              <span className="text-lg">{habit.unit}</span>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
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
