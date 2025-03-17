import * as Clipboard from "expo-clipboard";
import { router, Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { SearchBarCommands } from "react-native-screens";
import * as wanakana from "wanakana";

import { HapticTab } from "@/components/HapticTab";
import { HistoryListItem } from "@/components/HistoryList";
import { Loader } from "@/components/Loader";
import { MenuActions } from "@/components/MenuActions";
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
  WordMeaning,
} from "@/services/database";
import {
  deduplicateEn,
  formatEn,
  formatJp,
  getJpTokens,
} from "@/services/parse";

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [meaningsMap, setMeaningsMap] = useState<Map<number, WordMeaning[]>>(
    new Map()
  );
  const searchBarRef = useRef<SearchBarCommands>(null);
  const [tokens, setTokens] = useState<Array<{ id: string; label: string }>>(
    []
  );

  const handleSearch = useDebouncedCallback(async (query: string) => {
    const text = query.trim();

    if (text.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const tokens = getJpTokens(text).map((t) => ({ id: t, label: t }));

    if (tokens.length > 1) {
      setTokens(tokens);
    }

    try {
      const searchResults = await searchDictionary(db, text);

      setResults(searchResults.words);
      setMeaningsMap(searchResults.meanings);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, 500);

  const handleChange = (text: string) => {
    setLoading(true);
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
    checkClipboardContent();
  };

  const history = useSearchHistory();
  const showHistory = !search.trim().length && !results.length;

  const handleHistoryWordPress = async (item: HistoryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.wordId.toString(), title: item.word },
    });
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
    <>
      <Stack.Screen
        options={{
          headerLargeTitle: true,
          headerSearchBarOptions: {
            placeholder: "Search in Japanese...",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            autoCapitalize: "none",
            ref: searchBarRef,
            shouldShowHintSearchIcon: true,
            onFocus,
          },
        }}
      />

      <Animated.FlatList
        itemLayoutAnimation={LinearTransition}
        contentInsetAdjustmentBehavior="automatic"
        data={showHistory ? history.list : results}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        refreshControl={
          loading ? (
            <View style={styles.loader}>
              <Loader />
            </View>
          ) : undefined
        }
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
      />
    </>
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
