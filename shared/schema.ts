export type Dream = {
  id: number;
  user_id: string;
  name: string;
  image: string;
  positive_motivation: string | null;
  negative_motivation: string | null;
  progress: number;
  is_demo: boolean;
  created_at: string;
};

export type Goal = {
  id: number;
  user_id: string;
  dream_id: number;
  parent_goal_id: number | null;
  name: string;
  image: string;
  progress: number;
  final_count: number;
  unit: string;
  is_demo: boolean;
  created_at: string;
};

export type Habit = {
  id: number;
  user_id: string;
  goal_id: number | null;
  name: string;
  unit: string;
  frequency: string;
  target_value: number;
  current_value: number;
  color: string;
  positive_motivation: string | null;
  negative_motivation: string | null;
  image: string | null;
  notes: string | null;
  is_demo: boolean;
  // Snowball (gradually growing) habits: target_value holds the *current*
  // target and grows by step_value every interval_days, starting from
  // base_target. last_increase_at anchors the next scheduled increase.
  habit_type: "standard" | "snowball";
  base_target: number | null;
  step_value: number | null;
  interval_days: number | null;
  last_increase_at: string | null;
  created_at: string;
};

// Sub-exercise row under a habit (e.g. "Exercise" → push-ups / squats / sit-ups).
// target 1 behaves like a checkbox; higher targets are filled with a counter.
export type HabitSubitem = {
  id: number;
  habit_id: number;
  user_id: string;
  name: string;
  target: number;
  unit: string;
  position: number;
  created_at: string;
};

export type HabitSubitemProgress = {
  id: number;
  subitem_id: number;
  user_id: string;
  date: string;
  value: number;
};

export type HabitProgress = {
  id: number;
  habit_id: number;
  user_id: string;
  date: string;
  value: number;
};

export type Reward = {
  id: number;
  user_id: string;
  habit_chances: string;
  name: string;
  image: string;
  available: number;
  is_demo: boolean;
  created_at: string;
};

// Value per habit: either a plain number (legacy format = win chance in %,
// quantity 1) or an object with the chance and how many pieces of the reward
// a single win grants (e.g. 5× "1 h of gaming" for a harder habit).
export type ChanceEntry = number | { chance: number; quantity?: number };
export type HabitChances = { [habitId: number]: ChanceEntry };
