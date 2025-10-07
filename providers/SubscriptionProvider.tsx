import { PaywallPrompt } from "@/components/PaywallPrompt";
import { SubscriptionContext, SubscriptionContextValue } from "@/providers/SubscriptionContext";
import {
  activateSubscription,
  cancelSubscription,
  canUseAIFeature, getDailyAIUsage, getSubscriptionInfo, getTrialDaysRemaining, incrementAIUsage, startFreeTrial, SubscriptionInfo
} from "@/services/subscription";
import React, { ReactNode, useCallback, useEffect, useState } from "react";

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo>(getSubscriptionInfo());
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(getTrialDaysRemaining());
  const [dailyUsage, setDailyUsage] = useState(getDailyAIUsage());
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | undefined>();

  const refreshSubscription = useCallback(() => {
    const info = getSubscriptionInfo();
    setSubscriptionInfo(info);
    setTrialDaysRemaining(getTrialDaysRemaining());
    setDailyUsage(getDailyAIUsage());
  }, []);

  useEffect(() => {
    refreshSubscription();

    const interval = setInterval(() => {
      refreshSubscription();
    }, 60000);

    return () => clearInterval(interval);
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
