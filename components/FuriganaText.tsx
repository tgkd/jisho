import React, { useEffect, useState } from "react";
import { StyleSheet, TextStyle, View } from "react-native";
import { useMMKVBoolean } from "react-native-mmkv";

import { SETTINGS_KEYS } from "@/services/storage";
import { combineFuri } from "../services/parse";
import { ThemedText } from "./ThemedText";

type BaseProps = {
  word: string;
  textStyle?: TextStyle;
  [key: string]: any;
};

type Props =
  | (BaseProps & {
      reading: string;
    })
  | (BaseProps & {
      furi: string | Record<string, string>;
    });

export function FuriganaText({
  word,
  reading,
  furi,
  textStyle = {},
  ...props
}: Props) {
  const [showFurigana] = useMMKVBoolean(SETTINGS_KEYS.SHOW_FURIGANA);

  const pairs = React.useMemo(
    () => combineFuri(word, reading, furi),
    [word, reading, furi]
  );

  return (
    <ThemedText style={[textStyle, styles.wrapper]} {...props}>
      {pairs.map(([ft, t], idx) => (
        <View key={t + idx} style={styles.pair}>
          {showFurigana ? (
            <ThemedText size="xs" style={textStyle}>
              {ft}
            </ThemedText>
          ) : null}
          <ThemedText style={textStyle}>{t}</ThemedText>
        </View>
      ))}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  pair: {
    flexDirection: "column",
    alignItems: "center",
  },
});
