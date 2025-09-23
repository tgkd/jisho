import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
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
import {
  DictionaryEntry,
  HistoryEntry,
  WordHistoryEntry,
  KanjiHistoryEntry,
  KanjiEntry,
  WordMeaning,
} from "@/services/database";
import { deduplicateEn, formatEn, formatJp } from "@/services/parse";
import { HapticTab } from "./HapticTab";
import { ThemedText } from "./ThemedText";
import { ThemedView } from "./ThemedView";
import { IconSymbol } from "./ui/IconSymbol";

const ACTION_WIDTH = 40;

// Helper functions for type checking
function isWordHistoryEntry(item: HistoryEntry): item is WordHistoryEntry {
  return item.entryType === 'word';
}

function isKanjiHistoryEntry(item: HistoryEntry): item is KanjiHistoryEntry {
  return item.entryType === 'kanji';
}

type BaseListItemProps = {
  index: number;
  total: number;
  onPress?: () => void;
};

type HistoryVariantProps = BaseListItemProps & {
  variant: "history";
  item: HistoryEntry;
  onRemove: (item: HistoryEntry) => void;
};

type SearchVariantProps = BaseListItemProps & {
  variant: "search";
  item: DictionaryEntry;
  meanings?: WordMeaning[];
};

type KanjiVariantProps = BaseListItemProps & {
  variant: "kanji";
  item: KanjiEntry;
};

type BookmarkVariantProps = BaseListItemProps & {
  variant: "bookmark";
  item: DictionaryEntry & { meaning?: string };
  onRemove: (item: DictionaryEntry & { meaning?: string }) => void;
};

type ListItemProps =
  | HistoryVariantProps
  | SearchVariantProps
  | KanjiVariantProps
  | BookmarkVariantProps;

export const ListItem = (props: ListItemProps) => {
  const { variant, index, total, onPress } = props;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const handlePress =
    onPress ||
    (() => {
      if (variant === "history") {
        const item = props.item as HistoryEntry;
        if (isWordHistoryEntry(item)) {
          router.push({
            pathname: "/word/[id]",
            params: { id: item.wordId.toString(), title: item.word },
          });
        } else if (isKanjiHistoryEntry(item)) {
          router.navigate({
            pathname: "/word/kanji/[id]",
            params: { id: item.kanjiId.toString(), title: item.character },
          });
        }
      } else if (variant === "search") {
        const item = props.item as DictionaryEntry;
        router.push({
          pathname: "/word/[id]",
          params: { id: item.id.toString(), title: item.word },
        });
      } else if (variant === "bookmark") {
        const item = props.item as DictionaryEntry;
        router.push({
          pathname: "/word/[id]",
          params: { id: item.id.toString(), title: item.word },
        });
      } else if (variant === "kanji") {
        const item = props.item as KanjiEntry;
        router.navigate({
          pathname: "/word/kanji/[id]",
          params: { id: item.id.toString(), title: item.character },
        });
      }
    });

  const renderContent = () => {
    switch (variant) {
      case "history":
        return (
          <HistoryContent
            {...(props as HistoryVariantProps)}
            isFirst={isFirst}
            isLast={isLast}
            onPress={handlePress}
          />
        );
      case "search":
        return (
          <SearchContent
            {...(props as SearchVariantProps)}
            isFirst={isFirst}
            isLast={isLast}
            onPress={handlePress}
          />
        );
      case "bookmark":
        return (
          <BookmarkContent
            {...(props as BookmarkVariantProps)}
            isFirst={isFirst}
            isLast={isLast}
            onPress={handlePress}
          />
        );
      case "kanji":
        return (
          <KanjiContent
            {...(props as KanjiVariantProps)}
            isFirst={isFirst}
            isLast={isLast}
            onPress={handlePress}
          />
        );
    }
  };

  if (variant === "history") {
    const historyProps = props as HistoryVariantProps;
    return (
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={ACTION_WIDTH}
        enableTrackpadTwoFingerGesture
        renderRightActions={(_, drag, swipe) => (
          <RightAction
            drag={drag}
            swipe={swipe}
            onPress={() => historyProps.onRemove(historyProps.item)}
          />
        )}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
        >
          {renderContent()}
        </Animated.View>
      </ReanimatedSwipeable>
    );
  }

  if (variant === "bookmark") {
    const bookmarkProps = props as BookmarkVariantProps;
    return (
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={ACTION_WIDTH}
        enableTrackpadTwoFingerGesture
        renderRightActions={(_, drag, swipe) => (
          <RightAction
            drag={drag}
            swipe={swipe}
            onPress={() => bookmarkProps.onRemove(bookmarkProps.item)}
          />
        )}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
        >
          {renderContent()}
        </Animated.View>
      </ReanimatedSwipeable>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      {renderContent()}
    </Animated.View>
  );
};

function HistoryContent({
  item,
  isFirst,
  isLast,
  onPress,
}: {
  item: HistoryEntry;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <HapticTab onPress={onPress}>
      <ThemedView
        style={[
          styles.resultItem,
          isFirst && styles.firstRowStyle,
          isLast && styles.lastRowStyle,
        ]}
        lightColor={Colors.light.groupedBackground}
        darkColor={Colors.dark.groupedBackground}
      >
        {isWordHistoryEntry(item) ? (
          <>
            <ThemedText uiTextView={false}>
              <ThemedText type="defaultSemiBold" uiTextView={false}>
                {item.word + " "}
              </ThemedText>
              <ThemedText size="sm" uiTextView={false}>
                {formatJp(item.reading, false)}
              </ThemedText>
            </ThemedText>
            <ThemedText type="secondary" style={styles.meaning} uiTextView={false}>
              {formatEn(item.meaning, "none", { truncateAll: 45 }).replace(
                /[,;]\s*$/,
                ""
              )}
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText uiTextView={false}>
              <ThemedText type="defaultSemiBold" size="lg" uiTextView={false}>
                {item.character}
              </ThemedText>
            </ThemedText>
            <ThemedText type="secondary" style={styles.meaning} uiTextView={false}>
              {formatEn(item.meaning, "none", { truncateAll: 45 }).replace(
                /[,;]\s*$/,
                ""
              )}
            </ThemedText>
          </>
        )}
      </ThemedView>
      {!isLast ? <View style={styles.separator} /> : null}
    </HapticTab>
  );
}

function BookmarkContent({
  item,
  isFirst,
  isLast,
  onPress,
}: {
  item: DictionaryEntry & { meaning?: string };
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <>
      <HapticTab onPress={onPress}>
        <ThemedView
          style={[
            styles.resultItem,
            isFirst && styles.firstRowStyle,
            isLast && styles.lastRowStyle,
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
        {!isLast ? <View style={styles.separator} /> : null}
      </HapticTab>
    </>
  );
}

function SearchContent({
  item,
  meanings,
  isFirst,
  isLast,
  onPress,
}: {
  item: DictionaryEntry;
  meanings?: WordMeaning[];
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const iconColor = useThemeColor({}, "secondaryText");
  const details = (
    meanings && meanings.length > 0
      ? deduplicateEn(meanings.map((m) => formatEn(m.meaning, "none"))).filter(
          Boolean
        )
      : []
  )
    .join(", ")
    .replace(/[,;]\s*$/, "");

  const truncatedDetails =
    details.length > 45 ? details.substring(0, 42) + "..." : details;

  return (
    <>
      <HapticTab onPress={onPress}>
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
              <ThemedText
                type="defaultSemiBold"
                uiTextView={false}
                numberOfLines={1}
              >
                {item.word}
              </ThemedText>
              <ThemedText
                type="secondary"
                uiTextView={false}
                numberOfLines={1}
                style={styles.readingText}
              >
                {formatJp(item.reading)}
              </ThemedText>
            </View>
            <ThemedText
              type="secondary"
              uiTextView={false}
              style={styles.detailsText}
            >
              {truncatedDetails}
            </ThemedText>
          </View>
          <IconSymbol color={iconColor} name="chevron.right" size={16} />
        </ThemedView>
        {isLast ? null : <View style={styles.separator} />}
      </HapticTab>
    </>
  );
}

function KanjiContent({
  item,
  isFirst,
  isLast,
  onPress,
}: {
  item: KanjiEntry;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const iconColor = useThemeColor({}, "secondaryText");

  return (
    <>
      <HapticTab onPress={onPress}>
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
            <ThemedText style={styles.detailsText} type="secondary">
              {item.meanings ? item.meanings.join(", ") : ""}
            </ThemedText>
          </View>
          <IconSymbol color={iconColor} name="chevron.right" size={16} />
        </ThemedView>
      </HapticTab>
      {isLast ? null : <View style={styles.separator} />}
    </>
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
  resultItem: {
    flexDirection: "column",
    flexWrap: "wrap",
    padding: 12,
    gap: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.light.separator,
    marginHorizontal: 8,
  },
  firstRowStyle: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  lastRowStyle: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  rightAction: {
    alignItems: "center",
    justifyContent: "center",
    width: ACTION_WIDTH,
  },
  meaning: {
    maxWidth: "90%",
  },
  col: {
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: 0,
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
    justifyContent: "flex-start",
    gap: 8,
    width: "100%",
    overflow: "hidden",
  },
  readingText: {
    maxWidth: "50%",
    textOverflow: "ellipsis",
  },
  detailsText: {
    marginTop: 4,
    width: "100%",
    textOverflow: "ellipsis",
  },
  firstRadius: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  lastRadius: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
});
