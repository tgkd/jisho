import { router, Stack, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import * as wanakana from "wanakana";

import { FlashList } from "@shopify/flash-list";
import { StyleSheet, View } from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { Colors } from "@/constants/Colors";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  DictionaryEntry,
  getBookmarks,
  removeBookmark,
} from "@/services/database";
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
            hideWhenScrolling: false,
          },
        }}
      />
      <FlashList
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
        contentContainerStyle={styles.scrollContainer}
        ListHeaderComponent={renderListHeader}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </>
  );
}

const ACTION_WIDTH = 40;

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
  const iconColor = useThemeColor({}, "secondaryText");
  const isFirst = index === 0;
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
          style={[
            styles.item,
            isFirst && styles.firstRadius,
            isLast && styles.lastRadius,
          ]}
          lightColor={Colors.light.groupedBackground}
          darkColor={Colors.dark.groupedBackground}
        >
          <ThemedText uiTextView={false}>
            <ThemedText type="defaultSemiBold" uiTextView={false}>
              {item.word + " "}
            </ThemedText>
            <ThemedText size="sm" uiTextView={false}>
              {formatJp(item.reading, false)}
            </ThemedText>
          </ThemedText>
          <ThemedText
            type="secondary"
            style={styles.meaning}
            uiTextView={false}
          >
            {item.meaning
              ? formatEn(item.meaning, "none")
              : formatJp(item.reading)}
          </ThemedText>
        </ThemedView>

        {isLast ? null : <View style={styles.separator} />}
      </HapticTab>
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
  const iconColor = useThemeColor({}, "error");

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
    <Animated.View style={[styleAnimation, styles.rightAction]}>
      <HapticTab onPress={handlePress}>
        <IconSymbol color={iconColor} name="trash.circle.fill" size={32} />
      </HapticTab>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  scrollContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  col: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    maxWidth: "90%",
    flexWrap: "wrap",
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  item: {
    flexDirection: "column",
    flexWrap: "wrap",
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
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

  rightAction: {
    alignItems: "center",
    justifyContent: "center",
    width: ACTION_WIDTH,
  },
  meaning: {
    maxWidth: "90%",
  },
});
