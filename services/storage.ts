import { MMKV } from "react-native-mmkv";

export const SETTINGS_KEYS = {
  HIGHLIGHT_COLOR: "settings.highlightColor",
  SHOW_FURIGANA: "settings.showFurigana",
  AUTO_PASTE: "settings.autoPaste",
};

export const settingsStorage = new MMKV();
