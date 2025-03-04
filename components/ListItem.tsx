import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { DictionaryEntry, WordMeaning } from "@/services/database";
import { HapticTab } from "./HapticTab";
import { IconSymbol } from "./ui/IconSymbol";
import { deduplicateEn, formatEn, formatJp } from "@/services/parse";

const ACTION_WIDTH = 40;

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
  const isFirst = index === 0;
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
          style={[
            styles.resultItem,
            isFirst && styles.firstRadius,
            isLast && styles.lastRadius,
          ]}
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

export function BookmarkListItem({
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
            styles.resultItem,
            isFirst && styles.firstRadius,
            isLast && styles.lastRadius,
          ]}
          lightColor={Colors.light.groupedBackground}
          darkColor={Colors.dark.groupedBackground}
        >
          <ThemedText type="defaultSemiBold">{item.word}</ThemedText>
          <ThemedText type="secondary">
            {item.meaning
              ? formatEn(item.meaning, "rows")
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
  resultItem: {
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
});
