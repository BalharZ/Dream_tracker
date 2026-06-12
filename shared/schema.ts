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
  // Escalation: every escalation_days days the app offers to escalate the
  // habit (add a sub-exercise / tighten an OR group). last_escalation_at
  // anchors the interval; null escalation_days = no escalation.
  escalation_days: number | null;
  last_escalation_at: string | null;
  // Push reminder: notify_time is a Postgres `time` ("HH:MM:SS") in the
  // user's local timezone; last_notified_date dedupes to one push per day
  // (written by the send-habit-notifications Edge Function).
  notify: boolean;
  notify_time: string | null;
  last_notified_date: string | null;
  created_at: string;
};

// One web-push subscription per browser/device (endpoint is unique).
export type PushSubscriptionRow = {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

// Sub-exercise row under a habit (e.g. "Exercise" → push-ups / squats / sit-ups).
// target 1 behaves like a checkbox; higher targets are filled with a counter.
// or_group: sub-exercises sharing the same number form an OR cluster — doing
// any one of them completes the whole cluster (5 push-ups OR 5 squats).
// null = required individually (AND).
export type HabitSubitem = {
  id: number;
  habit_id: number;
  user_id: string;
  name: string;
  target: number;
  unit: string;
  position: number;
  or_group: number | null;
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

// Calendar event: date + optional times; start_time null = all-day event.
// Times are Postgres `time` values ("HH:MM:SS"), date is "YYYY-MM-DD".
export type CalendarEvent = {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};

// Long-lived random token for the Android home-screen widget (one per user).
// The widget authenticates RPC calls (widget_get_today / widget_complete_habit)
// with it instead of a Supabase session.
export type WidgetToken = {
  user_id: string;
  token: string;
  created_at: string;
};

// Value per habit: either a plain number (legacy format = win chance in %,
// quantity 1) or an object with the chance and how many pieces of the reward
// a single win grants (e.g. 5× "1 h of gaming" for a harder habit).
export type ChanceEntry = number | { chance: number; quantity?: number };
export type HabitChances = { [habitId: number]: ChanceEntry };
