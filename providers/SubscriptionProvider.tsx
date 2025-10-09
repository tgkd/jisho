import { PaywallPrompt } from "@/components/PaywallPrompt";
import {
  SubscriptionContext,
  SubscriptionContextValue,
} from "@/providers/SubscriptionContext";
import { SETTINGS_KEYS, settingsStorage } from "@/services/storage";
import React, { ReactNode, useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesPackage
} from "react-native-purchases";

const TRIAL_DURATION_DAYS = 7;
const FREE_AI_QUERIES_PER_DAY = 3;
const ENTITLEMENT_ID = "Pro";

export type SubscriptionStatus = "active" | "trial" | "inactive" | "expired";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  productId?: string;
  purchaseDate?: string;
  trialEndDate?: string;
  isActive: boolean;
  isTrial: boolean;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo>({
    status: "inactive",
    isActive: false,
    isTrial: false,
  });
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(
    null
  );
  const [dailyUsage, setDailyUsage] = useState({
    count: 0,
    limit: FREE_AI_QUERIES_PER_DAY,
    resetsAt: "",
  });
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | undefined>();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getLocalSubscriptionInfo = useCallback((): SubscriptionInfo => {
    const status = settingsStorage.getString(
      SETTINGS_KEYS.SUBSCRIPTION_STATUS
    ) as SubscriptionStatus | undefined;
    const productId = settingsStorage.getString(
      SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID
    );
    const purchaseDate = settingsStorage.getString(
      SETTINGS_KEYS.SUBSCRIPTION_PURCHASE_DATE
    );
    const trialEndDate = settingsStorage.getString(
      SETTINGS_KEYS.TRIAL_END_DATE
    );

    const currentStatus = status || "inactive";
    const isActive = currentStatus === "active" || currentStatus === "trial";
    const isTrial = currentStatus === "trial";

    if (isTrial && trialEndDate) {
      const trialEnd = new Date(trialEndDate);
      if (new Date() > trialEnd) {
        settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, "expired");
        return {
          status: "expired",
          productId,
          purchaseDate,
          trialEndDate,
          isActive: false,
          isTrial: false,
        };
      }
    }

    return {
      status: currentStatus,
      productId,
      purchaseDate,
      trialEndDate,
      isActive,
      isTrial,
    };
  }, []);

  const getTrialDaysRemainingValue = useCallback((): number | null => {
    const info = getLocalSubscriptionInfo();
    if (!info.isTrial || !info.trialEndDate) {
      return null;
    }
    const trialEnd = new Date(info.trialEndDate);
    const now = new Date();
    const diffMs = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [getLocalSubscriptionInfo]);

  const getDailyAIUsageValue = useCallback(() => {
    const info = getLocalSubscriptionInfo();
    if (info.isActive) {
      return { count: 0, limit: Infinity, resetsAt: "" };
    }

    const usageResetDate = settingsStorage.getString(
      SETTINGS_KEYS.AI_USAGE_RESET_DATE
    );
    const today = new Date().toDateString();

    if (usageResetDate !== today) {
      settingsStorage.set(SETTINGS_KEYS.AI_USAGE_COUNT, 0);
      settingsStorage.set(SETTINGS_KEYS.AI_USAGE_RESET_DATE, today);
    }

    const count = settingsStorage.getNumber(SETTINGS_KEYS.AI_USAGE_COUNT) || 0;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return {
      count,
      limit: FREE_AI_QUERIES_PER_DAY,
      resetsAt: tomorrow.toISOString(),
    };
  }, [getLocalSubscriptionInfo]);

  const updateSubscriptionFromCustomerInfo = useCallback(
    (customerInfo: CustomerInfo) => {
      const hasActiveEntitlement =
        typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";

      if (hasActiveEntitlement) {
        const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
        settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, "active");
        settingsStorage.set(
          SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID,
          entitlement.productIdentifier
        );
        if (
          !settingsStorage.getString(SETTINGS_KEYS.SUBSCRIPTION_PURCHASE_DATE)
        ) {
          settingsStorage.set(
            SETTINGS_KEYS.SUBSCRIPTION_PURCHASE_DATE,
            new Date().toISOString()
          );
        }
      } else {
        const localInfo = getLocalSubscriptionInfo();
        if (localInfo.status === "active") {
          settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, "inactive");
        }
      }
    },
    [getLocalSubscriptionInfo]
  );

  const refreshSubscription = useCallback(async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      updateSubscriptionFromCustomerInfo(customerInfo);

      // Update user ID on each refresh
      const userId = await Purchases.getAppUserID();
      if (userId) {
        settingsStorage.set(SETTINGS_KEYS.REVENUECAT_USER_ID, userId);
      }
    } catch (error) {
      console.error("Failed to refresh subscription:", error);
    }

    const info = getLocalSubscriptionInfo();
    setSubscriptionInfo(info);
    setTrialDaysRemaining(getTrialDaysRemainingValue());
    setDailyUsage(getDailyAIUsageValue());
  }, [
    getLocalSubscriptionInfo,
    getTrialDaysRemainingValue,
    getDailyAIUsageValue,
    updateSubscriptionFromCustomerInfo,
  ]);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        if (Platform.OS === "ios") {
          Purchases.configure({
            apiKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || "",
          });
        } else if (Platform.OS === "android") {
          Purchases.configure({
            apiKey: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || "",
          });
        }

        // Store RevenueCat user ID for API authentication
        const userId = await Purchases.getAppUserID();

        if (userId) {
          settingsStorage.set(SETTINGS_KEYS.REVENUECAT_USER_ID, userId);
        }

        const offerings = await Purchases.getOfferings();
        if (mounted && offerings.current?.availablePackages) {
          setPackages(offerings.current.availablePackages);
        }

        await refreshSubscription();
      } catch (error) {
        console.error("Failed to initialize RevenueCat:", error);
      }
    };

    initialize();

    const interval = setInterval(() => {
      refreshSubscription();
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [refreshSubscription]);

  const startTrial = useCallback(() => {
    const currentInfo = getLocalSubscriptionInfo();
    if (currentInfo.trialEndDate) {
      return false;
    }

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

    settingsStorage.set(
      SETTINGS_KEYS.TRIAL_END_DATE,
      trialEndDate.toISOString()
    );
    settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, "trial");
    settingsStorage.set(SETTINGS_KEYS.AI_USAGE_COUNT, 0);
    settingsStorage.set(
      SETTINGS_KEYS.AI_USAGE_RESET_DATE,
      new Date().toDateString()
    );

    const info = getLocalSubscriptionInfo();
    setSubscriptionInfo(info);
    setTrialDaysRemaining(getTrialDaysRemainingValue());
    setDailyUsage(getDailyAIUsageValue());

    return true;
  }, [
    getLocalSubscriptionInfo,
    getTrialDaysRemainingValue,
    getDailyAIUsageValue,
  ]);

  const upgrade = useCallback(
    (productId: string) => {
      settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, "active");
      settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID, productId);
      if (
        !settingsStorage.getString(SETTINGS_KEYS.SUBSCRIPTION_PURCHASE_DATE)
      ) {
        settingsStorage.set(
          SETTINGS_KEYS.SUBSCRIPTION_PURCHASE_DATE,
          new Date().toISOString()
        );
      }
      refreshSubscription();
    },
    [refreshSubscription]
  );

  const cancel = useCallback(() => {
    settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, "inactive");
    refreshSubscription();
  }, [refreshSubscription]);

  const canUseAI = useCallback(() => {
    const info = getLocalSubscriptionInfo();
    if (info.isActive) {
      return { allowed: true };
    }

    const usage = getDailyAIUsageValue();
    if (usage.count >= usage.limit) {
      return {
        allowed: false,
        reason: "Daily limit reached. Upgrade to Pro for unlimited access.",
        remaining: 0,
      };
    }

    return { allowed: true, remaining: usage.limit - usage.count };
  }, [getLocalSubscriptionInfo, getDailyAIUsageValue]);

  const trackAIUsage = useCallback(() => {
    const info = getLocalSubscriptionInfo();
    if (info.isActive) {
      return;
    }

    const usageResetDate = settingsStorage.getString(
      SETTINGS_KEYS.AI_USAGE_RESET_DATE
    );
    const today = new Date().toDateString();

    if (usageResetDate !== today) {
      settingsStorage.set(SETTINGS_KEYS.AI_USAGE_COUNT, 0);
      settingsStorage.set(SETTINGS_KEYS.AI_USAGE_RESET_DATE, today);
    }

    const currentCount =
      settingsStorage.getNumber(SETTINGS_KEYS.AI_USAGE_COUNT) || 0;
    settingsStorage.set(SETTINGS_KEYS.AI_USAGE_COUNT, currentCount + 1);
    setDailyUsage(getDailyAIUsageValue());
  }, [getLocalSubscriptionInfo, getDailyAIUsageValue]);

  const showPaywall = useCallback((feature?: string) => {
    setPaywallFeature(feature);
    setPaywallVisible(true);
  }, []);

  const hidePaywall = useCallback(() => {
    setPaywallVisible(false);
    setPaywallFeature(undefined);
  }, []);

  const purchase = useCallback(
    async (packageIdentifier: string) => {
      setIsLoading(true);
      try {
        const pkg = packages.find((p) => p.identifier === packageIdentifier);
        if (!pkg) {
          throw new Error("Package not found");
        }

        const { customerInfo } = await Purchases.purchasePackage(pkg);
        updateSubscriptionFromCustomerInfo(customerInfo);

        if (
          typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !==
          "undefined"
        ) {
          await refreshSubscription();
          return true;
        }
        return false;
      } catch (error: any) {
        if (!error.userCancelled) {
          console.error("Purchase failed:", error);
        }
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [packages, updateSubscriptionFromCustomerInfo, refreshSubscription]
  );

  const restore = useCallback(async () => {
    setIsLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      updateSubscriptionFromCustomerInfo(customerInfo);
      await refreshSubscription();

      return (
        typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined"
      );
    } catch (error) {
      console.error("Restore failed:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [updateSubscriptionFromCustomerInfo, refreshSubscription]);

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
    packages,
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
