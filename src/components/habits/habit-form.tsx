import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Habit, HabitSubitem, Goal, Reward } from "@shared/schema";
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
import { Bell, Edit, Gift, Loader2, PlusCircle, X, Image as ImageIcon } from "lucide-react";
import { ImageGallery } from "@/components/images/image-gallery";
import { conversionFactor, isTimeUnit, sameTimeUnit, timeAltUnit } from "@/lib/units";
import { getChance, getQuantity, makeChanceEntry, parseHabitChances } from "@/lib/habit-chances";
import { increaseSnowballNow } from "@/lib/snowball";
import { escalationDue, snoozeEscalation } from "@/lib/habit-clusters";
import { ensurePushSubscription } from "@/lib/push";
import {
  isNativeApp,
  ensureNotificationPermission,
  scheduleHabitReminder,
  cancelHabitReminder,
} from "@/lib/local-notifications";

// Editable sub-exercise row; id is set for rows loaded from the DB.
// or_group: OR cluster number (null = required individually / AND).
type SubitemDraft = {
  id?: number;
  name: string;
  target: number | string;
  or_group: number | null;
};

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
  // How many pieces of the reward one win grants ("" while the field is being
  // cleared/typed; coerced to >= 1 on save).
  const [rewardQuantities, setRewardQuantities] = useState<Record<number, number | "">>({});
  const [showCreateReward, setShowCreateReward] = useState(false);
  const [newRewardName, setNewRewardName] = useState("");
  const [newRewardImage, setNewRewardImage] = useState("");
  const [rewardGalleryOpen, setRewardGalleryOpen] = useState(false);
  const [subitems, setSubitems] = useState<SubitemDraft[]>([]);

  // Existing sub-exercises of the edited habit (synced on save: update by id,
  // insert new, delete removed).
  const { data: existingSubitems } = useQuery({
    queryKey: ["habit_subitems", habit?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_subitems")
        .select("*")
        .eq("habit_id", habit!.id)
        .order("position", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return data as HabitSubitem[];
    },
    enabled: !!habit,
  });

  useEffect(() => {
    if (habit) {
      setSubitems(
        (existingSubitems || []).map((s) => ({
          id: s.id,
          name: s.name,
          target: s.target,
          or_group: s.or_group ?? null,
        }))
      );
    }
  }, [habit, existingSubitems]);

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
      habit_type: habit?.habit_type || "standard",
      base_target: (habit?.base_target ?? 0) as number | string,
      step_value: (habit?.step_value ?? 1) as number | string,
      interval_days: (habit?.interval_days ?? 21) as number | string,
      escalation_days: (habit?.escalation_days ?? 0) as number | string,
      notify: habit?.notify || false,
      // DB `time` is "HH:MM:SS"; <input type="time"> wants "HH:MM".
      notify_time: habit?.notify_time?.slice(0, 5) || "08:00",
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
        habit_type: habit.habit_type || "standard",
        base_target: habit.base_target ?? 0,
        step_value: habit.step_value ?? 1,
        interval_days: habit.interval_days ?? 21,
        escalation_days: habit.escalation_days ?? 0,
        notify: habit.notify || false,
        notify_time: habit.notify_time?.slice(0, 5) || "08:00",
      });

      setDialogOpen(true);

      const habitRewards = rewards.filter(
        r => parseHabitChances(r.habit_chances)[habit.id] !== undefined
      );

      setNoRewards(habitRewards.length === 0);
      setSelectedRewards(habitRewards.map(r => r.id));

      const chances: Record<number, number> = {};
      const quantities: Record<number, number> = {};
      habitRewards.forEach(r => {
        const entry = parseHabitChances(r.habit_chances)[habit.id];
        chances[r.id] = getChance(entry) || 50;
        quantities[r.id] = getQuantity(entry);
      });
      setRewardChances(chances);
      setRewardQuantities(quantities);
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
        habit_type: "standard",
        base_target: 0,
        step_value: 1,
        interval_days: 21,
        escalation_days: 0,
        notify: false,
        notify_time: "08:00",
      });
      setNoRewards(false);
      setSelectedRewards([]);
      setRewardChances({});
      setRewardQuantities({});
      setSubitems([]);
    }
  }, [habit, rewards]);

  const createHabit = useMutation({
    mutationFn: async (values: any) => {
      let newHabit: Habit;

      const isSnow = values.habit_type === "snowball";
      const wasSnow = habit?.habit_type === "snowball";
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const escDays = values.escalation_days > 0 ? values.escalation_days : null;
      // Reminder: when the time or the toggle changes, clear the daily dedup
      // so a time later today still fires.
      const notifyTime = values.notify ? values.notify_time || "08:00" : null;
      const notifyChanged =
        !habit ||
        !!habit.notify !== !!values.notify ||
        (habit.notify_time?.slice(0, 5) ?? null) !== notifyTime;
      const basePayload = {
        name: values.name,
        unit: values.unit,
        goal_id: values.goal_id || null,
        frequency: values.frequency,
        color: values.color,
        image: values.image,
        positive_motivation: values.positive_motivation,
        negative_motivation: values.negative_motivation,
        notes: values.notes?.trim() || null,
        habit_type: isSnow ? "snowball" : "standard",
        base_target: isSnow ? values.base_target : null,
        step_value: isSnow ? values.step_value : null,
        interval_days: isSnow ? values.interval_days : null,
        escalation_days: escDays,
        notify: !!values.notify,
        notify_time: notifyTime,
        ...(notifyChanged ? { last_notified_date: null } : {}),
      };

      // Adding a new sub-exercise while an escalation is due counts as the
      // escalation itself, so the offer interval restarts automatically.
      const addedSubitem = subitems.some((s) => !s.id && s.name.trim());
      const escalationAnchor = !escDays
        ? null
        : !habit || !habit.escalation_days
          ? todayStr // (re)enabled now → start the interval today
          : escalationDue(habit) && addedSubitem
            ? todayStr
            : habit.last_escalation_at;

      if (habit) {
        const { data, error } = await supabase
          .from("habits")
          .update({
            ...basePayload,
            // An existing snowball habit keeps its grown target; switching a
            // standard habit to snowball (re)starts at the base target.
            target_value: isSnow
              ? wasSnow
                ? habit.target_value
                : values.base_target
              : values.target_value,
            last_increase_at: isSnow ? (wasSnow ? habit.last_increase_at : todayStr) : null,
            last_escalation_at: escalationAnchor,
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
            ...basePayload,
            target_value: isSnow ? values.base_target : values.target_value,
            last_increase_at: isSnow ? todayStr : null,
            last_escalation_at: escalationAnchor,
            user_id: user!.id,
          })
          .select()
          .single();
        if (error) throw error;
        newHabit = data as Habit;
      }

      // Sync sub-exercises: update existing rows by id, insert new ones,
      // delete the removed ones.
      const cleaned = subitems
        .map((s, i) => {
          const target = Number(s.target);
          return {
            id: s.id,
            name: s.name.trim(),
            target: Number.isFinite(target) && target > 0 ? target : 1,
            position: i,
            or_group: s.or_group,
          };
        })
        .filter((s) => s.name);
      const keepIds = new Set(cleaned.filter((s) => s.id).map((s) => s.id!));
      const removed = (existingSubitems || []).filter((s) => !keepIds.has(s.id));
      const subitemOps: PromiseLike<unknown>[] = [];
      if (removed.length > 0) {
        subitemOps.push(
          supabase.from("habit_subitems").delete().in("id", removed.map((s) => s.id))
        );
      }
      for (const s of cleaned) {
        if (s.id) {
          subitemOps.push(
            supabase
              .from("habit_subitems")
              .update({
                name: s.name,
                target: s.target,
                position: s.position,
                or_group: s.or_group,
              })
              .eq("id", s.id)
          );
        } else {
          subitemOps.push(
            supabase.from("habit_subitems").insert({
              habit_id: newHabit.id,
              user_id: user!.id,
              name: s.name,
              target: s.target,
              unit: "",
              position: s.position,
              or_group: s.or_group,
            })
          );
        }
      }
      await Promise.all(subitemOps);

      if (!noRewards && selectedRewards.length > 0) {
        for (const rewardId of selectedRewards) {
          const reward = rewards.find(r => r.id === rewardId);
          if (!reward) continue;

          try {
            const currentChances = parseHabitChances(reward.habit_chances);
            const quantity = Math.max(1, Math.round(Number(rewardQuantities[rewardId])) || 1);
            const updatedChances = {
              ...currentChances,
              [newHabit.id]: makeChanceEntry(rewardChances[rewardId] || 50, quantity)
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
      // Native app: (re)schedule or cancel the on-device daily reminder to
      // match the saved habit. No-op in the browser (web push handles it).
      if (newHabit.notify && newHabit.notify_time) {
        scheduleHabitReminder(newHabit);
      } else {
        cancelHabitReminder(newHabit.id);
      }

      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      queryClient.invalidateQueries({ queryKey: ["habit_subitems"] });

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
      if (habit) cancelHabitReminder(habit.id);
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

  // "Later" on a due escalation offer: restart the interval and close the
  // dialog (the habit prop would be stale).
  const snoozeEscalationNow = useMutation({
    mutationFn: async () => snoozeEscalation(habit!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast({
        title: "Escalation snoozed",
        description: `You'll be reminded again in ${habit?.escalation_days} days.`,
      });
      onSuccess();
      setDialogOpen(false);
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Error!",
        description: "Failed to snooze the escalation.",
        variant: "destructive",
      });
    },
  });

  // "Increase earlier" for snowball habits: bump the target right away and
  // restart the interval, then close the dialog (the habit prop would be stale).
  const increaseNow = useMutation({
    mutationFn: async () => increaseSnowballNow(habit!),
    onSuccess: (newTarget) => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast({
        title: "Target increased!",
        description: `New target: ${newTarget} ${habit?.unit || ""}`.trim(),
      });
      onSuccess();
      setDialogOpen(false);
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Error!",
        description: "Failed to increase the target.",
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
              onSubmit={form.handleSubmit((data) => {
                const num = (v: unknown, fallback = 0) =>
                  v === "" || v === null || v === undefined ? fallback : Number(v) || fallback;
                createHabit.mutate({
                  ...data,
                  target_value: num(data.target_value),
                  base_target: num(data.base_target),
                  step_value: num(data.step_value),
                  interval_days: Math.max(1, Math.round(num(data.interval_days, 21)) || 21),
                  escalation_days: Math.max(0, Math.round(num(data.escalation_days, 0)) || 0),
                });
              })}
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

              <FormField
                control={form.control}
                name="habit_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Habit Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="snowball">Snowball (target grows over time)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {form.watch("habit_type") === "snowball" ? (
                  <FormField
                    control={form.control}
                    name="base_target"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Target</FormLabel>
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
                ) : (
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
                )}

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

              {form.watch("habit_type") === "snowball" && (
                <div className="space-y-3 border p-3 rounded-md">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="step_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Increase By (step)</FormLabel>
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
                      name="interval_days"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Every (days)</FormLabel>
                          <FormControl>
                            <NumberStepper
                              min={1}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The target starts at the start target and automatically grows by the
                    step after each interval (e.g. every 21 days).
                  </p>
                  {habit && habit.habit_type === "snowball" && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        Current target:{" "}
                        <span className="font-semibold">
                          {habit.target_value} {habit.unit}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={increaseNow.isPending || !(habit.step_value && habit.step_value > 0)}
                        onClick={() => increaseNow.mutate()}
                      >
                        {increaseNow.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Increase now (+{habit.step_value ?? 0})
                      </Button>
                    </div>
                  )}
                </div>
              )}

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

              <div className="space-y-2 border p-3 rounded-md">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="habit-notify"
                    className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                  >
                    <Bell className="h-4 w-4" />
                    Reminder notification
                  </label>
                  <input
                    type="checkbox"
                    id="habit-notify"
                    className="h-4 w-4"
                    checked={form.watch("notify")}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      form.setValue("notify", checked);
                      if (!checked || !user) return;
                      // Native app: web push doesn't work in the WebView, so
                      // ask for the OS notification permission now (the click is
                      // the gesture the prompt needs). The reminder itself is
                      // scheduled on save, once the habit id + time are known.
                      if (isNativeApp()) {
                        const granted = await ensureNotificationPermission();
                        if (!granted) {
                          toast({
                            title: "Notifications blocked",
                            description:
                              "Allow notifications for Dream Tracker in your phone's app settings to get reminders.",
                            variant: "destructive",
                          });
                        }
                        return;
                      }
                      // Browser: subscribe this browser right away.
                      const result = await ensurePushSubscription(user.id);
                      if (result === "denied") {
                        toast({
                          title: "Notifications blocked",
                          description:
                            "Allow notifications for this site (or enable the reminder on the device where you want it).",
                          variant: "destructive",
                        });
                      } else if (result === "unsupported") {
                        toast({
                          title: "Push not supported here",
                          description:
                            "This browser can't receive push notifications. On iPhone, install the app to the home screen first.",
                          variant: "destructive",
                        });
                      } else if (result === "error") {
                        toast({
                          title: "Subscription failed",
                          description:
                            "Could not register this device for push. The reminder stays on — try again later.",
                          variant: "destructive",
                        });
                      }
                    }}
                  />
                </div>
                {form.watch("notify") && (
                  <FormField
                    control={form.control}
                    name="notify_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remind me at</FormLabel>
                        <FormControl>
                          <Input type="time" className="w-40" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Sends a push notification at the chosen time with your dream's
                  image and your positive &amp; negative motivation.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <FormLabel>Sub-exercises</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSubitems((prev) => [...prev, { name: "", target: 1, or_group: null }])
                    }
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add sub-exercise
                  </Button>
                </div>
                {subitems.length > 0 && (
                  <div className="space-y-2 border p-3 rounded-md">
                    {subitems.map((s, i) => (
                      <div key={s.id ?? `new-${i}`} className="flex items-center gap-2">
                        <Input
                          placeholder="e.g. Push-ups"
                          value={s.name}
                          className="flex-1"
                          onChange={(e) =>
                            setSubitems((prev) =>
                              prev.map((row, idx) =>
                                idx === i ? { ...row, name: e.target.value } : row
                              )
                            )
                          }
                        />
                        <NumberStepper
                          min={0}
                          value={s.target}
                          onChange={(val) =>
                            setSubitems((prev) =>
                              prev.map((row, idx) =>
                                idx === i ? { ...row, target: val } : row
                              )
                            )
                          }
                          className="w-28 shrink-0"
                          inputClassName="h-9"
                          buttonClassName="h-9 w-9"
                          aria-label="Sub-exercise target"
                        />
                        <Select
                          value={s.or_group != null ? String(s.or_group) : "and"}
                          onValueChange={(value) =>
                            setSubitems((prev) =>
                              prev.map((row, idx) =>
                                idx === i
                                  ? { ...row, or_group: value === "and" ? null : parseInt(value) }
                                  : row
                              )
                            )
                          }
                        >
                          <SelectTrigger
                            className="h-9 w-20 shrink-0"
                            aria-label="AND / OR group"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="and">AND</SelectItem>
                            <SelectItem value="1">OR 1</SelectItem>
                            <SelectItem value="2">OR 2</SelectItem>
                            <SelectItem value="3">OR 3</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() =>
                            setSubitems((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          aria-label="Remove sub-exercise"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Sub-exercises are filled one by one when logging a day. AND = required
                      individually; rows sharing the same OR group form a cluster where
                      completing any one of them counts (e.g. 5 push-ups OR 5 squats).
                      The day's habit value becomes the number of completed items
                      (AND rows + OR clusters), so set the target accordingly.
                    </p>
                  </div>
                )}

                <div className="space-y-2 border p-3 rounded-md">
                  <FormField
                    control={form.control}
                    name="escalation_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Offer escalation every (days)</FormLabel>
                        <FormControl>
                          <NumberStepper
                            min={0}
                            value={field.value ?? ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          0 = off. After this many days the app offers to escalate the
                          habit — add a new sub-exercise or tighten an OR group. Adding
                          a sub-exercise restarts the countdown.
                        </p>
                      </FormItem>
                    )}
                  />
                  {habit && escalationDue(habit) && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2">
                      <span className="text-sm">
                        Escalation is due — add a sub-exercise above or tighten an OR
                        group, then save.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={snoozeEscalationNow.isPending}
                        onClick={() => snoozeEscalationNow.mutate()}
                      >
                        {snoozeEscalationNow.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Later
                      </Button>
                    </div>
                  )}
                </div>
              </div>

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
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">Pieces per win:</span>
                                <NumberStepper
                                  min={1}
                                  max={99}
                                  value={rewardQuantities[reward.id] ?? 1}
                                  onChange={(val) => {
                                    if (val === "") {
                                      setRewardQuantities(prev => ({ ...prev, [reward.id]: "" }));
                                      return;
                                    }
                                    const num = Math.round(Number(val));
                                    if (Number.isNaN(num)) return;
                                    setRewardQuantities(prev => ({
                                      ...prev,
                                      [reward.id]: Math.max(1, Math.min(num, 99)),
                                    }));
                                  }}
                                  className="w-32"
                                  inputClassName="h-8"
                                  buttonClassName="h-8 w-8"
                                />
                                <span className="text-xs text-muted-foreground">×</span>
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
