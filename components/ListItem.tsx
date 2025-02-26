import { router } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { DictionaryEntry } from "@/services/database";
import { Colors } from "@/constants/Colors";
import { HapticTab } from "./HapticTab";

/*
{
  "id": 106891,
  "word": "すんばらしい",
  "reading": [
    "すばらしい",
    "すんばらしい"
  ],
  "reading_hiragana": "すばらしい",
  "kanji": "素晴らしい;素晴しい;素薔薇しい",
  "meanings": [
    {
      "meaning": "wonderful;splendid;magnificent",
      "part_of_speech": "adj-i",
      "field": "",
      "misc": "",
      "info": null
    }
  ]
}

*/

export function ListItem({
  item,
  index,
  total,
}: {
  item: DictionaryEntry;
  index: number;
  total: number;
}) {
  const isFirst = index === 0;
  const isLast = index === total - 1;

  const handleWordPress = (item: DictionaryEntry) => {
    router.push({
      pathname: "/word/[id]",
      params: { id: item.id.toString(), title: item.word },
    });
  };
  const meanings = item.meanings
    .map((m) => ({
      text: m.meaning.replaceAll(";", ", "),
      partOfSpeech: m.part_of_speech,
    }))
    .filter((m) => m.text.length > 0);

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
            <ThemedText type="secondary">
              {`【${item.reading.join(", ")}】`}
            </ThemedText>
          </View>
          {meanings.map((m, idx) => (
            <View key={idx}>
              <ThemedText type="secondary">{m.text}</ThemedText>
            </View>
          ))}
        </ThemedView>
      </HapticTab>
      {isLast ? null : <View style={styles.separator} />}
    </>
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
});
