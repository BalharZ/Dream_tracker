import { useEffect, useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import type { Habit, Reward } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getChance, parseHabitChances, weeklyChanceKey } from "@/lib/habit-chances";
import { frequencyLabel, habitFrequency } from "@/lib/frequency";

/**
 * S56: pick which rewards the weekly roulette of a N× per week habit can
 * give, and their win chances. Stored next to the daily chances in
 * rewards.habit_chances under the key "w<habitId>"; saved straight away so it
 * works both from the habit form and from the "Week complete" prompt.
 */
export function WeeklyRewardsDialog({
  open,
  onOpenChange,
  habit,
  rewards,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit;
  rewards: Reward[];
}) {
  const { toast } = useToast();
  const key = weeklyChanceKey(habit.id);
  const [chances, setChances] = useState<Record<number, number | "">>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<number, number | ""> = {};
    rewards.forEach((r) => {
      const entry = parseHabitChances(r.habit_chances)[key];
      if (entry !== undefined) init[r.id] = getChance(entry);
    });
    setChances(init);
  }, [open, rewards, key]);

  const selectedIds = Object.keys(chances).map(Number);
  const total = selectedIds.reduce((a, id) => a + (Number(chances[id]) || 0), 0);

  const toggle = (id: number) =>
    setChances((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = 30;
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      for (const r of rewards) {
        const current = parseHabitChances(r.habit_chances);
        const had = current[key] !== undefined;
        const want = r.id in chances;
        const chance = Math.min(100, Math.max(1, Number(chances[r.id]) || 1));
        if (!had && !want) continue;
        if (had && want && getChance(current[key]) === chance) continue;
        if (want) current[key] = chance;
        else delete current[key];
        const { error } = await supabase
          .from("rewards")
          .update({ habit_chances: JSON.stringify(current) })
          .eq("id", r.id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({ title: "Weekly rewards saved" });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Saving failed", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const freq = habitFrequency(habit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Weekly rewards · {habit.name}</DialogTitle>
          <DialogDescription>
            Spin an extra roulette when you complete the whole week
            {freq.kind === "weekly" ? ` (${frequencyLabel(freq)})` : ""}. The daily roulette keeps working as before.
          </DialogDescription>
        </DialogHeader>

        {rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a reward on the Rewards page first.</p>
        ) : (
          <ul className="space-y-2">
            {rewards.map((r) => {
              const on = r.id in chances;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={on} onChange={() => toggle(r.id)} />
                    {r.image ? (
                      <img src={r.image} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
                    ) : (
                      <Gift className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm font-medium">{r.name}</span>
                  </label>
                  {on && (
                    <div className="flex items-center gap-1">
                      <NumberStepper
                        min={1}
                        max={100}
                        value={chances[r.id]}
                        onChange={(v) => setChances((prev) => ({ ...prev, [r.id]: v === "" ? "" : Number(v) }))}
                        className="w-32"
                        aria-label={`${r.name} weekly chance`}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {selectedIds.length > 0 && (
          <p className={total > 100 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            Total chance {total} %{total > 100 ? " — keep it at 100 % or less" : ` · ${100 - total} % “progress is a reward”`}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || total > 100}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
