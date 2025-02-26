import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";

import { ListItem } from "@/components/ListItem";
import { Loader } from "@/components/Loader";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  DictionaryEntry,
  searchByEnglishWord,
  searchDictionary,
} from "@/services/database";
import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

type SearchMode = "japanese" | "english";

export default function HomeScreen() {
  const inputBackground = useThemeColor({}, "secondaryBackground");
  const inputTextColor = useThemeColor({}, "text");
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
  }, 500);

  const handleChange = (text: string) => {
    setSearch(text);
    handleSearch(text);
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: DictionaryEntry;
    index: number;
  }) => <ListItem item={item} index={index} total={results?.length || 0} />;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.searchContainer}>
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
          value={search}
          onChangeText={handleChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
          enablesReturnKeyAutomatically
          spellCheck={false}
        />
        <HapticTab onPress={toggleSearchMode}>
          <IconSymbol
            color={Colors.light.tint}
            name={searchMode === "japanese" ? "e.circle" : "j.circle"}
            size={24}
          />
        </HapticTab>
      </View>

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          loading ? (
            <View style={styles.headerContainer}>
              <Loader />
            </View>
          ) : null
        }
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 24,
  },
  scrollContainer: {
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
