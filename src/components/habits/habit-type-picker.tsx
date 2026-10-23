import { cn } from "@/lib/utils";

type HabitType = "standard" | "snowball";

/** Classic habit: a fixed bullseye — the target stays where you put it. */
function ClassicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="4" fill="currentColor" />
    </svg>
  );
}

/** Snowball: a rolling ball with speed lines — the target grows (or shrinks) as you go. */
function SnowballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M3 18h9M1 25h10M4 32h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <circle cx="29" cy="25" r="15" fill="#e0f2fe" stroke="currentColor" strokeWidth="2.5" />
      <path d="M21 18c2-3 6-5 10-4" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="33" cy="30" r="2" fill="#7dd3fc" />
      <circle cx="25" cy="31" r="1.5" fill="#7dd3fc" />
      <circle cx="36" cy="21" r="1.5" fill="#7dd3fc" />
    </svg>
  );
}

const OPTIONS: { value: HabitType; title: string; subtitle: string; Icon: typeof ClassicIcon }[] = [
  { value: "standard", title: "Classic", subtitle: "Fixed target", Icon: ClassicIcon },
  { value: "snowball", title: "Snowball", subtitle: "Target adapts", Icon: SnowballIcon },
];

export function HabitTypePicker({
  value,
  onChange,
}: {
  value: HabitType;
  onChange: (value: HabitType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup">
      {OPTIONS.map(({ value: v, title, subtitle, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center transition-colors",
              active
                ? "border-primary bg-primary/5 text-primary"
                : "border-muted text-muted-foreground hover:border-primary/40",
            )}
          >
            <Icon className="h-10 w-10" />
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <span className="text-xs">{subtitle}</span>
          </button>
        );
      })}
    </div>
  );
}
