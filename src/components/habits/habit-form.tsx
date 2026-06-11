import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { Habit, Goal, Reward } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumberStepper } from "@/components/ui/number-stepper";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Gift, Loader2, PlusCircle, X, Image as ImageIcon } from "lucide-react";
import { ImageGallery } from "@/components/images/image-gallery";
import { conversionFactor, isTimeUnit, sameTimeUnit, timeAltUnit } from "@/lib/units";

export function HabitForm({
  goals,
  rewards,
  habit,
  onSuccess,
  onDelete,
}: {
  goals: Goal[];
  rewards: Reward[];
  habit: Habit | null;
  onSuccess: () => void;
  onDelete?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showRewardSelector, setShowRewardSelector] = useState(false);
  const [noRewards, setNoRewards] = useState(false);
  const [selectedRewards, setSelectedRewards] = useState<number[]>([]);
  const [rewardChances, setRewardChances] = useState<Record<number, number>>({});
  const [showCreateReward, setShowCreateReward] = useState(false);
  const [newRewardName, setNewRewardName] = useState("");
  const [newRewardImage, setNewRewardImage] = useState("");
  const [rewardGalleryOpen, setRewardGalleryOpen] = useState(false);

  // Distribute ~50% across the selected rewards (evenly) and leave ~50% for
  // the "no reward" outcome. Re-runs whenever rewards are added/removed.
  const distributeChances = (ids: number[]): Record<number, number> => {
    const result: Record<number, number> = {};
    if (ids.length === 0) return result;
    const share = Math.floor(50 / ids.length);
    const remainder = 50 - share * ids.length;
    ids.forEach((id, i) => {
      result[id] = share + (i < remainder ? 1 : 0);
    });
    return result;
  };

  const colorPresets = [
    "#4299E1", "#48BB78", "#F56565", "#ED8936", "#D69E2E",
    "#805AD5", "#D53F8C", "#667EEA", "#000000",
  ];

  const form = useForm({
    defaultValues: {
      name: habit?.name || "",
      unit: habit?.unit || "",
      goal_id: habit?.goal_id ?? undefined as number | undefined,
      frequency: habit?.frequency || "daily",
      color: habit?.color || "#4299E1",
      target_value: habit?.target_value || 0,
      image: habit?.image || null as string | null,
      positive_motivation: habit?.positive_motivation || null as string | null,
      negative_motivation: habit?.negative_motivation || null as string | null,
      notes: habit?.notes || "",
    },
  });

  useEffect(() => {
    if (habit) {
      form.reset({
        name: habit.name,
        unit: habit.unit,
        goal_id: habit.goal_id ?? undefined,
        frequency: habit.frequency,
        color: habit.color,
        target_value: habit.target_value,
        image: habit.image,
        positive_motivation: habit.positive_motivation,
        negative_motivation: habit.negative_motivation,
        notes: habit.notes || "",
      });

      setDialogOpen(true);

      const habitRewards = rewards.filter(r => {
        try {
          const chances = JSON.parse(r.habit_chances || "{}");
          return chances[habit.id] !== undefined;
        } catch {
          return false;
        }
      });

      setNoRewards(habitRewards.length === 0);
      setSelectedRewards(habitRewards.map(r => r.id));

      const chances: Record<number, number> = {};
      habitRewards.forEach(r => {
        try {
          const hc = JSON.parse(r.habit_chances || "{}");
          chances[r.id] = hc[habit.id] || 50;
        } catch {}
      });
      setRewardChances(chances);
    } else {
      form.reset({
        name: "",
        unit: "",
        goal_id: undefined,
        frequency: "daily",
        color: "#4299E1",
        target_value: 0,
        image: null,
        positive_motivation: null,
        negative_motivation: null,
        notes: "",
      });
      setNoRewards(false);
      setSelectedRewards([]);
      setRewardChances({});
    }
  }, [habit, rewards]);

  const createHabit = useMutation({
    mutationFn: async (values: any) => {
      let newHabit: Habit;

      if (habit) {
        const { data, error } = await supabase
          .from("habits")
          .update({
            name: values.name,
            unit: values.unit,
            goal_id: values.goal_id || null,
            frequency: values.frequency,
            color: values.color,
            target_value: values.target_value,
            image: values.image,
            positive_motivation: values.positive_motivation,
            negative_motivation: values.negative_motivation,
            notes: values.notes?.trim() || null,
          })
          .eq("id", habit.id)
          .select()
          .single();
        if (error) throw error;
        newHabit = data as Habit;
      } else {
        const { data, error } = await supabase
          .from("habits")
          .insert({
            name: values.name,
            unit: values.unit,
            goal_id: values.goal_id || null,
            frequency: values.frequency,
            color: values.color,
            target_value: values.target_value,
            image: values.image,
            positive_motivation: values.positive_motivation,
            negative_motivation: values.negative_motivation,
            notes: values.notes?.trim() || null,
            user_id: user!.id,
          })
          .select()
          .single();
        if (error) throw error;
        newHabit = data as Habit;
      }

      if (!noRewards && selectedRewards.length > 0) {
        for (const rewardId of selectedRewards) {
          const reward = rewards.find(r => r.id === rewardId);
          if (!reward) continue;

          try {
            const currentChances = JSON.parse(reward.habit_chances || "{}");
            const updatedChances = {
              ...currentChances,
              [newHabit.id]: rewardChances[rewardId] || 50
            };

            await supabase
              .from("rewards")
              .update({ habit_chances: JSON.stringify(updatedChances) })
              .eq("id", rewardId);
          } catch (error) {
            console.error("Error updating reward:", error);
          }
        }
      } else {
        for (const reward of rewards) {
          try {
            const currentChances = JSON.parse(reward.habit_chances || "{}");
            if (currentChances[newHabit.id] !== undefined) {
              const { [newHabit.id]: _, ...restChances } = currentChances;
              await supabase
                .from("rewards")
                .update({ habit_chances: JSON.stringify(restChances) })
                .eq("id", reward.id);
            }
          } catch (error) {
            console.error("Error removing habit from reward:", error);
          }
        }
      }

      return newHabit;
    },
    onSuccess: (newHabit) => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });

      if (newHabit.goal_id) {
        queryClient.invalidateQueries({ queryKey: ["goals"] });
        queryClient.invalidateQueries({ queryKey: ["dreams"] });
      }

      toast({
        title: `Habit ${habit ? "updated" : "created"}!`,
        description: `Your habit has been ${habit ? "updated" : "created"} successfully.`,
      });
      form.reset();
      onSuccess();
      setDialogOpen(false);
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Error!",
        description: `Failed to ${habit ? "update" : "create"} habit.`,
        variant: "destructive",
      });
    },
  });

  const deleteHabit = useMutation({
    mutationFn: async () => {
      if (!habit) return;

      const { error } = await supabase.from("habits").delete().eq("id", habit.id);
      if (error) throw error;

      for (const reward of rewards) {
        try {
          const currentChances = JSON.parse(reward.habit_chances || "{}");
          if (currentChances[habit.id] !== undefined) {
            const { [habit.id]: _, ...restChances } = currentChances;
            await supabase
              .from("rewards")
              .update({ habit_chances: JSON.stringify(restChances) })
              .eq("id", reward.id);
          }
        } catch (error) {
          console.error("Error removing habit from reward:", error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({
        title: "Habit deleted!",
        description: "Your habit has been deleted successfully.",
      });
      onSuccess();
      setDialogOpen(false);
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Error!",
        description: "Failed to delete habit.",
        variant: "destructive",
      });
    },
  });

  const createInlineReward = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .insert({
          name: newRewardName.trim(),
          image: newRewardImage,
          habit_chances: "{}",
          user_id: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Reward;
    },
    onSuccess: (newReward) => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      const next = [...selectedRewards, newReward.id];
      setSelectedRewards(next);
      setRewardChances(distributeChances(next));
      setNoRewards(false);
      setShowCreateReward(false);
      setNewRewardName("");
      setNewRewardImage("");
      toast({
        title: "Reward created!",
        description: "It was added to this habit.",
      });
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Error!",
        description: "Failed to create reward.",
        variant: "destructive",
      });
    },
  });

  const rootGoals = goals?.filter((goal) => !goal.parent_goal_id && goal.id) || [];
  const subgoals = goals?.filter((goal) => {
    if (!goal.parent_goal_id || !goal.id) return false;
    const parentExists = goals.some(parent => parent.id === goal.parent_goal_id);
    return parentExists;
  }) || [];

  return (
    <>
      <Button
        variant="outline"
        className={`${
          habit ? "bg-transparent border-2 border-primary hover:border-primary" : "bg-primary/10"
        } flex gap-2 items-center`}
        onClick={() => setDialogOpen(true)}
      >
        {habit ? (
          <>
            <Edit size={16} />
            <span>Edit</span>
          </>
        ) : (
          <>
            <PlusCircle size={16} />
            <span>Add Habit</span>
          </>
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{habit ? "Edit Habit" : "Create New Habit"}</DialogTitle>
            <DialogDescription>
              {habit
                ? "Update your habit details below."
                : "Add a new habit to track your progress."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) =>
                createHabit.mutate({
                  ...data,
                  target_value:
                    data.target_value === "" || data.target_value === null
                      ? 0
                      : Number(data.target_value),
                })
              )}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="goal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Goal</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value === "no-goal") {
                          field.onChange(undefined);
                        } else {
                          const goalId = parseInt(value);
                          field.onChange(goalId);
                          // Inherit the unit from the selected goal.
                          const selected = goals?.find((g) => g.id === goalId);
                          if (selected?.unit) form.setValue("unit", selected.unit);
                        }
                      }}
                      value={field.value?.toString() || "no-goal"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a goal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="no-goal">
                          -- No goal (independent habit) --
                        </SelectItem>

                        {rootGoals.map((goal) => (
                          <SelectItem key={goal.id} value={goal.id.toString()}>
                            {goal.name}
                          </SelectItem>
                        ))}
                        {subgoals.map((goal) => {
                          const parentGoal = goals?.find(
                            (g) => g.id === goal.parent_goal_id
                          );
                          return (
                            <SelectItem key={goal.id} value={goal.id.toString()}>
                              {parentGoal?.name} → {goal.name}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Habit Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your habit" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="target_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Value</FormLabel>
                      <FormControl>
                        <NumberStepper
                          min={0}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => {
                    const selectedGoal = goals?.find((g) => g.id === form.watch("goal_id"));
                    const goalUnit = selectedGoal?.unit;
                    // Time-unit goal (hours/minutes): offer a toggle between the
                    // goal's unit and the complementary one instead of free text.
                    if (goalUnit && isTimeUnit(goalUnit)) {
                      const altUnit = timeAltUnit(goalUnit)!;
                      return (
                        <FormItem>
                          <FormLabel>Unit</FormLabel>
                          <div className="flex gap-2">
                            {[goalUnit, altUnit].map((u) => (
                              <Button
                                key={u}
                                type="button"
                                variant={sameTimeUnit(field.value, u) ? "default" : "outline"}
                                className="flex-1"
                                onClick={() => field.onChange(u)}
                              >
                                {u}
                              </Button>
                            ))}
                          </div>
                          {conversionFactor(field.value, goalUnit) !== 1 && (
                            <p className="text-xs text-muted-foreground">
                              Entries are converted to {goalUnit} for goal progress (60 min = 1 h).
                            </p>
                          )}
                        </FormItem>
                      );
                    }
                    return (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. minutes, times" {...field} />
                        </FormControl>
                      </FormItem>
                    );
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {colorPresets.map((color) => (
                            <div
                              key={color}
                              onClick={() => field.onChange(color)}
                              className={`w-8 h-8 rounded-full cursor-pointer border-2 ${
                                field.value === color ? 'border-white shadow-lg' : 'border-transparent'
                              } hover:scale-110 transition-transform`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                        <FormControl>
                          <Input
                            type="color"
                            {...field}
                            className="h-10 w-full"
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional notes about this habit (tips, rules, context...)"
                        rows={3}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <FormLabel>Rewards</FormLabel>
                  {!noRewards && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRewardSelector(true)}
                    >
                      <Gift className="mr-2 h-4 w-4" />
                      Select Rewards
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="no-rewards"
                    checked={noRewards}
                    onChange={(e) => {
                      setNoRewards(e.target.checked);
                      if (e.target.checked) {
                        setSelectedRewards([]);
                        setRewardChances({});
                      }
                    }}
                  />
                  <label htmlFor="no-rewards" className="font-medium cursor-pointer">
                    No rewards for this habit
                  </label>
                </div>

                {!noRewards && selectedRewards.length > 0 && (
                  <div className="space-y-2 border p-3 rounded-md bg-gray-50 dark:bg-gray-800">
                    <h4 className="font-medium text-sm">Selected Rewards ({selectedRewards.length})</h4>

                    <div className="space-y-3">
                      {selectedRewards.map(rewardId => {
                        const reward = rewards.find(r => r.id === rewardId);
                        if (!reward) return null;

                        const chance = rewardChances[reward.id] || 50;

                        let bgColorClass = '';
                        if (chance < 10) bgColorClass = 'bg-amber-100 dark:bg-amber-950/30';
                        else if (chance < 20) bgColorClass = 'bg-red-100 dark:bg-red-950/30';
                        else if (chance < 30) bgColorClass = 'bg-purple-100 dark:bg-purple-950/30';
                        else if (chance < 50) bgColorClass = 'bg-blue-100 dark:bg-blue-950/30';
                        else bgColorClass = 'bg-green-100 dark:bg-green-950/30';

                        return (
                          <div
                            key={reward.id}
                            className={`flex items-center gap-3 p-2 rounded-md ${bgColorClass}`}
                          >
                            <div
                              className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                              style={{
                                backgroundColor: (() => {
                                  const c = rewardChances[reward.id] || 50;
                                  if (c < 10) return '#B45309';
                                  if (c < 20) return '#991B1B';
                                  if (c < 30) return '#5B21B6';
                                  if (c < 50) return '#1E3A8A';
                                  return '#065F46';
                                })()
                              }}
                            >
                              {reward.image ? (
                                <img
                                  src={reward.image}
                                  alt={reward.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgMTJWOEg0VjE5SDEzIiBzdHJva2U9IiM2ODhGRjQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTQgOFY1SDIwVjgiIHN0cm9rZT0iIzY4OEZGNCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMTYgMTdDMTYgMTYuNDQ3NyAxNi40NDc3IDE2IDE3IDE2SDE5QzE5LjU1MjMgMTYgMjAgMTYuNDQ3NyAyMCAxN1YxOUMyMCAxOS41NTIzIDE5LjU1MjMgMjAgMTkgMjBIMTdDMTYuNDQ3NyAyMCAxNiAxOS41NTIzIDE2IDE5VjE3WiIgZmlsbD0iIzY4OEZGNCIvPjxwYXRoIGQ9Ik0xNyAxNUwxNS41IDEzLjVNMTcgMTVMMTguNSAxMy41IiBzdHJva2U9IiM2ODhGRjQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+"
                                  }}
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-blue-500">
                                  <Gift size={14} />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium text-sm truncate">{reward.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">Chance:</span>
                                {(() => {
                                  let otherChances = 0;
                                  for (const id of selectedRewards) {
                                    if (id !== reward.id) otherChances += rewardChances[id] || 0;
                                  }
                                  const maxAllowed = 100 - otherChances;
                                  return (
                                    <NumberStepper
                                      min={1}
                                      max={maxAllowed}
                                      step={5}
                                      value={rewardChances[reward.id] ?? ""}
                                      onChange={(val) => {
                                        if (val === "") {
                                          setRewardChances(prev => ({ ...prev, [reward.id]: 0 }));
                                          return;
                                        }
                                        const num = Math.round(Number(val));
                                        if (Number.isNaN(num)) return;
                                        const finalValue = Math.max(0, Math.min(num, maxAllowed));
                                        setRewardChances(prev => ({ ...prev, [reward.id]: finalValue }));
                                      }}
                                      className="w-32"
                                      inputClassName="h-8"
                                      buttonClassName="h-8 w-8"
                                    />
                                  );
                                })()}
                                <span className="text-xs text-muted-foreground">%</span>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                const next = selectedRewards.filter(id => id !== reward.id);
                                setSelectedRewards(next);
                                setRewardChances(distributeChances(next));
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}

                      {!noRewards && selectedRewards.length > 0 && (
                        <div className="flex items-center gap-3 p-2 rounded-md bg-gray-100 dark:bg-gray-700 mt-4">
                          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-800 border-2 border-gray-600">
                            <div className="h-full w-full flex items-center justify-center text-gray-400">
                              <X size={14} />
                            </div>
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-medium text-sm truncate">No reward</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Chance:</span>
                              <span className="w-12 h-6 text-xs flex items-center font-medium">
                                {(() => {
                                  let totalChance = 0;
                                  for (const id of selectedRewards) {
                                    totalChance += rewardChances[id] || 0;
                                  }
                                  return Math.max(0, 100 - totalChance);
                                })()}
                              </span>
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end items-center mt-6">
                {habit && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this habit?")) {
                        onDelete();
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={createHabit.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {createHabit.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>Save</>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showRewardSelector} onOpenChange={setShowRewardSelector}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Rewards</DialogTitle>
            <DialogDescription>
              Choose rewards to motivate this habit. Each reward has a chance to be won when you complete the habit.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4">
            {showCreateReward ? (
              <div className="space-y-3 border rounded-md p-3">
                <Input
                  placeholder="Reward name"
                  value={newRewardName}
                  onChange={(e) => setNewRewardName(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Image URL or select from gallery"
                    value={newRewardImage}
                    onChange={(e) => setNewRewardImage(e.target.value)}
                  />
                  {newRewardImage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setNewRewardImage("")}
                      title="Clear image"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setRewardGalleryOpen(true)}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
                {newRewardImage && (
                  <div className="w-full h-28 rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                    <img
                      src={newRewardImage}
                      alt="Reward preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCreateReward(false);
                      setNewRewardName("");
                      setNewRewardImage("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newRewardName.trim() || createInlineReward.isPending}
                    onClick={() => createInlineReward.mutate()}
                  >
                    {createInlineReward.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full mb-4"
                onClick={() => setShowCreateReward(true)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Create new reward
              </Button>
            )}
          </div>

          <div className="space-y-4 my-4">
            {rewards.length === 0 ? (
              <div className="text-center p-4 border rounded-md">
                <Gift className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No rewards available. Create rewards first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rewards.map(reward => (
                  <div
                    key={reward.id}
                    className={`flex items-center gap-3 p-2 border rounded-md cursor-pointer ${
                      selectedRewards.includes(reward.id)
                      ? (() => {
                          const chance = rewardChances[reward.id] || 50;
                          if (chance < 10) return 'bg-amber-100 dark:bg-amber-950/30 hover:bg-amber-200 dark:hover:bg-amber-950/50';
                          if (chance < 20) return 'bg-red-100 dark:bg-red-950/30 hover:bg-red-200 dark:hover:bg-red-950/50';
                          if (chance < 30) return 'bg-purple-100 dark:bg-purple-950/30 hover:bg-purple-200 dark:hover:bg-purple-950/50';
                          if (chance < 50) return 'bg-blue-100 dark:bg-blue-950/30 hover:bg-blue-200 dark:hover:bg-blue-950/50';
                          return 'bg-green-100 dark:bg-green-950/30 hover:bg-green-200 dark:hover:bg-green-950/50';
                        })()
                      : 'hover:bg-accent'
                    }`}
                    onClick={() => {
                      const next = selectedRewards.includes(reward.id)
                        ? selectedRewards.filter(id => id !== reward.id)
                        : [...selectedRewards, reward.id];
                      setSelectedRewards(next);
                      setRewardChances(distributeChances(next));
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRewards.includes(reward.id)}
                      onChange={() => {}}
                      className="h-4 w-4"
                    />
                    <div
                      className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                      style={{
                        backgroundColor: (() => {
                          const chance = rewardChances[reward.id] || 50;
                          if (chance < 10) return '#B45309';
                          if (chance < 20) return '#991B1B';
                          if (chance < 30) return '#5B21B6';
                          if (chance < 50) return '#1E3A8A';
                          return '#065F46';
                        })()
                      }}
                    >
                      {reward.image ? (
                        <img
                          src={reward.image}
                          alt={reward.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjAgMTJWOEg0VjE5SDEzIiBzdHJva2U9IiM2ODhGRjQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTQgOFY1SDIwVjgiIHN0cm9rZT0iIzY4OEZGNCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMTYgMTdDMTYgMTYuNDQ3NyAxNi40NDc3IDE2IDE3IDE2SDE5QzE5LjU1MjMgMTYgMjAgMTYuNDQ3NyAyMCAxN1YxOUMyMCAxOS41NTIzIDE5LjU1MjMgMjAgMTkgMjBIMTdDMTYuNDQ3NyAyMCAxNiAxOS41NTIzIDE2IDE5VjE3WiIgZmlsbD0iIzY4OEZGNCIvPjxwYXRoIGQ9Ik0xNyAxNUwxNS41IDEzLjVNMTcgMTVMMTguNSAxMy41IiBzdHJva2U9IiM2ODhGRjQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+"
                          }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-blue-500">
                          <Gift size={14} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{reward.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRewardSelector(false)}
            >
              Done
            </Button>
          </div>

          <ImageGallery
            isOpen={rewardGalleryOpen}
            setIsOpen={setRewardGalleryOpen}
            onSelect={(url) => setNewRewardImage(url)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
