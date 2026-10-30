import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/hooks/use-plan";
import type { PaywallReason } from "@/components/plan/paywall-dialog";

/**
 * S58: shows Pro content to free users blurred — their *real* data, so they
 * see what they'd get — with a lock and an "Unlock Pro" button on top.
 * Pro users get the children unchanged.
 */
export function Locked({
  children,
  title,
  reason = "stats",
}: {
  children: ReactNode;
  title: string;
  reason?: PaywallReason;
}) {
  const { isPro, openPaywall } = usePlan();
  if (isPro) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none blur-[6px] saturate-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-10">
        <div className="mx-4 flex max-w-sm flex-col items-center gap-2 rounded-xl border bg-background/95 p-4 text-center shadow-elevated">
          <Lock className="h-5 w-5 text-amber-500" />
          <p className="text-sm font-medium">{title}</p>
          <Button size="sm" onClick={() => openPaywall(reason)}>
            Unlock Pro
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A hidden value ("■■■■") for teasers like "Your weakest day is ■■■■". */
export const Masked = ({ length = 4 }: { length?: number }) => (
  <span aria-label="hidden — Pro" className="tracking-tighter text-muted-foreground">
    {"■".repeat(length)}
  </span>
);
