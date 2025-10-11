import { MMKV } from "react-native-mmkv";


export const SETTINGS_KEYS = {
  HIGHLIGHT_COLOR: "settings.highlightColor",
  SHOW_FURIGANA: "settings.showFurigana",
  AI_PROVIDER_TYPE: "settings.aiProviderType",
  SEARCH_MODE: "settings.searchMode",
  SUBSCRIPTION_STATUS: "subscription.status",
  SUBSCRIPTION_PRODUCT_ID: "subscription.productId",
  REVENUECAT_USER_ID: "subscription.revenuecatUserId",
};

export const settingsStorage = new MMKV();
