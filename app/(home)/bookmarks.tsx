import { Stack, router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { getBookmarks, type DictionaryEntry } from "@/services/database";

export default function BookmarksScreen() {
  const insets = useSafeAreaInsets();
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

  const handleWordPress = (item: DictionaryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.id.toString(), title: item.word },
    });
  };

  const renderItem = useCallback(
    ({ item }: { item: DictionaryEntry }) => (
      <ThemedView
        style={styles.resultItem}
        lightColor={Colors.light.groupedBackground}
        darkColor={Colors.dark.groupedBackground}
      >
        <HapticTab onPress={() => handleWordPress(item)}>
          <View style={styles.wordContainer}>
            <ThemedText type="defaultSemiBold">{item.word}</ThemedText>
            <ThemedText type="secondary" style={styles.reading}>
              {`【${item.reading.join(", ")}】`}
            </ThemedText>
          </View>
          <ThemedText style={styles.meanings}>
            {item.meanings
              .slice(0, 3)
              .map((m) => m.meaning.replaceAll(";", ", "))
              .join("; ")}
          </ThemedText>
        </HapticTab>
      </ThemedView>
    ),
    []
  );

  const renderListHeader = () => {
    if (loading) {
      return (
        <View style={styles.headerContainer}>
          <ThemedText type="secondary" style={styles.headerText}>
            Loading bookmarks...
          </ThemedText>
        </View>
      );
    }

    if (bookmarks.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.statusText}>No bookmarks yet</ThemedText>
        </View>
      );
    }

    if (search && filteredBookmarks.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.statusText}>
            {"No matching bookmarks found"}
          </ThemedText>
        </View>
      );
    }

    return null;
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Bookmarks",
          headerSearchBarOptions: {
            placeholder: "Search in bookmarks",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            autoCapitalize: "none",
          },
        }}
      />
      <FlatList
        data={filteredBookmarks}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContainer,
          { paddingBottom: insets.bottom + 16, paddingTop: insets.top + 16 },
        ]}
        ListHeaderComponent={renderListHeader}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponentStyle={styles.headerComponentStyle}
        ListEmptyComponent={null}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 32,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 32,
  },
  listContainer: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  resultItem: {
    padding: 16,
    marginBottom: 8,
    borderRadius: 10,
  },
  wordContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
    gap: 8,
  },
  kanji: {
    fontSize: 20,
    marginRight: 8,
  },
  reading: {
    fontSize: 15,
  },
  meanings: {
    fontSize: 15,
    opacity: 0.7,
    marginTop: 4,
  },
  statusText: {
    marginBottom: 8,
    textAlign: "center",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginBottom: 12,
    borderRadius: 8,
  },
  headerText: {
    fontSize: 14,
    marginRight: 8,
  },
  headerComponentStyle: {
    marginBottom: 8,
  },
});
