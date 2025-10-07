import { SubscriptionInfo } from "@/services/subscription";
import { createContext, useContext } from "react";

export interface SubscriptionContextValue {
  subscriptionInfo: SubscriptionInfo;
  isPremium: boolean;
  isTrial: boolean;
  trialDaysRemaining: number | null;
  dailyUsage: { count: number; limit: number; resetsAt: string };

  startTrial: () => boolean;
  upgrade: (productId: string) => void;
  cancel: () => void;

  canUseAI: () => { allowed: boolean; reason?: string; remaining?: number };
  trackAIUsage: () => void;

  refreshSubscription: () => void;

  showPaywall: (feature?: string) => void;
  hidePaywall: () => void;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return context;
}
