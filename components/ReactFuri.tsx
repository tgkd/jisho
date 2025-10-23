import React from "react";
import { StyleSheet, View, type TextStyle, type ViewStyle } from "react-native";
import {
  isHiragana,
  isKana,
  isKanji,
  isKatakana,
  stripOkurigana,
  tokenize
} from "wanakana";

import { ThemedText } from "./ThemedText";




type FuriPair = [string, string];
type FuriLocation = [[number, number], string];
type FuriData = string | Record<number, string>;

interface ReactFuriNativeProps {
  word?: string;
  reading?: string;
  furi?: FuriData;
  showFuri?: boolean;
  render?: (props: { pairs: FuriPair[] }) => React.ReactElement;
  style?: ViewStyle;
  pairStyle?: ViewStyle;
  textStyle?: TextStyle;
  furiStyle?: TextStyle;
}

interface WrapperProps {
  style?: ViewStyle;
  children: React.ReactNode;
}

interface PairProps {
  style?: ViewStyle;
  children: React.ReactNode;
}

interface FuriTextProps {
  style?: TextStyle;
  children: React.ReactNode;
}

interface TextProps {
  style?: TextStyle;
  children: React.ReactNode;
}

function zip<T, U>(arr1: T[], arr2: U[]): [T, U][] {
  const length = Math.min(arr1.length, arr2.length);
  const result: [T, U][] = [];
  for (let i = 0; i < length; i++) {
    result.push([arr1[i], arr2[i]]);
  }
  return result;
}

function parseFuriString(locations = ""): FuriLocation[] {
  return locations.split(";").map((entry) => {
    const [indexes, content] = entry.split(":");
    const [start, end] = indexes.split("-").map(Number);
    return [[start, end ? end + 1 : start + 1], content];
  });
}

function parseFuriObject(locations: Record<number, string> = {}): FuriLocation[] {
  return Object.entries(locations).map(([start, content]) => [
    [Number(start), Number(start) + 1],
    content,
  ]);
}

function parseFuri(data: FuriData): FuriLocation[] {
  return typeof data === "string" ? parseFuriString(data) : parseFuriObject(data);
}

function generatePairs(word = "", furiLocs: FuriLocation[] = []): FuriPair[] {
  let prevCharEnd = 0;

  return furiLocs.reduce((pairs, [[start, end], furiText], index, source) => {
    if (start !== prevCharEnd) {
      pairs.push(["", word.slice(prevCharEnd, start)]);
    }

    pairs.push([furiText, word.slice(start, end)]);

    if (end < word.length && !source[index + 1]) {
      pairs.push(["", word.slice(end)]);
    }

    prevCharEnd = end;
    return pairs;
  }, [] as FuriPair[]);
}

function removeExtraneousKana(str = "", leading = "", trailing = "") {
  return str.replace(RegExp(`^${leading}`), "").replace(RegExp(`${trailing}$`), "");
}

function skipRedundantReadings([reading, word = ""]: [string, string]): FuriPair {
  return !reading || reading === word ? ["", word] : [reading, word];
}

function basicFuri(word = "", reading = ""): FuriPair[] {
  if (Array.from(word).every((c) => !isKana(c))) {
    return [[reading, word]];
  }

  const [bikago, okurigana] = [
    reading.slice(0, word.length - (stripOkurigana(word, { leading: true } as any) as string).length),
    reading.slice((stripOkurigana(reading, { matchKanji: word } as any) as string).length),
  ];

  const innerWordTokens = tokenize(removeExtraneousKana(word, bikago, okurigana)).map((token) =>
    typeof token === "string" ? token : token.value
  );
  let innerReadingChars: any = removeExtraneousKana(reading, bikago, okurigana);

  const kanjiOddKanaEvenRegex = RegExp(
    innerWordTokens.map((char) => (isKanji(char) ? "(.*)" : `(${char})`)).join(""),
  );

  const match = innerReadingChars.match(kanjiOddKanaEvenRegex) || [];
  innerReadingChars = match.slice(1);

  const ret = zip(innerReadingChars as string[], innerWordTokens).map(skipRedundantReadings);

  if (bikago) {
    ret.unshift(["", bikago]);
  }

  if (okurigana) {
    ret.push(["", okurigana]);
  }

  return ret;
}

function combineFuri(word = "", reading = "", furi: FuriData = ""): FuriPair[] {
  const furiLocs = parseFuri(furi);
  const isSpecialReading = furiLocs.length === 1 && Array.from(word).every(isKanji);
  const isKanaWord = Array.from(word).every(isKana);
  const isWanikaniMadness =
    Array.from(reading).some(isHiragana) && Array.from(reading).some(isKatakana);

  if (word === reading || isKanaWord) {
    return [["", word]];
  }

  if (!furi || isSpecialReading || isWanikaniMadness) {
    return basicFuri(word, reading);
  }

  return generatePairs(word, furiLocs);
}

function useFuriPairs(word?: string, reading?: string, furi?: FuriData): FuriPair[] {
  return React.useMemo(() => combineFuri(word, reading, furi), [word, reading, furi]);
}

function Wrapper({ style, children }: WrapperProps) {
  return <View style={[styles.wrapper, style]}>{children}</View>;
}

function Pair({ style, children }: PairProps) {
  return <View style={[styles.pair, style]}>{children}</View>;
}

function FuriText({ style, children }: FuriTextProps) {
  return <ThemedText style={[styles.furigana, style]}>{children}</ThemedText>;
}

function Text({ style, children }: TextProps) {
  return <ThemedText style={style}>{children}</ThemedText>;
}

export function ReactFuriNative({
  word = "",
  reading = "",
  furi = "",
  showFuri = true,
  render,
  style,
  pairStyle,
  textStyle,
  furiStyle,
}: ReactFuriNativeProps) {
  const pairs = useFuriPairs(word, reading, furi);

  if (render) {
    return render({ pairs });
  }

  return (
    <Wrapper style={style}>
      {pairs.map(([furigana, text], index) => (
        <Pair key={`${text}-${index}`} style={pairStyle}>
          {showFuri && furigana && <FuriText style={furiStyle}>{furigana}</FuriText>}
          <Text style={textStyle}>{text}</Text>
        </Pair>
      ))}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  pair: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    marginHorizontal: 1,
  },
  furigana: {
    opacity: 0.9,
    marginBottom: 2,
  },
});

export { Wrapper, Pair, FuriText as Furi, Text, useFuriPairs, combineFuri };
