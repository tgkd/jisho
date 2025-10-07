import { settingsStorage, SETTINGS_KEYS } from "./storage";

export type SubscriptionStatus = "active" | "trial" | "inactive" | "expired";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  productId?: string;
  purchaseDate?: string;
  trialEndDate?: string;
  isActive: boolean;
  isTrial: boolean;
}

const PRODUCT_IDS = {
  MONTHLY: "com.jisho.premium.monthly",
} as const;

const SUBSCRIPTION_SKUS = [PRODUCT_IDS.MONTHLY];

const TRIAL_DURATION_DAYS = 7;
const FREE_AI_QUERIES_PER_DAY = 3;

export function getSubscriptionInfo(): SubscriptionInfo {
  const status = settingsStorage.getString(SETTINGS_KEYS.SUBSCRIPTION_STATUS) as SubscriptionStatus | undefined;
  const productId = settingsStorage.getString(SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID);
  const purchaseDate = settingsStorage.getString(SETTINGS_KEYS.SUBSCRIPTION_PURCHASE_DATE);
  const trialEndDate = settingsStorage.getString(SETTINGS_KEYS.TRIAL_END_DATE);

  const currentStatus = status || "inactive";
  const isActive = currentStatus === "active" || currentStatus === "trial";
  const isTrial = currentStatus === "trial";

  if (isTrial && trialEndDate) {
    const trialEnd = new Date(trialEndDate);
    if (new Date() > trialEnd) {
      setSubscriptionStatus("expired");
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
}

export function setSubscriptionStatus(status: SubscriptionStatus, productId?: string): void {
  settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_STATUS, status);

  if (productId) {
    settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID, productId);
  }

  if (status === "active" && !settingsStorage.getString(SETTINGS_KEYS.SUBSCRIPTION_PURCHASE_DATE)) {
    settingsStorage.set(SETTINGS_KEYS.SUBSCRIPTION_PURCHASE_DATE, new Date().toISOString());
  }
}

export function startFreeTrial(): boolean {
  const currentInfo = getSubscriptionInfo();

  if (currentInfo.trialEndDate) {
    return false;
  }

  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

  settingsStorage.set(SETTINGS_KEYS.TRIAL_END_DATE, trialEndDate.toISOString());
  setSubscriptionStatus("trial");

  resetDailyUsage();

  return true;
}

export function activateSubscription(productId: string): void {
  setSubscriptionStatus("active", productId);
  resetDailyUsage();
}

export function cancelSubscription(): void {
  setSubscriptionStatus("inactive");
}

export function getTrialDaysRemaining(): number | null {
  const info = getSubscriptionInfo();

  if (!info.isTrial || !info.trialEndDate) {
    return null;
  }

  const trialEnd = new Date(info.trialEndDate);
  const now = new Date();
  const diffMs = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

export function canUseAIFeature(): { allowed: boolean; reason?: string; remaining?: number } {
  const info = getSubscriptionInfo();

  if (info.isActive) {
    return { allowed: true };
  }

  const { count, limit } = getDailyAIUsage();

  if (count >= limit) {
    return {
      allowed: false,
      reason: "Daily limit reached. Upgrade to Pro for unlimited access.",
      remaining: 0
    };
  }

  return { allowed: true, remaining: limit - count };
}

export function incrementAIUsage(): void {
  const info = getSubscriptionInfo();

  if (info.isActive) {
    return;
  }

  const usageResetDate = settingsStorage.getString(SETTINGS_KEYS.AI_USAGE_RESET_DATE);
  const today = new Date().toDateString();

  if (usageResetDate !== today) {
    resetDailyUsage();
  }

  const currentCount = settingsStorage.getNumber(SETTINGS_KEYS.AI_USAGE_COUNT) || 0;
  settingsStorage.set(SETTINGS_KEYS.AI_USAGE_COUNT, currentCount + 1);
}

export function getDailyAIUsage(): { count: number; limit: number; resetsAt: string } {
  const info = getSubscriptionInfo();

  if (info.isActive) {
    return { count: 0, limit: Infinity, resetsAt: "" };
  }

  const usageResetDate = settingsStorage.getString(SETTINGS_KEYS.AI_USAGE_RESET_DATE);
  const today = new Date().toDateString();

  if (usageResetDate !== today) {
    resetDailyUsage();
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
}

function resetDailyUsage(): void {
  settingsStorage.set(SETTINGS_KEYS.AI_USAGE_COUNT, 0);
  settingsStorage.set(SETTINGS_KEYS.AI_USAGE_RESET_DATE, new Date().toDateString());
}

export function clearSubscriptionData(): void {
  settingsStorage.delete(SETTINGS_KEYS.SUBSCRIPTION_STATUS);
  settingsStorage.delete(SETTINGS_KEYS.SUBSCRIPTION_PRODUCT_ID);
  settingsStorage.delete(SETTINGS_KEYS.TRIAL_END_DATE);
  settingsStorage.delete(SETTINGS_KEYS.SUBSCRIPTION_PURCHASE_DATE);
  resetDailyUsage();
}

export async function initializeIAP(): Promise<void> {
  try {
    await RNIap.initConnection();
    await RNIap.flushFailedPurchasesCachedAsPendingAndroid();
  } catch (error) {
    console.error("Failed to initialize IAP:", error);
    throw error;
  }
}

export async function endIAP(): Promise<void> {
  try {
    await RNIap.endConnection();
  } catch (error) {
    console.error("Failed to end IAP connection:", error);
  }
}

export async function getSubscriptionProducts(): Promise<Subscription[]> {
  try {
    const products = await RNIap.getSubscriptions({ skus: SUBSCRIPTION_SKUS });
    return products;
  } catch (error) {
    console.error("Failed to fetch subscription products:", error);
    throw error;
  }
}

export async function purchaseSubscription(productId: string): Promise<void> {
  try {
    const purchase = await RNIap.requestSubscription({ sku: productId });

    if (purchase) {
      await validateAndActivatePurchase(purchase);
    }
  } catch (error) {
    if ((error as any).code === "E_USER_CANCELLED") {
      throw new Error("Purchase cancelled");
    }
    console.error("Purchase failed:", error);
    throw error;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const purchases = await RNIap.getAvailablePurchases();

    if (purchases.length === 0) {
      return false;
    }

    for (const purchase of purchases) {
      await validateAndActivatePurchase(purchase);
    }

    return true;
  } catch (error) {
    console.error("Failed to restore purchases:", error);
    throw error;
  }
}

async function validateAndActivatePurchase(purchase: ProductPurchase | Purchase): Promise<void> {
  try {
    const receipt = purchase.transactionReceipt;

    if (!receipt) {
      throw new Error("No receipt found");
    }

    activateSubscription(purchase.productId);

    await RNIap.finishTransaction({ purchase, isConsumable: false });
  } catch (error) {
    console.error("Failed to validate purchase:", error);
    throw error;
  }
}

export { PRODUCT_IDS };
