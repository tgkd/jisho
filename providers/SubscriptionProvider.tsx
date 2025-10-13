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
import RevenueCatUI from "react-native-purchases-ui";

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

  const deriveSubscriptionInfo = useCallback(
    (customerInfo: CustomerInfo): SubscriptionInfo => {
      const hasActiveEntitlement =
        typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";

      if (!hasActiveEntitlement) {
        return {
          status: "inactive",
          isActive: false,
          isTrial: false,
        };
      }

      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      const periodType = String(entitlement.periodType || "").toLowerCase();
      const isTrial = periodType === "trial";
      const status: SubscriptionStatus = isTrial ? "trial" : "active";

      return {
        status,
        productId: entitlement.productIdentifier,
        purchaseDate: entitlement.originalPurchaseDate,
        isActive: true,
        isTrial,
      };
    },
    []
  );

  const updateSubscriptionState = useCallback(
    (customerInfo: CustomerInfo): void => {
      const info = deriveSubscriptionInfo(customerInfo);
      setSubscriptionInfo(info);

      if (info.isActive) {
        settingsStorage.set(SETTINGS_KEYS.AI_PROVIDER_TYPE, "remote");
      } else {
        const currentProvider = settingsStorage.getString(
          SETTINGS_KEYS.AI_PROVIDER_TYPE
        );
        if (currentProvider === "remote") {
          settingsStorage.set(SETTINGS_KEYS.AI_PROVIDER_TYPE, "local");
        }
      }
    },
    [deriveSubscriptionInfo]
  );

  const refreshSubscription = useCallback(async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      updateSubscriptionState(customerInfo);

      const userId = await Purchases.getAppUserID();
      if (userId) {
        settingsStorage.set(SETTINGS_KEYS.REVENUECAT_USER_ID, userId);
      }
    } catch (error) {
      console.error("Failed to refresh subscription:", error);
      setSubscriptionInfo({
        status: "inactive",
        isActive: false,
        isTrial: false,
      });
    }
  }, [updateSubscriptionState]);

  useEffect(() => {
    const initialize = async () => {
      try {
        Purchases.setLogLevel(LOG_LEVEL.ERROR);
        const key = Platform.select({
          ios: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || "",
          android: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || "",
        });
        await Purchases.configure({ apiKey: key || "" });

        const userId = await Purchases.getAppUserID();

        if (userId) {
          settingsStorage.set(SETTINGS_KEYS.REVENUECAT_USER_ID, userId);
        }

        const offerings = await Purchases.getOfferings();

        if (offerings.current?.availablePackages) {
          setPackages(offerings.current.availablePackages);
        }

        await refreshSubscription();
      } catch (error) {
        console.error("Failed to initialize RevenueCat:", error);
      }
    };

    initialize();
  }, []);

  const showPaywall = useCallback(async () => {
    try {
      const result = await RevenueCatUI.presentPaywall();

      if (
        result &&
        typeof result === "object" &&
        "purchasedOrRestored" in result
      ) {
        await refreshSubscription();
      }
    } catch (error) {
      console.error("Failed to show paywall:", error);
    }
  }, [refreshSubscription]);

  const restore = useCallback(async () => {
    setIsLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();

      const info = deriveSubscriptionInfo(customerInfo);
      updateSubscriptionState(customerInfo);

      const userId = await Purchases.getAppUserID();
      if (userId) {
        settingsStorage.set(SETTINGS_KEYS.REVENUECAT_USER_ID, userId);
      }

      return info.isActive;
    } catch (error) {
      console.error("Restore failed:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [deriveSubscriptionInfo, updateSubscriptionState]);

  const contextValue: SubscriptionContextValue = {
    subscriptionInfo,
    isPremium: subscriptionInfo.isActive,
    isTrial: subscriptionInfo.isTrial,
    showPaywall,
    refreshSubscription,
    packages,
    isLoading,
    restore,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}
