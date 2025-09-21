import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";

import {
  getHistory,
  HistoryEntry,
  removeHistoryById
} from "@/services/database";

const PAGE_SIZE = 20;

export function useSearchHistory() {
  const db = useSQLiteContext();
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const loadHistory = useCallback(async (pageNum: number, append = false) => {
    setIsLoading(prev => {
      if (prev) return prev; // Don't start new load if already loading
      return true;
    });

    try {
      const offset = pageNum * PAGE_SIZE;
      const history = await getHistory(db, PAGE_SIZE, offset);

      if (append) {
        setHistoryItems(prev => [...prev, ...history]);
      } else {
        setHistoryItems(history);
        setPage(0);
      }

      setHasMore(history.length === PAGE_SIZE);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadHistory(0, false);
    }, [loadHistory])
  );

  const handleRemoveHistoryItem = async (item: HistoryEntry) => {
    try {
      await removeHistoryById(db, item.id);
      setHistoryItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (error) {
      console.error("Failed to remove history item:", error);
    }
  };

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadHistory(nextPage, true);
    }
  }, [hasMore, isLoading, page, loadHistory]);

  return {
    list: historyItems,
    removeItem: handleRemoveHistoryItem,
    loadMore,
    hasMore,
    isLoading
  };
}
