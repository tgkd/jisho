import { SubscriptionInfo } from "@/providers/SubscriptionProvider";
import { createContext, useContext } from "react";
import type { PurchasesPackage } from "react-native-purchases";

export interface SubscriptionContextValue {
  subscriptionInfo: SubscriptionInfo;
  isPremium: boolean;
  isTrial: boolean;

  upgrade: (productId: string) => void;
  cancel: () => void;
  showPaywall: () => void;
  refreshSubscription: () => Promise<void>;

  packages: PurchasesPackage[];
  isLoading: boolean;
  purchase: (packageIdentifier: string) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

export const SubscriptionContext = createContext<
  SubscriptionContextValue | undefined
>(undefined);

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return context;
}
