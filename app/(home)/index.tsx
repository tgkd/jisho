import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";

import { ListItem } from "@/components/ListItem";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useThrottledSearch } from "@/hooks/useThrottledSearch";
import {
  DictionaryEntry,
  searchByEnglishWord,
  searchDictionary,
} from "@/services/database";

type SearchMode = "japanese" | "english";

export default function HomeScreen() {
  const inputBackground = useThemeColor({}, "secondaryBackground");
  const inputTextColor = useThemeColor({}, "text");
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [searchMode, setSearchMode] = useState<SearchMode>("japanese");

  const handleSearch = async (value: string) => {
    const text = value.trim();

    if (text.length < 1) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      let searchResults: DictionaryEntry[];
      if (searchMode === "japanese") {
        searchResults = await searchDictionary(db, text);
      } else {
        searchResults = await searchByEnglishWord(db, text);
      }
      setResults(searchResults);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const { value: query, handleChange } = useThrottledSearch<
    typeof handleSearch,
    string
  >(handleSearch);

  const renderEmpty = () => {
    if (loading) {
      return null;
    }

    if (query) {
      return (
        <ThemedText type="secondary" style={styles.listPlaceholderText}>
          {`No results found for "${query}"`}
        </ThemedText>
      );
    } else {
      return (
        <ThemedText type="secondary" style={styles.listPlaceholderText}>
          {"Start typing to search for words"}
        </ThemedText>
      );
    }
  };

  const toggleSearchMode = (mode: SearchMode) => {
    if (searchMode !== mode) {
      setSearchMode(mode);
      if (query) {
        handleSearch(query);
      }
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
        <SegmentedControl
          options={[
            { label: "Japanese", value: "japanese" },
            { label: "English", value: "english" },
          ]}
          value={searchMode}
          onChange={(value) => toggleSearchMode(value as SearchMode)}
        />
        <TextInput
          style={[
            styles.searchInput,
            { backgroundColor: inputBackground, color: inputTextColor },
          ]}
          placeholder={
            searchMode === "japanese"
              ? "Search in Japanese..."
              : "Search in English..."
          }
          value={query || ""}
          onChangeText={handleChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
          enablesReturnKeyAutomatically={true}
          spellCheck={false}
        />
      </View>

      <FlatList
        data={results}
        renderItem={({ index, item }) => (
          <ListItem index={index} item={item} total={results.length} />
        )}
        keyExtractor={(item) => item.id.toString()}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContainer}
        ListEmptyComponent={renderEmpty}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 24,
  },
  scrollContainer: {
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: "hidden",
  },
  searchContainer: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    height: 40,
    fontSize: 17,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: Colors.light.text,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listPlaceholderText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 17,
    letterSpacing: -0.41,
  },
});
