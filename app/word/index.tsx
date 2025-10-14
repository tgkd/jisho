import { FlashList } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import { Stack, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  KanjiHistoryEntry,
  searchDictionary,
  searchKanji,
  WordHistoryEntry,
  WordMeaning,
} from "@/services/database";
import { getJpTokens } from "@/services/parse";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Button, Host } from "@expo/ui/swift-ui";
import { useThemeColor } from "@/hooks/useThemeColor";

type SearchResult = DictionaryEntry | KanjiEntry;

function isKanjiEntry(item: SearchResult | HistoryEntry): item is KanjiEntry {
  return "character" in item;
}

function isHistoryItem(
  item: SearchResult | HistoryEntry
): item is HistoryEntry {
  return "entryType" in item;
}

function isWordHistoryEntry(item: HistoryEntry): item is WordHistoryEntry {
  return item.entryType === "word";
}

function isKanjiHistoryEntry(item: HistoryEntry): item is KanjiHistoryEntry {
  return item.entryType === "kanji";
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const history = useSearchHistory();
  const defaultColor = useThemeColor({}, "text");

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

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (text.length === 0) {
      setResults([]);
      setLoading(false);
      isSearchingRef.current = false;
      return;
    }

    if (isSearchingRef.current) {
      return;
    }

    isSearchingRef.current = true;

    const controller = new AbortController();
    abortControllerRef.current = controller;

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

        if (controller.signal.aborted) {
          return;
        }

        if (!controller.signal.aborted && isSearchingRef.current) {
          const newResults = searchResults.words || [];
          const newMeanings = searchResults.meanings || new Map();

          if (JSON.stringify(newResults) !== JSON.stringify(results)) {
            setResults(newResults);
            setMeaningsMap(newMeanings);
          }
        }
      } else {
        const kanjiResults = await searchKanji(db, text);

        if (controller.signal.aborted) {
          return;
        }

        if (!controller.signal.aborted && isSearchingRef.current) {
          setResults(kanjiResults);
          setMeaningsMap(new Map());
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Search failed:", error);
      }
      if (!controller.signal.aborted && isSearchingRef.current) {
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
  }, 100);

  const handleChange = (text: string) => {
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

    const currentSearch = search;
    if (currentSearch.trim().length > 0) {
      setLoading(true);
      setResults([]);
      setTokens([]);
      setMeaningsMap(new Map());
      handleSearch(currentSearch);
    } else {
      setResults([]);
      setTokens([]);
      setMeaningsMap(new Map());
    }
  }, [searchMode, search, handleSearch]);

  const handleHistoryItemPress = useCallback(
    (item: HistoryEntry) => {
      if (isWordHistoryEntry(item)) {
        router.push({
          pathname: "/word/[id]",
          params: { id: item.wordId.toString(), title: item.word },
        });
      } else if (isKanjiHistoryEntry(item)) {
        router.navigate({
          pathname: "/word/kanji/[id]",
          params: { id: item.kanjiId.toString(), title: item.character },
        });
      }
    },
    [router]
  );

  const shouldShowRecentHistory =
    !search.trim().length && !results.length && !loading;
  const recentHistory = shouldShowRecentHistory
    ? history.list.slice(0, 10)
    : [];
  const displayData: (SearchResult | HistoryEntry)[] = shouldShowRecentHistory
    ? recentHistory
    : results;

  const handleCancelButtonPress = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

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
          onPress={() => {
            history.addKanjiToHistory(item);
            router.navigate({
              pathname: "/word/kanji/[id]",
              params: { id: item.id.toString(), title: item.character },
            });
          }}
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
        {searchMode === "kanji" && (
          <TouchableOpacity
            onPress={toggleSearchMode}
            style={styles.switchButton}
          >
            <ThemedText size="sm" type="link">
              {"Search as word instead"}
            </ThemedText>
          </TouchableOpacity>
        )}
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
              searchMode === "word"
                ? "Search by word..."
                : "Search by kanji...",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            ref: searchBarRef as React.RefObject<SearchBarCommands>,
            onCancelButtonPress: handleCancelButtonPress,
            hideWhenScrolling: false,
            autoCapitalize: searchMode === "kanji" ? "none" : "sentences",
          },
          headerTitle: () => <Text style={{ flex: 1 }} />,
          title: searchMode === "word" ? "Words" : "Kanji",
          headerRight: () => (
            <Host style={{ width: 35, height: 35 }}>
              <Button
                color={defaultColor}
                systemImage={
                  searchMode === "word" ? "character" : "character.book.closed"
                }
                onPress={toggleSearchMode}
              />
            </Host>
          ),
        }}
      />
      <FlashList
        data={displayData}
        renderItem={renderItem}
        keyExtractor={(item) =>
          isHistoryItem(item) ? `history-${item.id}` : `result-${item.id}`
        }
        style={styles.list}
        contentContainerStyle={styles.scrollContainer}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <TagsList items={tokens} onSelect={handleTokenSelect} />
        }
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
  list: {
    flex: 1,
  },
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
  switchButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pasteButton: {
    position: "absolute",
    bottom: 96,
    right: 28,
    height: 48,
    width: 48,
  },
});
