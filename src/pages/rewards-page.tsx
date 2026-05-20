import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Reward } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Loader2, Pencil, Trash2, Library } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const presetRewards: Record<string, { name: string; image: string }[]> = {
  "Free Rewards": [
    { name: "Virtual Badge", image: "https://images.unsplash.com/photo-1578269174936-2709b6aeb913?q=80&w=1771&auto=format&fit=crop" },
    { name: "Extra Leisure Time", image: "https://images.unsplash.com/photo-1520206183501-b80df61043c9?q=80&w=1771&auto=format&fit=crop" },
    { name: "Personalized Quote", image: "https://images.unsplash.com/photo-1512064444593-978d55e3cc51?q=80&w=1780&auto=format&fit=crop" },
    { name: "Social Media Shoutout", image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?q=80&w=1774&auto=format&fit=crop" },
    { name: "Exclusive Content Access", image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1770&auto=format&fit=crop" },
    { name: "Dream Journal Template", image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=1887&auto=format&fit=crop" },
    { name: "Virtual High-Five", image: "https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?q=80&w=1774&auto=format&fit=crop" },
    { name: "Custom Playlist", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=2070&auto=format&fit=crop" },
    { name: "Virtual Pet Customization", image: "https://images.unsplash.com/photo-1450778869180-41d0601e046e?q=80&w=1950&auto=format&fit=crop" },
    { name: "Meditation Session", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1731&auto=format&fit=crop" },
  ],
  "Food & Drink": [
    { name: "Ice Cream or Frozen Yogurt", image: "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?q=80&w=1770&auto=format&fit=crop" },
    { name: "Coffee or Specialty Drink", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1770&auto=format&fit=crop" },
    { name: "Pizza or Burger", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1770&auto=format&fit=crop" },
    { name: "Healthy Smoothie", image: "https://images.unsplash.com/photo-1502741126161-b048400d085d?q=80&w=1769&auto=format&fit=crop" },
    { name: "Gourmet Chocolate", image: "https://images.unsplash.com/photo-1481391319762-47dff72954d9?q=80&w=1964&auto=format&fit=crop" },
    { name: "Homemade Baked Goods", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1772&auto=format&fit=crop" },
    { name: "Snack Box", image: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?q=80&w=1770&auto=format&fit=crop" },
    { name: "Sushi Dinner", image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=1770&auto=format&fit=crop" },
    { name: "Movie Night Popcorn", image: "https://images.unsplash.com/photo-1505686994434-e3cc5abf1330?q=80&w=1773&auto=format&fit=crop" },
    { name: "Special Brunch", image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?q=80&w=1770&auto=format&fit=crop" },
  ],
  "Clothing & Accessories": [
    { name: "Dream Tracker T-shirt", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1780&auto=format&fit=crop" },
    { name: "Cozy Socks", image: "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?q=80&w=1780&auto=format&fit=crop" },
    { name: "Custom Bracelet", image: "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?q=80&w=1769&auto=format&fit=crop" },
    { name: "Personalized Cap", image: "https://images.unsplash.com/photo-1521369909029-2afed882baee?q=80&w=1770&auto=format&fit=crop" },
    { name: "Comfy Loungewear", image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&w=1705&auto=format&fit=crop" },
    { name: "Stylish Tote Bag", image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?q=80&w=1887&auto=format&fit=crop" },
    { name: "Trendy Sunglasses", image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?q=80&w=1780&auto=format&fit=crop" },
    { name: "Enamel Pins", image: "https://images.unsplash.com/photo-1563290173-d0b7ce301f57?q=80&w=1886&auto=format&fit=crop" },
    { name: "Quote Hoodie", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1887&auto=format&fit=crop" },
    { name: "Workout Gear", image: "https://images.unsplash.com/photo-1518459031867-a89b944bffe4?q=80&w=1776&auto=format&fit=crop" },
  ],
  "Affordable Rewards": [
    { name: "$5 Gift Card", image: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=1887&auto=format&fit=crop" },
    { name: "DIY Craft Kit", image: "https://images.unsplash.com/photo-1499513029304-499942730aab?q=80&w=1770&auto=format&fit=crop" },
    { name: "Small Plant", image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?q=80&w=1772&auto=format&fit=crop" },
    { name: "Journal or Planner", image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?q=80&w=1887&auto=format&fit=crop" },
    { name: "Coloring Book", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1771&auto=format&fit=crop" },
    { name: "Custom Keychain", image: "https://images.unsplash.com/photo-1553531384-cc64ac80f931?q=80&w=1964&auto=format&fit=crop" },
    { name: "Sticker Pack", image: "https://images.unsplash.com/photo-1584727638096-042c644ece3a?q=80&w=1772&auto=format&fit=crop" },
    { name: "Digital Book", image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1974&auto=format&fit=crop" },
    { name: "Phone Wallpaper", image: "https://images.unsplash.com/photo-1616348436168-de43ad0db179?q=80&w=1781&auto=format&fit=crop" },
    { name: "Scented Candle", image: "https://images.unsplash.com/photo-1602874801007-bd36201de131?q=80&w=1770&auto=format&fit=crop" },
  ],
  "High-Value Rewards": [
    { name: "Spa Day Pass", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=1770&auto=format&fit=crop" },
    { name: "Premium Headphones", image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1770&auto=format&fit=crop" },
    { name: "Gym Membership", image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1770&auto=format&fit=crop" },
    { name: "Weekend Getaway", image: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?q=80&w=1968&auto=format&fit=crop" },
    { name: "Personal Coaching", image: "https://images.unsplash.com/photo-1475823678248-624fc6f85785?q=80&w=1770&auto=format&fit=crop" },
    { name: "Designer Clothing", image: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=1770&auto=format&fit=crop" },
    { name: "Concert Tickets", image: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1770&auto=format&fit=crop" },
    { name: "Subscription Box", image: "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?q=80&w=1780&auto=format&fit=crop" },
    { name: "Custom Art Piece", image: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?q=80&w=1766&auto=format&fit=crop" },
    { name: "Fine Dining Experience", image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1770&auto=format&fit=crop" },
  ],
  "Experiences & Activities": [
    { name: "Movie Theater Tickets", image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=2070&auto=format&fit=crop" },
    { name: "Escape Room", image: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1769&auto=format&fit=crop" },
    { name: "Hiking Adventure", image: "https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=1770&auto=format&fit=crop" },
    { name: "Cooking Class", image: "https://images.unsplash.com/photo-1507048331197-7d4ac70811cf?q=80&w=1774&auto=format&fit=crop" },
    { name: "Dance Lesson", image: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1769&auto=format&fit=crop" },
    { name: "VR Experience", image: "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?q=80&w=1778&auto=format&fit=crop" },
    { name: "Road Trip", image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1721&auto=format&fit=crop" },
    { name: "Museum Visit", image: "https://images.unsplash.com/photo-1518998053901-5348d3961a04?q=80&w=1774&auto=format&fit=crop" },
    { name: "Live Performance", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1774&auto=format&fit=crop" },
    { name: "Charity Event", image: "https://images.unsplash.com/photo-1593113598332-cd288d649433?q=80&w=1770&auto=format&fit=crop" },
  ],
  "Personal Growth & Wellness": [
    { name: "Yoga Class Pass", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1731&auto=format&fit=crop" },
    { name: "Self-Help Book", image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1974&auto=format&fit=crop" },
    { name: "Life Coaching Session", image: "https://images.unsplash.com/photo-1516534775068-ba3e7458af70?q=80&w=1770&auto=format&fit=crop" },
    { name: "Online Course", image: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=1774&auto=format&fit=crop" },
    { name: "Fitness Plan", image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1770&auto=format&fit=crop" },
    { name: "Journaling Kit", image: "https://images.unsplash.com/photo-1517842645767-c639042777db?q=80&w=1770&auto=format&fit=crop" },
    { name: "Gratitude Challenge", image: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1774&auto=format&fit=crop" },
    { name: "Meal Plan", image: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1770&auto=format&fit=crop" },
    { name: "Self-Care Day", image: "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?q=80&w=1770&auto=format&fit=crop" },
    { name: "Motivational Video Access", image: "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1770&auto=format&fit=crop" },
  ],
  "Digital Rewards": [
    { name: "E-book Download", image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1974&auto=format&fit=crop" },
    { name: "Premium App Access", image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1774&auto=format&fit=crop" },
    { name: "Custom Wallpaper", image: "https://images.unsplash.com/photo-1616348436168-de43ad0db179?q=80&w=1781&auto=format&fit=crop" },
    { name: "Custom Ringtone", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=2070&auto=format&fit=crop" },
    { name: "Exclusive Webinar", image: "https://images.unsplash.com/photo-1591115765373-5207764f72e7?q=80&w=1770&auto=format&fit=crop" },
    { name: "Website Feature", image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1815&auto=format&fit=crop" },
    { name: "Digital Avatar", image: "https://images.unsplash.com/photo-1534488972407-5a4aa1e47d83?q=80&w=1888&auto=format&fit=crop" },
    { name: "Special App Filters", image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?q=80&w=1774&auto=format&fit=crop" },
    { name: "Digital Collection NFT", image: "https://images.unsplash.com/photo-1644658722893-6d8e35fba44e?q=80&w=2070&auto=format&fit=crop" },
    { name: "Virtual Coaching", image: "https://images.unsplash.com/photo-1591115765373-5207764f72e7?q=80&w=1770&auto=format&fit=crop" },
  ],
};

function RewardCard({ reward, onClick }: { reward: Reward; onClick: () => void }) {
  const { toast } = useToast();

  const claimReward = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("rewards")
        .update({ available: reward.available - 1 })
        .eq("id", reward.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({
        title: "Reward Claimed!",
        description: "You've successfully claimed your reward.",
      });
    },
  });

  return (
    <Card className="relative overflow-hidden group hover:ring-2 hover:ring-border transition-all">
      <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={onClick}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
      <CardContent className="pt-6">
        <div
          className="w-full h-32 mb-4 rounded-lg bg-cover bg-center cursor-pointer"
          style={{ backgroundImage: `url(${reward.image})` }}
          onClick={onClick}
        />
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3
              className="text-xl font-semibold cursor-pointer hover:text-primary"
              onClick={onClick}
            >
              {reward.name}
            </h3>
            <span className="text-sm font-medium text-muted-foreground">
              {reward.available || 0} available
            </span>
          </div>
          <Button
            className="w-full"
            onClick={() => claimReward.mutate()}
            disabled={claimReward.isPending || !reward.available}
            variant={reward.available ? "default" : "secondary"}
          >
            {claimReward.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Claim Reward
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BrowseRewardsDialog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const createReward = useMutation({
    mutationFn: async (values: { name: string; image: string }) => {
      const { error } = await supabase.from("rewards").insert({
        ...values,
        habit_chances: "{}",
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      toast({
        title: "Reward Added",
        description: "The reward has been added to your collection.",
      });
    },
  });

  const categories = Object.keys(presetRewards);
  const displayRewards = selectedCategory ? presetRewards[selectedCategory] : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Library className="h-4 w-4 mr-2" />
          Browse Rewards
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Browse Preset Rewards</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Select
            value={selectedCategory || ""}
            onValueChange={(value) => setSelectedCategory(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedCategory && (
            <div className="grid grid-cols-2 gap-4">
              {displayRewards.map((reward, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => {
                    createReward.mutate(reward);
                    setOpen(false);
                  }}
                >
                  <CardContent className="p-4">
                    <div
                      className="w-full h-24 mb-2 rounded-lg bg-cover bg-center"
                      style={{ backgroundImage: `url(${reward.image})` }}
                    />
                    <h3 className="text-sm font-medium text-center">{reward.name}</h3>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddRewardForm({
  reward,
  onSuccess,
}: {
  reward?: Reward | null;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const form = useForm({
    defaultValues: {
      name: reward?.name || "",
      image: reward?.image || "",
    },
  });

  const createReward = useMutation({
    mutationFn: async (values: { name: string; image: string }) => {
      if (reward) {
        const { error } = await supabase
          .from("rewards")
          .update({ name: values.name, image: values.image })
          .eq("id", reward.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rewards").insert({
          ...values,
          habit_chances: "{}",
          user_id: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      form.reset();
      onSuccess();
    },
  });

  const deleteReward = useMutation({
    mutationFn: async () => {
      if (!reward) return;
      const { error } = await supabase.from("rewards").delete().eq("id", reward.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      onSuccess();
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => createReward.mutate(data))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reward Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter the reward" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter an image URL for visualization"
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
            disabled={createReward.isPending}
          >
            {createReward.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {reward ? "Update Reward" : "Create Reward"}
          </Button>

          {reward && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteReward.mutate()}
              disabled={deleteReward.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

export default function RewardsPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["rewards", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("rewards").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Rewards</h1>
          <p className="text-muted-foreground">
            Create rewards that can be earned through habits
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <BrowseRewardsDialog />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Reward
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedReward ? "Edit Reward" : "Add New Reward"}</DialogTitle>
              </DialogHeader>
              <AddRewardForm
                reward={selectedReward}
                onSuccess={() => {
                  setOpen(false);
                  setSelectedReward(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rewards?.map((reward) => (
          <RewardCard
            key={reward.id}
            reward={reward}
            onClick={() => {
              setSelectedReward(reward);
              setOpen(true);
            }}
          />
        ))}
      </div>
    </div>
  );
}
