import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import { Pressable, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { KanjiEntry, searchKanji, getKanjiList } from "@/services/database";
import { Loader } from "@/components/Loader";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function KanjiScreen() {
  const [search, setSearch] = useState("");
  const [kanjiList, setKanjiList] = useState<KanjiEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const db = useSQLiteContext();

  const getRandomList = async () => {
    setLoading(true);
    try {
      const results = await getKanjiList(db);
      setKanjiList(results);
    } catch (error) {
      console.error("Failed to fetch random kanji:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useDebouncedCallback(async (query: string) => {
    setLoading(true);
    try {
      const text = query.trim();
      if (text.length === 0) {
        getRandomList();
        return;
      }
      const results = await searchKanji(db, query);
      setKanjiList(results);
    } catch (error) {
      console.error("Failed to search kanji:", error);
    } finally {
      setLoading(false);
    }
  }, 300);

  useFocusEffect(
    useCallback(() => {
      getRandomList();
    }, [])
  );

  const handleChange = (text: string) => {
    setSearch(text);
    handleSearch(text);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Search kanji",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            autoCapitalize: "none",
          },
        }}
      />
      <Animated.FlatList
        itemLayoutAnimation={LinearTransition}
        contentInsetAdjustmentBehavior="automatic"
        data={kanjiList}
        renderItem={({ item, index }) => (
          <KanjiListItem item={item} index={index} total={kanjiList.length} />
        )}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={true}
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

function KanjiListItem({
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
  const router = useRouter();

  const handlePress = () => {
    router.push(`/kanji/${item.id}`);
  };

  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  col: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    maxWidth: "90%",
    gap: 4,
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
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
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
  loader: {
    paddingTop: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 32,
  },
});
