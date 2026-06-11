import { supabase } from "./supabase";

export type DemoPreset = "male" | "female";

/**
 * Seeds demo data for a newly registered user based on the chosen preset
 * (male / female). Creates several dreams (house, body, project) each with
 * a goal and habits, plus a set of rewards linked to those habits.
 *
 * Every row is inserted with `is_demo: true` so it can later be removed
 * with the "Delete demo data" button (see delete-demo-data.ts).
 */

type HabitSeed = {
  /** Local key used to link reward chances to this habit. */
  key: string;
  name: string;
  unit: string;
  frequency: string;
  target_value: number;
  color: string;
  positive_motivation: string;
  negative_motivation: string;
  image: string | null;
};

type GoalSeed = {
  name: string;
  image: string;
  final_count: number;
  unit: string;
  habits: HabitSeed[];
};

type DreamSeed = {
  name: string;
  image: string;
  positive_motivation: string;
  negative_motivation: string;
  goals: GoalSeed[];
};

type RewardSeed = {
  name: string;
  image: string;
  /** habit key -> chance % (chances per habit should sum to ~50, rest = no reward) */
  chances: Record<string, number>;
};

type Preset = {
  dreams: DreamSeed[];
  rewards: RewardSeed[];
};

const STORAGE =
  "https://cqhggjhidxmtmnunhzjx.supabase.co/storage/v1/object/public/images";

const IMG = {
  // Shared demo images already uploaded in Supabase Storage
  fitCouple: `${STORAGE}/demo-dream-fit-couple-1779265524902.jpg`,
  training: `${STORAGE}/demo-goal-training-1779218698574.jpg`,
  workout: `${STORAGE}/demo-habit-workout-1779218699023.jpg`,
  massage: `${STORAGE}/demo-reward-sports-massage-1779218697068.jpg`,
  cheatMeal: `${STORAGE}/demo-reward-cheat-meal-1779218697806.jpg`,
  tvShow: `${STORAGE}/demo-reward-tv-show-episode-1779218698205.jpg`,
  // Unsplash (stable CDN URLs)
  house:
    "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=900&q=80",
  homeInterior:
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80",
  savings:
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80",
  laptopCode:
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80",
  workspace:
    "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=900&q=80",
  yoga:
    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=80",
  spa:
    "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80",
  gaming:
    "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=900&q=80",
};

const MALE_PRESET: Preset = {
  dreams: [
    {
      name: "Own House",
      image: IMG.house,
      positive_motivation:
        "A home of my own — security, freedom and a place to build my life",
      negative_motivation:
        "Years of rent paying off someone else's mortgage",
      goals: [
        {
          name: "Save the Down Payment",
          image: IMG.savings,
          final_count: 12000,
          unit: "$",
          habits: [
            {
              key: "save",
              name: "Put Money Aside",
              unit: "$",
              frequency: "daily",
              target_value: 30,
              color: "#22c55e",
              positive_motivation:
                "Every dollar saved is a brick in my future house",
              negative_motivation:
                "Money spent carelessly pushes the house years away",
              image: null,
            },
          ],
        },
      ],
    },
    {
      name: "Fit & Strong Body",
      image: IMG.fitCouple,
      positive_motivation:
        "I will feel great, full of energy and confidence",
      negative_motivation:
        "Without exercise I will be tired and unhappy with my body",
      goals: [
        {
          name: "30 Hours of Training",
          image: IMG.training,
          final_count: 30,
          unit: "hours",
          habits: [
            {
              key: "workout",
              name: "Workout",
              unit: "minutes",
              frequency: "3x per week",
              target_value: 30,
              color: "#ef4444",
              positive_motivation:
                "Every workout brings me closer to my dream body",
              negative_motivation: "Skipping a workout = step backwards",
              image: IMG.workout,
            },
            {
              key: "run",
              name: "Morning Run",
              unit: "minutes",
              frequency: "2x per week",
              target_value: 20,
              color: "#f97316",
              positive_motivation: "Running clears my head and burns fat",
              negative_motivation:
                "Every skipped run makes the next one harder",
              image: null,
            },
          ],
        },
      ],
    },
    {
      name: "Launch My Side Project",
      image: IMG.laptopCode,
      positive_motivation:
        "My own product, extra income and the pride of having built something",
      negative_motivation:
        "The idea stays in my head forever and someone else builds it",
      goals: [
        {
          name: "100 Hours of Deep Work",
          image: IMG.workspace,
          final_count: 100,
          unit: "hours",
          habits: [
            {
              key: "deepwork",
              name: "Deep Work Session",
              unit: "minutes",
              frequency: "daily",
              target_value: 45,
              color: "#3b82f6",
              positive_motivation:
                "45 focused minutes a day add up to a finished project",
              negative_motivation:
                "A day without progress means the launch slips again",
              image: null,
            },
          ],
        },
      ],
    },
  ],
  rewards: [
    {
      name: "Cheat Meal",
      image: IMG.cheatMeal,
      chances: { workout: 14, run: 15 },
    },
    {
      name: "TV Show Episode",
      image: IMG.tvShow,
      chances: { workout: 25, run: 20, deepwork: 20, save: 25 },
    },
    {
      name: "Gaming Hour",
      image: IMG.gaming,
      chances: { deepwork: 30, save: 25 },
    },
    {
      name: "Sports Massage",
      image: IMG.massage,
      chances: { workout: 9, run: 15 },
    },
  ],
};

const FEMALE_PRESET: Preset = {
  dreams: [
    {
      name: "Dream Home",
      image: IMG.homeInterior,
      positive_motivation: "A cozy place that is truly ours",
      negative_motivation:
        "Staying stuck in a rented flat that never feels like home",
      goals: [
        {
          name: "Save the Down Payment",
          image: IMG.savings,
          final_count: 12000,
          unit: "$",
          habits: [
            {
              key: "save",
              name: "Put Money Aside",
              unit: "$",
              frequency: "daily",
              target_value: 25,
              color: "#22c55e",
              positive_motivation:
                "Every saved dollar brings our home closer",
              negative_motivation:
                "Impulse purchases push the dream years away",
              image: null,
            },
          ],
        },
      ],
    },
    {
      name: "Dream Figure",
      image: IMG.yoga,
      positive_motivation:
        "Feeling light, strong and confident in my own body",
      negative_motivation: "Low energy and clothes that no longer fit",
      goals: [
        {
          name: "25 Hours of Exercise",
          image: IMG.training,
          final_count: 25,
          unit: "hours",
          habits: [
            {
              key: "yoga",
              name: "Yoga / Pilates",
              unit: "minutes",
              frequency: "3x per week",
              target_value: 30,
              color: "#a855f7",
              positive_motivation:
                "Every session leaves me calmer and stronger",
              negative_motivation:
                "Skipping practice means stiffness and stress come back",
              image: null,
            },
            {
              key: "walk",
              name: "Evening Walk",
              unit: "minutes",
              frequency: "daily",
              target_value: 30,
              color: "#f97316",
              positive_motivation:
                "A walk clears my head and gently burns calories",
              negative_motivation:
                "An evening on the couch is a missed easy win",
              image: null,
            },
          ],
        },
      ],
    },
    {
      name: "My Own Project",
      image: IMG.workspace,
      positive_motivation:
        "Turning my passion into something real — maybe even a business",
      negative_motivation: "Wondering forever what could have been",
      goals: [
        {
          name: "80 Hours on My Project",
          image: IMG.laptopCode,
          final_count: 80,
          unit: "hours",
          habits: [
            {
              key: "create",
              name: "Creative Work",
              unit: "minutes",
              frequency: "daily",
              target_value: 45,
              color: "#3b82f6",
              positive_motivation:
                "45 minutes a day quietly builds something I'm proud of",
              negative_motivation:
                "Days without progress let the dream fade",
              image: null,
            },
          ],
        },
      ],
    },
  ],
  rewards: [
    {
      name: "Sweet Treat",
      image: IMG.cheatMeal,
      chances: { yoga: 15, walk: 15 },
    },
    {
      name: "TV Show Episode",
      image: IMG.tvShow,
      chances: { yoga: 20, walk: 20, create: 20, save: 25 },
    },
    {
      name: "Home Spa Evening",
      image: IMG.spa,
      chances: { create: 30, save: 25 },
    },
    {
      name: "Massage",
      image: IMG.massage,
      chances: { yoga: 15, walk: 15 },
    },
  ],
};

const PRESETS: Record<DemoPreset, Preset> = {
  male: MALE_PRESET,
  female: FEMALE_PRESET,
};

export async function seedDemoData(
  userId: string,
  preset: DemoPreset = "male",
): Promise<void> {
  const data = PRESETS[preset] ?? MALE_PRESET;

  try {
    // Maps local habit keys to inserted habit IDs (for reward chances).
    const habitIdByKey: Record<string, number> = {};

    for (const dreamSeed of data.dreams) {
      const { data: dream, error: dreamErr } = await supabase
        .from("dreams")
        .insert({
          user_id: userId,
          name: dreamSeed.name,
          image: dreamSeed.image,
          positive_motivation: dreamSeed.positive_motivation,
          negative_motivation: dreamSeed.negative_motivation,
          progress: 0,
          is_demo: true,
        })
        .select("id")
        .single();

      if (dreamErr || !dream) {
        console.error("Failed to seed dream:", dreamErr);
        continue;
      }

      for (const goalSeed of dreamSeed.goals) {
        const { data: goal, error: goalErr } = await supabase
          .from("goals")
          .insert({
            user_id: userId,
            dream_id: dream.id,
            name: goalSeed.name,
            image: goalSeed.image,
            progress: 0,
            final_count: goalSeed.final_count,
            unit: goalSeed.unit,
            is_demo: true,
          })
          .select("id")
          .single();

        if (goalErr || !goal) {
          console.error("Failed to seed goal:", goalErr);
          continue;
        }

        for (const habitSeed of goalSeed.habits) {
          const { data: habit, error: habitErr } = await supabase
            .from("habits")
            .insert({
              user_id: userId,
              goal_id: goal.id,
              name: habitSeed.name,
              unit: habitSeed.unit,
              frequency: habitSeed.frequency,
              target_value: habitSeed.target_value,
              current_value: 0,
              color: habitSeed.color,
              positive_motivation: habitSeed.positive_motivation,
              negative_motivation: habitSeed.negative_motivation,
              image: habitSeed.image,
              is_demo: true,
            })
            .select("id")
            .single();

          if (habitErr || !habit) {
            console.error("Failed to seed habit:", habitErr);
            continue;
          }

          habitIdByKey[habitSeed.key] = habit.id;
        }
      }
    }

    // Rewards reference the inserted habit IDs through habit_chances.
    const rewards = data.rewards
      .map((rewardSeed) => {
        const chances: Record<number, number> = {};
        for (const [key, chance] of Object.entries(rewardSeed.chances)) {
          const habitId = habitIdByKey[key];
          if (habitId !== undefined) chances[habitId] = chance;
        }
        return {
          user_id: userId,
          name: rewardSeed.name,
          image: rewardSeed.image,
          available: 0,
          habit_chances: JSON.stringify(chances),
          is_demo: true,
        };
      })
      .filter((r) => r.habit_chances !== "{}");

    if (rewards.length > 0) {
      const { error: rewardsErr } = await supabase
        .from("rewards")
        .insert(rewards);

      if (rewardsErr) {
        console.error("Failed to seed rewards:", rewardsErr);
      }
    }
  } catch (err) {
    // Don't block registration if seeding fails
    console.error("Demo data seeding failed:", err);
  }
}
