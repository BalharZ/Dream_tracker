import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { PaywallDialog, type PaywallReason } from "@/components/plan/paywall-dialog";

/**
 * Free / Pro plans (S57, docs/MONETIZATION.md §1).
 *
 * Until payments exist (S66) the plan comes from a TEST switch in Settings,
 * stored in this browser only. S66 replaces `readTestPlan` with the
 * `entitlements` table written by the RevenueCat webhook — everything else
 * (limits, paywall, isPro checks) stays the same.
 */
export type Plan = "free" | "pro" | "pro_ai";

export const FREE_LIMITS = { dreams: 3, habits: 5, historyDays: 90 } as const;

const TEST_PLAN_KEY = "ns-test-plan";

function readTestPlan(): Plan {
  try {
    const v = localStorage.getItem(TEST_PLAN_KEY);
    return v === "pro" || v === "pro_ai" ? v : "free";
  } catch {
    return "free";
  }
}

type PlanContextValue = {
  plan: Plan;
  isPro: boolean;
  hasAI: boolean;
  setTestPlan: (plan: Plan) => void;
  openPaywall: (reason: PaywallReason) => void;
  /** True when a free user may still add one more; otherwise opens the paywall. */
  allowCreate: (kind: "dreams" | "habits", currentCount: number) => boolean;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<Plan>(readTestPlan);
  const [paywall, setPaywall] = useState<PaywallReason | null>(null);

  const setTestPlan = useCallback((next: Plan) => {
    try {
      localStorage.setItem(TEST_PLAN_KEY, next);
    } catch {
      // Private mode: the switch just lasts for this session.
    }
    setPlan(next);
  }, []);

  const isPro = plan !== "free";

  const allowCreate = useCallback(
    (kind: "dreams" | "habits", currentCount: number) => {
      if (isPro || currentCount < FREE_LIMITS[kind]) return true;
      setPaywall(kind === "dreams" ? "dream-limit" : "habit-limit");
      return false;
    },
    [isPro],
  );

  return (
    <PlanContext.Provider
      value={{ plan, isPro, hasAI: plan === "pro_ai", setTestPlan, openPaywall: setPaywall, allowCreate }}
    >
      {children}
      <PaywallDialog reason={paywall} onClose={() => setPaywall(null)} />
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within a PlanProvider");
  return ctx;
}
