import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useThrottledSearch } from "@/hooks/useThrottledSearch";
import { DictionaryEntry, searchDictionary } from "@/services/database";
import { useState } from "react";

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<DictionaryEntry[]>([]);

  const handleSearch = async (text: string) => {
    if (text.length < 1) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const searchResults = await searchDictionary(db, text);
      setResults(searchResults);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const { value: query, handleChange } = useThrottledSearch<
    typeof handleSearch,
    string
  >(handleSearch);

  const inputBackground = useThemeColor(
    { light: "#fff", dark: "#1c1c1c" },
    "background"
  );

  const handleWordPress = (item: DictionaryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.id.toString() },
    });
  };

  const renderItem = ({ item }: { item: DictionaryEntry }) => (
    <TouchableOpacity onPress={() => handleWordPress(item)}>
      <ThemedView style={styles.resultItem}>
        <View style={styles.wordContainer}>
          <ThemedText type="title" style={styles.kanji}>
            {item.word}
          </ThemedText>
          <ThemedText style={styles.reading}>{`[${item.reading}]`}</ThemedText>
        </View>
        <ThemedText style={styles.meanings}>
          {item.meanings.map((m) => m.meaning).join(", ")}
        </ThemedText>
      </ThemedView>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.listPlaceholderText}>
            {"Loading..."}
          </ThemedText>
        </View>
      );
    } else if (query) {
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

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollView
        enableResetScrollToCoords={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: inputBackground }]}
            placeholder="Search in English or Japanese..."
            value={query || ""}
            onChangeText={handleChange}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.contentContainer}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={renderEmpty}
        />
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
  },
  searchInput: {
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 16,
  },
  loading: {
    marginTop: 20,
  },
  resultItem: {
    borderRadius: 8,
  },
  wordContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  kanji: {
    fontSize: 24,
    marginRight: 8,
  },
  reading: {
    fontSize: 18,
  },
  meanings: {
    fontSize: 14,
    opacity: 0.7,
  },
  scrollContent: {
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  listPlaceholderText: {
    textAlign: "center",
    fontSize: 16,
    color: "#666",
    marginTop: 20,
  },
});
