import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { HapticTab } from "@/components/HapticTab";
import { ThemedText } from "@/components/ThemedText";
import { getKanji, KanjiEntry } from "@/services/database";

export function KanjiDetails({ character }: { character: string }) {
  const router = useRouter();
  const db = useSQLiteContext();
  const [details, setDetails] = useState<KanjiEntry | null>(null);

  useEffect(() => {
    const loadKanjiDetails = async () => {
      const result = await getKanji(db, character);
      setDetails(result);
    };
    loadKanjiDetails();
  }, [character, db]);

  const goToKanji = () => {
    if (!details) {
      return;
    }

    router.push({
      pathname: "/word/kanji/[id]",
      params: { id: details.id.toString(), title: details.character },
    });
  };

  if (!details) {
    return null;
  }

  return (
    <View style={styles.kanjiDetails}>
      <View style={styles.row}>
        <HapticTab onPress={goToKanji} hitSlop={12}>
          <ThemedText type="subtitle">{details.character}</ThemedText>
        </HapticTab>
        <ThemedText size="sm" style={styles.kanjiDesc}>
          {details.meanings?.join(", ")}
        </ThemedText>
      </View>
      {details.onReadings && (
        <ThemedText type="secondary" size="sm">
          {"On: " + details.onReadings.join(", ")}
        </ThemedText>
      )}
      {details.kunReadings && (
        <ThemedText type="secondary" size="sm">
          {"Kun: " + details.kunReadings.join(", ")}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kanjiDetails: {
    paddingVertical: 4,
    gap: 2,
  },
  kanjiDesc: {
    maxWidth: "90%",
  },
});
