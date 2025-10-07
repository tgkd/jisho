import { SubscriptionInfo } from "@/services/subscription";
import { createContext, useContext } from "react";
import type { Subscription } from "react-native-iap";

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

  products: Subscription[];
  isLoading: boolean;
  purchase: (productId: string) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

export const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return context;
}
