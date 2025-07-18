import { FlashList } from "@shopify/flash-list";
import * as Clipboard from "expo-clipboard";
import { router, Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";
import Animated, {
  FadeIn,
  FadeOut
} from "react-native-reanimated";
import { SearchBarCommands } from "react-native-screens";
import * as wanakana from "wanakana";

import { HapticTab } from "@/components/HapticTab";
import { HistoryListItem } from "@/components/HistoryList";
import { Loader } from "@/components/Loader";
import { MenuActions } from "@/components/MenuActions";
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
  HistoryEntry,
  searchDictionary,
  WordMeaning
} from "@/services/database";
import {
  deduplicateEn,
  formatEn,
  formatJp,
  getJpTokens
} from "@/services/parse";
import { SETTINGS_KEYS } from "@/services/storage";

export default function HomeScreen() {
  const db = useSQLiteContext();

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [meaningsMap, setMeaningsMap] = useState<Map<number, WordMeaning[]>>(
    new Map()
  );
  const searchBarRef = useRef<SearchBarCommands>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [tokens, setTokens] = useState<{ id: string; label: string }[]>(
    []
  );
  const isSearchingRef = useRef(false);
  const [autoPaste] = useMMKVBoolean(SETTINGS_KEYS.AUTO_PASTE);

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

    const tokensRes = getJpTokens(text).map((t) => ({ id: t, label: t }));
    setTokens(tokensRes.length > 1 ? tokensRes : []);

    try {
      const searchResults = await searchDictionary(db, text, { signal: controller.signal });

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
    } catch (error) {
      // Don't log abort errors
      if (error instanceof Error && error.name !== 'AbortError') {
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
  const showHistory = !search.trim().length && !results.length && !loading;
  
  // Memoize data to prevent unnecessary re-renders
  const flatListData = showHistory ? history.list : results;

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
    item: DictionaryEntry | HistoryEntry;
  }) =>
    isHistoryItem(item) ? (
      <HistoryListItem
        item={item}
        index={index}
        list={history.list}
        onPress={handleHistoryWordPress}
        onRemove={history.removeItem}
      />
    ) : (
      <SearchListItem
        item={item}
        meanings={meaningsMap.get(item.id)}
        index={index}
        total={results?.length || 0}
      />
    );

  return (
    <SearchErrorBoundary>
      <Stack.Screen
        options={{
          headerLargeTitle: true,
          headerSearchBarOptions: {
            placeholder: "Search in Japanese...",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            autoCapitalize: "none",
            ref: searchBarRef as React.RefObject<SearchBarCommands>,
            shouldShowHintSearchIcon: true,
            onFocus,
            onCancelButtonPress: handleCancelButtonPress,
          },
        }}
      />

      <FlashList
        data={flatListData}
        renderItem={renderItem}
        keyExtractor={(item) => `${showHistory ? 'history' : 'result'}-${item.id}`}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        estimatedItemSize={80}
        drawDistance={400}
        disableAutoLayout={true}
        ListHeaderComponent={
          <TagsList items={tokens} onSelect={handleTokenSelect} />
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
  item: DictionaryEntry | HistoryEntry
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
    meanings
      ? deduplicateEn(meanings.map((m) => formatEn(m.meaning, "none")))
      : []
  ).join(", ");

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
      <MenuActions
        text={item.word + " " + formatJp(item.reading) + " " + details}
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
                <ThemedText type="defaultSemiBold">{item.word}</ThemedText>
                <ThemedText type="secondary">
                  {formatJp(item.reading)}
                </ThemedText>
              </View>
              <ThemedText numberOfLines={1} type="secondary">
                {details}
              </ThemedText>
            </View>
            <IconSymbol color={iconColor} name="chevron.right" size={16} />
          </ThemedView>

          {isLast ? null : <View style={styles.separator} />}
        </HapticTab>
      </MenuActions>
    </Animated.View>
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
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 32,
  },
  col: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    maxWidth: "90%",
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
    flexWrap: "wrap",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginHorizontal: 8,
  },
  firstRadius: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  lastRadius: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
});
