import * as Clipboard from "expo-clipboard";
import * as wanakana from "wanakana";
import { useEffect } from "react";

export function useClipboardInit(cb: (text: string) => void) {
  useEffect(() => {
    const checkClipboardContent = async () => {
      try {
        if (!Clipboard.isPasteButtonAvailable) {
          return;
        }
        const text = await Clipboard.getStringAsync();

        if (text && wanakana.isJapanese(text)) {
          cb(text);
        }
      } catch (error) {
        console.error("Error accessing clipboard:", error);
      }
    };

    checkClipboardContent();
  }, []);
}
