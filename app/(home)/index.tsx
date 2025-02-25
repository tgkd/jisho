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

  const inputBackground = useThemeColor(
    {
      light: Colors.light.secondaryBackground,
      dark: Colors.dark.secondaryBackground,
    },
    "background"
  );

  const inputTextColor = useThemeColor(
    {
      light: Colors.light.text,
      dark: Colors.dark.text,
    },
    "text"
  );

  const renderEmpty = () => {
    if (loading) {
      return null;
    }

    if (query) {
      return (
        <ThemedText style={styles.listPlaceholderText}>
          {`No results found for "${query}"`}
        </ThemedText>
      );
    } else {
      return (
        <ThemedText style={styles.listPlaceholderText}>
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
        renderItem={ListItem}
        keyExtractor={(item) => item.id.toString()}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={renderEmpty}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
  },
  scrollContainer: {
    padding: 16,
    paddingTop: 0,
  },
  searchContainer: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    height: 40,
    fontSize: 17,
    backgroundColor: Colors.light.secondaryBackground,
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
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
  },
  listPlaceholderText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 17,
    color: Colors.light.secondaryText,
    letterSpacing: -0.41,
  },
});
