import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { recomputeProgress } from "@/lib/progress";
import { Progress } from "@/components/ui/progress";
import { Plus, Loader2, ChevronRight, Trash2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { useState, useEffect } from "react";

type Dream = { id: number; name: string; image: string; progress: number };
type Goal = {
  id: number; dream_id: number; parent_goal_id: number | null;
  name: string; image: string; progress: number; final_count: number; unit: string;
};

function GoalCard({ goal, dream, subgoals, onEdit, onDelete }: {
  goal: Goal; dream?: Dream; subgoals: Goal[];
  onEdit: (goal: Goal) => void; onDelete: (goal: Goal) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold hover:text-primary cursor-pointer" onClick={() => onEdit(goal)}>
            {goal.name}
          </h3>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(goal); }}
            className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {dream && (
          <div className="flex items-center text-sm text-muted-foreground mb-4 cursor-pointer" onClick={() => onEdit(goal)}>
            <ChevronRight className="h-4 w-4 mx-1" />
            <span className="font-medium">{dream.name}</span>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span><span>{Math.round(goal.progress)}%</span>
          </div>
          <Progress value={goal.progress} />
        </div>
        {goal.final_count > 0 && (
          <div className="mt-3 text-sm text-muted-foreground flex justify-between">
            <span>Target: {goal.final_count} {goal.unit}</span>
          </div>
        )}
        {subgoals.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium">Subgoals ({subgoals.length}):</h4>
            {subgoals.map((subgoal) => (
              <div key={subgoal.id} className="text-sm flex flex-col" onClick={(e) => { e.stopPropagation(); onEdit(subgoal); }}>
                <div className="flex items-center mb-1">
                  <ChevronRight className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="hover:text-primary">{subgoal.name}</span>
                </div>
                <div className="flex justify-between pl-4">
                  <span>Target: {subgoal.final_count} {subgoal.unit}</span>
                  <span>Progress: {Math.round(subgoal.progress)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GoalsPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const { toast } = useToast();

  const { data: dreams } = useQuery({
    queryKey: ["dreams", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("dreams").select("id, name, image, progress").eq("user_id", user!.id);
      if (error) throw error;
      return data as Dream[];
    },
    enabled: !!user,
  });

  const { data: goals, isLoading } = useQuery({
    queryKey: ["goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Goal[];
    },
    enabled: !!user,
  });

  const goalsByParent = goals?.reduce((acc, goal) => {
    const parentId = goal.parent_goal_id || 'root';
    acc[parentId] = acc[parentId] || [];
    acc[parentId].push(goal);
    return acc;
  }, {} as Record<string | number, Goal[]>) || {};

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);

  const showDeleteConfirmation = (goal: Goal) => { setGoalToDelete(goal); setDeleteDialogOpen(true); };

  const deleteGoal = useMutation({
    mutationFn: async ({ goalId }: { goalId: number; keepProgress: boolean }) => {
      const { error } = await supabase.from("goals").delete().eq("id", goalId);
      if (error) throw error;
      await recomputeProgress(user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dreams"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      setDeleteDialogOpen(false);
      setGoalToDelete(null);
      toast({ title: "Goal deleted", description: "The goal has been successfully deleted." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-8">
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
            <DialogDescription>Are you sure you want to delete this goal?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex sm:justify-between gap-4 mt-4">
            <Button variant="destructive" onClick={() => { if (goalToDelete) deleteGoal.mutate({ goalId: goalToDelete.id, keepProgress: false }); }}
              disabled={deleteGoal.isPending}>
              {deleteGoal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Goal
            </Button>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Goals</h1>
          <p className="text-muted-foreground">Break down your dreams into achievable goals</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) setSelectedGoal(null); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setSelectedGoal(null)}><Plus className="h-4 w-4 mr-2" />Add Goal</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{selectedGoal ? "Edit Goal" : "Add New Goal"}</DialogTitle></DialogHeader>
            <AddGoalForm dreams={dreams || []} goals={goals || []} goal={selectedGoal}
              onSuccess={() => { setOpen(false); setSelectedGoal(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {goalsByParent['root']?.map((goal) => (
          <GoalCard key={goal.id} goal={goal} subgoals={(goalsByParent[goal.id] || []).slice().sort((a, b) => a.id - b.id)}
            dream={dreams?.find((d) => d.id === goal.dream_id)}
            onEdit={(g) => { setSelectedGoal(g); setOpen(true); }} onDelete={showDeleteConfirmation} />
        ))}
      </div>
    </div>
  );
}

function AddGoalForm({ dreams, goals, goal, onSuccess }: {
  dreams: Dream[]; goals: Goal[]; goal?: Goal | null; onSuccess: () => void;
}) {
  const { user } = useAuth();
  // Subgoals inherit the unit from the parent goal, so no per-subgoal unit state.
  const [subgoals, setSubgoals] = useState<{ name: string; final_count: number | string; id?: number }[]>([]);

  useEffect(() => {
    if (goal) {
      const existing = goals
        .filter(g => g.parent_goal_id === goal.id)
        .sort((a, b) => a.id - b.id)
        .map(g => ({ name: g.name, final_count: g.final_count, id: g.id }));
      setSubgoals(existing);
    }
  }, [goal, goals]);

  const form = useForm({
    defaultValues: {
      name: goal?.name || "",
      dream_id: goal?.dream_id || (dreams[0]?.id || 0),
      image: goal?.image || "placeholder.jpg",
      final_count: (goal?.final_count ?? 100) as number | string,
      unit: goal?.unit || "",
    },
  });

  const hasSubgoals = subgoals.length > 0;
  const subgoalSum = subgoals.reduce((acc, sg) => acc + (parseFloat(String(sg.final_count)) || 0), 0);

  const createGoal = useMutation({
    mutationFn: async (values: any) => {
      const finalCount = hasSubgoals ? subgoalSum : (parseFloat(String(values.final_count)) || 0);

      let goalId: number;
      if (goal) {
        const { error } = await supabase.from("goals").update({
          name: values.name, dream_id: values.dream_id, image: values.image,
          final_count: finalCount, unit: values.unit,
        }).eq("id", goal.id);
        if (error) throw error;
        goalId = goal.id;
      } else {
        const { data, error } = await supabase.from("goals").insert({
          user_id: user!.id, name: values.name, dream_id: values.dream_id, image: values.image || "placeholder.jpg",
          final_count: finalCount, unit: values.unit,
        }).select().single();
        if (error) throw error;
        goalId = data.id;
      }

      // Sync subgoals for both create and edit: update existing by id, insert new, delete removed.
      const existingIds = goal ? goals.filter(g => g.parent_goal_id === goal.id).map(g => g.id) : [];
      const keptIds = subgoals.filter(sg => sg.id).map(sg => sg.id as number);
      const deletedIds = existingIds.filter(id => !keptIds.includes(id));

      for (const delId of deletedIds) {
        const { error } = await supabase.from("goals").delete().eq("id", delId);
        if (error) throw error;
      }

      for (const sg of subgoals) {
        if (!sg.name) continue;
        const sgFinal = parseFloat(String(sg.final_count)) || 0;
        if (sg.id) {
          const { error } = await supabase.from("goals").update({
            name: sg.name, dream_id: values.dream_id, final_count: sgFinal, unit: values.unit,
          }).eq("id", sg.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("goals").insert({
            user_id: user!.id, name: sg.name, dream_id: values.dream_id, parent_goal_id: goalId,
            image: "placeholder.jpg", final_count: sgFinal, unit: values.unit,
          });
          if (error) throw error;
        }
      }

      // Final counts / subgoal structure changed -> recompute the cascade.
      await recomputeProgress(user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["dreams"] });
      form.reset();
      setSubgoals([]);
      onSuccess();
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => createGoal.mutate(data))} className="space-y-4">
        <FormField control={form.control} name="dream_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Related Dream</FormLabel>
            <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select a dream" /></SelectTrigger></FormControl>
              <SelectContent>
                {dreams.map((d) => (<SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </FormItem>
        )} />

        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Goal Name</FormLabel><FormControl><Input placeholder="Enter your goal" {...field} /></FormControl></FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          {hasSubgoals ? (
            <FormItem>
              <FormLabel>Final Count (100%)</FormLabel>
              <FormControl>
                <Input type="number" value={subgoalSum} disabled readOnly />
              </FormControl>
              <p className="text-xs text-muted-foreground">Auto-summed from subgoals</p>
            </FormItem>
          ) : (
            <FormField control={form.control} name="final_count" render={({ field }) => (
              <FormItem><FormLabel>Final Count (100%)</FormLabel><FormControl>
                <Input type="number" min="1" placeholder="e.g. 100" {...field}
                  onChange={(e) => field.onChange(e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))} />
              </FormControl></FormItem>
            )} />
          )}
          <FormField control={form.control} name="unit" render={({ field }) => (
            <FormItem><FormLabel>Unit</FormLabel><FormControl><Input placeholder="e.g. kg, books, days" {...field} /></FormControl></FormItem>
          )} />
        </div>

        <div className="border rounded-md p-4 space-y-1 mt-4">
          <h3 className="text-sm font-medium mb-2">Subgoals</h3>
          {subgoals.map((sg, i) => (
            <div key={sg.id ?? `new-${i}`} className="grid grid-cols-12 gap-2 py-2 border-t items-center">
              <div className="col-span-5"><Input placeholder="Subgoal name" value={sg.name} onChange={(e) => { const n = [...subgoals]; n[i] = { ...n[i], name: e.target.value }; setSubgoals(n); }} /></div>
              <div className="col-span-3"><Input type="number" min="1" placeholder="Count" value={sg.final_count} onChange={(e) => { const n = [...subgoals]; n[i] = { ...n[i], final_count: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0) }; setSubgoals(n); }} /></div>
              <div className="col-span-3 flex items-center px-1 text-sm text-muted-foreground truncate" title="Unit is inherited from the goal">{form.watch("unit") || "—"}</div>
              <div className="col-span-1 text-center"><Button type="button" variant="ghost" size="icon" onClick={() => { const n = [...subgoals]; n.splice(i, 1); setSubgoals(n); }} className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button></div>
            </div>
          ))}
          {subgoals.length === 0 && <div className="text-sm text-muted-foreground py-2">No subgoals added yet.</div>}
          {hasSubgoals && (
            <div className="flex justify-between items-center pt-3 mt-1 border-t text-sm font-medium">
              <span>Total (final count)</span>
              <span>{subgoalSum} {form.watch("unit")}</span>
            </div>
          )}
          <div className="pt-3">
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setSubgoals([...subgoals, { name: "", final_count: 100 }])}>
              <Plus className="h-4 w-4 mr-2" />Add Subgoal
            </Button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={createGoal.isPending}>
          {createGoal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {goal ? "Update Goal" : "Create Goal"}
        </Button>
      </form>
    </Form>
  );
}
