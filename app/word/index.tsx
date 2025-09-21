import { FlashList } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SearchBarCommands } from "react-native-screens";

import { HapticButton } from "@/components/HapticTab";
import { ListItem } from "@/components/ListItem";
import { Loader } from "@/components/Loader";
import TagsList from "@/components/TagsList";
import { ThemedText } from "@/components/ThemedText";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import {
  DictionaryEntry,
  HistoryEntry,
  KanjiEntry,
  searchDictionary,
  searchKanji,
  WordMeaning,
} from "@/services/database";
import { getJpTokens } from "@/services/parse";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

type SearchResult = DictionaryEntry | KanjiEntry;

function isKanjiEntry(item: SearchResult | HistoryEntry): item is KanjiEntry {
  return "character" in item;
}

function isHistoryItem(
  item: SearchResult | HistoryEntry
): item is HistoryEntry {
  return "wordId" in item;
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const history = useSearchHistory();

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [search, setSearch] = useState("");
  const [meaningsMap, setMeaningsMap] = useState<Map<number, WordMeaning[]>>(
    new Map()
  );
  const searchBarRef = useRef<SearchBarCommands>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [tokens, setTokens] = useState<{ id: string; label: string }[]>([]);
  const isSearchingRef = useRef(false);
  const [searchMode, setSearchMode] = useState<"word" | "kanji">("word");

  const handleSearch = useDebouncedCallback(async (query: string) => {
    const text = query.trim();

    // Cancel any pending search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (text.length === 0) {
      setResults([]);
      setLoading(false);
      isSearchingRef.current = false;
      return;
    }

    // Prevent concurrent searches
    if (isSearchingRef.current) {
      return;
    }

    isSearchingRef.current = true;

    // Create new abort controller for this search
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Only process tokens for word search
    if (searchMode === "word") {
      const tokensRes = getJpTokens(text).map((t) => ({ id: t, label: t }));
      setTokens(tokensRes.length > 1 ? tokensRes : []);
    } else {
      setTokens([]);
    }

    try {
      if (searchMode === "word") {
        const searchResults = await searchDictionary(db, text, {
          signal: controller.signal,
        });

        // Check if this search was cancelled
        if (controller.signal.aborted) {
          return;
        }

        // Safe state updates with guards
        if (!controller.signal.aborted && isSearchingRef.current) {
          // Batch state updates to prevent FlatList transition issues
          const newResults = searchResults.words || [];
          const newMeanings = searchResults.meanings || new Map();

          // Only update if data actually changed
          if (JSON.stringify(newResults) !== JSON.stringify(results)) {
            setResults(newResults);
            setMeaningsMap(newMeanings);
          }
        }
      } else {
        const kanjiResults = await searchKanji(db, text);

        // Check if this search was cancelled
        if (controller.signal.aborted) {
          return;
        }

        if (!controller.signal.aborted && isSearchingRef.current) {
          setResults(kanjiResults);
          setMeaningsMap(new Map());
        }
      }
    } catch (error) {
      // Don't log abort errors
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Search failed:", error);
      }
      if (!controller.signal.aborted && isSearchingRef.current) {
        // Only clear results if we actually had results
        if (results.length > 0) {
          setResults([]);
        }
      }
    } finally {
      if (!controller.signal.aborted && isSearchingRef.current) {
        setLoading(false);
      }
      isSearchingRef.current = false;
    }
  }, 300);

  const handleChange = (text: string) => {
    // Only set loading if we're actually going to search
    if (text.trim().length > 0) {
      setLoading(true);
    }
    setSearch(text);
    handleSearch(text);
  };

  const handleTokenSelect = (value: string) => {
    searchBarRef.current?.setText(value);
    handleChange(value);
    setTokens([]);
  };

  const toggleSearchMode = useCallback(() => {
    const newMode = searchMode === "word" ? "kanji" : "word";
    setSearchMode(newMode);
    setSearch("");
    setResults([]);
    setTokens([]);
    setMeaningsMap(new Map());
    searchBarRef.current?.setText("");

    // No automatic loading of random kanji - show placeholder instead
  }, [searchMode]);

  const handleHistoryItemPress = useCallback(
    (item: HistoryEntry) => {
      router.push({
        pathname: "/word/[id]",
        params: { id: item.wordId.toString(), title: item.word },
      });
    },
    [router]
  );

  // Determine what data to show
  const shouldShowRecentHistory =
    searchMode === "word" &&
    !search.trim().length &&
    !results.length &&
    !loading;
  const recentHistory = shouldShowRecentHistory
    ? history.list.slice(0, 10)
    : [];
  const displayData: (SearchResult | HistoryEntry)[] = shouldShowRecentHistory
    ? recentHistory
    : results;

  const handleCancelButtonPress = () => {
    // Cancel any pending searches
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset searching state
    isSearchingRef.current = false;

    setSearch("");
    setResults([]);
    setTokens([]);
    setLoading(false);
    searchBarRef.current?.setText("");
    searchBarRef.current?.blur();
  };

  const renderItem = ({
    index,
    item,
  }: {
    index: number;
    item: SearchResult | HistoryEntry;
  }) => {
    if (isHistoryItem(item)) {
      return (
        <ListItem
          variant="history"
          item={item}
          index={index}
          total={recentHistory.length}
          onPress={() => handleHistoryItemPress(item)}
          onRemove={history.removeItem}
        />
      );
    }

    if (isKanjiEntry(item)) {
      return (
        <ListItem
          variant="kanji"
          item={item}
          index={index}
          total={results?.length || 0}
        />
      );
    }

    return (
      <ListItem
        variant="search"
        item={item as DictionaryEntry}
        meanings={meaningsMap.get(item.id)}
        index={index}
        total={results?.length || 0}
      />
    );
  };

  const renderHeader = () => {
    return (
      <>
        <TagsList items={tokens} onSelect={handleTokenSelect} />
      </>
    );
  };

  const renderEmptyContainer = () => {
    if (loading) {
      return null;
    }

    if (!search.length) {
      return (
        <View style={styles.emptyContainer}>
          <ThemedText type="secondary">{"Start search..."}</ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <ThemedText type="secondary">{"No results found"}</ThemedText>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placement: "automatic",
            placeholder:
              searchMode === "word" ? "Search in Japanese..." : "Search kanji",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            ref: searchBarRef as React.RefObject<SearchBarCommands>,
            onCancelButtonPress: handleCancelButtonPress,
            hideWhenScrolling: false,
            autoCapitalize: searchMode === "kanji" ? "none" : "sentences",
          },
          headerTitle: ({}) => <Text style={{ flex: 1 }} />,
          title: searchMode === "word" ? "Words" : "Kanji",
          headerRight: () => (
            <HapticButton
              onPress={toggleSearchMode}
              systemImage={
                searchMode === "word" ? "character" : "character.book.closed"
              }
            />
          ),
        }}
      />
      <FlashList
        data={displayData}
        renderItem={renderItem}
        keyExtractor={(item) =>
          isHistoryItem(item) ? `history-${item.id}` : `result-${item.id}`
        }
        contentContainerStyle={styles.scrollContainer}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={searchMode === "word" ? renderHeader() : null}
        ListEmptyComponent={renderEmptyContainer()}
        ListFooterComponent={
          loading ? (
            <View style={styles.loader}>
              <Loader />
            </View>
          ) : null
        }
      />
      {Clipboard.isPasteButtonAvailable ? (
        <KeyboardAvoidingView behavior="position" keyboardVerticalOffset={-24}>
          <Clipboard.ClipboardPasteButton
            onPress={(data) => {
              if (data.type === "text" && data.text) {
                searchBarRef.current?.setText(data.text);
                handleChange(data.text);
              }
            }}
            cornerStyle="capsule"
            acceptedContentTypes={["plain-text"]}
            displayMode="iconOnly"
            style={styles.pasteButton}
          />
        </KeyboardAvoidingView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingTop: 16,
  },
  scrollContainer: {
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 32,
  },
  pasteButton: {
    position: "absolute",
    bottom: 96,
    right: 28,
    height: 48,
    width: 48,
  },
});
