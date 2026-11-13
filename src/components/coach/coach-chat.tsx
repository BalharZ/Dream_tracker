import { useEffect, useRef, useState } from "react";
import { Bot, PlayCircle, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { FREE_LIMITS, usePlan } from "@/hooks/use-plan";

/**
 * S60: the coach chat. In this phase it is a scripted guide — no AI, no cost:
 * a first-setup walkthrough (dream → goal → habit → reward), answers to the
 * basic "how does X work" questions and a demo of the AI coach (Pro + AI).
 * S64 plugs the real AI coach into the same window for Pro + AI users.
 */

type Msg = { from: "coach" | "user"; text: string };
type Step =
  | "menu"
  | "dream"
  | "goal"
  | "goal-amount"
  | "habit"
  | "habit-often"
  | "habit-amount"
  | "reward"
  | "saving"
  | "done";

type Draft = {
  dream?: string;
  goal?: string;
  goalCount?: number;
  goalUnit?: string;
  habit?: string;
  frequency?: string;
  habitAmount?: number;
  habitUnit?: string;
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do habits work?",
    a: "A habit is the small thing you repeat — like “Run 3 km”. Fill it in on the Dashboard or in the Habits table. Every habit can belong to a goal, and every goal to a dream, so each completion moves your dream forward.",
  },
  {
    q: "What is habit strength?",
    a: "Habit strength shows how automatic a habit has become, from 0 to 100 %. It grows with every completion and dips a little when you miss — missing twice in a row hurts more. Science says a habit gets automatic after about 66 days on average, not 21.",
  },
  {
    q: "How do rewards work?",
    a: "Attach rewards to a habit with a win chance. When you complete the habit, a roulette spins and you may win one. N× per week habits can also have a weekly reward for finishing the whole week.",
  },
  {
    q: "Weekly or monthly habits?",
    a: "Pick “Weekly” or “Monthly” as the frequency and set how many times — e.g. 3× a week, 1 hour each. A done day is half-coloured until you reach the count for the week (or month), then the whole period fills in.",
  },
];

const EXAMPLES = {
  dream: ["Run a marathon", "Speak fluent Spanish", "Get fit and strong"],
  goal: ["Run 500 km", "Learn 2000 words", "Train 100 hours"],
  goalAmount: ["500 km", "2000 words", "100 hours"],
  habit: ["Run", "Learn Spanish words", "Workout"],
  often: [
    { label: "Every day", value: "daily" },
    { label: "3× per week", value: "3x per week" },
    { label: "2× per week", value: "2x per week" },
  ],
  habitAmount: ["5 km", "20 words", "60 minutes"],
  reward: ["☕ Favourite coffee", "📺 An episode of a series", "🎮 30 min of gaming"],
};

/** "500 km" → { count: 500, unit: "km" }; null when no number. */
function parseAmount(text: string): { count: number; unit: string } | null {
  const m = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return null;
  const count = Number(m[1].replace(",", "."));
  return count > 0 ? { count, unit: m[2].trim() || "times" } : null;
}

/** The /coach page, opened from "Coach" in the navigation (bottom bar / sidebar). */
export function CoachChat() {
  const { user } = useAuth();
  const { hasAI, isPro, openPaywall } = usePlan();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [step, setStep] = useState<Step>("menu");
  const [draft, setDraft] = useState<Draft>({});
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ from: "coach", text: "Hi! I'm your Northstar coach. What would you like to do?" }]);
    }
  }, [messages.length]);

  useEffect(() => {
    // Scroll only the message list — scrollIntoView would also move the page.
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, step]);

  const say = (...msgs: Msg[]) => setMessages((prev) => [...prev, ...msgs]);
  const coach = (text: string): Msg => ({ from: "coach", text });
  const me = (text: string): Msg => ({ from: "user", text });

  const backToMenu = () => {
    setStep("menu");
    setDraft({});
    say(coach("Anything else?"));
  };

  const startSetup = async () => {
    say(me("Set up my first habit"));
    if (!isPro && user) {
      // The walkthrough adds one of each, so every kind needs a free slot.
      const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
      const [dreams, goals, habits, rewards] = await Promise.all([
        count(supabase.from("dreams").select("id", { count: "exact", head: true }).eq("user_id", user.id)),
        count(supabase.from("goals").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("parent_goal_id", null)),
        count(supabase.from("habits").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("archived_at", null)),
        count(supabase.from("rewards").select("id", { count: "exact", head: true }).eq("user_id", user.id)),
      ]);
      const full = (
        [
          ["dreams", dreams, "dream-limit"],
          ["goals", goals, "goal-limit"],
          ["habits", habits, "habit-limit"],
          ["rewards", rewards, "reward-limit"],
        ] as const
      ).find(([kind, n]) => n >= FREE_LIMITS[kind]);
      if (full) {
        say(coach(`You've used all the ${full[0]} of the Free plan. Free is for trying Northstar out — go Pro for unlimited.`));
        openPaywall(full[2]);
        return;
      }
    }
    say(coach("Let's start with the big picture. What's a dream you'd love to reach?"));
    setStep("dream");
  };

  const answer = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setInput("");
    say(me(value));
    switch (step) {
      case "dream":
        setDraft((d) => ({ ...d, dream: value }));
        say(coach(`“${value}” — love it. What's a first, measurable goal on the way there?`));
        setStep("goal");
        break;
      case "goal":
        setDraft((d) => ({ ...d, goal: value }));
        say(coach("How much is that in numbers? For example “500 km” or “100 hours”."));
        setStep("goal-amount");
        break;
      case "goal-amount": {
        const a = parseAmount(value);
        if (!a) {
          say(coach("Start with a number please, like “500 km”."));
          return;
        }
        setDraft((d) => ({ ...d, goalCount: a.count, goalUnit: a.unit }));
        say(coach("Now the habit that gets you there — what will you do regularly?"));
        setStep("habit");
        break;
      }
      case "habit":
        setDraft((d) => ({ ...d, habit: value }));
        say(coach("How often?"));
        setStep("habit-often");
        break;
      case "habit-amount": {
        const a = parseAmount(value);
        if (!a) {
          say(coach("Start with a number please, like “5 km”."));
          return;
        }
        setDraft((d) => ({ ...d, habitAmount: a.count, habitUnit: a.unit }));
        say(coach("Last one: how will you treat yourself? Pick a reward — you'll have a 30 % chance to win it each time."));
        setStep("reward");
        break;
      }
      case "reward":
        void save(value);
        break;
      default:
        break;
    }
  };

  const chooseOften = (label: string, value: string) => {
    say(me(label));
    setDraft((d) => ({ ...d, frequency: value }));
    say(coach(`And how much each time? For example “5 ${draft.goalUnit || "km"}”.`));
    setStep("habit-amount");
  };

  const save = async (rewardName: string) => {
    if (!user) return;
    setStep("saving");
    const d = draft;
    try {
      const { data: dream, error: e1 } = await supabase
        .from("dreams")
        .insert({ user_id: user.id, name: d.dream, image: "", positive_motivation: "", negative_motivation: "" })
        .select()
        .single();
      if (e1) throw e1;
      const { data: goal, error: e2 } = await supabase
        .from("goals")
        .insert({
          user_id: user.id,
          dream_id: dream.id,
          name: d.goal,
          image: "placeholder.jpg",
          final_count: d.goalCount,
          unit: d.goalUnit,
        })
        .select()
        .single();
      if (e2) throw e2;
      const { data: habit, error: e3 } = await supabase
        .from("habits")
        .insert({
          user_id: user.id,
          goal_id: goal.id,
          name: d.habit,
          unit: d.habitUnit || d.goalUnit,
          frequency: d.frequency || "daily",
          target_value: d.habitAmount || 1,
          color: "#4299E1",
          image: null,
          positive_motivation: "",
          negative_motivation: "",
          habit_type: "standard",
          notify: false,
        })
        .select()
        .single();
      if (e3) throw e3;
      const { error: e4 } = await supabase
        .from("rewards")
        .insert({ user_id: user.id, name: rewardName, image: "", habit_chances: JSON.stringify({ [habit.id]: 30 }) });
      if (e4) throw e4;

      ["dreams", "goals", "habits", "rewards"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      say(
        coach(
          `All set! 🎉 Dream “${d.dream}” → goal “${d.goal}” → habit “${d.habit}” with “${rewardName}” as a reward. Fill it in on the Dashboard today and watch your habit strength grow.`,
        ),
      );
      setStep("done");
    } catch (error: any) {
      say(coach(`Something went wrong while saving: ${error.message}. Nothing is lost — try again from the menu.`));
      setStep("done");
    }
  };

  const showAiDemo = () => {
    say(me("What can the AI coach do?"));
    say(
      coach(
        "With Pro + AI I can talk with you like a real coach: break a dream into goals, set up habits with you (frequency, snowball, variations), plan your week and give you a weekly review based on your stats. Watch the short demo below.",
      ),
    );
    setStep("menu");
  };

  if (!user) return null;

  const chips = (items: string[]) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => answer(t)}
          className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-accent"
        >
          {t}
        </button>
      ))}
    </div>
  );

  const typing = ["dream", "goal", "goal-amount", "habit", "habit-amount", "reward"].includes(step);

  return (
    // Fills the screen between the top bar and the bottom navigation, so only
    // the message list scrolls (12rem = main's mobile top + bottom padding).
    <div className="flex h-[calc(100dvh-12rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm md:h-[calc(100dvh-4rem)]">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Bot className="h-6 w-6 text-primary" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight">Coach</h1>
          <div className="text-xs text-muted-foreground">{hasAI ? "AI coach arrives soon" : "Guide · AI coach in Pro + AI"}</div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3 md:px-6">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] md:max-w-[70%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm",
                m.from === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}

        {step === "menu" && (
          <div className="max-w-xl space-y-1.5 pt-1">
            <button
              type="button"
              onClick={startSetup}
              className="w-full rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-left text-sm font-medium hover:bg-primary/10"
            >
              🚀 Set up my first habit
            </button>
            {FAQ.map((f) => (
              <button
                key={f.q}
                type="button"
                onClick={() => say(me(f.q), coach(f.a))}
                className="w-full rounded-xl border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {f.q}
              </button>
            ))}
            <button
              type="button"
              onClick={showAiDemo}
              className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <Sparkles className="h-4 w-4 text-primary" /> What can the AI coach do?
            </button>
            {/* Demo video slot: drop the recorded clip at public/coach-demo.mp4. */}
            {messages.some((m) => m.text.startsWith("With Pro + AI")) && (
              <div className="max-w-xl space-y-2 rounded-xl border p-2">
                <video src="/coach-demo.mp4" controls playsInline className="w-full rounded-lg bg-muted" poster="/icons/icon-512.png">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <PlayCircle className="h-4 w-4" /> Demo video coming soon
                  </span>
                </video>
                {!hasAI && (
                  <Button size="sm" className="w-full" onClick={() => openPaywall("ai-coach")}>
                    See Pro + AI
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {step === "dream" && chips(EXAMPLES.dream)}
        {step === "goal" && chips(EXAMPLES.goal)}
        {step === "goal-amount" && chips(EXAMPLES.goalAmount)}
        {step === "habit" && chips(EXAMPLES.habit)}
        {step === "habit-often" && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.often.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => chooseOften(o.label, o.value)}
                className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-accent"
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {step === "habit-amount" && chips(EXAMPLES.habitAmount)}
        {step === "reward" && chips(EXAMPLES.reward)}
        {step === "saving" && <p className="text-xs text-muted-foreground">Saving…</p>}
        {step === "done" && (
          <Button size="sm" variant="outline" onClick={backToMenu}>
            Back to menu
          </Button>
        )}
      </div>

      {typing && (
        <form
          className="flex gap-2 border-t p-2 md:p-3"
          onSubmit={(e) => {
            e.preventDefault();
            answer(input);
          }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type or pick above…" className="h-10" />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-10 shrink-0" onClick={backToMenu}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
