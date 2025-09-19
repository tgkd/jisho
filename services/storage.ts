import { MMKV } from "react-native-mmkv";


export const SETTINGS_KEYS = {
  HIGHLIGHT_COLOR: "settings.highlightColor",
  SHOW_FURIGANA: "settings.showFurigana",
  API_AUTH_USERNAME: "settings.apiAuthUsername",
  API_AUTH_PASSWORD: "settings.apiAuthPassword",
  LOCAL_AI_ENABLED: "settings.localAIEnabled",
  LOCAL_AI_MODEL: "settings.localAIModel",
  AI_TYPE: "settings.aiType", // "local" | "remote"
};

export const settingsStorage = new MMKV();
