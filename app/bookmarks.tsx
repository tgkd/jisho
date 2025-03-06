import { router, Stack, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import * as wanakana from "wanakana";

import { ThemedText } from "@/components/ThemedText";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import {
  getBookmarks,
  removeBookmark,
  type DictionaryEntry,
} from "@/services/database";

import { HapticTab } from "@/components/HapticTab";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatEn, formatJp } from "@/services/parse";

export default function BookmarksScreen() {
  const [search, setSearch] = useState("");
  const [bookmarks, setBookmarks] = useState<DictionaryEntry[]>([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState<DictionaryEntry[]>(
    []
  );
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const fetchBookmarks = async () => {
        try {
          setLoading(true);
          const results = await getBookmarks(db);
          setBookmarks(results);
          setFilteredBookmarks(results);
        } catch (error) {
          console.error("Failed to fetch bookmarks:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchBookmarks();
    }, [])
  );

  const handleSearch = useDebouncedCallback((query: string) => {
    const text = query.trim().toLowerCase();

    if (text.length === 0) {
      setFilteredBookmarks(bookmarks);
      return;
    }

    const hiraganaText = wanakana.isRomaji(text)
      ? wanakana.toHiragana(text)
      : text;

    const filtered = bookmarks.filter((b) => {
      const matchWord = b.word.toLowerCase().includes(text);
      const matchKanji = b.kanji ? b.kanji.toLowerCase().includes(text) : false;
      const matchReading =
        b.reading.includes(text) || b.reading.includes(hiraganaText);
      let matchMeaning = false;
      if ("meaning" in b && typeof b.meaning === "string") {
        matchMeaning = b.meaning.toLowerCase().includes(text);
      }

      return matchWord || matchKanji || matchReading || matchMeaning;
    });

    setFilteredBookmarks(filtered);
  }, 300);

  const handleChange = (text: string) => {
    setSearch(text);
    handleSearch(text);
  };

  const handleRemoveBookmark = async (id: string | number) => {
    await removeBookmark(db, id as number);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    setFilteredBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const renderListHeader = () => {
    let text = "";

    if (loading) {
      text = "Loading bookmarks...";
    }

    if (bookmarks.length === 0) {
      text = "No bookmarks yet";
    }

    if (search && filteredBookmarks.length === 0) {
      text = "No results found";
    }

    if (text.length === 0) {
      return null;
    }

    return (
      <ThemedText textAlign="center" type="secondary">
        {text}
      </ThemedText>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Search in bookmarks",
            onChangeText: (e) => handleChange(e.nativeEvent.text),
            autoCapitalize: "none",
          },
        }}
      />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={filteredBookmarks}
        renderItem={({ index, item }) => (
          <BookmarkListItem
            item={item}
            index={index}
            total={filteredBookmarks.length}
            onRightPress={() => handleRemoveBookmark(item.id)}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderListHeader}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </>
  );
}

const ACTION_WIDTH = 60;

function BookmarkListItem({
  item,
  index,
  total,
  onRightPress,
}: {
  item: DictionaryEntry & { meaning?: string };
  index: number;
  total: number;
  onRightPress: () => void;
}) {
  const isLast = index === total - 1;

  const handleWordPress = (item: DictionaryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.id.toString(), title: item.word },
    });
  };

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={ACTION_WIDTH}
      enableTrackpadTwoFingerGesture
      renderRightActions={(_, drag, swipe) => (
        <RightAction drag={drag} swipe={swipe} onPress={onRightPress} />
      )}
    >
      <HapticTab onPress={() => handleWordPress(item)}>
        <ThemedView
          style={styles.item}
          lightColor={Colors.light.groupedBackground}
          darkColor={Colors.dark.groupedBackground}
        >
          <ThemedText type="defaultSemiBold">{item.word}</ThemedText>
          <ThemedText type="secondary">
            {item.meaning
              ? formatEn(item.meaning, "none", { truncateAll: 30 })
              : formatJp(item.reading)}
          </ThemedText>
        </ThemedView>
      </HapticTab>
      {isLast ? null : <View style={styles.separator} />}
    </ReanimatedSwipeable>
  );
}

function RightAction({
  drag,
  swipe,
  onPress,
}: {
  drag: SharedValue<number>;
  swipe: SwipeableMethods;
  onPress?: () => void;
}) {
  const bgColor = useThemeColor({}, "error");

  const styleAnimation = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: drag.value + ACTION_WIDTH }],
    };
  });

  const handlePress = () => {
    swipe.close();
    onPress?.();
  };

  return (
    <Animated.View
      style={[styleAnimation, styles.rightAction, { backgroundColor: bgColor }]}
    >
      <HapticTab onPress={handlePress}>
        <IconSymbol color={"white"} name="trash" size={24} />
      </HapticTab>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginHorizontal: 8,
  },
  rightAction: {
    alignItems: "center",
    justifyContent: "center",
    width: ACTION_WIDTH,
  },
});
