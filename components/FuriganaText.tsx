import React from "react";
import { View, StyleSheet, TextStyle } from "react-native";

import { type FuriPair, combineFuri } from "../services/parse";
import { ThemedText } from "./ThemedText";

type BaseProps = {
  word: string;
  showFuri?: boolean;
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
  showFuri = true,
  textStyle = {},
  ...props
}: Props) {
  const pairs = React.useMemo(
    () => combineFuri(word, reading, furi),
    [word, reading, furi]
  );

  return (
    <ThemedText style={[textStyle, styles.wrapper]} {...props}>
      {pairs.map(([ft, t], idx) => (
        <View key={t + idx} style={styles.pair}>
          {showFuri ? (
            <ThemedText size="xs" style={textStyle}>{ft}</ThemedText>
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
