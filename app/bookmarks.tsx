import { Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchBarCommands } from "react-native-screens";

import { ListItem } from "@/components/ListItem";
import { ThemedText } from "@/components/ThemedText";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { getBookmarks, type DictionaryEntry } from "@/services/database";

export default function BookmarksScreen() {
  const insets = useSafeAreaInsets();
  const searchRef = useRef<SearchBarCommands>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [search, setSearch] = useState("");
  const [bookmarks, setBookmarks] = useState<DictionaryEntry[]>([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState<DictionaryEntry[]>(
    []
  );
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
  }, [db]);

  const handleSearch = useDebouncedCallback((query: string) => {
    const text = query.trim().toLowerCase();

    if (text.length === 0) {
      setFilteredBookmarks(bookmarks);
      return;
    }

    const filtered = bookmarks.filter((item) => {
      // Search in word
      const matchWord = item.word.toLowerCase().includes(text);

      // Search in kanji (which is a string, not an array)
      const matchKanji = item.kanji
        ? item.kanji.toLowerCase().includes(text)
        : false;

      // Search in reading (array of strings)
      const matchReading = item.reading.some((r) =>
        r.toLowerCase().includes(text)
      );

      // Search in meanings (array of objects with meaning property)
      const matchMeanings = item.meanings.some((m) =>
        m.meaning.toLowerCase().includes(text)
      );

      return matchWord || matchKanji || matchReading || matchMeanings;
    });

    setFilteredBookmarks(filtered);
  }, 300);

  const handleChange = (text: string) => {
    setSearch(text);
    handleSearch(text);
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

  const animatedStyle = useAnimatedStyle(() => {
    return {
      paddingTop: withTiming(insets.top + (searchFocused ? 64 : 108)),
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            ref: searchRef,
            placeholder: "Search in bookmarks",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            autoCapitalize: "none",
            onFocus: () => setSearchFocused(true),
            onBlur: () => setSearchFocused(false),
          },
        }}
      />
      <FlatList
        data={filteredBookmarks}
        renderItem={({ index, item }) => (
          <ListItem
            item={item}
            index={index}
            total={filteredBookmarks.length}
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
        ListEmptyComponent={null}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  scrollContainer: {
    paddingHorizontal: 16,
  },
});
