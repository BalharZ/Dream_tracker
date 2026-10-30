import { Check, Crown, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Why the paywall opened — picks the headline so it always matches what the user just tried. */
export type PaywallReason =
  | "dream-limit"
  | "habit-limit"
  | "stats"
  | "history"
  | "export"
  | "ai-coach"
  | "ai-images"
  | "reminders"
  | "upgrade";

const HEADLINES: Record<PaywallReason, { title: string; text: string }> = {
  "dream-limit": { title: "Dream bigger with Pro", text: "Free covers 3 dreams. Pro has no limits — add every dream you have." },
  "habit-limit": { title: "More habits with Pro", text: "Free covers 5 active habits. Archive one, or go Pro for unlimited habits." },
  stats: { title: "See what really works", text: "Pro unlocks every chart: trends, best and weakest days, the year view and when you'll reach your goal." },
  history: { title: "Your whole history", text: "Free shows the last 3 months. Pro keeps your entire history in view." },
  export: { title: "Beautiful exports", text: "Pro exports to Excel and PDF reports, with automatic backups you can restore." },
  "ai-coach": { title: "Meet your AI coach", text: "Break dreams into goals, plan your week and get a weekly review — with Pro + AI." },
  "ai-images": { title: "Picture your dream", text: "Generate images of your dream — even you, at your goal — with Pro + AI." },
  reminders: { title: "Smarter reminders", text: "Motivational reminders, several a day and at the time you usually act — with Pro." },
  upgrade: { title: "Go further with Northstar Pro", text: "Unlimited dreams and habits, full stats, exports — and an AI coach." },
};

// Prices from docs/MONETIZATION.md §2 — shown for the test build only; real
// prices come from Google Play once payments are wired up (S66).
const PLANS = [
  {
    id: "lifetime",
    name: "Pro Lifetime",
    price: "$99",
    note: "one-time · launch price (list $149)",
    features: ["Unlimited dreams & habits", "Full stats & history", "Excel / PDF export, backups", "Themes & icons"],
  },
  {
    id: "pro_ai",
    name: "Pro + AI",
    price: "$7.99",
    note: "per month · or $59.99 / year with a 7-day trial",
    features: ["Everything in Pro", "AI coach that sets up your habits", "Weekly AI review", "AI dream images"],
    highlight: true,
  },
];

export function PaywallDialog({ reason, onClose }: { reason: PaywallReason | null; onClose: () => void }) {
  const copy = HEADLINES[reason || "upgrade"];
  return (
    <Dialog open={reason !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.text}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex flex-col rounded-xl border p-4",
                p.highlight && "border-primary shadow-md ring-1 ring-primary/30",
              )}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                {p.highlight ? <Sparkles className="h-4 w-4 text-primary" /> : <Crown className="h-4 w-4 text-amber-500" />}
                {p.name}
              </div>
              <div className="mt-2 text-3xl font-bold">{p.price}</div>
              <div className="text-xs text-muted-foreground">{p.note}</div>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-4 w-full" variant={p.highlight ? "default" : "outline"} disabled>
                Coming soon
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Already have AI with Lifetime? The AI add-on will be $4.99 / month. Payments are not live yet.
        </p>
      </DialogContent>
    </Dialog>
  );
}
