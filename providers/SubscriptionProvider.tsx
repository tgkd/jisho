import { PaywallPrompt } from "@/components/PaywallPrompt";
import { SubscriptionContext, SubscriptionContextValue } from "@/providers/SubscriptionContext";
import {
  activateSubscription,
  cancelSubscription,
  canUseAIFeature,
  getDailyAIUsage,
  getSubscriptionInfo, getTrialDaysRemaining,
  incrementAIUsage, startFreeTrial,
  SubscriptionInfo
} from "@/services/subscription";
import React, { ReactNode, useCallback, useEffect, useState } from "react";

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo>(getSubscriptionInfo());
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(getTrialDaysRemaining());
  const [dailyUsage, setDailyUsage] = useState(getDailyAIUsage());
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | undefined>();
  const [products, setProducts] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSubscription = useCallback(() => {
    const info = getSubscriptionInfo();
    setSubscriptionInfo(info);
    setTrialDaysRemaining(getTrialDaysRemaining());
    setDailyUsage(getDailyAIUsage());
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await initializeIAP();
        const availableProducts = await getSubscriptionProducts();
        if (mounted) {
          setProducts(availableProducts);
        }
      } catch (error) {
        console.error("Failed to initialize IAP:", error);
      }
    };

    initialize();
    refreshSubscription();

    const interval = setInterval(() => {
      refreshSubscription();
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshSubscription]);

  const startTrial = useCallback(() => {
    const success = startFreeTrial();
    if (success) {
      refreshSubscription();
    }
    return success;
  }, [refreshSubscription]);

  const upgrade = useCallback((productId: string) => {
    activateSubscription(productId);
    refreshSubscription();
  }, [refreshSubscription]);

  const cancel = useCallback(() => {
    cancelSubscription();
    refreshSubscription();
  }, [refreshSubscription]);

  const canUseAI = useCallback(() => {
    return canUseAIFeature();
  }, []);

  const trackAIUsage = useCallback(() => {
    incrementAIUsage();
    setDailyUsage(getDailyAIUsage());
  }, []);

  const showPaywall = useCallback((feature?: string) => {
    setPaywallFeature(feature);
    setPaywallVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPaywallFeature(undefined);
  }, []);

  const purchase = useCallback(async (productId: string) => {
    setIsLoading(true);
    try {
      await purchaseSubscription(productId);
      refreshSubscription();
      return true;
    } catch (error) {
      console.error("Purchase failed:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshSubscription]);

  const restore = useCallback(async () => {
    setIsLoading(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        refreshSubscription();
      }
      return restored;
    } catch (error) {
      console.error("Restore failed:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshSubscription]);

  const contextValue: SubscriptionContextValue = {
    subscriptionInfo,
    isPremium: subscriptionInfo.isActive,
    isTrial: subscriptionInfo.isTrial,
    trialDaysRemaining,
    dailyUsage,
    startTrial,
    upgrade,
    cancel,
    canUseAI,
    trackAIUsage,
    refreshSubscription,
    showPaywall,
    hidePaywall,
    products,
    isLoading,
    purchase,
    restore,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
      <PaywallPrompt
        visible={paywallVisible}
        onClose={hidePaywall}
        feature={paywallFeature}
      />
    </SubscriptionContext.Provider>
  );
}
