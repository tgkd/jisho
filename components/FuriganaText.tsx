import React from "react";
import { StyleSheet, TextStyle, View, type ViewStyle } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";

import type { FuriganaSegment } from "@/services/database";
import { SETTINGS_KEYS } from "@/services/storage";
import { formatJp } from "../services/parse";
import { ThemedText } from "./ThemedText";

type Props = {
  word: string;
  reading: string;
  textStyle?: TextStyle;
  furiganaStyle?: TextStyle;
  pairStyle?: ViewStyle;
  style?: ViewStyle;
  segments?: FuriganaSegment[];
};

/**
 * Displays Japanese text with furigana annotations in React Native, mirroring HTML ruby layout.
 *
 * @param {Props} props - Component props including the word, optional furigana data, and styling.
 * @returns {JSX.Element} Rendered furigana content.
 */
export function FuriganaText({
  word,
  reading,
  textStyle = {},
  furiganaStyle,
  pairStyle,
  style,
  segments = [],
}: Props) {
  const [showFurigana = true] = useMMKVBoolean(SETTINGS_KEYS.SHOW_FURIGANA);
  const baseTextStyles = React.useMemo(() => {
    const fontSize =
      typeof textStyle?.fontSize === "number" ? textStyle.fontSize : undefined;
    const lineHeight =
      typeof textStyle?.lineHeight === "number"
        ? textStyle.lineHeight
        : fontSize
        ? Math.round(fontSize * 1.2)
        : undefined;

    return [lineHeight ? { lineHeight } : null, textStyle];
  }, [textStyle]);

  const furiganaStyles = React.useMemo(() => {
    const fontSize =
      typeof furiganaStyle?.fontSize === "number"
        ? furiganaStyle.fontSize
        : undefined;
    const lineHeight =
      typeof furiganaStyle?.lineHeight === "number"
        ? furiganaStyle.lineHeight
        : fontSize
        ? Math.round(fontSize * 1.2)
        : 16;

    return [styles.furigana, lineHeight ? { lineHeight } : null, furiganaStyle];
  }, [furiganaStyle]);

  const pairs = React.useMemo(() => {
    return segments.map((segment): [string, string] => [
      segment.rt || "",
      segment.ruby,
    ]);
  }, [segments]);

  if (pairs.length === 0) {
    return <ThemedText style={baseTextStyles}>{word}</ThemedText>;
  }

  return (
    <View style={[styles.container, !showFurigana && styles.containerNoFuri]}>
      <View style={[styles.wrapper, style]}>
        {pairs.map(([furigana, text], idx) => (
          <View
            key={`${text}-${idx}`}
            style={[styles.pair, !showFurigana && styles.pairNoFuri, pairStyle]}
          >
            {showFurigana && furigana ? (
              <ThemedText size="xs" style={furiganaStyles}>
                {furigana}
              </ThemedText>
            ) : null}
            <ThemedText style={baseTextStyles}>{text}</ThemedText>
          </View>
        ))}
      </View>
      {!showFurigana && reading ? (
        <ThemedText type="secondary">{formatJp(reading, true)}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  containerNoFuri: {
    alignItems: "flex-start",
  },
  wrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  pair: {
    flexDirection: "column",
    alignItems: "center",
    marginHorizontal: 1,
  },
  pairNoFuri: {
    justifyContent: "flex-end",
  },
  furigana: {
    marginBottom: 2,
  },
});
