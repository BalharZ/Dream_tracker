import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { Plus, Loader2, Trash2, ImageIcon } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { useState } from "react";
import { ImageGallery } from "@/components/images/image-gallery";

type Dream = {
  id: number;
  user_id: string;
  name: string;
  image: string;
  positive_motivation: string | null;
  negative_motivation: string | null;
  progress: number;
  created_at: string;
};

export default function DreamsPage() {
  const [open, setOpen] = useState(false);
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null);
  const { data: dreams, isLoading } = useQuery({
    queryKey: ["dreams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dreams").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Dream[];
    },
  });

  const deleteDream = useMutation({
    mutationFn: async (dreamId: number) => {
      const { error } = await supabase.from("dreams").delete().eq("id", dreamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dreams"] });
      setOpen(false);
      setSelectedDream(null);
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dreams</h1>
          <p className="text-muted-foreground">
            Define your life dreams and track your progress
          </p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelectedDream(null); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Dream
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedDream ? "Edit Dream" : "Add New Dream"}</DialogTitle>
            </DialogHeader>
            <AddDreamForm
              dream={selectedDream}
              onSuccess={() => {
                setOpen(false);
                setSelectedDream(null);
              }}
              onDelete={selectedDream ? () => deleteDream.mutate(selectedDream.id) : undefined}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {dreams?.map((dream) => (
          <DreamCard
            key={dream.id}
            dream={dream}
            onClick={() => {
              setSelectedDream(dream);
              setOpen(true);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DreamCard({ dream, onClick }: { dream: Dream; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={onClick}>
      <CardContent className="pt-6">
        <div
          className="w-full h-32 rounded-lg bg-cover bg-center"
          style={{ backgroundImage: `url(${dream.image})` }}
        />

        <h3 className="text-xl font-semibold mb-2 mt-4">{dream.name}</h3>

        {dream.positive_motivation && (
          <p className="text-sm text-green-600 dark:text-green-400 mb-2">
            ✨ {dream.positive_motivation}
          </p>
        )}

        {dream.negative_motivation && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            ⚠️ {dream.negative_motivation}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(dream.progress)}%</span>
          </div>
          <Progress value={dream.progress} />
        </div>
      </CardContent>
    </Card>
  );
}

function AddDreamForm({ dream, onSuccess, onDelete }: { dream?: Dream | null; onSuccess: () => void; onDelete?: () => void }) {
  const { user } = useAuth();
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const form = useForm({
    defaultValues: {
      name: dream?.name || "",
      image: dream?.image || "",
      positive_motivation: dream?.positive_motivation || "",
      negative_motivation: dream?.negative_motivation || "",
    },
  });

  const createDream = useMutation({
    mutationFn: async (values: any) => {
      if (dream) {
        const { error } = await supabase.from("dreams").update(values).eq("id", dream.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dreams").insert({ ...values, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dreams"] });
      form.reset();
      onSuccess();
    },
  });

  const handleImageSelect = (imageUrl: string) => {
    form.setValue("image", imageUrl);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => {
          createDream.mutate(data);
          return undefined;
        })}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dream Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter your dream" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dream Image</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    placeholder="Enter an image URL or select from gallery"
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsGalleryOpen(true)}
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </div>
              <FormDescription>
                Select an image that represents your dream
              </FormDescription>

              {field.value && (
                <div className="mt-2">
                  <div
                    className="relative w-full h-40 rounded-md overflow-hidden border"
                    style={{ backgroundImage: `url(${field.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  />
                </div>
              )}

              <ImageGallery
                isOpen={isGalleryOpen}
                setIsOpen={setIsGalleryOpen}
                onSelect={handleImageSelect}
              />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="positive_motivation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Positive Motivation</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What will you gain by achieving this dream?"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="negative_motivation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Negative Motivation</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="What will you lose by not achieving this dream?"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button
            type="submit"
            className="flex-1"
            disabled={createDream.isPending}
          >
            {createDream.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {dream ? "Update Dream" : "Create Dream"}
          </Button>

          {onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
