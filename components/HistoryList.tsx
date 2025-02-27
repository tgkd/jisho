import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { FlatList } from "react-native-gesture-handler";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  interpolateColor,
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
import { HapticTab } from "./HapticTab";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { IconSymbol } from "./ui/IconSymbol";

const ACTION_WIDTH = 40;

export function HistoryList() {
  const router = useRouter();
  const db = useSQLiteContext();
  const backgroundColor = useThemeColor({}, "background");
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);

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
      params: { id: item.id.toString(), title: item.word },
    });
  };

  const renderHistoryItem = ({
    item,
    index,
  }: {
    item: HistoryEntry;
    index: number;
  }) => {
    const isFirst = index === 0;
    const isLast = index === historyItems.length - 1;
    return (
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={ACTION_WIDTH}
        enableTrackpadTwoFingerGesture
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
            <ThemedText type="secondary">{`【${item.reading}】`}</ThemedText>
          </ThemedView>
          {!isLast ? <View style={styles.separator} /> : null}
        </HapticTab>
      </ReanimatedSwipeable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={historyItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderHistoryItem}
        maxToRenderPerBatch={5}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews
        initialNumToRender={5}
      />
    </ThemedView>
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
    flex: 1,
    marginHorizontal: 16,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
});
