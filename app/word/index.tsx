import { FlashList } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import { Color, Stack, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SearchBarCommands } from "react-native-screens";

import { ListItem, ListItemSeparator } from "@/components/ListItem";
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
  WordMeaning
} from "@/services/database";
import { getJpTokens } from "@/services/parse";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

type SearchResult = DictionaryEntry | KanjiEntry;

function isKanjiEntry(item: SearchResult | HistoryEntry): item is KanjiEntry {
  return "character" in item;
}

function isHistoryItem(
  item: SearchResult | HistoryEntry,
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

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [search, setSearch] = useState("");
  const [meaningsMap, setMeaningsMap] = useState<Map<number, WordMeaning[]>>(
    new Map(),
  );
  const searchBarRef = useRef<SearchBarCommands>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [tokens, setTokens] = useState<{ id: string; label: string }[]>([]);
  const [searchMode, setSearchMode] = useState<"word" | "kanji">("word");

  const handleSearch = useDebouncedCallback(async (query: string) => {
    const text = query.trim();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (text.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

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

        if (controller.signal.aborted) return;

        setResults(searchResults.words || []);
        setMeaningsMap(searchResults.meanings || new Map());
      } else {
        const kanjiResults = await searchKanji(db, text);

        if (controller.signal.aborted) return;

        setResults(kanjiResults);
        setMeaningsMap(new Map());
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Search failed:", error);
      }
      if (!controller.signal.aborted) {
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, 150);

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
    [router],
  );

  const shouldShowRecentHistory =
    !search.trim().length && !results.length && !loading;
  const recentHistory = shouldShowRecentHistory ? history.list : [];
  const displayData: (SearchResult | HistoryEntry)[] = shouldShowRecentHistory
    ? recentHistory
    : results;

  const handleCancelButtonPress = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

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
          <ThemedText type="secondary">{"No search history yet."}</ThemedText>
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
      <Stack.Screen.Title large>
        {searchMode === "word" ? "Words" : "Kanji"}
      </Stack.Screen.Title>
      <Stack.SearchBar
        placement="automatic"
        placeholder={
          searchMode === "word" ? "Search by word..." : "Search by kanji..."
        }
        onChangeText={(e) => handleChange(e.nativeEvent.text)}
        ref={searchBarRef as React.RefObject<SearchBarCommands>}
        onCancelButtonPress={handleCancelButtonPress}
        hideWhenScrolling={false}
        hideNavigationBar={false}
        autoCapitalize={searchMode === "kanji" ? "none" : "sentences"}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={searchMode === "word" ? "character" : "character.book.closed"}
          tintColor={Color.ios.label}
          onPress={toggleSearchMode}
        />
      </Stack.Toolbar>
      <FlashList
        data={displayData}
        renderItem={renderItem}
        ItemSeparatorComponent={ListItemSeparator}
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
          loading || (history.isLoading && shouldShowRecentHistory && history.list.length > 0) ? (
            <View style={styles.loader}>
              <Loader />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (shouldShowRecentHistory) history.loadMore();
        }}
        onEndReachedThreshold={0.5}
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
