import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";

import {
  getHistory,
  HistoryEntry,
  removeHistoryById,
} from "@/services/database";

export function useSearchHistory() {
  const db = useSQLiteContext();
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      const loadHistory = async () => {
        try {
          const history = await getHistory(db);
          setHistoryItems(history);
        } catch (error) {
          console.error("Failed to load history:", error);
        }
      };

      loadHistory();
    }, [])
  );

  const handleRemoveHistoryItem = async (item: HistoryEntry) => {
    try {
      await removeHistoryById(db, item.id);
      setHistoryItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (error) {
      console.error("Failed to remove history item:", error);
    }
  };

  return { list: historyItems, removeItem: handleRemoveHistoryItem };
}
