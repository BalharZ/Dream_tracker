import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Flame, Loader2, Trophy } from "lucide-react";
import type { Habit } from "@shared/schema";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProgressRing } from "@/components/ui/progress-ring";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { computeStreak, type ValuesByDate } from "@/lib/streaks";
import {
  breakdown,
  series,
  streakRuns,
  trend,
  weekdayRates,
  yearGrid,
  type DayState,
} from "@/lib/habit-stats";

type ProgressByHabit = Record<number, ValuesByDate>;

const RANGES = [
  { days: 30, label: "30 d" },
  { days: 90, label: "3 m" },
  { days: 180, label: "6 m" },
  { days: 365, label: "1 y" },
];

const pct = (r: number) => `${Math.round(r * 100)} %`;

/** All habit_progress rows of the user, paged past Supabase's 1000-row cap. */
async function loadAllProgress(userId: string): Promise<ProgressByHabit> {
  const out: ProgressByHabit = {};
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("habit_progress")
      .select("habit_id, date, value")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    (data || []).forEach((p) => {
      (out[p.habit_id] ||= {})[p.date] = p.value;
    });
    if (!data || data.length < page) break;
  }
  return out;
}

export function HabitStatsDialog({
  open,
  onOpenChange,
  habits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habits: Habit[];
}) {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  const { data: progress, isLoading } = useQuery({
    queryKey: ["habit_progress_all_stats", user?.id],
    queryFn: () => loadAllProgress(user!.id),
    enabled: open && !!user,
  });

  const selected = habits.find((h) => h.id === selectedId) || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="h-[100dvh] max-w-3xl sm:h-[90vh]"
        bodyClassName="flex h-full flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center gap-2 border-b px-4 py-3 pr-12">
          {selected ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedId(null)} aria-label="Back to all habits">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <BarChart3 className="h-5 w-5 text-primary" />
          )}
          <DialogTitle className="truncate">{selected ? selected.name : "Habit stats"}</DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoading || !progress ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history…
            </div>
          ) : selected ? (
            <HabitDetail habit={selected} values={progress[selected.id] || {}} />
          ) : (
            <Overview habits={habits} progress={progress} onSelect={setSelectedId} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- overview */

const Ring = ProgressRing;

function TrendBadge({ now, before }: { now: number; before: number | null }) {
  if (before === null) return <span className="text-xs text-muted-foreground">new</span>;
  const diff = Math.round((now - before) * 100);
  if (diff === 0) return <span className="text-xs text-muted-foreground">± 0 %</span>;
  const up = diff > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center text-xs font-medium", up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : ""}{diff} %
    </span>
  );
}

function cellStyle(state: DayState, color: string): React.CSSProperties {
  if (state === "done") return { backgroundColor: color };
  if (state === "partial") return { backgroundColor: color, opacity: 0.4 };
  if (state === "missed") return { backgroundColor: "hsl(var(--muted))" };
  return { backgroundColor: "transparent", outline: "1px dashed hsl(var(--border))", outlineOffset: -1 };
}

function Overview({ habits, progress, onSelect }: {
  habits: Habit[]; progress: ProgressByHabit; onSelect: (id: number) => void;
}) {
  const rows = useMemo(
    () =>
      habits.map((h) => {
        const v = progress[h.id] || {};
        return {
          habit: h,
          month: trend(h, v, 30),
          streak: computeStreak(h, v),
          best: streakRuns(h, v)[0]?.length || 0,
          last28: yearGrid(h, v).flat().filter((c) => c.date <= new Date()).slice(-28),
        };
      }),
    [habits, progress],
  );

  if (habits.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">No habits yet — add one to see stats.</p>;
  }

  const avg = rows.reduce((a, r) => a + r.month.now, 0) / rows.length;
  const topStreak = rows.reduce((a, r) => (r.streak > a.streak ? r : a), rows[0]);
  const topBest = rows.reduce((a, r) => (r.best > a.best ? r : a), rows[0]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center gap-1 rounded-xl border bg-card p-3">
          <Ring value={avg} color="hsl(var(--primary))" size={64} stroke={7}>{pct(avg)}</Ring>
          <span className="text-center text-[11px] text-muted-foreground">Avg. success, 30 days</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-card p-3 text-center">
          <Flame className="h-6 w-6 text-orange-500" />
          <span className="text-2xl font-bold leading-none">{topStreak.streak}</span>
          <span className="line-clamp-2 text-[11px] text-muted-foreground">Longest running · {topStreak.habit.name}</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border bg-card p-3 text-center">
          <Trophy className="h-6 w-6 text-amber-500" />
          <span className="text-2xl font-bold leading-none">{topBest.best}</span>
          <span className="line-clamp-2 text-[11px] text-muted-foreground">Best ever · {topBest.habit.name}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Tap a habit for the full breakdown.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ habit, month, streak, best, last28 }) => (
          <button
            key={habit.id}
            type="button"
            onClick={() => onSelect(habit.id)}
            className="group relative overflow-hidden rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: habit.color }} />
            <div className="flex items-center gap-3 pl-1">
              <Ring value={month.now} color={habit.color}>{pct(month.now)}</Ring>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate font-semibold">{habit.name}</span>
                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3 text-orange-500" />{streak}</span>
                  <span className="inline-flex items-center gap-0.5"><Trophy className="h-3 w-3 text-amber-500" />{best}</span>
                  <TrendBadge now={month.now} before={month.before} />
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[repeat(28,minmax(0,1fr))] gap-[2px] pl-1">
              {last28.map((c) => (
                <span key={c.date.toISOString()} className="aspect-square rounded-[2px]" style={cellStyle(c.state, habit.color)} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ detail */

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[11px]">{label}</span></div>
      <span className="text-2xl font-bold leading-none">{value}</span>
    </div>
  );
}

function ChartTip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-2 py-1 text-xs shadow-md">
      <div className="text-muted-foreground">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="font-medium text-foreground">
          {p.value} {unit}
        </div>
      ))}
    </div>
  );
}

function HabitDetail({ habit, values }: { habit: Habit; values: ValuesByDate }) {
  const [range, setRange] = useState(90);
  const color = habit.color;

  const runs = useMemo(() => streakRuns(habit, values), [habit, values]);
  const current = computeStreak(habit, values);
  const allTime = breakdown(habit, values, 3650);
  const trends = [7, 14, 30].map((d) => ({ d, ...trend(habit, values, d) }));
  const chart = useMemo(() => series(habit, values, range), [habit, values, range]);
  const split = breakdown(habit, values, range);
  const weekdays = useMemo(() => weekdayRates(habit, values, range), [habit, values, range]);
  const grid = useMemo(() => yearGrid(habit, values), [habit, values]);
  const best = runs[0]?.length || 0;

  const pie = [
    { name: "Done", value: split.done, fill: color, opacity: 1 },
    { name: "Partial", value: split.partial, fill: color, opacity: 0.4 },
    { name: "Missed", value: split.missed, fill: "hsl(var(--muted))", opacity: 1 },
  ];

  const yearRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Start the year view at today (right edge); scroll left for the past.
    const el = yearRef.current;
    if (el) requestAnimationFrame(() => (el.scrollLeft = el.scrollWidth));
  }, [grid]);

  const rangeTabs = (
    <div className="flex rounded-md border p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.days}
          type="button"
          onClick={() => setRange(r.days)}
          className={cn(
            "rounded px-2 py-0.5 text-xs transition-colors",
            range === r.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi icon={<Flame className="h-4 w-4 text-orange-500" />} value={current} label="Current streak" />
        <Kpi icon={<Trophy className="h-4 w-4 text-amber-500" />} value={best} label="Best streak" />
        <Kpi icon={<span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />} value={allTime.done} label="Days done (all time)" />
        <Kpi icon={<BarChart3 className="h-4 w-4" />} value={pct(allTime.rate)} label="Success (all time)" />
      </div>

      <Section title="Getting better or worse?">
        <div className="grid grid-cols-3 gap-2">
          {trends.map((t) => (
            <div key={t.d} className="flex flex-col items-center gap-1 rounded-lg bg-muted/40 p-2 text-center">
              <span className="text-[11px] text-muted-foreground">Last {t.d} days</span>
              <Ring value={t.now} color={color} size={52} stroke={5}>{pct(t.now)}</Ring>
              <TrendBadge now={t.now} before={t.before} />
              <span className="text-[10px] text-muted-foreground">vs previous {t.d}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={range > 90 ? "Weekly average" : "Daily values"} right={rangeTabs}>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${habit.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip unit={habit.unit} />} cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }} />
              <ReferenceLine
                y={habit.target_value}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{ value: `target ${habit.target_value}`, position: "insideTopRight", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad-${habit.id})`} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Done vs missed">
          <div className="flex items-center gap-4">
            <div className="relative h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" innerRadius="68%" outerRadius="100%" paddingAngle={split.total ? 2 : 0} stroke="none" startAngle={90} endAngle={-270} isAnimationActive>
                    {pie.map((p) => (
                      <Cell key={p.name} fill={p.fill} fillOpacity={p.opacity} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTip unit="days" />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{pct(split.rate)}</span>
                <span className="text-[10px] text-muted-foreground">success</span>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              {pie.map((p) => (
                <li key={p.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: p.fill, opacity: p.opacity }} />
                  <span className="text-muted-foreground">{p.name}</span>
                  <span className="font-semibold">{p.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section title="Best days of the week">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdays} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip unit="% done" />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {weekdays.map((w) => {
                    const top = Math.max(...weekdays.map((x) => x.rate));
                    return <Cell key={w.name} fill={color} fillOpacity={w.rate === top && top > 0 ? 1 : 0.45} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section
        title="Year at a glance"
        right={
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            missed
            {(["missed", "partial", "done"] as DayState[]).map((s) => (
              <span key={s} className="h-2.5 w-2.5 rounded-[2px]" style={cellStyle(s, color)} />
            ))}
            done
          </div>
        }
      >
        <div ref={yearRef} className="overflow-x-auto pb-2">
          <div className="inline-flex gap-[3px]">
            <div className="mr-1 flex flex-col gap-[3px] pt-4 text-[9px] leading-[12px] text-muted-foreground">
              {["M", "", "W", "", "F", "", "S"].map((d, i) => <span key={i} className="h-3">{d}</span>)}
            </div>
            {grid.map((week, wi) => {
              const first = week[0].date;
              const showMonth = wi === 0 || first.getDate() <= 7;
              return (
                <div key={wi} className="flex flex-col gap-[3px]">
                  <span className="h-4 whitespace-nowrap text-[9px] text-muted-foreground">{showMonth ? format(first, "MMM") : ""}</span>
                  {week.map((c) => (
                    <span
                      key={c.date.toISOString()}
                      title={`${format(c.date, "EEE d MMM yyyy")}: ${c.state === "none" ? "—" : `${c.value} ${habit.unit}`}`}
                      className="h-3 w-3 rounded-[2px]"
                      style={cellStyle(c.state, color)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Longest streaks">
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed days yet.</p>
        ) : (
          <ol className="space-y-2">
            {runs.slice(0, 5).map((r, i) => (
              <li key={r.start.toISOString()} className="flex items-center gap-2">
                <span className="w-4 text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="h-5 rounded" style={{ width: `${Math.max(6, (r.length / best) * 100)}%`, backgroundColor: color, opacity: i === 0 ? 1 : 0.55 }} />
                  <span className="text-[11px] text-muted-foreground">
                    {format(r.start, "d MMM yyyy")} – {format(r.end, "d MMM yyyy")}
                  </span>
                </div>
                <span className="w-14 text-right text-sm font-semibold">{r.length} d</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
