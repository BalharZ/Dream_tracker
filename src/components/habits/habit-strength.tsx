import { useMemo } from "react";
import { Dumbbell } from "lucide-react";
import type { Habit } from "@shared/schema";
import type { ValuesByDate } from "@/lib/streaks";
import { ProgressRing } from "@/components/ui/progress-ring";
import { habitStrength, nextMilestone, strengthLevel, STRENGTH_MILESTONES } from "@/lib/habit-strength";

const pct = (s: number) => `${Math.round(s * 100)}%`;

/** Compact strength badge for the habits table (S53). */
export function StrengthChip({ habit, values }: { habit: Habit; values: ValuesByDate }) {
  const s = useMemo(() => habitStrength(habit, values), [habit, values]);
  if (s < 0.01) return null;
  return (
    <span
      title={`Habit strength ${pct(s)} — ${strengthLevel(s)}`}
      aria-label={`Habit strength ${pct(s)}`}
      className="flex-shrink-0 flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-semibold leading-none"
      style={{ color: habit.color, backgroundColor: `${habit.color}1f` }}
    >
      <Dumbbell className="h-3 w-3" />
      {pct(s)}
    </span>
  );
}

/** Strength card for the stats detail: ring, level, milestones (free in every plan). */
export function StrengthCard({ habit, values }: { habit: Habit; values: ValuesByDate }) {
  const s = useMemo(() => habitStrength(habit, values), [habit, values]);
  const next = nextMilestone(s);

  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-center gap-4">
        <ProgressRing value={s} color={habit.color} size={84} stroke={8}>
          <span className="text-lg font-bold">{pct(s)}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Habit strength</div>
          <div className="text-xl font-bold" style={{ color: habit.color }}>{strengthLevel(s)}</div>
          <p className="text-xs text-muted-foreground">
            Grows with every completion, dips a little when you miss — missing twice in a row hurts more.
          </p>
        </div>
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-2">
        {STRENGTH_MILESTONES.map((m) => {
          const reached = s >= m.strength;
          return (
            <li
              key={m.days}
              className="rounded-lg p-2 text-center"
              style={reached ? { backgroundColor: `${habit.color}22`, color: habit.color } : undefined}
            >
              <div className={reached ? "text-sm font-bold" : "text-sm font-bold text-muted-foreground"}>{m.days} days</div>
              <div className={reached ? "text-[11px]" : "text-[11px] text-muted-foreground"}>{m.label}</div>
            </li>
          );
        })}
      </ol>
      {next && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Next: “{next.label}” at {pct(next.strength)} — about {next.days} days of steady practice. Science says a
          habit gets automatic after ~66 days on average, not 21.
        </p>
      )}
    </section>
  );
}
