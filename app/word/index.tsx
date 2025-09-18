import { FlashList } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import { router, Stack, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { SearchBarCommands } from "react-native-screens";
import * as wanakana from "wanakana";

import { HapticButton, HapticTab } from "@/components/HapticTab";
import { HistoryListItem } from "@/components/HistoryList";
import { Loader } from "@/components/Loader";
import { NavHeader } from "@/components/NavHeader";
import { SearchErrorBoundary } from "@/components/SearchErrorBoundary";
import TagsList from "@/components/TagsList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  DictionaryEntry,
  getKanjiList,
  HistoryEntry,
  KanjiEntry,
  searchDictionary,
  searchKanji,
  WordMeaning,
} from "@/services/database";
import {
  deduplicateEn,
  formatEn,
  formatJp,
  getJpTokens,
} from "@/services/parse";
import { SETTINGS_KEYS } from "@/services/storage";

type SearchResult = DictionaryEntry | KanjiEntry;

function isKanjiEntry(item: SearchResult): item is KanjiEntry {
  return "character" in item;
}

export default function HomeScreen() {
  const db = useSQLiteContext();

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
  const [autoPaste] = useMMKVBoolean(SETTINGS_KEYS.AUTO_PASTE);
  const [searchMode, setSearchMode] = useState<"word" | "kanji">("word");

  const getRandomKanjiList = useCallback(async () => {
    setLoading(true);
    try {
      const results = await getKanjiList(db);
      setResults(results);
    } catch (error) {
      console.error("Failed to fetch random kanji:", error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  const handleSearch = useDebouncedCallback(async (query: string) => {
    const text = query.trim();

    // Cancel any pending search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (text.length === 0) {
      if (searchMode === "kanji") {
        getRandomKanjiList();
        return;
      }
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

  const checkClipboardContent = async () => {
    try {
      if (!Clipboard.isPasteButtonAvailable) {
        return;
      }
      const text = await Clipboard.getStringAsync();

      if (text && wanakana.isJapanese(text)) {
        searchBarRef.current?.setText(text);
        handleChange(text);
        await Clipboard.setStringAsync("");
      }
    } catch (error) {
      console.error("Error accessing clipboard:", error);
    }
  };

  const onFocus = () => {
    if (autoPaste) {
      checkClipboardContent();
    }
  };

  const history = useSearchHistory();
  const showHistory =
    searchMode === "word" &&
    !search.trim().length &&
    !results.length &&
    !loading;

  const flatListData = showHistory ? history.list : results;

  useFocusEffect(
    useCallback(() => {
      if (searchMode === "kanji" && !search.trim().length) {
        getRandomKanjiList();
      }
    }, [searchMode, search, getRandomKanjiList])
  );

  const toggleSearchMode = useCallback(() => {
    const newMode = searchMode === "word" ? "kanji" : "word";
    setSearchMode(newMode);
    setSearch("");
    setResults([]);
    setTokens([]);
    setMeaningsMap(new Map());
    searchBarRef.current?.setText("");

    if (newMode === "kanji") {
      getRandomKanjiList();
    }
  }, [searchMode, getRandomKanjiList]);

  const handleHistoryWordPress = async (item: HistoryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.wordId.toString(), title: item.word },
    });
  };

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
        <HistoryListItem
          item={item}
          index={index}
          list={history.list}
          onPress={handleHistoryWordPress}
          onRemove={history.removeItem}
        />
      );
    }

    if (isKanjiEntry(item)) {
      return (
        <KanjiListItem item={item} index={index} total={results?.length || 0} />
      );
    }

    return (
      <SearchListItem
        item={item as DictionaryEntry}
        meanings={meaningsMap.get(item.id)}
        index={index}
        total={results?.length || 0}
      />
    );
  };

  return (
    <SearchErrorBoundary>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placement: "automatic",
            placeholder:
              searchMode === "word" ? "Search in Japanese..." : "Search kanji",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            ref: searchBarRef as React.RefObject<SearchBarCommands>,
            onFocus,
            onCancelButtonPress: handleCancelButtonPress,
            hideWhenScrolling: false,
            autoCapitalize: searchMode === "kanji" ? "none" : "sentences",
          },
          title: searchMode === "word" ? "Words" : "Kanji",
          headerTitle: () => <NavHeader title={""} />,
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
        data={flatListData}
        renderItem={renderItem}
        keyExtractor={(item) =>
          `${showHistory ? "history" : "result"}-${item.id}`
        }
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContainer}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        drawDistance={400}
        ListHeaderComponent={
          searchMode === "word" ? (
            <TagsList items={tokens} onSelect={handleTokenSelect} />
          ) : null
        }
        ListEmptyComponent={
          loading || !search.length ? null : (
            <View style={styles.emptyContainer}>
              <ThemedText type="secondary">{"No results found"}</ThemedText>
            </View>
          )
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.loader}>
              <Loader />
            </View>
          ) : null
        }
      />
    </SearchErrorBoundary>
  );
}

function isHistoryItem(
  item: SearchResult | HistoryEntry
): item is HistoryEntry {
  return (item as HistoryEntry).wordId !== undefined;
}

export function SearchListItem({
  item,
  index,
  total,
  meanings,
}: {
  item: DictionaryEntry;
  index: number;
  total: number;
  meanings?: WordMeaning[];
}) {
  const iconColor = useThemeColor({}, "secondaryText");
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const details = (
    meanings && meanings.length > 0
      ? deduplicateEn(meanings.map((m) => formatEn(m.meaning, "none"))).filter(
          Boolean
        )
      : []
  )
    .join(", ")
    .replace(/[,;]\s*$/, "");

  // Truncate to ~45 characters to fit one line
  const truncatedDetails =
    details.length > 45 ? details.substring(0, 42) + "..." : details;

  const handleWordPress = (item: DictionaryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.id.toString(), title: item.word },
    });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <HapticTab onPress={() => handleWordPress(item)}>
        <ThemedView
          style={[
            styles.item,
            isFirst && styles.firstRadius,
            isLast && styles.lastRadius,
          ]}
          lightColor={Colors.light.groupedBackground}
          darkColor={Colors.dark.groupedBackground}
        >
          <View style={styles.col}>
            <View style={styles.titleRow}>
              <ThemedText
                type="defaultSemiBold"
                uiTextView={false}
                numberOfLines={1}
                style={styles.wordText}
              >
                {item.word}
              </ThemedText>
              <ThemedText
                type="secondary"
                uiTextView={false}
                numberOfLines={1}
                style={styles.readingText}
              >
                {formatJp(item.reading)}
              </ThemedText>
            </View>
            <ThemedText
              numberOfLines={1}
              type="secondary"
              uiTextView={false}
              style={styles.detailsText}
            >
              {truncatedDetails}
            </ThemedText>
          </View>
          <IconSymbol color={iconColor} name="chevron.right" size={16} />
        </ThemedView>

        {isLast ? null : <View style={styles.separator} />}
      </HapticTab>
    </Animated.View>
  );
}

export function KanjiListItem({
  item,
  index,
  total,
}: {
  item: KanjiEntry;
  index: number;
  total: number;
}) {
  const iconColor = useThemeColor({}, "secondaryText");
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const handlePress = () => {
    router.navigate({
      pathname: "/kanji/[id]",
      params: { id: item.id.toString(), title: item.character },
    });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <Pressable onPress={handlePress}>
        <ThemedView
          style={[
            styles.item,
            isFirst && styles.firstRadius,
            isLast && styles.lastRadius,
          ]}
          lightColor={Colors.light.groupedBackground}
          darkColor={Colors.dark.groupedBackground}
        >
          <View style={styles.col}>
            <View style={styles.kanjiRow}>
              <ThemedText size="lg" type="defaultSemiBold">
                {item.character}
              </ThemedText>
              <View style={styles.readings}>
                {item.onReadings && item.onReadings.length > 0 && (
                  <ThemedText size="sm" type="secondary">
                    On: {item.onReadings.join(", ")}
                  </ThemedText>
                )}
                {item.kunReadings && item.kunReadings.length > 0 && (
                  <ThemedText size="sm" type="secondary">
                    Kun: {item.kunReadings.join(", ")}
                  </ThemedText>
                )}
              </View>
            </View>
            <ThemedText type="secondary">
              {item.meanings ? item.meanings.join(", ") : ""}
            </ThemedText>
          </View>
          <IconSymbol color={iconColor} name="chevron.right" size={16} />
        </ThemedView>
      </Pressable>

      {isLast ? null : <View style={styles.separator} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    fontSize: 16,
  },
  menuButton: {
    padding: 4,
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
  col: {
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: 0,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    padding: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    minWidth: 0,
  },
  wordText: {
    flex: 1,
    minWidth: 0,
  },
  readingText: {
    flexShrink: 1,
    minWidth: 0,
  },
  detailsText: {
    width: "100%",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginHorizontal: 8,
  },
  firstRadius: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  lastRadius: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  kanjiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  readings: {
    flexDirection: "column",
    gap: 2,
  },
});
