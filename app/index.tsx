import * as Clipboard from "expo-clipboard";
import { router, Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { SearchBarCommands } from "react-native-screens";
import * as wanakana from "wanakana";

import { HapticTab } from "@/components/HapticTab";
import { HistoryList } from "@/components/HistoryList";
import { Loader } from "@/components/Loader";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import {
  DictionaryEntry,
  searchDictionary,
  WordMeaning,
} from "@/services/database";
import { deduplicateEn, formatEn, formatJp } from "@/services/parse";
import { Colors } from "@/constants/Colors";

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [meaningsMap, setMeaningsMap] = useState<Map<number, WordMeaning[]>>(
    new Map()
  );
  const searchBarRef = useRef<SearchBarCommands>(null);

  const handleSearch = useDebouncedCallback(async (query: string) => {
    const text = query.trim();

    if (text.length === 0) {
      setResults([]);
      setLoading(false);
      return;
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

  const checkClipboardContent = async () => {
    try {
      if (!Clipboard.isPasteButtonAvailable) {
        return;
      }
      const text = await Clipboard.getStringAsync();

      if (text && wanakana.isJapanese(text)) {
        searchBarRef.current?.setText(text);
        handleChange(text);
      }
    } catch (error) {
      console.error("Error accessing clipboard:", error);
    }
  };

  const onFocus = () => {
    checkClipboardContent();
  };

  const showHistory = !search.trim().length && !results.length;

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
      {showHistory ? (
        <HistoryList />
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          data={results}
          renderItem={({ index, item }) => (
            <SearchListItem
              item={item}
              meanings={meaningsMap.get(item.id)}
              index={index}
              total={results?.length || 0}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListHeaderComponent={
            loading && search.length ? (
              <View style={styles.container}>
                <Loader />
              </View>
            ) : null
          }
          ListEmptyComponent={
            loading || !search.length ? null : (
              <View style={styles.container}>
                <ThemedText type="secondary">{"No results found"}</ThemedText>
              </View>
            )
          }
        />
      )}
    </>
  );
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
  const isLast = index === total - 1;

  const details = meanings
    ? deduplicateEn(meanings.map((m) => formatEn(m.meaning, "none")))
    : [];

  const handleWordPress = (item: DictionaryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.id.toString(), title: item.word },
    });
  };

  return (
    <>
      <HapticTab onPress={() => handleWordPress(item)}>
        <ThemedView
          style={styles.item}
          lightColor={Colors.light.groupedBackground}
          darkColor={Colors.dark.groupedBackground}
        >
          <View style={styles.titleRow}>
            <ThemedText type="defaultSemiBold">{item.word}</ThemedText>
            <ThemedText type="secondary">{formatJp(item.reading)}</ThemedText>
          </View>
          {details.map((m, idx) => (
            <ThemedText key={idx} type="secondary">
              {m}
            </ThemedText>
          ))}
        </ThemedView>
      </HapticTab>
      {isLast ? null : <View style={styles.separator} />}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 32,
  },
  item: {
    flexDirection: "column",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
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
});
