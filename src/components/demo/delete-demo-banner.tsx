import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { hasDemoData, deleteDemoData } from "@/lib/delete-demo-data";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Shows a dismissable banner with a "Delete demo data" button while the
 * user still has demo rows (is_demo = true). Deleting removes only demo
 * dreams/goals/habits/rewards (and their habit_progress); the banner then
 * disappears on its own.
 */
export function DeleteDemoBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: hasDemo } = useQuery({
    queryKey: ["demo-data", user?.id],
    queryFn: () => hasDemoData(user!.id),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDemoData(user!.id),
    onSuccess: () => {
      for (const key of [
        "dreams",
        "goals",
        "habits",
        "rewards",
        "stash",
        "habit_progress_today",
        "demo-data",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast({
        title: "Demo data deleted",
        description: "All sample dreams, goals, habits and rewards are gone.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete demo data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!hasDemo) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border bg-muted/50 p-4">
      <Sparkles className="h-5 w-5 text-primary shrink-0 hidden sm:block" />
      <div className="flex-1">
        <p className="font-medium">You're looking at sample data</p>
        <p className="text-sm text-muted-foreground">
          Explore how dreams, goals, habits and rewards work — then delete the
          demo and start with your own.
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="shrink-0"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete demo data
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes only the sample dreams, goals, habits and rewards
              that came with your account. Anything you created yourself stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()}>
              Delete demo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
