import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";

import { HistoryList } from "@/components/HistoryList";
import { ListItem } from "@/components/ListItem";
import { Loader } from "@/components/Loader";
import { ThemedText } from "@/components/ThemedText";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { DictionaryEntry, searchDictionary } from "@/services/database";

type SearchMode = "japanese" | "english";

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("japanese");
  const [search, setSearch] = useState("");

  const toggleSearchMode = () => {
    setSearchMode((prev) => (prev === "japanese" ? "english" : "japanese"));
  };

  const handleSearch = useDebouncedCallback(async (query: string) => {
    const text = query.trim();

    if (text.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    try {
      let searchResults: DictionaryEntry[];
      searchResults = await searchDictionary(db, text, true);
      setResults(searchResults);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, 500);

  const handleChange = useCallback(
    (text: string) => {
      setLoading(true);
      setSearch(text);
      handleSearch(text);
    },
    [handleSearch]
  );

  const showHistory = !search.trim().length && !results.length;

  return (
    <>
      <Stack.Screen
        options={{
          headerLargeTitle: true,
          headerSearchBarOptions: {
            placeholder:
              searchMode === "japanese"
                ? "Search in Japanese..."
                : "Search in English...",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            autoCapitalize: "none",
          },
        }}
      />
      {showHistory ? (
        <HistoryList />
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={results}
          renderItem={({ index, item }) => (
            <ListItem item={item} index={index} total={results?.length || 0} />
          )}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListHeaderComponent={
            loading && search.length ? (
              <View style={styles.headerContainer}>
                <Loader />
              </View>
            ) : null
          }
          ListEmptyComponent={
            loading || !search.length ? null : (
              <View style={styles.emptyContainer}>
                <ThemedText type="secondary">{"No results found"}</ThemedText>
              </View>
            )
          }
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 17,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  statusText: {
    fontSize: 14,
    marginRight: 8,
  },
  headerLoader: {
    width: 14,
    height: 14,
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
  emptyListContent: {
    flexGrow: 1,
  },
});
