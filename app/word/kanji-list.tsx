import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

import { KanjiDetails } from "@/components/KanjiList";

export default function KanjiListScreen() {
  const params = useLocalSearchParams<{ kanji: string }>();
  const kanjiChars = params.kanji?.split(",") || [];

  return (
    <ScrollView
      contentContainerStyle={styles.kanjiList}
      contentInsetAdjustmentBehavior="automatic"
    >
      {kanjiChars.map((char, idx) => (
        <KanjiDetails key={idx} character={char} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kanjiList: {
    padding: 16,
    gap: 4,
  },
});
