import { supabase } from "./supabase";

/**
 * Seeds demo data for a newly registered user.
 * Creates: 1 Dream → 1 Goal → 1 Habit → 3 Rewards (with habit_chances linked to the new habit).
 * Images are shared from Supabase Storage (public URLs).
 *
 * Future plan: add is_demo column + onboarding wizard + "Delete demo data" button.
 */
export async function seedDemoData(userId: string): Promise<void> {
  try {
    // 1. Create Dream
    const { data: dream, error: dreamErr } = await supabase
      .from("dreams")
      .insert({
        user_id: userId,
        name: "Fit Body",
        image:
          "https://cqhggjhidxmtmnunhzjx.supabase.co/storage/v1/object/public/images/demo-dream-fit-couple-1779265524902.jpg",
        positive_motivation:
          "I will feel great, full of energy and confidence",
        negative_motivation:
          "Without exercise I will be tired and unhappy with my body",
        progress: 0,
      })
      .select("id")
      .single();

    if (dreamErr || !dream) {
      console.error("Failed to seed dream:", dreamErr);
      return;
    }

    // 2. Create Goal (linked to dream)
    const { data: goal, error: goalErr } = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        dream_id: dream.id,
        name: "30 Hours of Training",
        image:
          "https://cqhggjhidxmtmnunhzjx.supabase.co/storage/v1/object/public/images/demo-goal-training-1779218698574.jpg",
        progress: 0,
        final_count: 30,
        unit: "hours",
      })
      .select("id")
      .single();

    if (goalErr || !goal) {
      console.error("Failed to seed goal:", goalErr);
      return;
    }

    // 3. Create Habit (linked to goal)
    const { data: habit, error: habitErr } = await supabase
      .from("habits")
      .insert({
        user_id: userId,
        goal_id: goal.id,
        name: "Workout",
        unit: "minutes",
        frequency: "3x per week",
        target_value: 15,
        current_value: 15,
        color: "#ef4444",
        positive_motivation:
          "Every workout brings me closer to my dream body",
        negative_motivation: "Skipping a workout = step backwards",
        image:
          "https://cqhggjhidxmtmnunhzjx.supabase.co/storage/v1/object/public/images/demo-habit-workout-1779218699023.jpg",
      })
      .select("id")
      .single();

    if (habitErr || !habit) {
      console.error("Failed to seed habit:", habitErr);
      return;
    }

    // 4. Create Rewards (habit_chances reference the new habit ID)
    const rewards = [
      {
        user_id: userId,
        name: "Sports Massage",
        image:
          "https://cqhggjhidxmtmnunhzjx.supabase.co/storage/v1/object/public/images/demo-reward-sports-massage-1779218697068.jpg",
        available: 0,
        habit_chances: JSON.stringify({ [habit.id]: 9 }),
      },
      {
        user_id: userId,
        name: "Cheat Meal",
        image:
          "https://cqhggjhidxmtmnunhzjx.supabase.co/storage/v1/object/public/images/demo-reward-cheat-meal-1779218697806.jpg",
        available: 0,
        habit_chances: JSON.stringify({ [habit.id]: 14 }),
      },
      {
        user_id: userId,
        name: "TV Show Episode",
        image:
          "https://cqhggjhidxmtmnunhzjx.supabase.co/storage/v1/object/public/images/demo-reward-tv-show-episode-1779218698205.jpg",
        available: 0,
        habit_chances: JSON.stringify({ [habit.id]: 25 }),
      },
    ];

    const { error: rewardsErr } = await supabase
      .from("rewards")
      .insert(rewards);

    if (rewardsErr) {
      console.error("Failed to seed rewards:", rewardsErr);
    }
  } catch (err) {
    // Don't block registration if seeding fails
    console.error("Demo data seeding failed:", err);
  }
}
