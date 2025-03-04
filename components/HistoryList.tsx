import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import { SectionList, StyleSheet, View } from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  getHistory,
  HistoryEntry,
  removeHistoryById,
} from "@/services/database";
import { formatEn } from "@/services/parse";
import { HapticTab } from "./HapticTab";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { IconSymbol } from "./ui/IconSymbol";

const ACTION_WIDTH = 40;

export function HistoryList() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);

  const groupedByMonth = useMemo(() => {
    const grouped: Record<string, HistoryEntry[]> = {};

    for (const item of historyItems) {
      const title = new Date(item.createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: undefined,
      });

      if (!grouped[title]) {
        grouped[title] = [];
      }
      grouped[title].push(item);
    }

    return Object.entries(grouped).map(([key, value]) => ({
      title: key,
      data: value,
    }));
  }, [historyItems]);

  useFocusEffect(
    useCallback(() => {
      const loadHistory = async () => {
        try {
          const history = await getHistory(db);
          setHistoryItems(history);
        } catch (error) {
          console.error("Failed to load history:", error);
        }
      };

      loadHistory();
    }, [])
  );

  const handleRemoveHistoryItem = (item: HistoryEntry) => async () => {
    console.log("Removing history item:", item);

    try {
      await removeHistoryById(db, item.id);
      setHistoryItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (error) {
      console.error("Failed to remove history item:", error);
    }
  };

  const handleWordPress = async (item: HistoryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.wordId.toString(), title: item.word },
    });
  };

  const renderHistoryItem = ({
    item,
    index,
    section,
  }: {
    item: HistoryEntry;
    index: number;
    section: { data: HistoryEntry[] };
  }) => {
    const isFirst = index === 0;
    const isLast = index === section.data.length - 1;

    return (
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={ACTION_WIDTH}
        enableTrackpadTwoFingerGesture
        onActivated={(e) => console.log("onSwipeableOpen", e.nativeEvent.state)}
        renderRightActions={(_, drag, swipe) => (
          <RightAction
            drag={drag}
            swipe={swipe}
            onPress={handleRemoveHistoryItem(item)}
          />
        )}
      >
        <HapticTab onPress={() => handleWordPress(item)}>
          <ThemedView
            style={[
              styles.resultItem,
              isFirst && styles.firstRowStyle,
              isLast && styles.lastRowStyle,
            ]}
            lightColor={Colors.light.groupedBackground}
            darkColor={Colors.dark.groupedBackground}
          >
            <ThemedText type="defaultSemiBold">{item.word}</ThemedText>
            <ThemedText type="secondary">
              {formatEn(item.meaning, "none", { truncateAll: 30 })}
            </ThemedText>
          </ThemedView>
          {!isLast ? <View style={styles.separator} /> : null}
        </HapticTab>
      </ReanimatedSwipeable>
    );
  };

  return (
    <SectionList
      contentInsetAdjustmentBehavior="automatic"
      sections={groupedByMonth}
      keyExtractor={(i) => i.id.toString()}
      renderItem={renderHistoryItem}
      renderSectionHeader={({ section: { title } }) => (
        <ThemedText style={styles.sectionTitle} type="secondary">
          {title}
        </ThemedText>
      )}
      maxToRenderPerBatch={5}
      windowSize={5}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      removeClippedSubviews
      initialNumToRender={5}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.container}
    />
  );
}

function RightAction({
  drag,
  swipe,
  onPress,
}: {
  drag: SharedValue<number>;
  swipe: SwipeableMethods;
  onPress: () => void;
}) {
  const iconColor = useThemeColor({}, "error");

  const styleAnimation = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: drag.value + ACTION_WIDTH }],
    };
  });

  const handlePress = () => {
    swipe.close();
    onPress();
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
    paddingBottom: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  firstRowStyle: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  lastRowStyle: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },

  rightAction: {
    alignItems: "center",
    justifyContent: "center",
    width: ACTION_WIDTH,
  },

  sectionTitle: {
    marginVertical: 8,
    paddingHorizontal: 8,
  },
});
