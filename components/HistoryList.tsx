import { StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  FadeIn,
  FadeOut,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { HistoryEntry } from "@/services/database";
import { formatEn } from "@/services/parse";
import { HapticTab } from "./HapticTab";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { IconSymbol } from "./ui/IconSymbol";

const ACTION_WIDTH = 40;

export const HistoryListItem = ({
  item,
  index,
  list,
  onRemove,
  onPress,
}: {
  list: HistoryEntry[];
  item: HistoryEntry;
  index: number;
  onRemove: (item: HistoryEntry) => void;
  onPress: (item: HistoryEntry) => void;
}) => {
  const isFirst = index === 0;
  const isLast = index === list.length - 1;

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={ACTION_WIDTH}
      enableTrackpadTwoFingerGesture
      renderRightActions={(_, drag, swipe) => (
        <RightAction drag={drag} swipe={swipe} onPress={() => onRemove(item)} />
      )}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
      >
        <HapticTab onPress={() => onPress(item)}>
          <ThemedView
            style={[
              styles.resultItem,
              isFirst && styles.firstRowStyle,
              isLast && styles.lastRowStyle,
            ]}
            lightColor={Colors.light.groupedBackground}
            darkColor={Colors.dark.groupedBackground}
          >
            <Text numberOfLines={1}>
              <ThemedText type="defaultSemiBold">{item.word + " "}</ThemedText>
              <ThemedText size="sm">{item.reading}</ThemedText>
            </Text>
            <ThemedText type="secondary" style={styles.meaning}>
              {formatEn(item.meaning, "none", { truncateAll: 30 })}
            </ThemedText>
          </ThemedView>
          {!isLast ? <View style={styles.separator} /> : null}
        </HapticTab>
      </Animated.View>
    </ReanimatedSwipeable>
  );
};

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
    flexDirection: "column",
    flexWrap: "wrap",
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
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
  meaning: {
    maxWidth: "90%",
  },
});
