import { MMKV } from "react-native-mmkv";


export const SETTINGS_KEYS = {
  HIGHLIGHT_COLOR: "settings.highlightColor",
  SHOW_FURIGANA: "settings.showFurigana",
  API_AUTH_USERNAME: "settings.apiAuthUsername",
  API_AUTH_PASSWORD: "settings.apiAuthPassword",
  AI_PROVIDER_TYPE: "settings.aiProviderType",
  SEARCH_MODE: "settings.searchMode",
};

export const settingsStorage = new MMKV();
