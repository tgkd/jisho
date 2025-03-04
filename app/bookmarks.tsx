import { Stack, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import * as wanakana from "wanakana";

import { BookmarkListItem } from "@/components/ListItem";
import { ThemedText } from "@/components/ThemedText";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import {
  getBookmarks,
  removeBookmark,
  type DictionaryEntry,
} from "@/services/database";

export default function BookmarksScreen() {
  const [search, setSearch] = useState("");
  const [bookmarks, setBookmarks] = useState<DictionaryEntry[]>([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState<DictionaryEntry[]>(
    []
  );
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchBookmarks = async () => {
        try {
          setLoading(true);
          const results = await getBookmarks(db);
          setBookmarks(results);
          setFilteredBookmarks(results);
        } catch (error) {
          console.error("Failed to fetch bookmarks:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchBookmarks();
    }, [])
  );

  const handleSearch = useDebouncedCallback((query: string) => {
    const text = query.trim().toLowerCase();

    if (text.length === 0) {
      setFilteredBookmarks(bookmarks);
      return;
    }

    const hiraganaText = wanakana.isRomaji(text)
      ? wanakana.toHiragana(text)
      : text;

    const filtered = bookmarks.filter((b) => {
      const matchWord = b.word.toLowerCase().includes(text);
      const matchKanji = b.kanji ? b.kanji.toLowerCase().includes(text) : false;
      const matchReading =
        b.reading.includes(text) || b.reading.includes(hiraganaText);
      let matchMeaning = false;
      if ("meaning" in b && typeof b.meaning === "string") {
        matchMeaning = b.meaning.toLowerCase().includes(text);
      }

      return matchWord || matchKanji || matchReading || matchMeaning;
    });

    setFilteredBookmarks(filtered);
  }, 300);

  const handleChange = (text: string) => {
    setSearch(text);
    handleSearch(text);
  };

  const handleRemoveBookmark = async (id: string | number) => {
    await removeBookmark(db, id as number);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    setFilteredBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const renderListHeader = () => {
    let text = "";

    if (loading) {
      text = "Loading bookmarks...";
    }

    if (bookmarks.length === 0) {
      text = "No bookmarks yet";
    }

    if (search && filteredBookmarks.length === 0) {
      text = "No results found";
    }

    if (text.length === 0) {
      return null;
    }

    return (
      <ThemedText textAlign="center" type="secondary">
        {text}
      </ThemedText>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Search in bookmarks",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            autoCapitalize: "none",
          },
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={filteredBookmarks}
        renderItem={({ index, item }) => (
          <BookmarkListItem
            item={item}
            index={index}
            total={filteredBookmarks.length}
            onRightPress={() => handleRemoveBookmark(item.id)}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.scrollContainer}
        ListHeaderComponent={renderListHeader}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  scrollContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
});
