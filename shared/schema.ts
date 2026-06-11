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
  created_at: string;
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

export type HabitChances = { [habitId: number]: number };
