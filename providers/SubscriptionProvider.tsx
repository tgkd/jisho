import {
  SubscriptionContext,
  SubscriptionContextValue,
} from "@/providers/SubscriptionContext";
import { SETTINGS_KEYS, settingsStorage } from "@/services/storage";
import React, { ReactNode, useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesPackage,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

const ENTITLEMENT_ID = "Pro";

export type SubscriptionStatus = "active" | "trial" | "inactive";

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
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getLocalSubscriptionInfo = useCallback((): SubscriptionInfo => {
    const status = settingsStorage.getString(
      SETTINGS_KEYS.SUBSCRIPTION_STATUS
    ) as SubscriptionStatus | undefined;
    const productId = settingsStorage.getString(
      SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID
    );

    const currentStatus =
      status === "active" || status === "trial" ? status : "inactive";
    const isActive = currentStatus === "active" || currentStatus === "trial";
    const isTrial = currentStatus === "trial";

    return {
      status: currentStatus,
      productId,
      isActive,
      isTrial,
    };
  }, []);

  const updateSubscriptionFromCustomerInfo = useCallback(
    (customerInfo: CustomerInfo) => {
      const hasActiveEntitlement =
        typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";

      if (hasActiveEntitlement) {
        const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
        const periodType = String(entitlement.periodType || "").toLowerCase();
        const isTrial = periodType === "trial";

        settingsStorage.set(
          SETTINGS_KEYS.SUBSCRIPTION_STATUS,
          isTrial ? "trial" : "active"
        );
        settingsStorage.set(
          SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID,
          entitlement.productIdentifier
        );
      } else {
        const localInfo = getLocalSubscriptionInfo();
        if (localInfo.status !== "inactive") {
          settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, "inactive");
        }
        settingsStorage.delete(SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID);
      }
    },
    [getLocalSubscriptionInfo]
  );

  const refreshSubscription = useCallback(async () => {
    try {
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      const customerInfo = await Purchases.getCustomerInfo();
      updateSubscriptionFromCustomerInfo(customerInfo);

      const userId = await Purchases.getAppUserID();
      if (userId) {
        settingsStorage.set(SETTINGS_KEYS.REVENUECAT_USER_ID, userId);
      }
    } catch (error) {
      console.error("Failed to refresh subscription:", error);
    }

    const info = getLocalSubscriptionInfo();
    setSubscriptionInfo(info);
  }, [getLocalSubscriptionInfo, updateSubscriptionFromCustomerInfo]);

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

  const upgrade = useCallback(
    (productId: string) => {
      settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, "active");
      settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID, productId);
      refreshSubscription();
    },
    [refreshSubscription]
  );

  const cancel = useCallback(() => {
    settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, "inactive");
    settingsStorage.delete(SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID);
    refreshSubscription();
  }, [refreshSubscription]);

  const showPaywall = useCallback(async () => {
    await RevenueCatUI.presentPaywall();
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
    upgrade,
    cancel,
    showPaywall,
    packages,
    isLoading,
    purchase,
    restore,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}
